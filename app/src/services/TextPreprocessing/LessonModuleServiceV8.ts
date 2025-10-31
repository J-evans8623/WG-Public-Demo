/**
 * @file app/src/services/TextPreprocessing/LessonModuleServiceV8.ts
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
  generateBatchedUnitSyllabus,        
} from './aiTextPreProcessingV33';
import {
  secondaryNode,
} from './LessonModuleTypes';
import AIController                       from '../../controllers/aiController';
import { callWithRetry } from './callWithRetry';
import UsageTracker from '../../services/UsageTracker'; 

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
    CourseTitle:string;
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
  pageCount: number,
   usageTracker?: UsageTracker  
): Promise<BatchedResult> {
  console.log('[LessonModuleServiceV7.ts][3001] structuralPass START');
  // fire-and-forget persistence
  void persistLessonContext(segmentText.join("\n\n"), documentID, fileId);

  // determine topic counts
  let topicAmount : string = '2';
  if (pageCount >= 5 && pageCount <= 15) topicAmount = '3 to 4';
  else if (pageCount > 15) topicAmount = '5 to 6';
  const max = topicAmount;

  // single Gemini call for syllabus + metadata
  console.log('[LessonModuleServiceV7.ts][3002] Calling generateBatchedUnitSyllabus', { topicAmount, max });
  const batched = await generateBatchedUnitSyllabus(segmentText.join("\n\n"), topicAmount, pageCount,  usageTracker);
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
      Introduction: batched.Introduction,
      CourseTitle: batched.CourseTitle,
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
  pageCount    : number,
  usageTracker?: UsageTracker 
): Promise<unknown /* lessonSchema */> {

console.log('[LessonModuleServiceV7.ts][6001] START generateLessonFromSegment', {
    segmentLength: segment.length,
    totalPages: FullTextArray.length
  });

  /* 2️⃣  Build primary / secondary stubs                       */
  console.time('v4fast-structural');
  const { metadata, nodes } = await structuralPass(segment, documentID, sourceFileId, pageCount, usageTracker);

  // batch enrichment
  console.log('[LessonModuleServiceV7.ts][3006] Calling AIController.generateSubtreeLesson', {
    lessonTitle: metadata.LessonTitle,
    nodesCount: nodes.length
  });

    // 1️⃣ Build per-node enrichment promises
  const enrichmentPromises = nodes.map((node, idx) => {
    // Adjust 1-based pageSequence to 0-based and extract text pages
    const selectedPages = node.pageSequence.map(p => FullTextArray[p - 1]);
    const LessonSegment = selectedPages.join('\n\n');

        // ⇨ NEW: compute raw words, shrink to 60%, then divide by (# subtopics)
    const rawWordCount = selectedPages
      .join(' ')
      .split(/\s+/)
      .filter(Boolean)
      .length;
    const shrinkFactor = 0.5;
    const subtopicCount = 1 + node.depth2_subtopics.length;
    const maxWordsPerSubtopic = Math.floor((rawWordCount * shrinkFactor) / subtopicCount);
    console.log('[LessonModuleServiceV8.ts][7001] Building LessonSegment for node', {
      nodeIndex: idx,
      title: node.title,
      pages: node.pageSequence,
      rawWords: rawWordCount,
        shrinked: rawWordCount * shrinkFactor,
        subtopicCount,
        maxWordsPerSubtopic
    });

    let maxWordCount = Math.max(150, Math.min(maxWordsPerSubtopic, 400));

    // Invoke V3 on this single-node slice
    return callWithRetry(() =>
      AIController.generateSubtreeLessonV3([node], metadata.LessonTitle, LessonSegment, maxWordCount,  usageTracker)
    );
});

    // 2️⃣ Execute all V3 calls in parallel
  const results = await Promise.all(enrichmentPromises);
  console.log('[LessonModuleServiceV8.ts][7002] All generateSubtreeLessonV3 calls completed', {
    resultsCount: results.length
  });



  console.timeEnd('v4fast-structural');


   const enriched = results.flatMap(res => res.primary_subtopics);
  console.log('[LessonModuleServiceV8.ts][7003] Flattened enriched subtopics', {
    enrichedCount: enriched.length
  });


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
      CourseTitle: metadata.CourseTitle,
    }
  };


  console.log(`XXX32 lessondata: ${JSON.stringify(payload)}`);

  return payload;
}
