/**
 * @file LearningSetDistributor.ts
 * @description
 * [Responsibility & Scope]
 * This module implements the notebook→learning set assignment step for the Study Planner
 * Service. Its single responsibility is to partition an arbitrary list of NotebookMeta
 * records into a minimal number of evenly balanced learning sets while observing the hard
 * constraint that a learning set can track a maximum of three notebooks. The distributor
 * preserves input order to keep user expectations stable (first notebooks specified are
 * assigned first), computes balanced bucket sizes to avoid skew (e.g., 4 notebooks → [2,2],
 * not [3,1]), and generates deterministic learning set identifiers (LS-A, LS-B, …) and
 * display names. The returned LearningSet objects are intentionally lightweight; their
 * scheduledDayPattern is left empty for the scheduler to populate in a later phase. All
 * operations are O(N) where N is the number of notebooks, and the function is pure aside
 * from concise logging at critical checkpoints to aid observability in production.
 */

import type { NotebookMeta } from '@/app/Library/Definitions/CalendarDefinitions';
import type { LearningSet } from '../models/LearningSet';
import { MAX_NOTEBOOKS_PER_LEARNING_SET, ID_PREFIX } from '../constants/schedulingConstants';

/**
 * @function distribute
 * @description
 * Evenly partitions notebooks into learning sets, respecting the maximum capacity per set
 * and preserving input order. The algorithm computes the minimum number of sets required,
 * derives balanced bucket sizes using division with remainder, and slices the input array
 * into contiguous groups that match those sizes. Each group is wrapped in a LearningSet
 * object with a stable identifier and friendly name. The function is deterministic and
 * side-effect free, making it safe for repeated calls during orchestration or testing.
 * Throws a descriptive error when invoked with an empty array to fail fast.
 */
export function distribute(notebooks: NotebookMeta[]): LearningSet[] {
  const loc = 'core/LearningSetDistributor.ts#5512';

  if (!Array.isArray(notebooks) || notebooks.length === 0) {
    // eslint-disable-next-line no-console
    console.log(`[${loc}] distribute -> FAIL (no notebooks)`);
    throw new Error('LearningSetDistributor.distribute requires a non-empty notebooks array.');
  }

  // Step 1) Compute the minimum number of sets required.
  const setCount = Math.max(1, Math.ceil(notebooks.length / MAX_NOTEBOOKS_PER_LEARNING_SET));

  // Step 2) Derive balanced sizes, e.g., N=5, K=2 -> [3,2]; N=7, K=3 -> [3,2,2].
  const base = Math.floor(notebooks.length / setCount);
  const remainder = notebooks.length % setCount;

  // Step 3) Build sizes array where the first `remainder` buckets receive +1.
  const sizes: number[] = new Array(setCount).fill(base).map((v, i) => (i < remainder ? v + 1 : v));

  // Step 4) Partition while preserving input order (O(N)).
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

  // eslint-disable-next-line no-console
  console.log(
    `[${loc}] distribute -> PASS sets=${out.length} sizes=[${sizes.join(',')}] totalNotebooks=${notebooks.length}`
  );
  return out;
}
