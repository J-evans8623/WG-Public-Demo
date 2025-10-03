/**
 * @file CalendarContext.tsx
 * @responsibility
 * React context that orchestrates calendar state using ONLY the new StudyPlanService and
 * the auth-protected `/api/calendar/persist` endpoint. It:
 *   • Hydrates `{studyPlan, selectedNotebooks, completedSessions}` from the endpoint
 *   • Generates/extends plans via StudyPlanService
 *   • Derives month view by grouping StudyPlanOutput.sessions per date
 *   • Persists only the new envelope (no legacy plan/index, no scheduleConfig)
 * Legacy modules (`RollingWindowUtil`, `CalendarService`, `StudyPlanCore`) are removed.
 */

import React, {
  createContext, useContext, useEffect, useMemo, useState, useCallback, ReactNode,
} from 'react';

import type {
  CalendarContextType,
  CalendarMonth,
  DailyStudyPlan,
  NotebookSummary,
  StudySession,
  PickerFileMeta,
  NotebookVersionState,
} from '@/app/Library/Definitions/CalendarDefinitions';
import type { DayOfWeek, ScheduleConfig } from '@/app/studygraph/(studygraph)/components/layout/Calendar/study-planner/models/Configuration.ts';
import { NotebooksApi } from '@/app/src/services/calendar/NotebooksApi';
import { CalendarPersistApi } from '@/app/src/services/calendar/CalendarPersistApi';
import { StudyPlanService } from '@/app/studygraph/(studygraph)/components/layout/Calendar/study-planner';
import type { StudyPlanOutput} from '@/app/studygraph/(studygraph)/components/layout/Calendar/study-planner/models/StudyPlanOutput.ts'
import { useYDoc } from '@/app/Library/Context/YDocContext';

const Ctx = createContext<CalendarContextType | undefined>(undefined);

/**
 * @function groupSessionsIntoMonth
 * @description Pure adapter: group sessions by `YYYY-MM-DD` to form a month view.
 * @steps
 *  1) Compute month range from `anchorDate`.
 *  2) Make map dateKey → StudySession[] by scanning all sessions once.
 *  3) Build DailyStudyPlan[] for each day in the month, aggregating totals/subjects.
 */
function groupSessionsIntoMonth(studyPlan: StudyPlanOutput, anchorDate: Date): CalendarMonth {
  const year = anchorDate.getFullYear();
  const month = anchorDate.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);

  const pad = (n: number) => String(n).padStart(2, '0');

  // (2) One pass over all sessions → map by date
  const map = new Map<string, StudySession[]>();
  for (const s of studyPlan.sessions) {
    const dk = `${s.date.getFullYear()}-${pad(s.date.getMonth() + 1)}-${pad(s.date.getDate())}`;
    if (!map.has(dk)) map.set(dk, []);
    map.get(dk)!.push(s);
  }

  // (3) Build daily plans for the visible month
  const days: DailyStudyPlan[] = [];
  for (let d = 1; d <= end.getDate(); d++) {
    const date = new Date(year, month, d);
    const key = `${year}-${pad(month + 1)}-${pad(d)}`;
    const sessions = map.get(key) ?? [];
    const subjectSummary: DailyStudyPlan['subjectSummary'] = {};

    let totalDuration = 0;
    for (const s of sessions) {
      totalDuration += s.metadata.estimatedDuration;
      const id = s.notebookMeta.fileId;
      if (!subjectSummary[id]) {
        subjectSummary[id] = {
          notebookName: s.notebookMeta.fileName,
          sessionCount: 0,
          totalUnits: 0,
          color: s.notebookMeta.color,
        };
      }
      subjectSummary[id].sessionCount += 1;
      subjectSummary[id].totalUnits += s.targetLessonUnits.length;
    }

    days.push({
      date,
      sessions,
      subjectSummary,
      totalDuration,
      completedSessions: [], // completion lives separately; merged by UI
    });
  }

  const monthlySummary = {
    totalSessions: days.reduce((m, d) => m + d.sessions.length, 0),
    totalStudyTime: days.reduce((m, d) => m + d.totalDuration, 0),
    activeNotebooks: Array.from(
      days.reduce((acc, d) => {
        d.sessions.forEach(s => acc.add(s.notebookMeta.fileId));
        return acc;
      }, new Set<string>())
    ),
    completionRate: 0,
  };

  return { year, month, dailyPlans: days, monthlySummary };
}

