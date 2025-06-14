/**
 * @file app/src/services/TextPreprocessing/LessonModuleServiceV5.ts
 * @description
 *   Non-blocking implementation: intro/LO generation (`generateFinalizedSyllabusv2`)
 *   now starts in parallel with unit processing.  The pipeline waits for the
 *   result only after all unit lessons are ready for the final merge.
 */

import { persistLessonContext }          from './persistLessonContext';
import { generateFinalizedSyllabusv2 }   from './aiTextPreProcessingV3';
import { mergeToLessonSchema }           from './mergeToLessonSchema';
import { unitLessonPipeline }            from './LessonModulePipeline';
import { PrimaryNode }                   from './LessonModuleTypes';

/* ------------------------------------------------------------------ */
/* INTERNAL: split module text → run unit pipelines                   */
/* ------------------------------------------------------------------ */
async function processDocument(
  fullText : string,
  sourceId : string,
  pgCount  : number,
  titleP   : Promise<string>
): Promise<PrimaryNode[]> {
  /* – determine unit count by pages – */
  let units = 1;
  if (pgCount >= 5 && pgCount <= 10) units = 2;
  else if (pgCount > 10)            units = 3;

  const slice = Math.ceil(fullText.length / units);
  const texts: string[] = [];
  for (let i = 0; i < units; i++) {
    const start = i * slice;
    texts.push(fullText.substring(start, Math.min(start + slice, fullText.length)));
  }

  /* – run every unit pipeline in parallel – */
  const nested = await Promise.all(
    texts.map((txt, idx) => unitLessonPipeline(txt, idx, titleP))
  );

  return nested.flat();
}

/* ------------------------------------------------------------------ */
/* PUBLIC:  generateLessonFromSegment                                 */
/* ------------------------------------------------------------------ */
export async function generateLessonFromSegment(
  segment     : string,
  documentID  : string,
  sourceFileId: string,
  pageCount   : number
): Promise<unknown> {
  /* 1️⃣ fire-and-forget persistence */
  void persistLessonContext(segment, documentID, sourceFileId);

  /* 2️⃣ kick off intro/LO generation PARALLEL to structural work */
  const metaPromise = generateFinalizedSyllabusv2(segment);
  const titlePromise: Promise<string> = metaPromise.then(m => m.LessonTitle);

  /* 3️⃣ do the heavy unit work while meta is cooking */
  console.time('v5-parallel-structural');
  const lessons = await processDocument(segment, sourceFileId, pageCount, titlePromise);
  console.timeEnd('v5-parallel-structural');

  /* 4️⃣ wait for meta (it usually resolved long ago) + merge */
  const meta = await metaPromise;
  return mergeToLessonSchema({
    file_id:             sourceFileId,
    main_title:          meta.LessonTitle,
    introduction:        meta.Introduction,
    learning_objective:  meta.LearningObjectives,
    hierarchy:           lessons
  });
}
