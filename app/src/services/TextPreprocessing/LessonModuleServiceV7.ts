/**
 * @file app/src/services/TextPreprocessing/LessonModuleServiceV7t.ts
 * @description
 *   Optimised version of LessonModuleServiceV4 that overlaps global-metadata
 *   generation with structural work.  External API remains identical:
 *     generateLessonFromSegment(
 *        segment, documentID, sourceFileId, pageCount
 *     ) ➜ Promise<lessonSchema JSON>
 *
 *   Differences from the original V4:
 *     • Stage-D call to generateFinalizedSyllabus *removed* from processDocument.
 *     • generateFinalizedSyllabusv2(segment) is kicked off up-front and awaited
 *       only when merging, so the LLM can work in parallel.
 *     • No more “combined syllabus” construction – it was only needed for
 *       the old metadata prompt.
 */

import { persistLessonContext }            from './persistLessonContext';
import {
  generateBatchedUnitSyllabus,        // non-blocking metadata util
} from './aiTextPreProcessingV33';
import {
  secondaryNode,
} from './LessonModuleTypes';
import AIController                       from '../../controllers/aiController';
import { callWithRetry } from './callWithRetry';


interface PrimaryNode {
  title: string; // primary subtopic title goes here
  Learning_Objectives:string;
  LessonOutline:string;
  depth2_subtopics: secondaryNode[]; // secondary topic goes here
  lessonOrder: Number;
  pageSequence: number[];
}


interface BatchedResult {
  metadata: {
    LessonTitle: string;
    Introduction: string;
  };
  nodes: PrimaryNode[];
}


/* ------------------------------------------------------------------ */
/* INTERNAL • structural work only (Stages A-C)                       */
/* ------------------------------------------------------------------ */
/**
 * INTERNAL • structural wrapper
 * - Persists context
 * - Calls Gemini once for syllabus + metadata
 * - Maps into PrimaryNode[]
 */


async function structuralPass(
  segmentText: string[],
  documentID: string,
  fileId: string,
  pageCount: number
): Promise<BatchedResult> {
  console.log('[LessonModuleServiceV7.ts][3001] structuralPass START');
  // fire-and-forget persistence
  void persistLessonContext(segmentText.join("\n\n"), documentID, fileId);

  // determine topic counts
  let topicAmount = 2;
  if (pageCount >= 5 && pageCount <= 15) topicAmount = 4;
  else if (pageCount > 15) topicAmount = 6;
  const max = topicAmount;

  // single Gemini call for syllabus + metadata
  console.log('[LessonModuleServiceV7.ts][3002] Calling generateBatchedUnitSyllabus', { topicAmount, max });
  const batched = await generateBatchedUnitSyllabus(segmentText.join("\n\n"), topicAmount, max);
  console.log(
    '[LessonModuleServiceV7.ts][3003] Received batched syllabus',
    { title: batched.LessonTitle, count: batched.unit_syllabus.length }
  );

  // map to PrimaryNode[]
  const nodes: PrimaryNode[] = [];
  for (const ps of batched.unit_syllabus) {
    console.log('[LessonModuleServiceV7.ts][3005] Mapping node index', { pageSequence: ps.relevantPages });
    nodes.push({
      title: ps.Title,
      Learning_Objectives: ps.Learning_Objectives,
      LessonOutline: ps.LessonOutline,
      depth2_subtopics: ps.SecondarySubtopic.map(s => ({
        title: s.Title,
        Learning_Objectives: s.Learning_Objectives,
        LessonOutline: s.LessonOutline
      })),
      lessonOrder: ps.ChronologicalOrder,
      pageSequence: ps.relevantPages
    });
  }

  console.log(
    '[LessonModuleServiceV7.ts][3004] structuralPass COMPLETE',
    { nodesCount: nodes.length }
  );
  return {
    metadata: {
      LessonTitle: batched.LessonTitle,
      Introduction: batched.Introduction
    },
    nodes
  };
}

/* ------------------------------------------------------------------ */
/* PUBLIC • identical signature to old V4                             */
/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */
/*  generateLessonFromSegment – minimal, uses raw model JSON          */
/* ------------------------------------------------------------------ */
export async function generateLessonFromSegment(
  FullTextArray: string[],
  segment      : string[],
  documentID   : string,
  sourceFileId : string,
  pageCount    : number
): Promise<unknown /* lessonSchema */> {

console.log('[LessonModuleServiceV7.ts][6001] START generateLessonFromSegment', {
    segmentLength: segment.length,
    totalPages: FullTextArray.length
  });

  /* 2️⃣  Build primary / secondary stubs                       */
  console.time('v4fast-structural');
  const { metadata, nodes } = await structuralPass(segment, documentID, sourceFileId, pageCount);

  // batch enrichment
  console.log('[LessonModuleServiceV7.ts][3006] Calling AIController.generateSubtreeLesson', {
    lessonTitle: metadata.LessonTitle,
    nodesCount: nodes.length
  });

  const LessonSegment = segment.join("\n\n")
   // Todo : What should I do with the code below??? Is all  of this data handling here absolutely necessary ???
  const {primary_subtopics: enriched, citations:global_citations }  = await callWithRetry(() =>
        AIController.generateSubtreeLessonV2(nodes, metadata.LessonTitle, LessonSegment)
      );

  console.timeEnd('v4fast-structural');


  /* 5️⃣  Collect *every* question into one quiz object          */
  const questions = enriched.flatMap(
    n => Array.isArray(n.quiz?.questions) ? n.quiz.questions : []
  );

  const combinedQuiz = {
    title    : `${metadata.LessonTitle} Quiz`,
    questions
  };

  /* 6️⃣  Re-assemble exactly the lessonSchema the FE expects    */
  const payload = {
    main_topic : {
      title               : metadata.LessonTitle,
      introduction        : metadata.Introduction,  
      primary_subtopics   : enriched,                    
      quiz                : combinedQuiz,
      global_citations
    }
  };


  console.log(`XXX32 lessondata: ${JSON.stringify(payload)}`);

  return payload;
}
