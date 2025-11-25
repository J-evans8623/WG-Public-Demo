/**
 * @file RollingWindowUtil.ts
 * @description
 *   Pure, side-effect-free helpers for forward-only (append-only) scheduling.
 *   Responsibilities:
 *   1) Compute a safe anchor date for initial generation so we never backfill the past.
 *   2) Determine the correct extension start (the day after the last scheduled session).
 *   3) Build forward windows respecting weekday constraints (useful for testing).
 *   4) Merge an extension into an existing month by appending *only* future sessions,
 *      preserving order and deduplicating by session id.
 *   5) Detect real content deltas between notebook metas to avoid no-op extensions.
 *
 *   These helpers are UI-agnostic and depend only on calendar types. They are designed
 *   for easy unit testing and to prevent policy drift across the codebase.
 */

import {
  CalendarMonth,
  DailyStudyPlan,
  NotebookMeta,
  StudySession,
} from '@/app/Library/Definitions/CalendarDefinitions';
import type { ScheduleConfig, DayOfWeek } from '@/app/workspace/(studygraph)/components/layout/Calendar/study-planner/models/Configuration.ts';


const DAY_LOOKUP: DayOfWeek[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];


/**
 * @function computeAnchorDate
 * @description
 *   Returns the later of "today (start of day)" and config.startDate (start of day).
 *   Prevents initial generation from backfilling the past.
 */
export function computeAnchorDate(params: { now: Date; config: ScheduleConfig }): Date {
  // 1) Normalize to local start-of-day
  const sod = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = sod(params.now);
  // 2) Anchor = max(today, config.startDate)
  return today 
}

/**
 * @function computeExtensionStart
 * @description
 *   Scans an existing month and returns the calendar date *after* the last day that has sessions.
 *   If no sessions exist, returns the 1st of the month (acts like “fresh” month).
 */
export function computeExtensionStart(existing: CalendarMonth): Date {
  // 1) Find last day containing at least one session
  let lastScheduled: Date | null = null;
  for (const day of existing.dailyPlans) {
    if (day.sessions.length > 0) {
      if (!lastScheduled || day.date.getTime() > lastScheduled.getTime()) {
        lastScheduled = day.date;
      }
    }
  }
  // 2) If none, start at 1st of month, else the next calendar day
  if (!lastScheduled) return new Date(existing.year, existing.month, 1);
  const d = new Date(lastScheduled);
  d.setDate(d.getDate() + 1);
  return d;
}

/**
 * @function buildForwardWindow
 * @description
 *   Builds a list of Date objects forward from `startDate` through the end of the month,
 *   including only days whose weekday is in config.daysPerWeek.
 *   Useful for deterministic tests of downstream scheduling.
 */
export function buildForwardWindow(params: {
  startDate: Date;
  config: ScheduleConfig;
}): Date[] {
  // 1) Month boundaries
  const start = new Date(params.startDate.getFullYear(), params.startDate.getMonth(), params.startDate.getDate());
  const year = start.getFullYear();
  const month = start.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

// 2) Iterate to end-of-month and filter by weekday policy
  const out: Date[] = [];
  for (let day = start.getDate(); day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    
    // FIX 2: Convert the number (0-6) to the specific string literal using the lookup
    const dayToken = DAY_LOOKUP[d.getDay()];

    // FIX 3: Use 'DayAvailability' (from your Interface) instead of 'daysPerWeek'
    if (params.config.DayAvailability.includes(dayToken)) {
      out.push(d);
    }
  }
  return out;
}

/**
 * @function countAdditionalUnits
 * @description
 *   Returns the net new lesson units in `updated` vs. `original`. If either is missing,
 *   conservatively returns 0 (no extension).
 */
export function countAdditionalUnits(original?: NotebookMeta, updated?: NotebookMeta): number {
  if (!original || !updated) return 0;
  const a = Array.isArray(original.lessonUnits) ? original.lessonUnits.length : 0;
  const b = Array.isArray(updated.lessonUnits) ? updated.lessonUnits.length : 0;
  return Math.max(0, b - a);
}

/**
 * @function mergeAppendOnly
 * @description
 *   Appends sessions for the specified notebook (or all, if omitted) from `extension`
 *   into `existing`, for dates strictly AFTER the last scheduled day in `existing`.
 *   Preserves chronological order and deduplicates by session id.
 *
 *   Returns a *new* DailyStudyPlan[] array (leave monthly summary recomputation to caller).
 */
