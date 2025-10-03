// app/src/services/calendar/CalendarApi.ts

/**
 * @file CalendarApi.ts
 * @description
 *   CalendarApi is a thin, production-ready HTTP client dedicated to synchronizing the calendar
 *   state with the backend. Its single responsibility is to perform network I/O against the
 *   `/api/calendar/persist` endpoint and (de)serialize complex calendar structures to and from
 *   JSON with full date handling. This file intentionally contains **no local caching** and
 *   **no browser storage** logic; React memory (via CalendarContext) is the only client-side
 *   source of truth. The API methods are designed for a local-first workflow where the UI renders
 *   from context immediately and then optionally persists the entire state to the backend:
 *   - `loadAll()` hydrates context when it’s empty (first open or app start).
 *   - `saveAll(payload)` persists the in-memory state optimistically (fire-and-forget or awaited).
 *   - `clearAll()` removes server-side calendar state for a full reset.
 *   The serializer is careful with nested dates (month/day/session), time slots, and version
 *   fields. Logging statements provide minimal but meaningful observability for diagnose-only
 *   scenarios without cluttering console output.
 */

import {
  CalendarData,
  CalendarMonth,
  DailyStudyPlan,
  StudySession,
  ScheduleConfig,
} from '@/app/Library/Definitions/CalendarDefinitions';
import type { StudyPlan, StudyPlanIndex } from '@/app/src/services/calendar/StudyPlanCore';

/** Accept full or partial payloads on save to enable incremental writes if desired. */
export type CalendarApiPayload = Partial<CalendarData>;



/**
 * @function ensureDate
 * @purpose Same semantics as in firebase.ts but local to this module.
 */
function ensureDate(v: unknown): Date { // update - 3
  if (v instanceof Date) return v;
  if (v && typeof (v as any).toDate === 'function') return (v as any).toDate();
  if (typeof v === 'string' || typeof v === 'number') {
    const d = new Date(v);
    return isNaN(d.getTime()) ? new Date() : d;
  }
  return new Date();
}

/**
 * @function toIso
 * @purpose Convert any date-like value to ISO string deterministically.
 */
function toIso(v: unknown): string { // update - 3
  return ensureDate(v).toISOString();
}


/**
 * @function serializeScheduleConfig
 * @description
 *   Converts a ScheduleConfig into a JSON-safe structure. Ensures that the `startDate` Date object
 *   is represented as an ISO string and preserves multi-subject properties—subjectsPerDay,
 *   preferredTimeSlots, and maxSessionsPerDay. This keeps the server contract stable and prevents
 *   accidental loss of typed data due to implicit JSON conversions.
 */
function serializeScheduleConfig(config: ScheduleConfig | null): any {
  if (!config) return null;
  return {
    ...config,
    startDate: config.startDate instanceof Date ? config.startDate.toISOString() : config.startDate,
  };
}

/**
 * @function deserializeScheduleConfig
 * @description
 *   Parses a serialized schedule configuration into a typed ScheduleConfig, safely converting
 *   `startDate` from ISO string to Date and providing sane defaults for newer fields to maintain
 *   backward compatibility with older payloads. Returns `null` when input is absent or invalid,
 *   leaving the context to apply its own defaults if needed.
 */
function deserializeScheduleConfig(raw: any): ScheduleConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  return {
    unitsPerBlockSession: Number(raw.unitsPerBlockSession ?? 3),
    revisionsPerLesson: Number(raw.revisionsPerLesson ?? 2),
    startDate: new Date(raw.startDate ?? Date.now()),
    daysPerWeek: Array.isArray(raw.daysPerWeek) ? raw.daysPerWeek.map(Number) : [1, 2, 3, 4, 5],
    subjectsPerDay: Number(raw.subjectsPerDay ?? 3),
    preferredTimeSlots: Array.isArray(raw.preferredTimeSlots)
      ? raw.preferredTimeSlots
      : ['morning', 'afternoon', 'evening'],
    maxSessionsPerDay: Number(raw.maxSessionsPerDay ?? 6),
  };
}

/**
 * @function serializePlan
 * @purpose Convert a StudyPlan into a JSON-safe payload with ISO dates (day/session/meta).
 * @steps
 *   1) Null → null
 *   2) Day: date → ISO via toIso
 *   3) Session: date → ISO; notebookMeta.lastUpdated → ISO
 */
// update - 2
function serializePlan(plan: StudyPlan | null): any {
  if (!plan) return null;
  return {
    ...plan,
    days: plan.days.map(d => ({
      ...d,
      date: toIso(d.date as any),
      sessions: d.sessions.map(s => ({
        ...s,
        date: toIso(s.date as any),
        notebookMeta: { ...s.notebookMeta, lastUpdated: toIso(s.notebookMeta.lastUpdated as any) },
      })),
    })),
  };
}