/**
 * @function CalendarProvider
 * @description
 * Provider owning the new calendar state: `studyPlan`, `selectedNotebooks`, `completedSessions`,
 * and a local `scheduleConfig` (not persisted). It hydrates once from `/persist`, generates/
 * extends with StudyPlanService, derives month view, and persists only the new envelope.
 */
export const CalendarProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // ── Core state
  const [selectedNotebooks, setSelectedNotebooks] = useState<string[]>([]);
  const [studyPlan, setStudyPlan] = useState<StudyPlanOutput | null>(null);
  const [completedSessions, setCompletedSessions] = useState<string[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [availableNotebooks, setAvailableNotebooks] = useState<NotebookSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Version tracking (unchanged conceptually)
  const [notebookVersions, setNotebookVersions] = useState<Map<string, NotebookVersionState>>(new Map());
  const [extensionInProgress, setExtensionInProgress] = useState(false);

  // Local-only config (not persisted)
 const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>({
    DayAvailability: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  });

  const [planStartDate, setPlanStartDate] = useState<Date>(new Date());

  // Services
  const notebooksApi = useMemo(() => new NotebooksApi(), []);
  const persistApi = useMemo(() => new CalendarPersistApi(), []);
  const service = useMemo(() => new StudyPlanService(), []);

  // External context for optional version wiring
  const { docFileID, version: currentDocVersion } = useYDoc();

  // ── Derived month (pure; recompute when inputs change)
  const currentMonth = useMemo<CalendarMonth | null>(() => {
    if (!studyPlan) return null;
    return groupSessionsIntoMonth(studyPlan, currentDate);
  }, [studyPlan, currentDate]);

  /**
   * @function hydrate
   * @description One-shot hydration from `/persist` when local state is empty.
   * @steps
   *  1) Skip if already hydrated or local state is non-empty.
   *  2) GET via CalendarPersistApi.
   *  3) Apply to state (dates already revived by server adapter).
   */
  const hydrate = useCallback(async () => {
    if (hydrated) return;
    const empty = selectedNotebooks.length === 0 && !studyPlan && completedSessions.length === 0;
    if (!empty) { setHydrated(true); return; }

    try {
      const data = await persistApi.load();
      setSelectedNotebooks(data.selectedNotebooks ?? []);
      setCompletedSessions(data.completedSessions ?? []);
      setStudyPlan(data.studyPlan ?? null);
    } catch (e) {
      console.warn('[CalendarContext][H001] hydrate failed', e);
    } finally {
      setHydrated(true);
    }
  }, [completedSessions.length, hydrated, persistApi, selectedNotebooks.length, studyPlan]);

  useEffect(() => { void hydrate(); }, [hydrate]);

  /**
   * @function persistOptimistic
   * @description Save current envelope to server without blocking UI.
   * @steps
   *  1) If no studyPlan yet, skip (only save when plan exists).
   *  2) POST `{studyPlan, selectedNotebooks, completedSessions}`.
   */
  const persistOptimistic = useCallback(async () => {
    if (!studyPlan) return;
    try {
      await persistApi.store({
        studyPlan,
        selectedNotebooks,
        completedSessions,
      });
    } catch (e) {
      console.warn('[CalendarContext][P001] persist failed', e);
      setError('Failed to sync changes. Will retry on next update.');
    }
  }, [completedSessions, persistApi, selectedNotebooks, studyPlan]);

  /**
   * @function refreshNotebooks
   * @description Load list of notebooks for selection UI.
   * @steps
   *  1) GET list() via NotebooksApi.
   *  2) Assign colors deterministically in UI (if not present).
   */
  const refreshNotebooks = useCallback(async () => {
    try {
      const notebooks = await notebooksApi.list();
      const withColors = notebooks.map((n, i) => ({ ...n, color: NOTEBOOK_COLORS[i % NOTEBOOK_COLORS.length] }));
      setAvailableNotebooks(withColors);
    } catch (e) {
      setError('Failed to load notebooks');
    }
  }, [notebooksApi]);

  useEffect(() => { void refreshNotebooks(); }, [refreshNotebooks]);

  /**
   * @function selectNotebook
   * @description Add notebook ID and persist envelope (if a plan exists).
   * // update - 3
   */
  const selectNotebook = useCallback((id: string) => {
    setSelectedNotebooks(prev => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      // version tracking (optional)
      if (id === docFileID) {
        setNotebookVersions(m => {
          const mm = new Map(m);
          mm.set(id, {
            notebookId: id,
            trackedVersion: String(currentDocVersion ?? 'unknown'),
            currentVersion: String(currentDocVersion ?? 'unknown'),
            needsUpdate: false,
            lastChecked: new Date(),
          });
          return mm;
        });
      }
      // persist only if plan exists (avoid POST with null plan)
      void persistOptimistic();
      return next;
    });
  }, [currentDocVersion, docFileID, persistOptimistic]);

  /**
   * @function deselectNotebook
   * @description Remove notebook ID and persist envelope (if a plan exists).
   * // update - 3
   */
  const deselectNotebook = useCallback((id: string) => {
    setSelectedNotebooks(prev => {
      const next = prev.filter(x => x !== id);
      setNotebookVersions(m => {
        const mm = new Map(m); mm.delete(id); return mm;
      });
      void persistOptimistic();
      return next;
    });
  }, [persistOptimistic]);

