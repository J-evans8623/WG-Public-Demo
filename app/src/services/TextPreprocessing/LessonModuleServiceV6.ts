/**
 * @file app/src/services/TextPreprocessing/LessonModuleServiceV4Fast.ts
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
  generateUnitSyllabus,
  scoreUnitSyllabus,
  generateFinalizedSyllabusv2          // non-blocking metadata util
} from './aiTextPreProcessingV32';
import { nextKey2, Key2 }                 from './TextKeys';
import {
  PrimaryNode,
  rank,
  UnitContext
} from './LessonModuleTypes';
import AIController                       from '../../controllers/aiController';
import { callWithRetry } from './callWithRetry';

/* ------------------------------------------------------------------ */
/* INTERNAL • structural work only (Stages A-C)                       */
/* ------------------------------------------------------------------ */
async function structuralPass(
  fullText   : string,
  documentID : string,
  fileId     : string,
  pageCount  : number
): Promise<PrimaryNode[]> {
  /* fire-and-forget persistence */
  void persistLessonContext(fullText, documentID, fileId);

  /* ---------- Stage A : split to units ----------------------------- */
  let units = 1;
  let order :rank[]= ['A','B','C']
  if (pageCount >= 5 && pageCount <= 15) units = 2;
  else if (pageCount > 10)               units = 3;

  const slice = Math.ceil(fullText.length / units);
  const contexts: UnitContext[] = [];
  for (let i = 0; i < units; i++) {
    const start = i * slice;
    const end   = Math.min(start + slice, fullText.length);
    contexts.push({
      unit_id : i,
      unit_text: fullText.substring(start, end),
      syllabus : undefined,
      rating   : undefined,
      prunedStubs: [],
      order : order[i],
    });
  }

  /* ---------- Stage B : generate syllabus (parallel) --------------- */
  await Promise.all(
    contexts.map(async ctx => {
      ctx.syllabus = await generateUnitSyllabus({
        unit_id: ctx.unit_id,
        unit_text: ctx.unit_text
      });
    })
  );

  /* ---------- Stage C : score + prune (parallel) ------------------- */
  await Promise.all(
    contexts.map(async ctx => {
      ctx.rating = await scoreUnitSyllabus(
        { unit_id: ctx.unit_id, unit_text: ctx.unit_text },
        ctx.syllabus!
      );

      /* build pruned stubs */
      const stubs: PrimaryNode[] = [];
      let idCntr = ctx.unit_id * 1000;
      ctx.rating!.primary_subtopics.forEach(ps => {
        const kept = ps.secondary_topics.filter(st => st.score >= 0); // keep all 
        if (!kept.length) return;
        const parentId = nextKey2(idCntr++) as Key2;
        stubs.push({
          node_id: parentId,
          unit_text: ctx.unit_text,
          title: ps.title,
          Learning_Objectives: ps.Learning_Objectives,
          LessonOutline: ps.LessonOutline,
          depth2_subtopics: kept.map(k => ({ title: k.title, Learning_Objectives: k.Learning_Objectives, LessonOutline: k.LessonOutline })),
          lessonOrder:ctx.order,
        });
      });

            // ** Debug log: print only title & lessonOrder of each stub **
      console.log(
        '[LessonModuleServiceV6.ts][3939] prunedStubs for unit',
        ctx.unit_id,
        stubs.map(s => ({ title: s.title, lessonOrder: s.lessonOrder }))
      );

      ctx.prunedStubs = stubs;
    })
  );

  

  /* ---------- flatten hierarchy ------------------------------------ */
  return contexts.flatMap(c => c.prunedStubs!);
}

/* ------------------------------------------------------------------ */
/* PUBLIC • identical signature to old V4                             */
/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */
/*  generateLessonFromSegment – minimal, uses raw model JSON          */
/* ------------------------------------------------------------------ */
export async function generateLessonFromSegment(
  segment      : string,
  documentID   : string,
  sourceFileId : string,
  pageCount    : number
): Promise<unknown /* lessonSchema */> {

  /* 1️⃣  Kick off intro / LO generation (don’t block yet) */
  const metaPromise = generateFinalizedSyllabusv2(segment);

  /* 2️⃣  Build primary / secondary stubs                       */
  console.time('v4fast-structural');
  const hierarchy = await structuralPass(
    segment, documentID, sourceFileId, pageCount
  );

  /* 3️⃣  Enrich each primary node in parallel                  */
  const lessonTitle = (await metaPromise).LessonTitle;
  const enriched  = await Promise.all(
    hierarchy.map(root =>
      callWithRetry(() =>
        AIController.generateSubtreeLesson(root, lessonTitle)
      )
    )
  );
  console.timeEnd('v4fast-structural');

  /* 4️⃣  Wait for metadata (intro + learning objective)         */
  const meta = await metaPromise;   // { LessonTitle, Introduction, LearningObjectives }

  /* 5️⃣  Collect *every* question into one quiz object          */
  const questions = enriched.flatMap(
    n => Array.isArray(n.quiz?.questions) ? n.quiz.questions : []
  );

  const combinedQuiz = {
    id       : meta.LessonTitle.replace(/\s+/g, '_').toLowerCase(),
    title    : `${meta.LessonTitle} Quiz`,
    questions
  };

  /* 6️⃣  Re-assemble exactly the lessonSchema the FE expects    */
  const payload = {
    main_topic : {
      title               : meta.LessonTitle,
      introduction        : meta.Introduction,
      learning_objectives : [meta.LearningObjectives],   // ← the *only* tweak
      primary_subtopics   : enriched,                    // raw model output
      quiz                : combinedQuiz
    }
  };


  return payload;
}
