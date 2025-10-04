/**
 * @file CalendarPersistApi.ts
 * @responsibility
 *   Browser client for the URL-minting `/api/calendar/persist`:
 *     • load():  GET → {downloadUrl} → fetch JSON → revive → return
 *     • store(): POST → {uploadUrl}  → PUT JSON
 *     • clear(): DELETE
 */

import type { StudyPlanOutput } from '@/app/studygraph/(studygraph)/components/layout/Calendar/study-planner/models/StudyPlanOutput.ts';

export type PersistLoadResult = {
  studyPlan: StudyPlanOutput | null;
  selectedNotebooks: string[];
  completedSessions: string[];
};

export class CalendarPersistApi {
  /**
   * @function load
   * @description Two-step read via signed URL.
   * // update - 3
   * @steps
   *   1) GET /api/calendar/persist → { downloadUrl }.
   *   2) fetch(downloadUrl) → JSON or 404 → defaults.
   *   3) Revive dates/Maps to runtime shapes and return.
   */
  public async load(): Promise<PersistLoadResult> {
    const res = await fetch('/api/calendar/persist', { method: 'GET', credentials: 'include' });
    if (!res.ok) {
      if (res.status === 404) return { studyPlan: null, selectedNotebooks: [], completedSessions: [] };
      throw new Error(`CalendarPersistApi.load failed: ${res.status}`);
    }
    const { downloadUrl } = await res.json();
    // If file does not exist yet, Storage returns 404; treat as empty.
    const blobRes = await fetch(downloadUrl, { method: 'GET', credentials: 'omit' });
    if (blobRes.status === 404) {
      return { studyPlan: null, selectedNotebooks: [], completedSessions: [] };
    }
    if (!blobRes.ok) throw new Error(`CalendarPersistApi.load blob fetch failed: ${blobRes.status}`);

    const body = await blobRes.json();

    // ---- helpers to revive runtime shapes from JSON (unchanged) ----
    const reviveDate = (v: any): Date => {
      if (v instanceof Date) return v;
      if (v === undefined || v === null) return new Date(NaN);
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
const sbdEntries =
  sp?.state?.sessionsByDate && typeof sp.state.sessionsByDate === 'object'
    ? Object.entries(sp.state.sessionsByDate).map(
        ([k, arr]) => [k, (arr as any[]).map(reviveSession)] as [string, any[]]
      )
    : [];

const state = {
  ...sp.state,
  nextAvailableDate: reviveDate(sp?.state?.nextAvailableDate),
  sessionsByDate: new Map<string, any[]>(sbdEntries),
  notebookProgress: new Map<string, unknown>(
    Object.entries((sp?.state?.notebookProgress ?? {}) as Record<string, unknown>)
  ),
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
   * @description Two-step write via signed URL.
   * // update - 3
   * @steps
   *   1) POST /api/calendar/persist → { uploadUrl }.
   *   2) PUT uploadUrl with JSON body and Content-Type: application/json.
   */
  public async store(payload: {
    studyPlan: StudyPlanOutput;
    selectedNotebooks: string[];
    completedSessions: string[];
  }): Promise<void> {
    const res = await fetch('/api/calendar/persist', {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`CalendarPersistApi.store (mint) failed: ${res.status}`);
    const { uploadUrl } = await res.json();

    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!putRes.ok) throw new Error(`CalendarPersistApi.store (PUT) failed: ${putRes.status}`);
  }

  /**
   * @function clear
   * @description Server-side delete of the blob.
   * // update - 2
   * @steps
   *   1) DELETE /api/calendar/persist.
   *   2) Return on 2xx; throw otherwise.
   */
  public async clear(): Promise<void> {
    const res = await fetch('/api/calendar/persist', { method: 'DELETE', credentials: 'include' });
    if (!res.ok) throw new Error(`CalendarPersistApi.clear failed: ${res.status}`);
  }
}
