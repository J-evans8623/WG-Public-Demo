/**
 * @file CalendarPersistApi.ts
 * @responsibility
 *   Browser client for the URL-minting `/api/calendar/persist`:
 *     • load():  GET → {downloadUrl} → fetch JSON → revive → return
 *     • store(): POST → {uploadUrl}  → PUT JSON
 *     • clear(): DELETE
 */

import type { StudyPlanOutput } from '@/app/studygraph/(studygraph)/components/layout/Calendar/study-planner/models/StudyPlanOutput.ts';
import { supersedingCall } from '@/app/src/net/SupersedingCaller';

export type PersistLoadResult = {
  studyPlan: StudyPlanOutput | null;
  selectedNotebooks: string[];
  completedSessions: string[];
};

export class CalendarPersistApi {
  /**
   * load
   * @description Two-step read via signed URL with a superseding GET mint.
   * @steps
   *   1) supersedingCall("calendar:persist:load") → GET /api/calendar/persist → { downloadUrl }.
   *   2) fetch(downloadUrl) → JSON or 404 → defaults.
   *   3) Revive dates/Maps to runtime shapes and return.
   */
  public async load(): Promise<PersistLoadResult> {
    const lane = 'calendar:persist:load';

    const makeRequest = async (signal: AbortSignal): Promise<Response> => {
      return fetch('/api/calendar/persist', { method: 'GET', credentials: 'include', signal });
    };

    const res = await supersedingCall(lane, null, makeRequest);

    // If superseded or waiting on Retry-After, let caller decide (no cached state here).
    if (!res) {
      const err: any = new Error('CALENDAR_LOAD_DEFERRED');
      err.deferred = true;
      throw err;
    }

    if (!res.ok) {
      if (res.status === 404) {
        return { studyPlan: null, selectedNotebooks: [], completedSessions: [] };
      }
      throw new Error(`CalendarPersistApi.load failed: ${res.status}`);
    }

    const { downloadUrl } = await res.json();

    // If blob not created yet, Storage returns 404; treat as empty default.
    const blobRes = await fetch(downloadUrl, { method: 'GET', credentials: 'omit' });
    if (blobRes.status === 404) {
      return { studyPlan: null, selectedNotebooks: [], completedSessions: [] };
    }
    if (!blobRes.ok) throw new Error(`CalendarPersistApi.load blob fetch failed: ${blobRes.status}`);

    const body = await blobRes.json();

    // ---- revive helpers (unchanged behavior) ----
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
   * store
   * @description Two-step write via signed URL with latest-wins semantics.
   * @steps
   *   1) supersedingCall("calendar:persist:store", payload) runs:
   *        POST /api/calendar/persist → { uploadUrl }  (honors Retry-After on 429)
   *        PUT uploadUrl with JSON body (credentials: omit to the blob host)
   *   2) If a newer store() arrives, the older in-flight is aborted and the newest snapshot is used.
   */
  public async store(payload: {
    studyPlan: StudyPlanOutput;
    selectedNotebooks: string[];
    completedSessions: string[];
  }): Promise<void> {
    const lane = 'calendar:persist:store';

    const makeRequest = async (signal: AbortSignal, bodyUnknown: unknown): Promise<Response> => {
      // Narrow payload shape defensively.
      const body =
        bodyUnknown && typeof bodyUnknown === 'object'
          ? (bodyUnknown as {
              studyPlan: StudyPlanOutput;
              selectedNotebooks: string[];
              completedSessions: string[];
            })
          : payload;

      // Step 1: mint signed upload URL (may 429; wrapper will schedule retry)
      const mintRes = await fetch('/api/calendar/persist', {
        method: 'POST',
        credentials: 'include',
        signal,
      });
      if (!mintRes.ok) return mintRes;
      const { uploadUrl } = await mintRes.json();

      // Step 2: PUT JSON to the signed URL (no credentials to blob host)
      return fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        // signed URL host is cross-origin, do not pass `credentials`
        signal,
      });
    };

    const res = await supersedingCall(lane, payload, makeRequest);

    // If superseded/deferred due to Retry-After, just exit; the queued timer will send the latest.
    if (!res) return;

    if (!res.ok) {
      throw new Error(`CalendarPersistApi.store failed: ${res.status}`);
    }
  }

  /**
   * clear
   * @description Server-side delete (idempotent). Uses a lane to prevent redundant concurrent calls.
   * @steps
   *   1) supersedingCall("calendar:persist:clear") → DELETE /api/calendar/persist.
   *   2) Return on 2xx; throw otherwise.
   */
  public async clear(): Promise<void> {
    const lane = 'calendar:persist:clear';

    const makeRequest = async (signal: AbortSignal): Promise<Response> => {
      return fetch('/api/calendar/persist', { method: 'DELETE', credentials: 'include', signal });
    };

    const res = await supersedingCall(lane, null, makeRequest);
    if (!res) return; // deferred due to Retry-After; timer will fire

    if (!res.ok) {
      throw new Error(`CalendarPersistApi.clear failed: ${res.status}`);
    }
  }
}
