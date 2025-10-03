/**
 * @file CalendarContext.tsx
 * @description
 *   CalendarContext is the single, local-first source of truth for the study calendar state. It keeps all
 *   client-side data strictly in React memory and coordinates synchronization to the backend through a thin
 *   CalendarApi. The runtime rules are: render directly from context; if the context is empty, hydrate once
 *   from the backend; thereafter, every change updates React state immediately and syncs to the server
 *   optimistically. This file intentionally removes all localStorage usage and the legacy CalendarPersistence
 *   (which mixed local caching with network I/O). Instead, we centralize state in React and use CalendarApi for
 *   pure network calls (loadAll / saveAll / clearAll). We also keep version monitoring global (not per document):
 *   when the active document changes, we only act if that notebook is tracked in the calendar. Functions here
 *   preserve the public interface so downstream consumers (CalendarModal, CalendarMonthView) need no changes.
 *   Observability is built-in via purposeful console.log statements with unique 4-digit codes for key flows.
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
  useMemo,
} from 'react';
import {
  CalendarContextType,
  CalendarMonth,
  DailyStudyPlan,
  StudySession,
  ScheduleConfig,
  NotebookSummary,
  NotebookVersionState,
  PickerFileMeta,
  CalendarData,
} from '@/app/Library/Definitions/CalendarDefinitions';
import { CalendarService } from '@/app/src/services/calendar/CalendarService';
import { useYDoc } from '@/app/Library/Context/YDocContext';
import { CalendarApi } from '@/app/src/services/calendar/CalendarApi'; // Step 2 uses the thin API
import readiness from '@/app/studygraph/(studygraph)/services/documentReadiness/DocumentReadinessService';
import {
  computeAnchorDate,
  computeExtensionStart,
  mergeAppendOnly,
  countAdditionalUnits,
} from '@/app/src/services/calendar/RollingWindowUtil';
import type { StudyPlan, StudyPlanIndex } from '@/app/src/services/calendar/StudyPlanCore';
import { sliceByDateRange, indexPlan } from '@/app/src/services/calendar/StudyPlanCore';
import { NotebooksApi } from '@/app/src/services/calendar/NotebooksApi';

/**
 * Internal context (do not export directly).
 */
const CalendarContext = createContext<CalendarContextType | undefined>(undefined);

/**
 * @function CalendarProvider
 * @description
 *   The top-level provider that owns all calendar state. It performs a one-time lazy hydration from the backend
 *   *only if* the context is empty (no selected notebooks and no current month). From then on, all mutations are
 *   optimistic: update React state immediately, then call CalendarApi.saveAll() in the background. Errors are
 *   surfaced via `error` and logged with file-scoped, unique codes. Version monitoring is global and triggers
 *   schedule extension only when the active document is already part of the selected notebooks.
 *   Time complexity: All per-day or per-session traversals are O(N) for the number of daily plans/sessions used.
 */
export const CalendarProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // ────────────────────────────────────────────────────────────────────────────
  // 1) Core state (React = only source of truth)
  // ────────────────────────────────────────────────────────────────────────────
  const [selectedNotebooks, setSelectedNotebooks] = useState<string[]>([]);
  const [plan, setPlan] = useState<StudyPlan | null>(null);
