/**
 * @file app/src/services/TextPreprocessing/LessonModulePipeline.ts
 * @description
 *   Unit-level mini-pipeline.
 *   Runs Stages 1 & 2 (syllabus + rating) immediately, then *waits* for the
 *   module title only when it reaches Stage 4 so that intro/LO generation
 *   can execute in parallel.
 */

import {
  generateUnitSyllabus,
  scoreUnitSyllabus
} from './aiTextPreProcessingV3';
import { PrimaryNode, unit as UnitType } from './LessonModuleTypes';
import { nextKey2, Key2 } from './TextKeys';
import AIController from '../../controllers/aiController';

/**
 * unitLessonPipeline
 * ------------------------------------------------------------
 * @param unitText          Raw text for this unit.
 * @param unitId            0-based numeric identifier.
 * @param mainTitlePromise  Either the *resolved* title string
 *                          or a promise that will resolve to it.
 */
export async function unitLessonPipeline(
  unitText: string,
  unitId: number,
  mainTitlePromise: Promise<string> | string
): Promise<PrimaryNode[]> {
  /* ---------- Stage 1 & 2 : syllabus → rating ----------------------- */
  const unitForLLM: UnitType = { unit_id: unitId, unit_text: unitText };
  const syllabus   = await generateUnitSyllabus(unitForLLM);
  const rating     = await scoreUnitSyllabus(unitForLLM, syllabus);

  /* ---------- build pruned primary stubs ---------------------------- */
  const stubs: PrimaryNode[] = [];
  let idCounter = unitId * 1000;
  rating.primary_subtopics.forEach((ps: any) => {
    const kept = ps.secondary_topics.filter((s: any) => s.score >= 3);
    if (!kept.length) return;

    const parentId = nextKey2(idCounter++) as Key2;
    stubs.push({
      node_id: parentId,
      unit_text: unitText,
      title: ps.title,
      depth2_subtopics: kept.map((s: any) => ({ title: s.title }))
    });
  });

  if (!stubs.length) return [];

  /* ---------- Stage 4 : detailed subtree lessons -------------------- */
  const title =
    typeof mainTitlePromise === 'string'
      ? mainTitlePromise
      : await mainTitlePromise;                    // only blocks here

  return Promise.all(
    stubs.map(stub => AIController.generateSubtreeLesson(stub, title))
  );
}