/**
   * @function updateScheduleConfig
   * @description Update DayAvailability only. Ignores deprecated fields.
   * // update - 4
   * @steps
   *  1) Validate provided DayAvailability tokens are among Mon..Sun.
   *  2) De-duplicate while preserving order.
   *  3) Merge into state.
   */
  const updateScheduleConfig = useCallback((u: Partial<ScheduleConfig>) => {
    if (!u || !u.DayAvailability) {
      return;
    }
    const allowed: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const deduped: DayOfWeek[] = [];
    for (const d of u.DayAvailability) {
      if ((allowed as string[]).includes(d) && !deduped.includes(d)) deduped.push(d as DayOfWeek);
    }
    setScheduleConfig(prev => ({ ...prev, DayAvailability: deduped.length ? deduped : prev.DayAvailability }));
  }, []);

  /**
   * @function generateSchedule
   * @description Build a brand-new plan via StudyPlanService and persist it.
   * @steps
   *  1) Load NotebookMeta[] for selectedNotebooks.
   *  2) Call service.generateStudyPlan(notebooks, config, startDate).
   *  3) Set studyPlan; POST envelope to server.
   * // update - 3
   */
  const generateSchedule = useCallback(async () => {
    if (selectedNotebooks.length === 0) {
      setError('Please select at least one notebook.');
      return;
    }
    setIsLoading(true); setError(null);
    try {
      const metas = await notebooksApi.details(selectedNotebooks);
      const colored = metas.map((m, i) => ({ ...m, color: m.color ?? NOTEBOOK_COLORS[i % NOTEBOOK_COLORS.length] }));
      const out = service.generateStudyPlan(colored, scheduleConfig, planStartDate);
      setStudyPlan(out);
      // initialize versions
      const map = new Map<string, NotebookVersionState>();
      colored.forEach(nb => {
        map.set(nb.fileId, {
          notebookId: nb.fileId,
          trackedVersion: nb.version ?? 'unknown',
          currentVersion: nb.version ?? 'unknown',
          needsUpdate: false,
          lastChecked: new Date(),
        });
      });
      setNotebookVersions(map);
      await persistApi.store({ studyPlan: out, selectedNotebooks, completedSessions });
    } catch (e: any) {
      setError(e?.message ?? 'Failed to generate plan');
    } finally {
      setIsLoading(false);
    }
  }, [selectedNotebooks, notebooksApi, service, scheduleConfig, planStartDate, persistApi, completedSessions]);

  /**
   * @function regenerateMonth
   * @description Move the visible window. The month is derived; no recompute needed.
   * // update - 3
   */
  const regenerateMonth = useCallback(async (year: number, monthIndex: number) => {
    setCurrentDate(new Date(year, monthIndex, 1));
  }, []);

  /**
   * @function navigateMonth
   * @description Shift month back/forward.
   */
