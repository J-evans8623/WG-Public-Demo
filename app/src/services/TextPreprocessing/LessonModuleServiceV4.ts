/**
 * @file app/src/services/TextPreprocessing/LessonModuleServiceV4.ts
 * @description
 *   Phase 3 “three-pass” processDocument with:
 *     • Stage A: split into units.
 *     • Stage B: generateUnitSyllabus().
 *     • Stage C: scoreUnitSyllabus() & prune.
 *     • Stage C.5: combine pruned syllabi → combinedSyllabus.
 *     • Stage D: generateFinalizedSyllabus(combined, fullText).
 *   Preserves signature & return type LessonModuleV3.
 */

import { persistLessonContext } from './persistLessonContext';
import {
  generateUnitSyllabus,
  scoreUnitSyllabus,
  generateFinalizedSyllabus
} from './aiTextPreProcessingV3';
import { nextKey2, Key2 } from './TextKeys';
import {PrimaryNode, LessonModuleV3, UnitContext } from './LessonModuleTypes';
import AIController from '../../controllers/aiController';
import { mergeToLessonSchema } from './mergeToLessonSchema';


export async function processDocument(
  fullText: string,
  documentID: string,
  sourceFileId: string,
  pgCount: number,
): Promise<LessonModuleV3> {
  // Fire-and-forget persistence
  void persistLessonContext(fullText, documentID, sourceFileId);

 
  let unitCount = 1;
  if (pgCount >= 5 && pgCount <= 10) unitCount = 2;
  else if (pgCount > 10) unitCount = 3;

  const unitLength = Math.ceil(fullText.length / unitCount);
  const contexts: UnitContext[] = [];
  for (let i = 0; i < unitCount; i++) {
    const start = i * unitLength;
    const end = Math.min(start + unitLength, fullText.length);
    contexts.push({
      unit_id: i,
      unit_text: fullText.substring(start, end),
      syllabus: undefined,
      rating: undefined,
      prunedStubs: []
    });
  }

  
  console.time('8641-generateUnitSyllabus');

  // Stage B: generate and store each unit’s syllabus
  await Promise.all(
    contexts.map(async ctx => {
      ctx.syllabus = await generateUnitSyllabus({ unit_id: ctx.unit_id, unit_text: ctx.unit_text });
    })
  );
  console.timeEnd('8641-generateUnitSyllabus');
  // Stage C: score & prune each syllabus → store NodeStubs in ctx.prunedStubs
  console.time('8641-scoreUnitSyllabus');
  await Promise.all(
    contexts.map(async ctx => {
      ctx.rating = await scoreUnitSyllabus(
        { unit_id: ctx.unit_id, unit_text: ctx.unit_text },
        ctx.syllabus!
      );
       console.timeEnd('8641-scoreUnitSyllabus');

      // build prunedStubs for this unit
      const pruned:PrimaryNode[] = [];
      let idCounter = ctx.unit_id * 1000; // just to keep ids distinct per unit
      ctx.rating!.primary_subtopics.forEach(ps => {
        const kept = ps.secondary_topics.filter(st => st.score >= 3);
        if (!kept.length) return;

        // primary stub
        const parentId = nextKey2(idCounter++) as Key2;
        const parent:PrimaryNode = {
          node_id: parentId,
          unit_text: ctx.unit_text,
          title: ps.title,
          depth2_subtopics: []
        };

        // children
        for (const st of kept) {
          parent.depth2_subtopics!.push({
            title: st.title
          });
        }
        pruned.push(parent);
      });
      ctx.prunedStubs = pruned;
    })
  );

  // Stage C.5: build combined syllabus JSON
  const combinedSyllabus = {
    primary_subtopics: contexts.flatMap(ctx =>
      ctx.rating!.primary_subtopics
        .map(ps => {
          const kept = ps.secondary_topics.filter(st => st.score >= 2);
          return kept.length
            ? { title: ps.title, secondary_topics: kept.map(st => ({ title: st.title })) }
            : null;
        })
        .filter(x => x !== null) as { title: string; secondary_topics: { title: string }[] }[]
    )
  };

  // Stage D: global metadata
  console.time('8641-generateFinalizedSyllabus-intro-LO');
  const globalMeta = await generateFinalizedSyllabus(combinedSyllabus, fullText);
  console.timeEnd('8641-generateFinalizedSyllabus-intro-LO');

  // flatten all prunedStubs into one hierarchy
  const hierarchy:PrimaryNode[] = contexts.flatMap(ctx => ctx.prunedStubs!);

  return {
    file_id: sourceFileId,
    main_title: globalMeta.LessonTitle,
    introduction: globalMeta.Introduction,
    learning_objective: globalMeta.LearningObjectives,
    hierarchy
  };
}

/**
 * generateLessonFromSegment
 * Unchanged from V3: calls processDocument, then generates subtree lessons in parallel,
 * and merges to the legacy lessonSchema.
 */
export async function generateLessonFromSegment(
  segment: string,
  documentID: string,
  sourceFileId: string,
  moduleSize:number,
): Promise<unknown> {
  console.time('8641-processDocument');
  const moduleV3 = await processDocument(segment, documentID, sourceFileId, moduleSize);
  console.log(`1111-Lesson module returned from process document : ${JSON.stringify(moduleV3.hierarchy)}`);
  console.timeEnd('8641-processDocument');
  

  console.time('8641-parallel subtree generation');
  moduleV3.hierarchy = await Promise.all(
    moduleV3.hierarchy.map(root =>
      AIController.generateSubtreeLesson(root, moduleV3.main_title)
    )
  );
  console.timeEnd('8641-parallel subtree generation');
  const data = mergeToLessonSchema(moduleV3);
  console.log(`1111-Finalized lesson returned to frontend ${JSON.stringify(data)}`);
  return data
}