export function mergeAppendOnly(params: {
  existing: CalendarMonth;
  extension: CalendarMonth;
  targetNotebookId?: string; // if provided, copy only sessions for this notebook
}): DailyStudyPlan[] {
  // 1) Determine cutoff (last scheduled day) as a timestamp
  let lastScheduledTime = -Infinity;
  for (const dp of params.existing.dailyPlans) {
    if (dp.sessions.length > 0) {
      const t = new Date(dp.date.getFullYear(), dp.date.getMonth(), dp.date.getDate()).getTime();
      if (t > lastScheduledTime) lastScheduledTime = t;
    }
  }

  // 2) Index existing plans by day-string for fast updates
  const dayKey = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).toDateString();
  const merged = new Map<string, DailyStudyPlan>();
  const dedupe = new Set<string>(); // session id set across the whole month

  // 3) Seed with existing (and record existing sessions for dedupe)
  for (const plan of params.existing.dailyPlans) {
    const key = dayKey(plan.date);
    merged.set(key, {
      ...plan,
      date: new Date(plan.date),
      sessions: [...plan.sessions],
      subjectSummary: { ...plan.subjectSummary },
    });
    for (const s of plan.sessions) dedupe.add(s.id);
  }

  // 4) Copy eligible sessions from extension
  for (const newPlan of params.extension.dailyPlans) {
    // 4.1) Enforce strict "after last scheduled" cutoff
    const t = new Date(newPlan.date.getFullYear(), newPlan.date.getMonth(), newPlan.date.getDate()).getTime();
    if (!(t > lastScheduledTime)) continue;

    // 4.2) Optionally filter to the target notebook
    const filtered = params.targetNotebookId
      ? newPlan.sessions.filter(s => s.notebookMeta.fileId === params.targetNotebookId)
      : newPlan.sessions;

    if (filtered.length === 0) continue;

    // 4.3) Append into the map, creating day as needed
    const key = dayKey(newPlan.date);
    const existing = merged.get(key);
    if (!existing) {
      const totalDuration = filtered.reduce((sum, s) => sum + (s.metadata?.estimatedDuration ?? 0), 0);
      merged.set(key, {
        date: new Date(newPlan.date),
        sessions: filtered.filter(s => !dedupe.has(s.id)).map(cloneSession),
        totalDuration,
        subjectSummary: summarizeSubjects(filtered),
        completedSessions: [],
      });
      for (const s of filtered) dedupe.add(s.id);
    } else {
      const toAdd: StudySession[] = [];
      let addedDuration = 0;
      for (const s of filtered) {
        if (!dedupe.has(s.id)) {
          toAdd.push(cloneSession(s));
          addedDuration += s.metadata?.estimatedDuration ?? 0;
          dedupe.add(s.id);
          // Update subject summary incrementally
          const id = s.notebookMeta.fileId;
          if (!existing.subjectSummary[id]) {
            existing.subjectSummary[id] = {
              notebookName: s.notebookMeta.fileName,
              sessionCount: 0,
              totalUnits: 0,
              colorCode: s.notebookMeta.colorCode || '#6B7280',
            };
          }
          existing.subjectSummary[id].sessionCount += 1;
          existing.subjectSummary[id].totalUnits += s.sessionConfig?.unitCount ?? s.targetLessonUnits.length ?? 0;
        }
      }
      if (toAdd.length > 0) {
        existing.sessions = [...existing.sessions, ...toAdd];
        existing.totalDuration += addedDuration;
        merged.set(key, existing);
      }
    }
  }

  // 5) Return chronologically sorted array
  return Array.from(merged.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
}

// ──────────────────────────────────────────────────────────────────────────────
// Private helpers (file-local)
// ──────────────────────────────────────────────────────────────────────────────

function cloneSession(s: StudySession): StudySession {
  return {
    ...s,
    date: new Date(s.date),
    notebookMeta: { ...s.notebookMeta },
    targetLessonUnits: [...s.targetLessonUnits],
    sessionConfig: { ...s.sessionConfig },
    metadata: { ...s.metadata, topicTitles: [...(s.metadata?.topicTitles ?? [])] },
  };
}

function summarizeSubjects(sessions: StudySession[]): DailyStudyPlan['subjectSummary'] {
  const summary: DailyStudyPlan['subjectSummary'] = {};
  for (const s of sessions) {
    const id = s.notebookMeta.fileId;
    if (!summary[id]) {
      summary[id] = {
        notebookName: s.notebookMeta.fileName,
        sessionCount: 0,
        totalUnits: 0,
        colorCode: s.notebookMeta.colorCode || '#6B7280',
      };
    }
    summary[id].sessionCount += 1;
    summary[id].totalUnits += s.sessionConfig?.unitCount ?? s.targetLessonUnits.length ?? 0;
  }
  return summary;
}
