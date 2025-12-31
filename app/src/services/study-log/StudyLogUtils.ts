// StudyLogUtils.ts

import { 
  StudyLogSummary, 
  DEFAULT_STUDY_LOG, 
  NotebookStudyStats 
} from '@/app/Library/Definitions/StudyLogDefinitions';

/**
 * @function getWeekStartTimestamp
 * @description
 * Calculates the Unix timestamp (ms) for the start of the current week (Monday 00:00:00).
 * pure utility - safe for client and server.
 */
export function getWeekStartTimestamp(now = new Date()): number {
  const d = new Date(now);
  const day = d.getDay(); // 0 (Sun) to 6 (Sat)
  // Adjust to make Monday index 0, Sunday index 6
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * @function resolveMostRecent
 * @description
 * Compares a local record and a remote record to determine the most up-to-date state.
 * Uses a "Last Update Wins" strategy for the top-level container, but performs a 
 * granular merge on the `notebookStats` map to ensure study sessions from different 
 * devices for different notebooks are preserved.
 * * Update - 1: Added granular merging logic for `notebookStats`.
 */
export function resolveMostRecent(
  local: StudyLogSummary | null,
  remote: StudyLogSummary | null
): StudyLogSummary {
  // If neither exists, start fresh with current week start
  if (!local && !remote) {
    return {
      ...DEFAULT_STUDY_LOG,
      currentWeekStart: getWeekStartTimestamp()
    };
  }
  if (!local) return remote!;
  if (!remote) return local;

  // 1. Determine the "Base Winner" for top-level metadata (e.g. currentWeekStart, global totals)
  // We default to the object with the latest write time.
  const baseIsRemote = remote.lastUpdated >= local.lastUpdated;
  const winner = baseIsRemote ? remote : local;

  // 2. Perform Granular Merge of notebookStats
  // We explicitly merge the maps so that if User studied Notebook A on Device 1 (Local)
  // and Notebook B on Device 2 (Remote), we keep BOTH progress records.
  
  // Initialize with local stats (handling potential undefined for backward compat)
  const mergedStats: Record<string, NotebookStudyStats> = { ...(local.notebookStats || {}) };
  const remoteStats = remote.notebookStats || {};

  // Iterate over remote keys to merge or overwrite
  Object.keys(remoteStats).forEach((notebookId) => {
    const rStat = remoteStats[notebookId];
    const lStat = mergedStats[notebookId];

    // If local doesn't have it, or remote is newer, take remote.
    // Otherwise, keep local (which is already in mergedStats).
    if (!lStat || rStat.lastUpdated > lStat.lastUpdated) {
      mergedStats[notebookId] = rStat;
    }
  });

  // 3. Return the winner with the intelligently merged stats map
  return {
    ...winner,
    notebookStats: mergedStats,
    // Note: In a perfect world, we might re-sum global totals here from mergedStats, 
    // but for Phase 1 we rely on the base winner's totals to maintain consistency 
    // with the 'Last Update Wins' contract for the document root.
  };
}