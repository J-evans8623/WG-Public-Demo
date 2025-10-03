/**
 * @file StudyPlanCore.ts
 * @responsibility
 *   The canonical, single source of truth for scheduling:
 *   1) Define the StudyPlan domain (multi-month, append-only).
 *   2) Deterministic session IDs (content-derived).
 *   3) Pure helpers to build, extend, slice, index, and dedupe.
 *   4) No side effects; UI/runtime services call into these helpers.
 *
 *   Consumer pattern:
 *     - Initial: buildInitialPlan(horizonDays) → persist { plan, planIndex }.
 *     - Extend:  extendPlan(plan, startDate, horizonDays) → append-only.
 *     - View:    sliceByDateRange(plan, start, end) → render.
 *     - Index:   indexPlan(plan) → O(1) day lookups by yyyy-mm-dd.
 */

import type {
  DailyStudyPlan,
  StudySession,
  NotebookMeta,
  ScheduleConfig,
} from '@/app/Library/Definitions/CalendarDefinitions';

/** Canonical plan is a chronologically ordered list of days. */
export interface PlanDay {
  date: string;               // yyyy-mm-dd (local)
  sessions: StudySession[];   // sessions scheduled for that date
  totalDuration: number;      // minutes
  subjectSummary: DailyStudyPlan['subjectSummary'];
  completedSessions: string[];
}

/** Full plan spanning months. Kept small + serializable. */
export interface StudyPlan {
  days: PlanDay[];            // sorted ascending by date
  horizonDays: number;        // rolling horizon used at build
  createdAt: string;          // ISO
  updatedAt: string;          // ISO
}

/** Fast index to access a day in O(1). */
export type StudyPlanIndex = Record<string, number>; // dateKey -> index into plan.days

/** Stable inputs used to compute deterministic session IDs. */
export interface SessionIdInput {
  fileId: string;
  unitPrimaryIdsInOrder: string[]; // targetLessonUnits.map(u => u.primaryConceptNodeID) in order
  type: 'block' | 'revision-block' | 'revision-interleaved';
  ordinal: number; // the Nth occurrence of this (fileId,type) in chronological order starting at 1
}

/**
 * @function computeSessionId
 * @purpose
 *   Deterministically derive a stable session id from immutable, content-based inputs.
 * @steps
 *   1) Normalize + serialize the input payload.
 *   2) Hash with a small non-crypto FNV-1a for speed.
 *   3) Encode as base36 for compactness and prefix with type tag.
 */
export function computeSessionId(input: SessionIdInput): string {
  // 1) serialize
  const payload = `${input.fileId}|${input.type}|${input.ordinal}|${input.unitPrimaryIdsInOrder.join(',')}`;
  // 2) fnv-1a 32-bit
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < payload.length; i++) {
    h ^= payload.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  // 3) tag + base36
  const tag = input.type === 'block' ? 'B' : input.type === 'revision-block' ? 'RB' : 'ILR';
  return `${tag}_${h.toString(36)}`;
}

/**
 * @function indexPlan
 * @purpose
 *   Build a date → index map for O(1) day lookups.
 * @steps
 *   1) Iterate days once.
 *   2) Record each date string to its array index.
 */
export function indexPlan(plan: StudyPlan): StudyPlanIndex {
  const idx: StudyPlanIndex = {};
  for (let i = 0; i < plan.days.length; i++) idx[plan.days[i].date] = i;
  return idx;
}

/**
 * @function lastPlannedDate
 * @purpose
 *   Return the yyyy-mm-dd of the last day in the plan (or null if empty).
 * @steps
 *   1) Guard empty.
 *   2) Return final element date.
 */
export function lastPlannedDate(plan: StudyPlan): string | null {
  if (!plan.days.length) return null;
  return plan.days[plan.days.length - 1].date;
}