/**
 * @function deserializePlan
 * @purpose
 *   Convert a serialized StudyPlan back to rich objects with Date instances.
 * @steps
 *   1) If falsy → return null.
 *   2) Validate array-ness of days.
 *   3) Hydrate Date fields on day/date and session/date + notebookMeta.lastUpdated.
 */
function deserializePlan(raw: any): StudyPlan | null { // update - 1
  if (!raw) return null;
  if (!Array.isArray(raw.days)) throw new Error('Invalid StudyPlan payload: days missing');

  return {
    ...raw,
    days: raw.days.map((d: any) => ({
      ...d,
      date: new Date(d.date),
      sessions: Array.isArray(d.sessions)
        ? d.sessions.map((s: any) => ({
            ...s,
            date: new Date(s.date),
            notebookMeta: {
              ...s.notebookMeta,
              lastUpdated: new Date(s.notebookMeta.lastUpdated),
            },
          }))
        : [],
    })),
  };
}
/**
 * @class CalendarApi
 * @description
 *   A minimal, strongly-typed HTTP client to load, save, and clear calendar data on the server.
 *   It **does not** attempt to cache responses or interact with any browser storage. Consumers
 *   (i.e., CalendarContext) fully own in-memory state; CalendarApi simply mirrors that state to
 *   the backend. Each public method logs high-signal checkpoints for debugging and returns typed
 *   data or throws on failure. All serialization is O(N) where N is the number of sessions in
 *   the current month (necessary to convert nested dates).
 */
export class CalendarApi {
  private readonly endpoint: string;

  constructor(endpoint: string = '/api/calendar/persist') {
    this.endpoint = endpoint;
  }

  /**
   * @method loadAll
   * @purpose
   *   Fetch canonical payload: { plan, planIndex, scalars }.
   * @steps
   *   1) GET JSON.
   *   2) Deserialize scheduleConfig and plan.
   *   3) Return typed CalendarData with defaults for missing scalars.
   */
  async loadAll(): Promise<CalendarData> { // update - 2
    console.log('[CalendarApi.ts][9101] GET /persist (plan) start');
    const res = await fetch(this.endpoint, { method: 'GET', credentials: 'include' });
    if (!res.ok) throw new Error(`Load failed: ${res.status} ${res.statusText}`);

    const raw = await res.json();
    const scheduleConfig = deserializeScheduleConfig(raw?.scheduleConfig ?? null);
    const plan = deserializePlan(raw?.plan ?? null);
    const planIndex: StudyPlanIndex = raw?.planIndex ?? {};

    const payload: CalendarData = {
      selectedNotebooks: Array.isArray(raw?.selectedNotebooks) ? raw.selectedNotebooks : [],
      scheduleConfig: scheduleConfig ?? {
        unitsPerBlockSession: 3,
        revisionsPerLesson: 2,
        startDate: new Date(),
        daysPerWeek: [1, 2, 3, 4, 5],
        subjectsPerDay: 3,
        preferredTimeSlots: ['morning', 'afternoon', 'evening'],
        maxSessionsPerDay: 6,
      },
      completedSessions: Array.isArray(raw?.completedSessions) ? raw.completedSessions : [],
      lastUpdated: raw?.lastUpdated ? new Date(raw.lastUpdated) : new Date(),
      version: String(raw?.version ?? '2.0'),
      plan,
      planIndex,
    };

    console.log('[CalendarApi.ts][9102] GET /persist ok → days=%d indexKeys=%d',
      plan?.days?.length ?? 0, Object.keys(planIndex || {}).length);
    return payload;
  }

  /**
   * @method saveAll
   * @purpose
   *   Persist canonical payload with Dates serialized.
   * @steps
   *   1) Build body with scalars + serializeScheduleConfig + serializePlan.
   *   2) PUT → /persist.
   *   3) Throw on non-2xx.
   */
  async saveAll(payload: Partial<CalendarData>): Promise<void> { // update - 2
    console.log('[CalendarApi.ts][9103] PUT /persist (plan) start');

    const body = {
      selectedNotebooks: payload.selectedNotebooks ?? [],
      scheduleConfig: serializeScheduleConfig(payload.scheduleConfig ?? null),
      completedSessions: payload.completedSessions ?? [],
      lastUpdated: (payload.lastUpdated ?? new Date()).toISOString(),
      version: payload.version ?? '2.0',
      plan: serializePlan(payload.plan ?? null),
      planIndex: payload.planIndex ?? {},
    };

    const res = await fetch(this.endpoint, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`Save failed: ${res.status} ${res.statusText}`);
    console.log('[CalendarApi.ts][9104] PUT /persist ok');
  }

  /**
   * @method clearAll
   * @purpose DELETE persisted calendar state.
   */
  async clearAll(): Promise<void> { // update - 2
    const res = await fetch(this.endpoint, { method: 'DELETE', credentials: 'include' });
    if (!res.ok) throw new Error(`Clear failed: ${res.status} ${res.statusText}`);
  }
}
