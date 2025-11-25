/**
 * @file app/src/services/firebase/StudyPlanFB.ts
 * @responsibility
 *   Firestore adapter for persisting the **new study plan contract** produced by StudyPlanService.
 *   Exposes: `storeStudyPlan`, `loadStudyPlan`, `clearStudyPlan` against
 *   `users/{uid}/calendar/current`. Performs all (de)serialization:
 *     • Dates  ↔ Firestore Timestamp
 *     • Map    ↔ plain object (record)
 *   **Deliberately excludes** legacy month/index and `scheduleConfig`. This module is transport-only:
 *   no HTTP, no UI, no legacy shapes. It **imports `firestore`** from the project’s singleton
 *   `firebase.ts` (no re-init).
 */

import admin from 'firebase-admin';
import { firestore } from '@/app/src/services/firebase'; // reuse initialized singleton
import type { StudyPlanOutput, StudyPlanState } from '@/app/workspace/(studygraph)/components/layout/Calendar/study-planner';
import type { NotebookMeta, StudySession } from '@/app/Library/Definitions/CalendarDefinitions';

// ---------- Internal wire types (Firestore-safe) ----------

type TS = admin.firestore.Timestamp;

type StudySessionWire = Omit<StudySession, 'date' | 'notebookMeta'> & {
  date: TS;
  notebookMeta: Omit<NotebookMeta, 'lastUpdated'> & { lastUpdated: TS };
};

type StudyPlanStateWire = Omit<StudyPlanState,
  'nextAvailableDate' | 'sessionsByDate' | 'config' | 'notebookProgress'
> & {
  nextAvailableDate: TS;
  // Maps become records
  sessionsByDate: Record<string, StudySessionWire[]>;
  notebookProgress: Record<string, unknown>;
  // keep config as-is but convert any Date fields (if present later)
  config: StudyPlanState['config'];
};

type StudyPlanOutputWire = {
  sessions: StudySessionWire[];
  planMetadata: {
    startDate: TS;
    endDate: TS;
    totalSessions: number;
    learningSetCount: number;
    sessionBreakdown: {
      blockLearning: number;
      blockRevision: number;
      interleavedRevision: number;
    };
  };
  state: StudyPlanStateWire;
};

export type PersistedCalendarWire = {
  studyPlan: StudyPlanOutputWire | null;
  selectedNotebooks: string[];
  completedSessions: string[];
  lastUpdated: TS;
  version: 'new-1';
};

// ---------- Small helpers (numbered for traceability) ----------

/**
 * @function toTS
 * @purpose Coerce unknown date-like into Firestore Timestamp.
 * @steps
 *   1) If value is Timestamp → return.
 *   2) If value is Date     → convert.
 *   3) Else construct Date from value; fallback to now if invalid.
 */
function toTS(v: any): TS {
  if (v && typeof v.toDate === 'function') return v as TS;
  const d = v instanceof Date ? v : new Date(v);
  return admin.firestore.Timestamp.fromDate(isNaN(d.getTime()) ? new Date() : d);
}

/**
 * @function fromTS
 * @purpose Convert Timestamp/string/number → Date.
 * @steps
 *   1) Timestamp → .toDate()
 *   2) Date      → identity
 *   3) string/#  → new Date(value)
 *   4) fallback  → new Date()
 */
function fromTS(v: any): Date {
  if (!v) return new Date();
  if (v instanceof Date) return v;
  if (typeof v?.toDate === 'function') return v.toDate();
  const d = new Date(v);
  return isNaN(d.getTime()) ? new Date() : d;
}


/**
 * @function resolveCalendarPath
 * @purpose Return the canonical Storage path for the user’s single calendar blob.
 * // update - 1
 * @steps
 *   1) Validate uid (string, non-empty).
 *   2) Return `calendars/{uid}.v1.json`.
 */
export function resolveCalendarPath(uid: string): string {
  if (!uid || typeof uid !== 'string') throw new Error('resolveCalendarPath: invalid uid');
  return `calendars/${uid}.v1.json`;
}

/**
 * @function encodeSession
 * @purpose Session → Firestore-safe session with Timestamps.
 * @steps
 *   1) Copy scalar fields.
 *   2) Convert session.date → TS.
 *   3) Convert notebookMeta.lastUpdated → TS.
 */
function encodeSession(s: StudySession): StudySessionWire {
  return {
    ...s,
    date: toTS(s.date),
    notebookMeta: {
      ...s.notebookMeta,
      lastUpdated: toTS(s.notebookMeta.lastUpdated),
    },
  };
}

/**
 * @function decodeSession
 * @purpose Firestore-safe session → runtime session with Dates.
 * @steps
 *   1) Copy scalars.
 *   2) Convert TS → Date for session.date and notebookMeta.lastUpdated.
 */
function decodeSession(sw: StudySessionWire): StudySession {
  return {
    ...sw,
    date: fromTS(sw.date),
    notebookMeta: {
      ...sw.notebookMeta,
      lastUpdated: fromTS(sw.notebookMeta.lastUpdated),
    },
  };
}

/**
 * @function encodeState
 * @purpose StudyPlanState → wire (TS + records).
 * @steps
 *   1) Map sessionsByDate (Map|Record) → Record<string, StudySessionWire[]>
 *   2) Shallow-copy notebookProgress Map → Record
 *   3) Convert nextAvailableDate → TS
 */