/**
 * @function sliceByDateRange
 * @purpose
 *   Materialize a month (or arbitrary window) by slicing the canonical plan.
 * @steps
 *   1) Linear scan — plan is already sorted.
 *   2) Copy days that fall within [start,end] inclusive.
 */
export function sliceByDateRange(plan: StudyPlan, start: string, end: string): PlanDay[] {
  const out: PlanDay[] = [];
  for (const d of plan.days) {
    if (d.date >= start && d.date <= end) out.push(d);
    if (d.date > end) break;
  }
  return out;
}

/**
 * @function buildInitialPlan
 * @purpose
 *   Build a brand-new plan with a rolling horizon; inject deterministic IDs.
 * @steps
 *   1) Generate a month view at a time from `strategy` and append days in order.
 *   2) While total days < horizon, advance the month and repeat.
 *   3) While appending, rewrite each session id to a deterministic value using
 *      `computeSessionId`, maintaining per-(fileId,type) ordinals.
 *   4) Dedupe day collisions by date (merge sessions, preserve order).
 */
export function buildInitialPlan(params: {
  anchorDate: Date;
  horizonDays: number;
  notebooks: NotebookMeta[];
  config: ScheduleConfig;
  strategy: (nb: NotebookMeta[], cfg: ScheduleConfig, targetDate: Date) => Promise<DailyStudyPlan[]>; // CalendarService.generateMonthlyCalendar (days)
}): Promise<StudyPlan> {
  return buildOrExtendInternal({ ...params, basePlan: null });
}

/**
 * @function extendPlan
 * @purpose
 *   Append-only growth beyond the last planned day; never edits history.
 * @steps
 *   1) Find cut-off = last planned date + 1 day.
 *   2) Generate months forward until we’ve added ≥ horizonDays beyond cutoff.
 *   3) Deterministically id sessions and merge by date.
 *   4) Return a *new* plan.
 */
export function extendPlan(params: {
  basePlan: StudyPlan;
  notebooks: NotebookMeta[];
  config: ScheduleConfig;
  horizonDays: number;
  strategy: (nb: NotebookMeta[], cfg: ScheduleConfig, targetDate: Date) => Promise<DailyStudyPlan[]>;
}): Promise<StudyPlan> {
  const last = lastPlannedDate(params.basePlan);
  const start = last ? addDays(parseYYYYMMDD(last), 1) : new Date();
  return buildOrExtendInternal({ ...params, anchorDate: start });
}

// ──────────────────────────────────────────────────────────────────────────────
// Internals
// ──────────────────────────────────────────────────────────────────────────────

type InternalParams = {
  basePlan: StudyPlan | null;
  anchorDate: Date;
  horizonDays: number;
  notebooks: NotebookMeta[];
  config: ScheduleConfig;
  strategy: (nb: NotebookMeta[], cfg: ScheduleConfig, targetDate: Date) => Promise<DailyStudyPlan[]>;
};