const navigateMonth = useCallback((dir: 'prev' | 'next') => {
  setCurrentDate(prev => {
    const d = new Date(prev);
    // normalize to the first of the month to avoid 30/31 rollover weirdness
    d.setDate(1);
    d.setMonth(d.getMonth() + (dir === 'next' ? 1 : -1));
    return d;
  });
}, []);

  /**
   * @function createSessionLauncher
   * @description Build PickerFileMeta from known sessions.
   * @steps
   *  1) Scan sessions to find `sessionId`.
   *  2) Return launch metadata for the file picker.
   */
  const createSessionLauncher = useCallback((sessionId: string): PickerFileMeta | null => {
    if (!studyPlan) return null;
    const s = studyPlan.sessions.find(x => x.id === sessionId);
    if (!s) return null;
    return {
      docId: s.notebookMeta.fileId,
      fileStorageId: s.notebookMeta.filePath,
      fileName: s.notebookMeta.fileName,
      updatedAt: s.notebookMeta.lastUpdated?.toISOString(),
    };
  }, [studyPlan]);

  /**
   * @function markSessionCompleted
   * @description Toggle completed session id (add).
   * @steps
   *  1) Add id if missing.
   *  2) Persist envelope if plan exists.
   */
  const markSessionCompleted = useCallback((sessionId: string) => {
    setCompletedSessions(prev => {
      if (prev.includes(sessionId)) return prev;
      const next = [...prev, sessionId];
      void persistOptimistic();
      return next;
    });
  }, [persistOptimistic]);

  /**
   * @function markSessionIncomplete
   * @description Toggle completed session id (remove).
   * @steps
   *  1) Remove id if present.
   *  2) Persist envelope if plan exists.
   */
  const markSessionIncomplete = useCallback((sessionId: string) => {
    setCompletedSessions(prev => {
      const next = prev.filter(id => id !== sessionId);
      void persistOptimistic();
      return next;
    });
  }, [persistOptimistic]);

  /**
   * @function clearSchedule
   * @description Clear local + remote envelope.
   * @steps
   *  1) Reset local state.
   *  2) DELETE on server (ignore errors).
   * // update - 3
   */
  const clearSchedule = useCallback(() => {
    setSelectedNotebooks([]);
    setStudyPlan(null);
    setCompletedSessions([]);
    setNotebookVersions(new Map());
    setError(null);
    void persistApi.clear();
  }, [persistApi]);

  const value: CalendarContextType = useMemo(() => ({
    // state
    selectedNotebooks,
    currentMonth,
    scheduleConfig,
    planStartDate,
    setPlanStartDate,
    isLoading: isLoading || extensionInProgress,
    error,
    availableNotebooks,

    // navigation
    currentDate,
    setCurrentDate,
    navigateMonth,

    // notebooks
    selectNotebook,
    deselectNotebook,
    refreshNotebooks,

    // config
    updateScheduleConfig,

    // scheduling
    generateSchedule,
    regenerateMonth,
    clearSchedule,

    // sessions
    createSessionLauncher,
    markSessionCompleted,
    markSessionIncomplete,

    // utilities
    notebookVersions,
  }), [selectedNotebooks, currentMonth, scheduleConfig, planStartDate, isLoading, extensionInProgress, error, availableNotebooks, currentDate, navigateMonth, selectNotebook, deselectNotebook, refreshNotebooks, updateScheduleConfig, generateSchedule, regenerateMonth, clearSchedule, createSessionLauncher, markSessionCompleted, markSessionIncomplete, notebookVersions]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

/**
 * @function useCalendar
 * @description Hook guard for CalendarContext.
 */
export function useCalendar(): CalendarContextType {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCalendar must be used within CalendarProvider');
  return ctx;
}

// Palette used when backend doesn’t provide colors
const NOTEBOOK_COLORS = [
  '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444',
  '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1',
];
