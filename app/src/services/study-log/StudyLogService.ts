/**
 * @file app/src/services/study-log/StudyLogService.ts
 * @description
 * Service adapter for Firestore interactions related to the Study Log.
 * Responsible for:
 * 1. Fetching the aggregated summary document from `users/{uid}/study_stats/summary`.
 * 2. Fetching recent session history for detailed views.
 * 3. Performing atomic batch writes to update the summary and insert new history records simultaneously.
 * 4. Providing utility functions for time calculations (e.g., Week Start) and synchronization checks.
 *
 * This service abstracts the Firestore dependency from the UI and Context layers. It implements
 * the "Last Update Wins" conflict resolution logic and ensures that aggregate counters
 * stay consistent with the granular history logs via batch operations.
 */

import { firestore } from '@/app/src/services/firebase'; // Use singleton Admin instance
import {
  StudyLogSummary,
  StudyLogSession,
  DEFAULT_STUDY_LOG
} from '@/app/Library/Definitions/StudyLogDefinitions';

const COLLECTION_ROOT = 'users';
const STATS_COLLECTION = 'study_stats';
const SUMMARY_DOC = 'summary';
const HISTORY_COLLECTION = 'session_history';

/**
 * @function getWeekStartTimestamp
 * @description
 * Calculates the Unix timestamp (ms) for the start of the current week (Monday 00:00:00).
 * Used to determine if the persisted weekly stats belong to the current week or a past week.
 * @returns {number} Unix timestamp
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
 * Compares a local record and a remote record to determine which one is the "winner"
 * based on the Last Update Wins policy.
 * @param {StudyLogSummary | null} local - The cached summary
 * @param {StudyLogSummary | null} remote - The summary fetched from the backend
 * @returns {StudyLogSummary} The most up-to-date record
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

  // Simple conflict resolution: timestamp comparison
  if (remote.lastUpdated >= local.lastUpdated) {
    return remote;
  }
  return local;
}

/**
 * @function fetchStudyLogSummary
 * @description
 * Retrieves the singleton summary document for a user.
 * Returns null if the document does not exist (implying a new user).
 * Uses the Admin SDK pattern: firestore.collection(...).doc(...).get()
 * @param {string} userId - The user's UID
 * @returns {Promise<StudyLogSummary | null>}
 */
export async function fetchStudyLogSummary(userId: string): Promise<StudyLogSummary | null> {
  if (!userId) throw new Error('fetchStudyLogSummary: userId is required');

  try {
    const ref = firestore
      .collection(COLLECTION_ROOT)
      .doc(userId)
      .collection(STATS_COLLECTION)
      .doc(SUMMARY_DOC);

    const snap = await ref.get();

    if (snap.exists) {
      const data = snap.data();
      // Safely cast data. Note: Firestore Timestamps should be converted if using them,
      // but our schema uses 'number' for timestamps which Firestore preserves accurately.
      return data as StudyLogSummary;
    }
    return null;
  } catch (error) {
    console.error('[StudyLogService] Fetch failed', error);
    // On error, we throw so the context can decide whether to use cache or default
    throw error;
  }
}

/**
 * @function fetchRecentSessions
 * @description
 * Retrieves the most recent study sessions for the user.
 * Used to hydrate the history list in the detailed modal.
 * @param {string} userId - The user's UID
 * @param {number} limit - Max number of sessions to retrieve (default 10)
 * @returns {Promise<StudyLogSession[]>}
 */
export async function fetchRecentSessions(userId: string, limit: number = 10): Promise<StudyLogSession[]> {
  if (!userId) throw new Error('fetchRecentSessions: userId is required');

  try {
    const historyRef = firestore
      .collection(COLLECTION_ROOT)
      .doc(userId)
      .collection(STATS_COLLECTION)
      .doc(SUMMARY_DOC)
      .collection(HISTORY_COLLECTION);

    const snapshot = await historyRef
      .orderBy('endTime', 'desc')
      .limit(limit)
      .get();

    const sessions: StudyLogSession[] = [];
    snapshot.forEach(doc => {
      sessions.push(doc.data() as StudyLogSession);
    });

    return sessions;
  } catch (error) {
    console.error('[StudyLogService] Fetch history failed', error);
    return [];
  }
}

/**
 * @function saveStudyLogData
 * @description
 * Persists the updated summary and appends any new completed sessions to the history.
 * Uses a Batch Write to ensure atomicity.
 * Uses the Admin SDK pattern: firestore.batch()
 * @param {string} userId - The user's UID
 * @param {StudyLogSummary} summary - The updated aggregated stats
 * @param {StudyLogSession[]} newSessions - Array of sessions completed since the last sync
 */
export async function saveStudyLogData(
  userId: string,
  summary: StudyLogSummary,
  newSessions: StudyLogSession[]
): Promise<void> {
  if (!userId) throw new Error('saveStudyLogData: userId is required');

  try {
    const batch = firestore.batch();

    // 1. Update Summary Document
    const summaryRef = firestore
      .collection(COLLECTION_ROOT)
      .doc(userId)
      .collection(STATS_COLLECTION)
      .doc(SUMMARY_DOC);

    batch.set(summaryRef, summary);

    // 2. Insert New Sessions into Sub-collection
    // We use the client-generated ID for idempotency in case of retries
    const historyRef = firestore
      .collection(COLLECTION_ROOT)
      .doc(userId)
      .collection(STATS_COLLECTION)
      .doc(SUMMARY_DOC)
      .collection(HISTORY_COLLECTION);

    newSessions.forEach((session) => {
      const sessionDoc = historyRef.doc(session.id);
      batch.set(sessionDoc, session);
    });

    await batch.commit();
    console.log(`[StudyLogService] Saved summary and ${newSessions.length} sessions.`);
  } catch (error) {
    console.error('[StudyLogService] Save failed', error);
    throw error;
  }
}