async function buildOrExtendInternal(p: InternalParams): Promise<StudyPlan> {
  // (1) Seed / clone
  const seed: StudyPlan = p.basePlan
    ? { days: [...p.basePlan.days], horizonDays: p.basePlan.horizonDays, createdAt: p.basePlan.createdAt, updatedAt: new Date().toISOString() }
    : { days: [], horizonDays: p.horizonDays, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };

  // (2) Prepare counters for deterministic ordinals per (fileId,type)
  const ordinal = new Map<string, number>(); // key: `${fileId}|${type}` -> count

  // (3) Pre-scan existing (if any) to initialize ordinals
  for (const d of seed.days) {
    for (const s of d.sessions) {
      const key = `${s.notebookMeta.fileId}|${s.type}`;
      ordinal.set(key, (ordinal.get(key) ?? 0) + 1);
    }
  }

  // (4) Loop months forward until we’ve added ≥ horizonDays beyond anchor
  let produced = 0;
  let cursor = new Date(p.anchorDate.getFullYear(), p.anchorDate.getMonth(), 1);
  const targetDateLimit = addDays(startOfDay(p.anchorDate), p.horizonDays - 1); // inclusive

  while (startOfDay(cursor) <= targetDateLimit) {
    // 4.1 Generate days for this month from strategy
    const monthDays = await p.strategy(p.notebooks, p.config, cursor); // array of DailyStudyPlan
    // 4.2 Filter to only days >= anchorDate and <= limit
    for (const dp of monthDays) {
      const dKey = toKey(dp.date);
      if (dp.date < startOfDay(p.anchorDate) || dp.date > targetDateLimit) continue;

      // 4.3 Rewrite session IDs deterministically
      const rewritten: StudySession[] = [];
      for (const sess of dp.sessions) {
        const unitPrimaryIdsInOrder = (sess.targetLessonUnits ?? []).map(u => u.primaryConceptNodeID);
        const key = `${sess.notebookMeta.fileId}|${sess.type}`;
        const nextOrdinal = (ordinal.get(key) ?? 0) + 1;
        ordinal.set(key, nextOrdinal);

        const stableId = computeSessionId({
          fileId: sess.notebookMeta.fileId,
          type: sess.type,
          ordinal: nextOrdinal,
          unitPrimaryIdsInOrder,
        });

        rewritten.push({ ...sess, id: stableId });
      }

      // 4.4 Merge into plan days map (dedupe + append)
      dedupeAppend(seed, {
        date: dKey,
        sessions: rewritten,
        totalDuration: rewritten.reduce((m, s) => m + (s.metadata?.estimatedDuration ?? 0), 0),
        subjectSummary: summarizeSubjects(rewritten),
        completedSessions: [],
      });

      produced++;
    }

    // 4.5 Advance to next month
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  seed.days.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  seed.updatedAt = new Date().toISOString();
  return seed;
}

/**
 * @function dedupeAppend
 * @purpose
 *   Merge a day into the plan; if the date exists, append only new sessions (by id).
 * @steps
 *   1) Find existing same-date day (if any).
 *   2) Build a session-id set.
 *   3) Append only non-duplicates; update aggregates.
 */
export function dedupeAppend(plan: StudyPlan, incoming: PlanDay): void {
  const idx = plan.days.findIndex(d => d.date === incoming.date);
  if (idx === -1) {
    plan.days.push({ ...incoming, sessions: [...incoming.sessions] });
    return;
  }

  const day = plan.days[idx];
  const seen = new Set(day.sessions.map(s => s.id));
  const add: StudySession[] = [];
  let addDuration = 0;

  for (const s of incoming.sessions) {
    if (!seen.has(s.id)) {
      add.push(s);
      addDuration += s.metadata?.estimatedDuration ?? 0;
      seen.add(s.id);
      // maintain subject summary
      const nbId = s.notebookMeta.fileId;
      if (!day.subjectSummary[nbId]) {
        day.subjectSummary[nbId] = {
          notebookName: s.notebookMeta.fileName,
          sessionCount: 0,
          totalUnits: 0,
          color: s.notebookMeta.color || '#6B7280',
        };
      }
      day.subjectSummary[nbId].sessionCount += 1;
      day.subjectSummary[nbId].totalUnits += s.sessionConfig?.unitCount ?? s.targetLessonUnits.length ?? 0;
    }
  }

  if (add.length) {
    day.sessions = day.sessions.concat(add);
    day.totalDuration += addDuration;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Small utils
// ──────────────────────────────────────────────────────────────────────────────
function toKey(d: Date): string { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function pad2(n: number): string { return n < 10 ? `0${n}` : `${n}`; }
function startOfDay(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function parseYYYYMMDD(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
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
        color: s.notebookMeta.color || '#6B7280',
      };
    }
    summary[id].sessionCount += 1;
    summary[id].totalUnits += s.sessionConfig?.unitCount ?? s.targetLessonUnits.length ?? 0;
  }
  return summary;
}
