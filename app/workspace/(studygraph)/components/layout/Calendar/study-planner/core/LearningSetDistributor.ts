// src/services/study-planner/core/LearningSetDistributor.ts
/**
 * @file LearningSetDistributor.ts
 * @description
 * [Responsibility & Scope]
 * This module implements the notebook→learning set assignment step for the Study Planner
 * Service. Its single responsibility is to partition an arbitrary list of NotebookMeta
 * records into a minimal number of evenly balanced learning sets. 
 * Update Phase 1: It now observes a "Max 2 Sets" strategy. If the notebook count exceeds
 * the NOTEBOOK_SPLIT_THRESHOLD, it splits them evenly into exactly two sets (A and B). 
 * Otherwise, it maintains a single set. The distributor preserves input order to keep 
 * user expectations stable (first notebooks specified are assigned first), computes balanced 
 * bucket sizes to avoid skew, and generates deterministic learning set identifiers.
 * All operations are O(N) where N is the number of notebooks.
 */

import type { NotebookMeta } from '@/app/Library/Definitions/CalendarDefinitions';
import type { LearningSet } from '../models/LearningSet';
import { NOTEBOOK_SPLIT_THRESHOLD, ID_PREFIX } from '../constants/schedulingConstants'; // update - 1

/**
 * @function distribute
 * @description
 * Evenly partitions notebooks into learning sets based on the flexible "Max 2 Sets" strategy.
 * If the total number of notebooks exceeds NOTEBOOK_SPLIT_THRESHOLD, the function creates 
 * exactly two learning sets and distributes the notebooks evenly between them (e.g., 5 items -> [3, 2]).
 * If the total is within the threshold, a single learning set is returned. This ensures a 
 * consistent alternating daily rhythm (A/B) regardless of high volume.
 * The function is deterministic and side-effect free.
 */
export function distribute(notebooks: NotebookMeta[]): LearningSet[] {
  const loc = 'core/LearningSetDistributor.ts#5512';

  if (!Array.isArray(notebooks) || notebooks.length === 0) {
    // eslint-disable-next-line no-console
    console.log(`[${loc}] distribute -> FAIL (no notebooks)`);
    throw new Error('LearningSetDistributor.distribute requires a non-empty notebooks array.');
  }

  // Step 1: Determine the number of sets (capped at 2).
  // update - 2
  const total = notebooks.length;
  const numSets = total > NOTEBOOK_SPLIT_THRESHOLD ? 2 : 1;

  // Step 2: Derive balanced sizes using division with remainder.
  // Example: 5 notebooks, 2 sets. Base = 2, Remainder = 1.
  // Sizes = [2+1, 2] = [3, 2].
  // update - 3
  const base = Math.floor(total / numSets);
  const remainder = total % numSets;

  // Step 3: Build sizes array where the first `remainder` buckets receive +1.
  const sizes: number[] = new Array(numSets).fill(base).map((v, i) => (i < remainder ? v + 1 : v));

  // Step 4: Partition while preserving input order (O(N)).
  const out: LearningSet[] = [];
  let cursor = 0;

  for (let i = 0; i < sizes.length; i++) {
    const sz = sizes[i];
    const slice = notebooks.slice(cursor, cursor + sz);
    cursor += sz;

    const id = `${ID_PREFIX.LSET}-${String.fromCharCode(65 + i)}`; // LS-A, LS-B, ...
    const name = `Learning Set ${String.fromCharCode(65 + i)}`;

    out.push({
      id,
      name,
      notebooks: slice,
      scheduledDayPattern: [], // Populated by LearningSetScheduler in a later phase.
    });
  }

  return out;
}