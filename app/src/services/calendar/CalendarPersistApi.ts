/**
 * @file CalendarPersistApi.ts
 * @responsibility
 * A tiny browser client for `/api/calendar/persist`. It strictly handles:
 *   - load(): GET persisted study plan + UI fields
 *   - store(): POST persisted study plan + UI fields
 *   - clear(): DELETE persisted payload
 * This module centralizes fetch options, response checks, and types so React code remains clean.
 */

import type { StudyPlanOutput} from '@/app/studygraph/(studygraph)/components/layout/Calendar/study-planner/models/StudyPlanOutput.ts'

export type PersistLoadResult = {
  studyPlan: StudyPlanOutput | null;
  selectedNotebooks: string[];
  completedSessions: string[];
};

export class CalendarPersistApi {
  /** 
   * @function load
   * @description Load persisted study plan envelope for current user.
   * @steps
   *  1) GET `/api/calendar/persist`.
   *  2) Guard response; return defaults if not found.
   *  3) JSON parse and narrow to PersistLoadResult.
   */
public async load(): Promise<PersistLoadResult> {
  const res = await fetch('/api/calendar/persist', { method: 'GET', credentials: 'include' });
  if (!res.ok) {
    if (res.status === 404) return { studyPlan: null, selectedNotebooks: [], completedSessions: [] };
    throw new Error(`CalendarPersistApi.load failed: ${res.status}`);
  }

  const body = await res.json();

  // ---- helpers to revive runtime shapes from JSON ----
  const reviveDate = (v: any): Date => {
    if (v instanceof Date) return v;
    // Handle undefined/null safely; new Date(undefined) => Invalid Date, so guard:
    if (v === undefined || v === null) return new Date(NaN);
    // Accept ISO strings or millis
    return typeof v === 'number' || typeof v === 'string' ? new Date(v) : new Date(NaN);
  };

  const reviveSession = (s: any) => ({
    ...s,
    date: reviveDate(s?.date),
    notebookMeta: {
      ...s?.notebookMeta,
      lastUpdated: reviveDate(s?.notebookMeta?.lastUpdated),
    },
  });

  const reviveStudyPlan = (sp: any) => {
    if (!sp) return null;

    const sessions = Array.isArray(sp.sessions) ? sp.sessions.map(reviveSession) : [];

    const planMetadata = {
      ...sp.planMetadata,
      startDate: reviveDate(sp?.planMetadata?.startDate),
      endDate: reviveDate(sp?.planMetadata?.endDate),
    };

    // sessionsByDate came across as a plain object; rebuild Map<string, StudySession[]>
    const sbdEntries =
      sp?.state?.sessionsByDate && typeof sp.state.sessionsByDate === 'object'
        ? Object.entries(sp.state.sessionsByDate).map(([k, arr]) => [k, (arr as any[]).map(reviveSession)])
        : [];

    const state = {
      ...sp.state,
      nextAvailableDate: reviveDate(sp?.state?.nextAvailableDate),
      sessionsByDate: new Map<string, any[]>(sbdEntries),
      notebookProgress: new Map<string, unknown>(
        Object.entries((sp?.state?.notebookProgress ?? {}) as Record<string, unknown>)
      ),
      // keep config as-is (currently only DayAvailability); no date fields to revive
      config: sp?.state?.config,
    };

    return { sessions, planMetadata, state };
  };

  return {
    studyPlan: body?.studyPlan ? reviveStudyPlan(body.studyPlan) : null,
    selectedNotebooks: Array.isArray(body?.selectedNotebooks) ? body.selectedNotebooks : [],
    completedSessions: Array.isArray(body?.completedSessions) ? body.completedSessions : [],
  };
}


  /**
   * @function store
   * @description Persist study plan + UI fields.
   * @steps
   *  1) POST `/api/calendar/persist` with JSON body.
   *  2) Ensure 2xx; throw on error for caller to surface.
   */
  public async store(payload: {
    studyPlan: StudyPlanOutput;
    selectedNotebooks: string[];
    completedSessions: string[];
  }): Promise<void> {
    const res = await fetch('/api/calendar/persist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`CalendarPersistApi.store failed: ${res.status}`);
  }

  /**
   * @function clear
   * @description Clear persisted study plan for the user.
   * @steps
   *  1) DELETE `/api/calendar/persist`.
   *  2) Ensure 2xx; throw on error for caller to surface.
   */
  public async clear(): Promise<void> {
    const res = await fetch('/api/calendar/persist', { method: 'DELETE', credentials: 'include' });
    if (!res.ok) throw new Error(`CalendarPersistApi.clear failed: ${res.status}`);
  }
}
