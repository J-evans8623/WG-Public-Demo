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

/** Accept full or partial payloads on save to enable incremental writes if desired. */
export type CalendarApiPayload = Partial<CalendarData>;

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
 * @function serializeMonth
 * @description
 *   Converts a CalendarMonth into a JSON-safe structure:
 *   - All Date fields (month daily plan dates and session dates) are transformed into ISO strings.
 *   - notebookMeta.lastUpdated is serialized to ISO.
 *   This enables a clean, deterministic wire format for storage and retrieval across environments.
 */
function serializeMonth(month: CalendarMonth | null): any {
  if (!month) return null;
  return {
    year: month.year,
    month: month.month,
    dailyPlans: month.dailyPlans.map((plan) => ({
      ...plan,
      date: plan.date instanceof Date ? plan.date.toISOString() : plan.date,
      sessions: plan.sessions.map((s) => ({
        ...s,
        date: s.date instanceof Date ? s.date.toISOString() : s.date,
        notebookMeta: {
          ...s.notebookMeta,
          lastUpdated:
            s.notebookMeta.lastUpdated instanceof Date
              ? s.notebookMeta.lastUpdated.toISOString()
              : s.notebookMeta.lastUpdated,
        },
      })),
    })),
    monthlySummary: month.monthlySummary,
  };
}

/**
 * @function deserializeMonth
 * @description
 *   Reconstructs a CalendarMonth from its serialized JSON form. It:
 *   - Converts all day and session `date` strings back into Date objects.
 *   - Restores `notebookMeta.lastUpdated` as a Date.
 *   - Preserves monthlySummary verbatim.
 *   If the input is malformed, throws an Error so callers can surface a user-friendly message.
 */
function deserializeMonth(raw: any): CalendarMonth | null {
  if (!raw) return null;
  if (
    typeof raw.year !== 'number' ||
    typeof raw.month !== 'number' ||
    !Array.isArray(raw.dailyPlans)
  ) {
    throw new Error('Invalid month payload');
  }

  const dailyPlans: DailyStudyPlan[] = raw.dailyPlans.map((plan: any) => {
    if (!plan) throw new Error('Invalid daily plan entry');
    const date = new Date(plan.date);
    const sessions: StudySession[] = Array.isArray(plan.sessions)
      ? plan.sessions.map((s: any) => ({
          ...s,
          date: new Date(s.date),
          notebookMeta: {
            ...s.notebookMeta,
            lastUpdated: new Date(s?.notebookMeta?.lastUpdated ?? Date.now()),
          },
        }))
      : [];

    return {
      ...plan,
      date,
      sessions,
    };
  });

  return {
    year: raw.year,
    month: raw.month,
    dailyPlans,
    monthlySummary: raw.monthlySummary,
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
   * @description
   *   Fetches the entire calendar payload from the backend and converts it into rich, typed data
   *   suitable for direct use in React state. Dates for month, daily plans, sessions, and config
   *   are rehydrated as `Date` instances. On any non-2xx response, throws an Error; callers should
   *   catch and surface a user-friendly message. Time complexity is O(N) where N is the number of
   *   sessions in the month due to nested deserialization.
   */
  async loadAll(): Promise<CalendarData> {
    console.log('[CalendarApi.ts][9001] › GET loadAll() start →', this.endpoint);
    const res = await fetch(this.endpoint, {
      method: 'GET',
      credentials: 'include',
    });

    if (!res.ok) {
      const msg = `Load failed: ${res.status} ${res.statusText}`;
      console.error('[CalendarApi.ts][9002] › GET loadAll() error:', msg);
      throw new Error(msg);
    }

    const raw = await res.json();

    const scheduleConfig = deserializeScheduleConfig(raw?.scheduleConfig ?? null);
    const currentMonth = raw?.currentMonth ? deserializeMonth(raw.currentMonth) : null;

    const payload: CalendarData = {
      selectedNotebooks: Array.isArray(raw?.selectedNotebooks) ? raw.selectedNotebooks : [],
      scheduleConfig: scheduleConfig ?? {
        // sane defaults if backend returns nothing
        unitsPerBlockSession: 3,
        revisionsPerLesson: 2,
        startDate: new Date(),
        daysPerWeek: [1, 2, 3, 4, 5],
        subjectsPerDay: 3,
        preferredTimeSlots: ['morning', 'afternoon', 'evening'],
        maxSessionsPerDay: 6,
      },
      currentMonth,
      completedSessions: Array.isArray(raw?.completedSessions) ? raw.completedSessions : [],
      lastUpdated: raw?.lastUpdated ? new Date(raw.lastUpdated) : new Date(),
      version: String(raw?.version ?? '2.0'),
    };

    console.log(
      '[CalendarApi.ts][9003] › GET loadAll() ok: notebooks=%d, sessions=%d',
      payload.selectedNotebooks.length,
      payload.currentMonth?.monthlySummary?.totalSessions ?? 0
    );
    return payload;
  }

  /**
   * @method saveAll
   * @description
   *   Persists the provided calendar payload to the backend. This method accepts a partial payload
   *   to support incremental syncs, but callers typically pass the complete in-memory state. Date
   *   objects are serialized to ISO strings across the structure (config startDate, month, daily
   *   plans, sessions, and notebook metadata timestamps). Throws an Error on non-2xx responses to
   *   allow the caller to decide on retry/backoff. Time complexity is O(N) with N = sessions count.
   */
  async saveAll(payload: CalendarApiPayload): Promise<void> {
    console.log('[CalendarApi.ts][9004] › PUT saveAll() start →', this.endpoint);

    const body = {
      selectedNotebooks: payload.selectedNotebooks ?? [],
      scheduleConfig: serializeScheduleConfig(payload.scheduleConfig ?? null),
      currentMonth: serializeMonth(payload.currentMonth ?? null),
      completedSessions: payload.completedSessions ?? [],
      lastUpdated: (payload.lastUpdated ?? new Date()).toISOString(),
      version: payload.version ?? '2.0',
    };

    const res = await fetch(this.endpoint, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const msg = `Save failed: ${res.status} ${res.statusText}`;
      console.error('[CalendarApi.ts][9005] › PUT saveAll() error:', msg);
      throw new Error(msg);
    }

    console.log('[CalendarApi.ts][9006] › PUT saveAll() ok');
  }

  /**
   * @method clearAll
   * @description
   *   Issues a DELETE to the backend to remove all stored calendar data for the current user.
   *   This is typically used by a “Reset Calendar” flow or as part of a migration. The method
   *   makes no attempt to clear local state (that is CalendarContext’s job), keeping concerns
   *   well separated. On error, throws so the UI can surface an appropriate message.
   */
  async clearAll(): Promise<void> {
    console.log('[CalendarApi.ts][9007] › DELETE clearAll() start →', this.endpoint);

    const res = await fetch(this.endpoint, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!res.ok) {
      const msg = `Clear failed: ${res.status} ${res.statusText}`;
      console.error('[CalendarApi.ts][9008] › DELETE clearAll() error:', msg);
      throw new Error(msg);
    }

    console.log('[CalendarApi.ts][9009] › DELETE clearAll() ok');
  }
}