function encodeState(state: StudyPlanState): StudyPlanStateWire {
  // 1) sessionsByDate normalization
  const sbd: Record<string, StudySessionWire[]> = {};
  const iter: [string, StudySession[]][] = state.sessionsByDate instanceof Map
    ? Array.from(state.sessionsByDate.entries())
    : Object.entries(state.sessionsByDate as any);

  for (const [k, arr] of iter) sbd[k] = (arr ?? []).map(encodeSession);

  // 2) notebookProgress (accept Map or Record)
  const np: Record<string, unknown> = state.notebookProgress instanceof Map
    ? Object.fromEntries(state.notebookProgress.entries())
    : (state.notebookProgress as any ?? {});

  // 3) nextAvailableDate → TS
  return {
    ...state,
    sessionsByDate: sbd,
    notebookProgress: np,
    nextAvailableDate: toTS(state.nextAvailableDate),
  };
}

/**
 * @function decodeState
 * @purpose wire → StudyPlanState with runtime Dates/Maps.
 * @steps
 *   1) Record sessionsByDate → Map<string, StudySession[]>
 *   2) Record notebookProgress → Map<string, unknown>
 *   3) nextAvailableDate TS → Date
 */
function decodeState(w: StudyPlanStateWire): StudyPlanState {
  const sbd = new Map<string, StudySession[]>();
  for (const [k, arr] of Object.entries(w.sessionsByDate ?? {})) {
    sbd.set(k, (arr ?? []).map(decodeSession));
  }
  const np = new Map<string, unknown>(Object.entries(w.notebookProgress ?? {}));
  return {
    ...w,
    sessionsByDate: sbd,
    notebookProgress: np as any,
    nextAvailableDate: fromTS(w.nextAvailableDate),
  };
}

/**
 * @function encodeOutput
 * @purpose StudyPlanOutput → wire.
 * @steps
 *   1) sessions[] → encodeSession[]
 *   2) planMetadata start/end → TS
 *   3) state → encodeState()
 */
function encodeOutput(out: StudyPlanOutput): StudyPlanOutputWire {
  return {
    sessions: out.sessions.map(encodeSession),
    planMetadata: {
      ...out.planMetadata,
      startDate: toTS(out.planMetadata.startDate),
      endDate: toTS(out.planMetadata.endDate),
    },
    state: encodeState(out.state),
  };
}

/**
 * @function decodeOutput
 * @purpose wire → StudyPlanOutput (runtime).
 * @steps
 *   1) sessions[] → decodeSession[]
 *   2) planMetadata start/end → Date
 *   3) state → decodeState()
 */
function decodeOutput(w: StudyPlanOutputWire): StudyPlanOutput {
  return {
    sessions: (w.sessions ?? []).map(decodeSession),
    planMetadata: {
      ...w.planMetadata,
      startDate: fromTS(w.planMetadata.startDate),
      endDate: fromTS(w.planMetadata.endDate),
    },
    state: decodeState(w.state),
  };
}

// ---------- Public adapter API ----------


/**
 * @function generateCalendarDownloadUrl
 * @purpose Mint a time-limited signed READ URL for the user’s calendar blob.
 * // update - 1
 * @steps
 *   1) Compute canonical path via resolveCalendarPath(uid).
 *   2) Use Admin bucket to create a v4 signed URL (action=read, 5 min TTL).
 *   3) Return { downloadUrl, path }.
 */
export async function generateCalendarDownloadUrl(uid: string): Promise<{ downloadUrl: string; path: string }> {
  const path = resolveCalendarPath(uid);
  const file = admin.storage().bucket().file(path);
  const [downloadUrl] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + 5 * 60 * 1000,
  });
  return { downloadUrl, path };
}


/**
 * @function generateCalendarUploadUrl
 * @purpose Mint a time-limited signed WRITE URL for the user’s calendar blob.
 * // update - 1
 * @steps
 *   1) Compute canonical path via resolveCalendarPath(uid).
 *   2) Use Admin bucket to create a v4 signed URL (action=write, 5 min TTL) requiring
 *      Content-Type: application/json for integrity.
 *   3) Return { uploadUrl, path }.
 */
export async function generateCalendarUploadUrl(uid: string): Promise<{ uploadUrl: string; path: string }> {
  const path = resolveCalendarPath(uid);
  const file = admin.storage().bucket().file(path);
  const [uploadUrl] = await file.getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: Date.now() + 5 * 60 * 1000,
    contentType: 'application/json',
  });
  return { uploadUrl, path };
}


/**
 * @function deleteCalendar
 * @purpose Permanently delete the user’s calendar blob from Storage.
 * // update - 1
 * @steps
 *   1) Compute canonical path.
 *   2) Attempt server-side delete; ignore 404-like errors.
 *   3) Return void.
 */
export async function deleteCalendar(uid: string): Promise<void> {
  const path = resolveCalendarPath(uid);
  const file = admin.storage().bucket().file(path);
  try {
    await file.delete();
  } catch (e: any) {
    // Gracefully ignore missing file
    const code = e?.code ?? e?.statusCode;
    if (code !== 404 && code !== 412) throw e;
  }
}