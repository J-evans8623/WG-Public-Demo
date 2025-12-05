/**
 * @file mergeStudyPlans.ts
 * @responsibility
 *  A pure utility that merges an existing unified StudyPlanOutput with an extension "tail"
 *  StudyPlanOutput into a single, updated plan. The function:
 *   • de-duplicates sessions by id (preserving existing first),
 *   • merges sessionsByDate deterministically and keeps canonical per-day ordering
 *     (block → revision-block → revision-interleaved),
 *   • carries forward the tail's updated progress and nextAvailableDate,
 *   • recomputes planMetadata across the merged sessions,
 *   • never mutates inputs.
 */

import type { StudyPlanOutput, StudyPlanState, PlanMetadata } from "./models";
import type { StudySession } from '@/app/Library/Definitions/CalendarDefinitions';

function sortCanonical(a: StudySession, b: StudySession): number {
  const order = { block: 0, 'revision-block': 1, 'revision-interleaved': 2 } as const;
  const ad = a.date.getTime() - b.date.getTime();
  if (ad !== 0) return ad;
  return order[a.type] - order[b.type];
}

/**
 * @function mergeStudyPlans
 * @description
 *  Merge `existing` (full plan) with an extension `tail` into a single StudyPlanOutput.
 * @steps
 *  1) Build a Set of existing ids for O(1) duplicate checks.
 *  2) Append only new sessions from tail; sort globally for stability.
 *  3) Merge sessionsByDate: append tail day's sessions after existing, drop dupes by id,
 *     then sort by canonical type order.
 *  4) Merge state: reuse existing.learningSets; take tail's notebookProgress, nextAvailableDate,
 *     and config (reflecting latest scheduling state). Use merged sessionsByDate map.
 *  5) Recompute planMetadata across merged sessions (start, end, totals, breakdown).
 *  6) Return a fresh StudyPlanOutput.
 */
export function mergeStudyPlans(existing: StudyPlanOutput, tail: StudyPlanOutput): StudyPlanOutput {
  // Step 1
  const existingIds = new Set(existing.sessions.map(s => s.id));

  // Step 1.5 (THE FIX): Create a Set of "Semantic Signatures" from the existing plan.
  // Signature = YYYY-MM-DD + NotebookFileId + SessionType
  // This prevents adding a session if the slot
  //  is already occupied by a previous version.
  const existingSignatures = new Set<string>();


  // Helper to generate signature
  const getSig = (s: StudySession) => {
    // Robust date formatting to YYYY-MM-DD
    const dateStr = s.date.toISOString().split('T')[0];
    return `${dateStr}|${s.notebookMeta.fileId}|${s.type}`;
  };

  existing.sessions.forEach(s => existingSignatures.add(getSig(s)));

  // Step 2
  // Step 2: Filter Tail
  const appended = tail.sessions.filter(s => {
    // 1. Drop if ID matches (standard dedupe)
    if (existingIds.has(s.id)) return false;

    // 2. Drop if Semantic Signature matches (The Bug Fix)
    // If we already have a session of this type for this notebook on this day,
    // we assume the existing one is the source of truth and discard the duplicate tail.
    if (existingSignatures.has(getSig(s))) return false;

    return true;
  });

  const mergedSessions: StudySession[] = [...existing.sessions, ...appended].sort(sortCanonical);

  // Step 3
  const mergedSessionsByDate = new Map<string, StudySession[]>();
  const push = (m: Map<string, StudySession[]>, s: StudySession) => {
    const key = `${s.date.getFullYear()}-${String(s.date.getMonth() + 1).padStart(2, '0')}-${String(s.date.getDate()).padStart(2, '0')}`;
    if (!m.has(key)) m.set(key, []);
    const arr = m.get(key)!;
    if (!arr.some(x => x.id === s.id)) arr.push(s);
  };

  for (const s of existing.sessions) push(mergedSessionsByDate, s);
  for (const s of tail.sessions) push(mergedSessionsByDate, s);

  // ensure deterministic per-day ordering
  for (const [k, arr] of mergedSessionsByDate.entries()) {
    mergedSessionsByDate.set(k, [...arr].sort(sortCanonical));
  }

  // Step 4
  const mergedState: StudyPlanState = {
    learningSets: existing.state.learningSets,
    notebookProgress: tail.state.notebookProgress, // latest snapshot after extension
    sessionsByDate: mergedSessionsByDate,
    nextAvailableDate: tail.state.nextAvailableDate,
    config: tail.state.config,
  };

  // Step 5
  const meta: PlanMetadata = (() => {
    if (mergedSessions.length === 0) {
      return {
        startDate: existing.planMetadata.startDate,
        endDate: existing.planMetadata.endDate,
        totalSessions: 0,
        learningSetCount: existing.planMetadata.learningSetCount,
        sessionBreakdown: { blockLearning: 0, blockRevision: 0, interleavedRevision: 0 },
      };
    }
    let end = mergedSessions[0].date;
    let block = 0, revB = 0, revI = 0;
    for (const s of mergedSessions) {
      if (s.date > end) end = s.date;
      if (s.type === 'block') block++;
      else if (s.type === 'revision-block') revB++;
      else revI++;
    }
    return {
      startDate: existing.planMetadata.startDate,
      endDate: end,
      totalSessions: mergedSessions.length,
      learningSetCount: existing.planMetadata.learningSetCount,
      sessionBreakdown: { blockLearning: block, blockRevision: revB, interleavedRevision: revI },
    };
  })();

  // Step 6
  return {
    sessions: mergedSessions,
    planMetadata: meta,
    state: mergedState,
  };
}
