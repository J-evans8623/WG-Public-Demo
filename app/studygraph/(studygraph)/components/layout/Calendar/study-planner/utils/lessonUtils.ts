// src/services/study-planner/utils/lessonUtils.ts
/**
 * @file lessonUtils.ts
 * @description
 * [Responsibility & Scope]
 * This module contains pure helpers for transforming raw notebook lesson units into
 * structured, scheduler-friendly shapes. It validates lesson data, groups units into
 * canonical lessons, sorts by LessonOrder, calculates chunk counts using the configured
 * chunk size, and generates stable lesson identifiers. Keeping these operations here
 * prevents duplication in parsers or schedulers and guarantees O(N) linear passes over
 * lesson arrays. Purposeful logs mark key transformations to aid debugging without
 * polluting hot paths. All functions avoid mutation of caller-provided inputs.
 */

import type { LessonUnit } from '@/app/Library/Definitions/CalendarDefinitions';
import { DEFAULT_CHUNK_SIZE, ID_PREFIX } from '../constants/schedulingConstants';

/**
 * @function validateLessonUnit
 * @description
 * Ensures a LessonUnit has the required shape before scheduling. This check is fast and
 * defensive: it verifies presence and primitive types for critical fields and throws an
 * actionable error when invalid to fail early and loudly in development and tests.
 */
export function validateLessonUnit(unit: unknown, context = 'lessonUtils'): asserts unit is LessonUnit {
  const loc = 'utils/lessonUtils.ts#1035';
  const u = unit as Partial<LessonUnit>;
  const ok =
    !!u &&
    typeof u.primaryConceptNodeID === 'string' &&
    typeof u.parentTitle === 'string' &&
    typeof u.LessonOrder === 'number';

  if (!ok) {
    // eslint-disable-next-line no-console
    console.log(`[${loc}] validateLessonUnit -> FAIL ctx=${context}`);
    throw new Error(`[${context}] Invalid LessonUnit: required fields id, parentTitle, LessonOrder`);
  }
  // eslint-disable-next-line no-console
  console.log(`[${loc}] validateLessonUnit -> PASS id=${u.primaryConceptNodeID}`);
}

/**
 * @function sortUnits
 * @description
 * Returns a new array of LessonUnit sorted by ascending LessonOrder. Stable sort ensures
 * deterministic progression across runs and environments.
 */
export function sortUnits(units: LessonUnit[]): LessonUnit[] {
  const loc = 'utils/lessonUtils.ts#2174';
  const out = [...units].sort((a, b) => (a as any).LessonOrder - (b as any).LessonOrder);
  // eslint-disable-next-line no-console
  console.log(`[${loc}] sortUnits -> in=${units.length} out=${out.length}`);
  return out;
}

/**
 * @function groupUnitsByLesson
 * @description
 * Groups units by a composite key of parentTitle + mapID (if present). Produces a Map
 * that is ideal for iterating in O(L) where L is number of lessons.
 */
export function groupUnitsByLesson(units: LessonUnit[]): Map<string, LessonUnit[]> {
  const loc = 'utils/lessonUtils.ts#3268';
  const map = new Map<string, LessonUnit[]>();
  for (const u of units) {
    validateLessonUnit(u, 'groupUnitsByLesson');
    const key = `${u.parentTitle}#${(u as any).mapID ?? 'nomap'}`;
    const bucket = map.get(key);
    if (bucket) {
      bucket.push(u);
    } else {
      map.set(key, [u]);
    }
  }
  // eslint-disable-next-line no-console
  console.log(`[${loc}] groupUnitsByLesson -> lessons=${map.size}`);
  return map;
}

/**
 * @function calculateChunkCount
 * @description
 * Calculates number of session-sized chunks using DEFAULT_CHUNK_SIZE. Final chunk may
 * contain fewer units; callers use chunkIndex/total for display.
 */
export function calculateChunkCount(unitCount: number, chunkSize: number = DEFAULT_CHUNK_SIZE): number {
  const loc = 'utils/lessonUtils.ts#4319';
  const count = Math.ceil(Math.max(unitCount, 0) / Math.max(1, chunkSize));
  // eslint-disable-next-line no-console
  console.log(`[${loc}] calculateChunkCount -> units=${unitCount} chunkSize=${chunkSize} chunks=${count}`);
  return count;
}

/**
 * @function generateLessonId
 * @description
 * Generates a stable, short identifier from title + mapID using a fast djb2 hash. IDs are
 * prefixed for analytics and quick identification during debugging.
 */
export function generateLessonId(title: string, mapID: string | undefined): string {
  const loc = 'utils/lessonUtils.ts#5457';
  const base = `${title}#${mapID ?? 'nomap'}`;
  let hash = 5381;
  // O(N) with tiny N (title length)
  for (let i = 0; i < base.length; i++) {
    hash = (hash * 33) ^ base.charCodeAt(i);
  }
  // Force positive 32-bit
  const code = (hash >>> 0).toString(36).toUpperCase();
  const id = `${ID_PREFIX.LESSON}-${code}`;
  // eslint-disable-next-line no-console
  console.log(`[${loc}] generateLessonId -> ${id}`);
  return id;
}