const [planIndex, setPlanIndex] = useState<StudyPlanIndex>({});
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isLoading, setIsLoading] = useState(false);         // Generation/regeneration
  const [error, setError] = useState<string | null>(null);   // User-visible error
  const [availableNotebooks, setAvailableNotebooks] = useState<NotebookSummary[]>([]);
  const [completedSessions, setCompletedSessions] = useState<string[]>([]);

  // Version monitoring
  const [notebookVersions, setNotebookVersions] = useState<Map<string, NotebookVersionState>>(new Map());
  const [extensionInProgress, setExtensionInProgress] = useState(false);

  // Hydration control
  const [hasHydrated, setHasHydrated] = useState(false);
  const [hydrating, setHydrating] = useState(false);

  // YDoc inputs for global version monitoring
  const { docFileID, version: currentDocVersion } = useYDoc();
  const [renderReady, setRenderReady] = useState(false);
  //const { ownedFiles } = useFileList();

  const currentMonth = useMemo(() => {
  if (!plan) return null;

  // 1) compute visible month window
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);

  const startKey = `${start.getFullYear()}-${String(month + 1).padStart(2, '0')}-01`;
  const endKey   = `${end.getFullYear()}-${String(month + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;

  // 2) slice from canonical plan
  const days = sliceByDateRange(plan, startKey, endKey);

  // 3) adapt to legacy CalendarMonth shape
  return {
    year,
    month,
    dailyPlans: days.map(d => ({
      date: new Date(d.date),
      sessions: d.sessions,
      subjectSummary: d.subjectSummary,
      totalDuration: d.totalDuration,
      completedSessions: d.completedSessions,
    })),
    monthlySummary: {
      totalSessions: days.reduce((m, d) => m + d.sessions.length, 0),
      totalStudyTime: days.reduce((m, d) => m + d.totalDuration, 0),
      activeNotebooks: Array.from(
        days.reduce((acc, d) => {
          d.sessions.forEach(s => acc.add(s.notebookMeta.fileId));
          return acc;
        }, new Set<string>())
      ),
      completionRate: 0,
    },
  };
}, [plan, currentDate]);

useEffect(() => {
  if (!docFileID) {
    setRenderReady(false);
    return;
  }
  const stream = readiness.renderReady$(docFileID);
  // 1) Immediate replay
  const initial =
    stream.value.phase === 'RENDER_READY' || stream.value.phase === 'SAVE_READY';
  setRenderReady(initial);
  console.log('[CalendarContext.tsx][5401] renderReady (initial):', { docId: docFileID, ready: initial });

  // 2) Live updates
  const sub = stream.subscribe((s) => {
    const ok = s.phase === 'RENDER_READY' || s.phase === 'SAVE_READY';
    setRenderReady(ok);
    console.log('[CalendarContext.tsx][5402] renderReady (update):', { docId: docFileID, phase: s.phase, ready: ok });
  });

  return () => sub.unsubscribe();
}, [docFileID]);

//(optional alias to minimize edits below—lets you keep existing guards)
const isInitialized = renderReady;

  // Default schedule config (local-first)
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>({
    unitsPerBlockSession: 3,
    revisionsPerLesson: 2,
    startDate: new Date(),
    daysPerWeek: [1, 2, 3, 4, 5,6,7],
    subjectsPerDay: 3,
    preferredTimeSlots: ['morning', 'afternoon', 'evening'],
    maxSessionsPerDay: 6,
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 2) Services
  // ────────────────────────────────────────────────────────────────────────────
  const calendarService = useMemo(() => new CalendarService(), []);
  const api = useMemo(() => new CalendarApi(), []); // Thin network-only client
  const notebooksApi = useMemo(() => new NotebooksApi(), []);
  // ────────────────────────────────────────────────────────────────────────────
  // 3) Helpers
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * @function computeMonthlySummary
   * @description
   *   Recomputes the monthly summary from a list of daily plans. This is useful after selective edits,
   *   such as removing sessions for a deselected notebook. We aggregate in O(D + S) time where D is the number
   *   of days in the month and S is total sessions across those days.
   */
  const computeMonthlySummary = useCallback((dailyPlans: DailyStudyPlan[]) => {
    let totalSessions = 0;
    let totalStudyTime = 0;
    const activeNotebookIds = new Set<string>();

    // O(D * S_d): iterate days, then sessions per day
    for (const plan of dailyPlans) {
      totalSessions += plan.sessions.length;
      totalStudyTime += plan.totalDuration;
      for (const s of plan.sessions) {
        activeNotebookIds.add(s.notebookMeta.fileId);
      }
    }

    return {
      totalSessions,
      totalStudyTime,
      activeNotebooks: Array.from(activeNotebookIds),
      // We do not recompute completion rate here (kept stable), but could if desired
      completionRate: currentMonth?.monthlySummary.completionRate ?? 0,
    };
  }, [currentMonth?.monthlySummary.completionRate]);

  /**
   * @function persistAllOptimistic
   * @description
   *   Centralized optimistic persistence. Build a payload snapshot from current React state (optionally
   *   with overrides for fields just updated), and call `api.saveAll()` in the background. We never block
   *   UI, and we only surface errors to `error` + console. Complexity is O(1) for building the envelope.
   */
  const persistAllOptimistic = useCallback(async (overrides?: Partial<CalendarData>) => {
    const payload: CalendarData = {
      selectedNotebooks,
      plan,
      planIndex,
      scheduleConfig,
      completedSessions,
      lastUpdated: new Date(),
      version: '2.0',
      ...overrides,
    };

    try {
      console.log('[CalendarContext.tsx][9101] › persistAllOptimistic saveAll() begin');
      await api.saveAll(payload);
      console.log('[CalendarContext.tsx][9102] › persistAllOptimistic saveAll() success');
    } catch (err) {
      console.warn('[CalendarContext.tsx][9103] › persistAllOptimistic saveAll() failed:', err);
      setError('Failed to sync calendar changes. Your local state is safe; will retry on next change.');
    }
  }, [selectedNotebooks, plan, planIndex, scheduleConfig, completedSessions, api]);

/**
 * @function lazyHydrateFromBackend
 * @description
 *   One-time hydration; respects canonical plan storage.
 *  
 */
const lazyHydrateFromBackend = useCallback(async () => {
  if (hasHydrated) return;

  const isEmpty = selectedNotebooks.length === 0 && !plan;
  if (!isEmpty) {
    console.log('[CalendarContext.tsx][9104] › Hydration skipped (state not empty)');
    setHasHydrated(true);
    return;
  }

  try {
    console.log('[CalendarContext.tsx][9105] › lazyHydrateFromBackend loadAll() begin');
    setHydrating(true);
    const data = await api.loadAll();

    if (!data) {
      console.log('[CalendarContext.tsx][9106] › No server data, staying local-first');
      setHasHydrated(true);
      setHydrating(false);
      return;
    }

    setSelectedNotebooks(data.selectedNotebooks ?? []);
    if (data.scheduleConfig) setScheduleConfig(data.scheduleConfig);
    if (data.plan) setPlan(data.plan);
    if (data.planIndex) setPlanIndex(data.planIndex);
    if (Array.isArray(data.completedSessions)) setCompletedSessions(data.completedSessions);

    // Initialize version tracking if any selection exists
    if ((data.selectedNotebooks?.length ?? 0) > 0) {
      const versionMap = new Map<string, NotebookVersionState>();
      (data.selectedNotebooks ?? []).forEach(id => {
        versionMap.set(id, {
          notebookId: id,
          trackedVersion: 'unknown',
          currentVersion: 'unknown',
          needsUpdate: false,
          lastChecked: new Date(),
        });
      });
      setNotebookVersions(versionMap);
    }

    console.log('[CalendarContext.tsx][9107] › Hydration success (plan-based)');
  } catch (err) {
    console.warn('[CalendarContext.tsx][9108] › Hydration failed:', err);
  } finally {
    setHasHydrated(true);
    setHydrating(false);
  }
}, [api, hasHydrated, selectedNotebooks.length, plan]);


  // ────────────────────────────────────────────────────────────────────────────
  // 4) Dynamic extension flows (global version monitoring)
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * @function extendCalendarSchedule
   * @description
   *   Computes an append-only extension for an updated notebook: we start the generation
   *   strictly after the last scheduled day and merge only the future sessions for the
   *   target notebook, preserving history untouched.
   *   
   *
   *   Algorithm (high level):
   *   1) Load current metas and swap in the updated notebook.
   *   2) Short-circuit if no additional lesson units were added.
   *   3) Compute extension start (day after last scheduled session).
   *   4) Generate extension month from that start date.
   *   5) Append-only merge (target notebook sessions strictly after cutoff).
   *   6) Recompute monthly summary and return the extended calendar.
   */
  const extendCalendarSchedule = useCallback(async (
    updatedNotebook: any,
    newVersion: string
  ): Promise<CalendarMonth | null> => {
    if (!currentMonth) return null;

    // Step 1: Gather current notebook metas and swap-in the updated meta
    const allNotebookIds = selectedNotebooks;
    const currentNotebooks = await notebooksApi.details(allNotebookIds);
    const updatedNotebooks = currentNotebooks.map(nb =>
      nb.fileId === updatedNotebook.fileId ? updatedNotebook : nb
    );

    const originalNotebook = currentNotebooks.find(nb => nb.fileId === updatedNotebook.fileId);
    if (!originalNotebook) {
      throw new Error('Original notebook not found for comparison');
    }

    // Step 2: Short-circuit if no net new units (append-only rule requires growth)
    const additionalUnits = countAdditionalUnits(originalNotebook, updatedNotebook);
    console.log('[CalendarContext.tsx][9202] › Additional lesson units:', additionalUnits);
    if (additionalUnits <= 0) {
      console.log('[CalendarContext.tsx][9203] › No new content; no extension required');
      return currentMonth;
    }

    // Step 3: Compute strict extension start (day after last scheduled)
    const extensionStartDate = computeExtensionStart(currentMonth);
    console.log('[CalendarContext.tsx][9204] › Extension start date:', extensionStartDate.toDateString());

    // Step 4: Generate extension using the existing service (API unchanged)
    const extensionMonth = await calendarService.generateMonthlyCalendar(
      updatedNotebooks,
      scheduleConfig,
      extensionStartDate
    );

    // Step 5: Append-only merge for the *target* notebook — numbered steps inside mergeAppendOnly
    const mergedDailyPlans = mergeAppendOnly({
      existing: currentMonth,
      extension: extensionMonth,
      targetNotebookId: updatedNotebook.fileId,
    });

    // Step 6: Recompute monthly summary and return a new month object
    const updatedSummary = computeMonthlySummary(mergedDailyPlans);
    const extendedCalendar: CalendarMonth = {
      ...currentMonth,
      dailyPlans: mergedDailyPlans,
      monthlySummary: updatedSummary,
    };

    console.log('[CalendarContext.tsx][9205] › Extension merged (append-only); days:', extendedCalendar.dailyPlans.length);
    return extendedCalendar;
  }, [calendarService, computeMonthlySummary, currentMonth, notebooksApi, scheduleConfig, selectedNotebooks]);


/**
 * @function triggerScheduleExtension
 * @description
 *   When a notebook content grows, extend the canonical plan append-only.
 *   // update - 2
 */
const triggerScheduleExtension = useCallback(async (notebookId: string, newVersion: string) => {
  if (!plan || extensionInProgress) {
    console.log('[CalendarContext.tsx][9301] › Skip extension: no plan or already running');
    return;
  }

  console.log('[CalendarContext.tsx][9302] › Trigger plan extension for notebook:', notebookId);
  setExtensionInProgress(true);
  setError(null);

  try {
    const updatedNotebooks = await notebooksApi.details([notebookId]);
    if (updatedNotebooks.length === 0) throw new Error('Updated notebook details not found');

    const metasForAll = await notebooksApi.details(selectedNotebooks);
    const merged = metasForAll.map(nb => nb.fileId === notebookId ? updatedNotebooks[0] : nb);

    const horizonDays = Math.max(plan.horizonDays ?? 120, 120);

    const { plan: extendedPlan, planIndex: newIndex } = await calendarService.extendStudyPlan({
      plan,
      notebooks: merged,
      config: scheduleConfig,
      horizonDays,
    });

    setPlan(extendedPlan);
    setPlanIndex(newIndex);

    // Update tracking map
    setNotebookVersions(prev => {
      const map = new Map(prev);
      const vs = map.get(notebookId);
      if (vs) {
        map.set(notebookId, {
          ...vs,
          trackedVersion: newVersion,
          needsUpdate: false,
          lastChecked: new Date(),
        });
      }
      return map;
    });

    await persistAllOptimistic({ plan: extendedPlan, planIndex: newIndex });
    console.log('[CalendarContext.tsx][9304] › Plan extension persisted');
  } catch (err) {
    console.error('[CalendarContext.tsx][9305] › Plan extension failed:', err);
    setError(err instanceof Error ? err.message : 'Failed to extend plan');
  } finally {
    setExtensionInProgress(false);
  }
}, [plan, extensionInProgress, notebooksApi, selectedNotebooks, calendarService, scheduleConfig, persistAllOptimistic]);


  // ────────────────────────────────────────────────────────────────────────────
  // 5) Notebooks loading (no caching here; pure network)
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * @function refreshNotebooks
   * @description
   *   Loads available notebooks from the service and assigns colors. This is network-only and does not persist
   *   anything. Complexity O(N) where N is number of notebooks returned.
   */
  const refreshNotebooks = useCallback(async () => {
    console.log('[CalendarContext.tsx][9501] › Refresh notebooks');
    try {
      const notebooks = await notebooksApi.list();
      const notebooksWithColors = notebooks.map((nb, i) => ({
        ...nb,
        color: NOTEBOOK_COLORS[i % NOTEBOOK_COLORS.length],
      }));
      setAvailableNotebooks(notebooksWithColors);
      console.log('[CalendarContext.tsx][9502] › Loaded notebooks:', notebooksWithColors.length);
    } catch (err) {
      console.error('[CalendarContext.tsx][9503] › Failed to refresh notebooks:', err);
      setError('Failed to load available notebooks');
    }
  }, [notebooksApi]);

  // Run notebook list load on mount (independent of hydration)
  useEffect(() => {
    refreshNotebooks();
  }, [refreshNotebooks]);

  // ────────────────────────────────────────────────────────────────────────────
  // 6) Selection mutations (optimistic)
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * @function selectNotebook
   * @description
   *   Adds a notebook to selection immediately and persists optimistically. If the active doc matches and
   *   YDoc is initialized, we initialize version tracking. Complexity O(1).
   */
  const selectNotebook = useCallback((notebookId: string) => {
    console.log('[CalendarContext.tsx][9601] › Select notebook:', notebookId);
    setSelectedNotebooks(prev => {
      if (prev.includes(notebookId)) return prev;
      const updated = [...prev, notebookId];

      // Initialize tracking if selecting the active doc
      if (notebookId === docFileID && isInitialized) {
        setNotebookVersions(prevMap => {
          const map = new Map(prevMap);
          map.set(notebookId, {
            notebookId,
            trackedVersion: currentDocVersion.toString(),
            currentVersion: currentDocVersion.toString(),
            needsUpdate: false,
            lastChecked: new Date(),
          });
          return map;
        });
      }

      // Persist full state optimistically with updated selection
      persistAllOptimistic({ selectedNotebooks: updated }).catch(() => void 0);
      return updated;
    });
  }, [currentDocVersion, docFileID, isInitialized, persistAllOptimistic]);

  /**
   * @function deselectNotebook
   * @description
   *   Removes a notebook from selection and prunes any of its sessions from the current month. Recomputes the
   *   monthly summary, then persists optimistically. Complexity O(D + S) to filter/aggregate.
   */
  const deselectNotebook = useCallback((notebookId: string) => {
    console.log('[CalendarContext.tsx][9602] › Deselect notebook:', notebookId);
    setSelectedNotebooks(prev => {
      const updated = prev.filter(id => id !== notebookId);

      // Remove its sessions from the current month
      if (currentMonth) {
        const prunedPlans = currentMonth.dailyPlans.map(plan => {
          const kept = plan.sessions.filter(s => s.notebookMeta.fileId !== notebookId);
          const removedDuration = plan.sessions
            .filter(s => s.notebookMeta.fileId === notebookId)
            .reduce((sum, s) => sum + s.metadata.estimatedDuration, 0);

          return {
            ...plan,
            sessions: kept,
            totalDuration: Math.max(0, plan.totalDuration - removedDuration),
            subjectSummary: Object.fromEntries(
              Object.entries(plan.subjectSummary).filter(([id]) => id !== notebookId)
            ),
          };
        });

        const updatedSummary = computeMonthlySummary(prunedPlans);
        const nextMonth: CalendarMonth = {
          ...currentMonth,
          dailyPlans: prunedPlans,
          monthlySummary: updatedSummary,
        };
        // outdated setCurrentMonth(nextMonth);

        // Persist full state optimistically
        persistAllOptimistic({ selectedNotebooks: updated}).catch(() => void 0);
      } else {
        // Persist just the selection change
        persistAllOptimistic({ selectedNotebooks: updated }).catch(() => void 0);
      }

      // Drop version tracking for this notebook
      setNotebookVersions(prevMap => {
        const map = new Map(prevMap);
        map.delete(notebookId);
        return map;
      });

      return updated;
    });
  }, [computeMonthlySummary, currentMonth, persistAllOptimistic]);

  // ────────────────────────────────────────────────────────────────────────────
  // 7) Config & generation (optimistic)
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * @function updateScheduleConfig
   * @description
   *   Applies a partial schedule config update with validation for the multi-subject model, then saves
   *   optimistically. Complexity O(1).
   */
  const updateScheduleConfig = useCallback((configUpdate: Partial<ScheduleConfig>) => {
    console.log('[CalendarContext.tsx][9701] › Update schedule config:', configUpdate);
    setScheduleConfig(prev => {
      const updated = { ...prev, ...configUpdate };

      if (updated.unitsPerBlockSession < 1) updated.unitsPerBlockSession = 1;
      if (updated.subjectsPerDay < 1) updated.subjectsPerDay = 1;
      if (updated.maxSessionsPerDay < updated.subjectsPerDay) {
        updated.maxSessionsPerDay = updated.subjectsPerDay;
      }

      // Persist full state optimistically
      persistAllOptimistic({ scheduleConfig: updated }).catch(() => void 0);
      return updated;
    });
  }, [persistAllOptimistic]);

/**
 * @function generateSchedule
 * @description
 *   Builds the canonical StudyPlan once with a rolling horizon; no month recomputes.
 *   
 */
const generateSchedule = useCallback(async () => {
  console.log('[CalendarContext.tsx][9702] › Generate canonical plan for', selectedNotebooks.length, 'notebooks');

  if (selectedNotebooks.length === 0) {
    setError('Please select at least one notebook for scheduling');
    console.warn('[CalendarContext.tsx][9703] › No notebooks selected');
    return;
  }

  setIsLoading(true);
  setError(null);

  try {
    // 1) Load metas and colorize
    const metas = await notebooksApi.details(selectedNotebooks);
    if (metas.length === 0) throw new Error('No valid notebook metadata found');
    const colored = metas.map((m, i) => ({ ...m, color: NOTEBOOK_COLORS[i % NOTEBOOK_COLORS.length] }));

    // 2) Safe anchor
    const anchor = computeAnchorDate({ now: new Date(), config: scheduleConfig });

    // 3) Build canonical plan with a rolling horizon (defaults to 120 days)
    const horizonDays = 120;
    const { plan: newPlan, planIndex: newIndex } = await calendarService.generateStudyPlan({
      notebooks: colored,
      config: scheduleConfig,
      anchor,
      horizonDays,
    });

    setPlan(newPlan);
    setPlanIndex(newIndex);

    // 4) Initialize version tracking
    const versionMap = new Map<string, NotebookVersionState>();
    colored.forEach(nb => {
      const currentVersion = nb.fileId === docFileID && isInitialized
        ? currentDocVersion.toString()
        : nb.version ?? 'unknown';
      versionMap.set(nb.fileId, {
        notebookId: nb.fileId,
        trackedVersion: currentVersion,
        currentVersion,
        needsUpdate: false,
        lastChecked: new Date(),
      });
    });
    setNotebookVersions(versionMap);

    // 5) Persist canonical envelope
    await persistAllOptimistic({ plan: newPlan, planIndex: newIndex });
    console.log('[CalendarContext.tsx][9704] › Canonical plan generated & persisted');
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to generate plan';
    console.error('[CalendarContext.tsx][9705] › Generate plan error:', msg);
    setError(msg);
  } finally {
    setIsLoading(false);
  }
}, [calendarService, currentDocVersion, docFileID, isInitialized, notebooksApi, persistAllOptimistic, scheduleConfig, selectedNotebooks]);



/**
 * @function regenerateMonth
 * @description
 *   No-op recompute; just move the visible window (pure slicing).
 *   // update - 2
 */
const regenerateMonth = useCallback(async (year: number, monthIndex: number) => {
  console.log('[CalendarContext.tsx][9706] › Re-slice month', { year, monthIndex });
  setCurrentDate(new Date(year, monthIndex, 1));
}, [setCurrentDate]);

  /**
   * @function navigateMonth
   * @description
   *   Advances the `currentDate` and then regenerates for the new month. Complexity O(N + D + S) due to regeneration.
   */
  const navigateMonth = useCallback((direction: 'prev' | 'next') => {
    const next = new Date(currentDate);
    if (direction === 'prev') next.setMonth(next.getMonth() - 1);
    else next.setMonth(next.getMonth() + 1);
    setCurrentDate(next);
  }, [currentDate]);

  // ────────────────────────────────────────────────────────────────────────────
  // 8) Session helpers & completion (optimistic)
  // ────────────────────────────────────────────────────────────────────────────

/**
 * @function createSessionLauncher
 * @description
 *   Prepare PickerFileMeta by scanning canonical plan (multi-month).
 * 
 */
const createSessionLauncher = useCallback((sessionId: string): PickerFileMeta | null => {
  if (!plan) return null;
  for (const d of plan.days) {
    const s = d.sessions.find(x => x.id === sessionId);
    if (s) {
      return {
        docId: s.notebookMeta.fileId,
        fileStorageId: s.notebookMeta.filePath,
        fileName: s.notebookMeta.fileName,
        role: undefined,
        updatedAt: s.notebookMeta.lastUpdated.toISOString(),
      };
    }
  }
  return null;
}, [plan]);


  /**
   * @function markSessionCompleted
   * @description
   *   Marks a session completed immediately and persists optimistically. Complexity O(1).
   */
  const markSessionCompleted = useCallback((sessionId: string) => {
    console.log('[CalendarContext.tsx][9801] › Complete session:', sessionId);
    setCompletedSessions(prev => {
      if (prev.includes(sessionId)) return prev;
      const updated = [...prev, sessionId];
      persistAllOptimistic({ completedSessions: updated }).catch(() => void 0);
      return updated;
    });
  }, [persistAllOptimistic]);

  /**
   * @function markSessionIncomplete
   * @description
   *   Clears completion for a session immediately and persists optimistically. Complexity O(C) where C is
   *   number of completed sessions (filter).
   */
  const markSessionIncomplete = useCallback((sessionId: string) => {
    console.log('[CalendarContext.tsx][9802] › Incomplete session:', sessionId);
    setCompletedSessions(prev => {
      const updated = prev.filter(id => id !== sessionId);
      persistAllOptimistic({ completedSessions: updated }).catch(() => void 0);
      return updated;
    });
  }, [persistAllOptimistic]);

  
/**
 * @function getDailyPlan
 * @description
 *   Return the legacy DailyStudyPlan-like shape for a specific date via planIndex.
 *   // update - 3
 
const getDailyPlan = useCallback((date: Date) => {
  if (!plan) return null;
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const idx = planIndex[key];
  if (idx == null) return null;
  const d = plan.days[idx];
  return {
    date: new Date(d.date),
    sessions: d.sessions,
    subjectSummary: d.subjectSummary,
    totalDuration: d.totalDuration,
    completedSessions: d.completedSessions,
  };
}, [plan, planIndex]);


 * @function getSessionsForDay
 * @description
 *   Returns sessions for a given date via planIndex.
 *   // update - 3

const getSessionsForDay = useCallback((date: Date) => {
  const dp = getDailyPlan(date);
  return dp ? dp.sessions : [];
}, [getDailyPlan]);



   * @function getTodaysPlan
   * @description
   *   Shortcut for today’s plan. Complexity O(D).
  const getTodaysPlan = useCallback(() => {
    return getDailyPlan(new Date());
  }, [getDailyPlan]);

  */

/**
 * @function clearSchedule
 * @description
 *   Clears plan + related state; remote wipe via API.
 *   // update - 2
 */
const clearSchedule = useCallback(() => {
  console.log('[CalendarContext.tsx][9901] › Clear schedule (plan-based)');
  setSelectedNotebooks([]);
  setPlan(null);
  setPlanIndex({});
  setCompletedSessions([]);
  setError(null);
  setNotebookVersions(new Map());
  api.clearAll().catch(err => {
    console.warn('[CalendarContext.tsx][9902] › clearAll() failed:', err);
    setError('Failed to clear server calendar; local state cleared.');
  });
}, [api]);


  // ────────────────────────────────────────────────────────────────────────────
  // 9) One-time lazy hydration (local-first)
  // ────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Run once; only hydrates if truly empty
    lazyHydrateFromBackend();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lazyHydrateFromBackend]);

  // ────────────────────────────────────────────────────────────────────────────
  // 10) Context value
  // ────────────────────────────────────────────────────────────────────────────
  const contextValue: CalendarContextType = useMemo(() => ({
    // State
    selectedNotebooks,
    currentMonth,
    scheduleConfig,
    isLoading: isLoading || extensionInProgress || hydrating,
    error,
    availableNotebooks,

    // Navigation
    currentDate,
    setCurrentDate,
    navigateMonth,

    // Notebook mgmt
    selectNotebook,
    deselectNotebook,
    refreshNotebooks,

    // Config
    updateScheduleConfig,

    // Scheduling
    generateSchedule,
    regenerateMonth,
    clearSchedule,

    // Sessions
    createSessionLauncher,
    markSessionCompleted,
    markSessionIncomplete,
    notebookVersions,
  }), [
    availableNotebooks,
    clearSchedule,
    currentDate,
    currentMonth,
    deselectNotebook,
    error,
    extensionInProgress,
    generateSchedule,
    hydrating,
    isLoading,
    navigateMonth,
    notebookVersions,
    regenerateMonth,
    scheduleConfig,
    selectNotebook,
    selectedNotebooks,
    setCurrentDate,
    updateScheduleConfig,
    refreshNotebooks,
    createSessionLauncher,
    markSessionCompleted,
    markSessionIncomplete,
  ]);

  return (
    <CalendarContext.Provider value={contextValue}>
      {children}
    </CalendarContext.Provider>
  );
};

/**
 * @function useCalendar
 * @description
 *   Hook to access the CalendarContext. Throws if used outside the provider, ensuring a predictable
 *   tree structure. Complexity O(1).
 */
export function useCalendar(): CalendarContextType {
  const context = useContext(CalendarContext);
  if (!context) {
    throw new Error('useCalendar must be used within a CalendarProvider');
  }
  return context;
}

// Color palette for notebook visual distinction in calendar
const NOTEBOOK_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#8B5CF6', // Purple
  '#F59E0B', // Orange
  '#EF4444', // Red
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#F97316', // Orange-600
  '#EC4899', // Pink
  '#6366F1', // Indigo
];
