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
import readiness from '@/app/studygraph/(studygraph)/services/DocumentReadinessService';

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
  const [currentMonth, setCurrentMonth] = useState<CalendarMonth | null>(null);
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

// update - 4 (optional alias to minimize edits below—lets you keep existing guards)
const isInitialized = renderReady;

  // Default schedule config (local-first)
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>({
    unitsPerBlockSession: 3,
    revisionsPerLesson: 2,
    startDate: new Date(),
    daysPerWeek: [1, 2, 3, 4, 5],
    subjectsPerDay: 3,
    preferredTimeSlots: ['morning', 'afternoon', 'evening'],
    maxSessionsPerDay: 6,
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 2) Services
  // ────────────────────────────────────────────────────────────────────────────
  const calendarService = useMemo(() => new CalendarService(), []);
  const api = useMemo(() => new CalendarApi(), []); // Thin network-only client

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
      scheduleConfig,
      currentMonth,
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
  }, [api, selectedNotebooks, scheduleConfig, currentMonth, completedSessions]);

  /**
   * @function lazyHydrateFromBackend
   * @description
   *   Local-first hydration that only runs once, and only when the context is effectively empty (no selected
   *   notebooks and no current month). If the backend has data, we normalize it and set state slices in one pass.
   *   If empty, we keep rendering from local defaults and skip network work. Complexity is O(N) for the month.
   */
  const lazyHydrateFromBackend = useCallback(async () => {
    if (hasHydrated) return;

    const isEmpty = selectedNotebooks.length === 0 && !currentMonth;
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

      // Dates should be already deserialized by CalendarApi (Step 1 responsibility).
      setSelectedNotebooks(data.selectedNotebooks ?? []);
      if (data.scheduleConfig) setScheduleConfig(data.scheduleConfig);
      if (data.currentMonth) setCurrentMonth(data.currentMonth);
      if (Array.isArray(data.completedSessions)) setCompletedSessions(data.completedSessions);

      // Initialize version tracking map if we received a month
      if (data.currentMonth && (data.selectedNotebooks?.length ?? 0) > 0) {
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

      console.log('[CalendarContext.tsx][9107] › Hydration success');
    } catch (err) {
      console.warn('[CalendarContext.tsx][9108] › Hydration failed:', err);
      // Don’t throw; keep local-first defaults
    } finally {
      setHasHydrated(true);
      setHydrating(false);
    }
  }, [api, hasHydrated, selectedNotebooks.length, currentMonth]);

  // ────────────────────────────────────────────────────────────────────────────
  // 4) Dynamic extension flows (global version monitoring)
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * @function extendCalendarSchedule
   * @description
   *   Computes an extension that appends/merges new sessions for an updated notebook while preserving the
   *   existing schedule. It generates from the next day after the last scheduled sessions. Time complexity is
   *   O(D_ext + S_ext) for the extension month plus O(D log D) to re-sort merged days (D is small).
   */
  const extendCalendarSchedule = useCallback(async (
    updatedNotebook: any,
    newVersion: string
  ): Promise<CalendarMonth | null> => {
    if (!currentMonth) return null;

    console.log('[CalendarContext.tsx][9201] › Extending schedule for updated notebook');

    const allNotebookIds = selectedNotebooks;
    const currentNotebooks = await calendarService.getNotebookDetails(allNotebookIds);

    const updatedNotebooks = currentNotebooks.map(nb =>
      nb.fileId === updatedNotebook.fileId ? updatedNotebook : nb
    );

    const originalNotebook = currentNotebooks.find(nb => nb.fileId === updatedNotebook.fileId);
    if (!originalNotebook) {
      throw new Error('Original notebook not found for comparison');
    }

    const additionalUnits = updatedNotebook.lessonUnits.length - originalNotebook.lessonUnits.length;
    console.log('[CalendarContext.tsx][9202] › Additional lesson units:', additionalUnits);

    if (additionalUnits <= 0) {
      console.log('[CalendarContext.tsx][9203] › No new content; no extension required');
      return currentMonth;
    }

    // Find last study day with sessions to start extension after
    const lastDayWithSessions = Math.max(
      ...currentMonth.dailyPlans
        .filter(plan => plan.sessions.length > 0)
        .map(plan => plan.date.getDate())
    );
    console.log('[CalendarContext.tsx][9204] › Last day with sessions:', lastDayWithSessions);

    const extensionStartDate = new Date(currentMonth.year, currentMonth.month, lastDayWithSessions + 1);
    const extensionMonth = await calendarService.generateMonthlyCalendar(
      updatedNotebooks,
      scheduleConfig,
      extensionStartDate
    );

    // Merge extension sessions targeting the updated notebook
    const mergedDailyPlans = [...currentMonth.dailyPlans];
    extensionMonth.dailyPlans.forEach(newPlan => {
      const existingIdx = mergedDailyPlans.findIndex(
        plan => plan.date.toDateString() === newPlan.date.toDateString()
      );

      const newSessionsForTarget = newPlan.sessions.filter(
        s => s.notebookMeta.fileId === updatedNotebook.fileId
      );

      if (newSessionsForTarget.length === 0) return;

      if (existingIdx >= 0) {
        const existing = mergedDailyPlans[existingIdx];
        mergedDailyPlans[existingIdx] = {
          ...existing,
          sessions: [...existing.sessions, ...newSessionsForTarget],
          totalDuration:
            existing.totalDuration +
            newSessionsForTarget.reduce((sum, s) => sum + s.metadata.estimatedDuration, 0),
          subjectSummary: {
            ...existing.subjectSummary,
            ...newPlan.subjectSummary,
          },
        };
      } else {
        mergedDailyPlans.push(newPlan);
      }
    });

    const updatedSummary = computeMonthlySummary(mergedDailyPlans);
    const extendedCalendar: CalendarMonth = {
      ...currentMonth,
      dailyPlans: mergedDailyPlans.sort((a, b) => a.date.getTime() - b.date.getTime()),
      monthlySummary: updatedSummary,
    };

    console.log('[CalendarContext.tsx][9205] › Extension merged; total days:', extendedCalendar.dailyPlans.length);
    return extendedCalendar;
  }, [calendarService, computeMonthlySummary, currentMonth, scheduleConfig, selectedNotebooks]);

  /**
   * @function triggerScheduleExtension
   * @description
   *   Runs the extension flow for a single notebook when its version changes. It updates the month in memory
   *   first, then persists optimistically. Complexity is driven by extendCalendarSchedule (O(D + S)).
   */
  const triggerScheduleExtension = useCallback(async (notebookId: string, newVersion: string) => {
    if (!currentMonth || extensionInProgress) {
      console.log('[CalendarContext.tsx][9301] › Skip extension: no month or already running');
      return;
    }

    console.log('[CalendarContext.tsx][9302] › Trigger extension for notebook:', notebookId);
    setExtensionInProgress(true);
    setError(null);

    try {
      const updatedNotebooks = await calendarService.getNotebookDetails([notebookId]);
      if (updatedNotebooks.length === 0) throw new Error('Updated notebook details not found');

      const updatedNotebook = updatedNotebooks[0];
      console.log('[CalendarContext.tsx][9303] › Updated notebook units:', updatedNotebook.lessonUnits.length);

      const extendedMonth = await extendCalendarSchedule(updatedNotebook, newVersion);
      if (extendedMonth) {
        setCurrentMonth(extendedMonth);

        // Mark as synchronized in version map
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

        // Persist full state optimistically
        await persistAllOptimistic({ currentMonth: extendedMonth });
        console.log('[CalendarContext.tsx][9304] › Extension persisted');
      }
    } catch (err) {
      console.error('[CalendarContext.tsx][9305] › Extension failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to extend schedule');
    } finally {
      setExtensionInProgress(false);
    }
  }, [calendarService, currentMonth, extendCalendarSchedule, extensionInProgress, persistAllOptimistic]);

/**
 * @function monitorActiveDocumentVersion
 * @description
 *   Watches the active doc’s version and decides whether to (a) initialize version tracking,
 *   (b) normalize tracking when no month exists (so we don’t loop), or (c) flag a delta and
 *   trigger an extension exactly once when a month exists. This prevents an infinite update loop
 *   where we kept setting needsUpdate while there was no calendar to extend. Time complexity O(1).
 */
const monitorActiveDocumentVersion = useCallback(() => {
  if (!docFileID || !isInitialized || !selectedNotebooks.includes(docFileID)) return;

  const currentVer = currentDocVersion?.toString?.() ?? 'unknown';
  console.log('[CalendarContext.tsx][9401] › Monitor active doc:', docFileID, 'v=', currentVer);

  const existing = notebookVersions.get(docFileID);

  // 1) No month yet → nothing to extend. Normalize tracking once and exit.
  if (!currentMonth) {
    const needsNormalize =
      !existing ||
      existing.trackedVersion !== currentVer ||
      existing.currentVersion !== currentVer ||
      existing.needsUpdate === true;

    if (needsNormalize) {
      setNotebookVersions(prev => {
        const map = new Map(prev);
        map.set(docFileID, {
          notebookId: docFileID,
          trackedVersion: currentVer,   // track to current version so we don't loop
          currentVersion: currentVer,
          needsUpdate: false,
          lastChecked: new Date(),
        });
        return map;
      });
      console.log('[CalendarContext.tsx][9404] › Normalized version tracking (no month); no extension needed');
    }
    return; // IMPORTANT: don’t attempt extension without a month
  }

  // 2) Month exists → detect a true change, flag once, and trigger extension.
  if (existing) {
    const changed = existing.trackedVersion !== currentVer;
    if (changed && !existing.needsUpdate) {
      console.log('[CalendarContext.tsx][9402] › Version change:', existing.trackedVersion, '→', currentVer);
      setNotebookVersions(prev => {
        const map = new Map(prev);
        map.set(docFileID, {
          ...existing,
          currentVersion: currentVer,
          needsUpdate: true,
          lastChecked: new Date(),
        });
        return map;
      });
      // Kick extension; triggerScheduleExtension is already guarded internally.
      triggerScheduleExtension(docFileID, currentVer);
    }
  } else {
    // 3) Month exists, but we have no tracking yet: initialize to currentVer.
    setNotebookVersions(prev => {
      const map = new Map(prev);
      map.set(docFileID, {
        notebookId: docFileID,
        trackedVersion: currentVer,
        currentVersion: currentVer,
        needsUpdate: false,
        lastChecked: new Date(),
      });
      return map;
    });
    console.log('[CalendarContext.tsx][9403] › Initialized tracking for active doc');
  }
}, [
  currentDocVersion,
  currentMonth,
  docFileID,
  isInitialized,
  selectedNotebooks,
  notebookVersions,
  triggerScheduleExtension,
]);


// Fire the monitor when the doc or its version changes, or when a month becomes available.
useEffect(() => {
  monitorActiveDocumentVersion();
}, [monitorActiveDocumentVersion]);


  // Run monitor on relevant changes
  useEffect(() => {
    monitorActiveDocumentVersion();
  }, [monitorActiveDocumentVersion]);

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
      const notebooks = await calendarService.getAvailableNotebooks();
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
  }, [calendarService]);

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
        setCurrentMonth(nextMonth);

        // Persist full state optimistically
        persistAllOptimistic({ selectedNotebooks: updated, currentMonth: nextMonth }).catch(() => void 0);
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
   *   Generates the month from selected notebooks and config. Updates state immediately and persists
   *   optimistically. Also initializes version tracking for all selected notebooks. Complexity O(N) to load
   *   notebook details and O(D + S) to generate the month.
   */
  const generateSchedule = useCallback(async () => {
    console.log('[CalendarContext.tsx][9702] › Generate schedule for', selectedNotebooks.length, 'notebooks');

    if (selectedNotebooks.length === 0) {
      setError('Please select at least one notebook for scheduling');
      console.warn('[CalendarContext.tsx][9703] › No notebooks selected');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const metas = await calendarService.getNotebookDetails(selectedNotebooks);
      if (metas.length === 0) throw new Error('No valid notebook metadata found');

      const colored = metas.map((m, i) => ({ ...m, color: NOTEBOOK_COLORS[i % NOTEBOOK_COLORS.length] }));
      const month = await calendarService.generateMonthlyCalendar(colored, scheduleConfig, currentDate);

      setCurrentMonth(month);

      // Initialize tracking for all selected notebooks
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

      // Persist full state optimistically
      await persistAllOptimistic({ currentMonth: month });
      console.log('[CalendarContext.tsx][9704] › Generate schedule success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate schedule';
      console.error('[CalendarContext.tsx][9705] › Generate schedule error:', msg);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [
    calendarService,
    currentDate,
    currentDocVersion,
    docFileID,
    isInitialized,
    persistAllOptimistic,
    scheduleConfig,
    selectedNotebooks,
  ]);

  /**
   * @function regenerateMonth
   * @description
   *   Regenerates a specific month based on current selection and config. Updates state immediately, then
   *   persists optimistically. Complexity O(N + D + S).
   */
  const regenerateMonth = useCallback(async (year: number, monthIndex: number) => {
    console.log('[CalendarContext.tsx][9706] › Regenerate month', { year, monthIndex });

    if (selectedNotebooks.length === 0) {
      console.warn('[CalendarContext.tsx][9707] › No notebooks selected for regeneration');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const targetDate = new Date(year, monthIndex, 1);
      const metas = await calendarService.getNotebookDetails(selectedNotebooks);
      const colored = metas.map((m, i) => ({ ...m, color: NOTEBOOK_COLORS[i % NOTEBOOK_COLORS.length] }));

      const monthData = await calendarService.generateMonthlyCalendar(colored, scheduleConfig, targetDate);
      setCurrentMonth(monthData);
      setCurrentDate(targetDate);

      await persistAllOptimistic({ currentMonth: monthData });
      console.log('[CalendarContext.tsx][9708] › Regeneration success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to regenerate month';
      console.error('[CalendarContext.tsx][9709] › Regeneration error:', msg);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [calendarService, persistAllOptimistic, scheduleConfig, selectedNotebooks]);

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
    regenerateMonth(next.getFullYear(), next.getMonth());
  }, [currentDate, regenerateMonth]);

  // ────────────────────────────────────────────────────────────────────────────
  // 8) Session helpers & completion (optimistic)
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * @function createSessionLauncher
   * @description
   *   Prepares the PickerFileMeta for a given session id so callers can switch files/launch slides.
   *   Complexity O(D + S) in worst case to scan sessions across the month.
   */
  const createSessionLauncher = useCallback((sessionId: string): PickerFileMeta | null => {
    if (!currentMonth) return null;
    for (const daily of currentMonth.dailyPlans) {
      const session = daily.sessions.find(s => s.id === sessionId);
      if (session) {
        return {
          docId: session.notebookMeta.fileId,
          fileStorageId: session.notebookMeta.filePath,
          fileName: session.notebookMeta.fileName,
          role: undefined,
          updatedAt: session.notebookMeta.lastUpdated.toISOString(),
        };
      }
    }
    return null;
  }, [currentMonth]);

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
   *   Finds the day matching the given date. Complexity O(D) for the number of days in the month.
   */
  const getDailyPlan = useCallback((date: Date) => {
    if (!currentMonth) return null;
    const key = date.toDateString();
    return currentMonth.dailyPlans.find(p => p.date.toDateString() === key) ?? null;
  }, [currentMonth]);

  /**
   * @function getSessionsForDay
   * @description
   *   Returns all sessions for a given date from the current month. Complexity O(D) via getDailyPlan.
   */
  const getSessionsForDay = useCallback((date: Date) => {
    const plan = getDailyPlan(date);
    return plan ? plan.sessions : [];
  }, [getDailyPlan]);

  /**
   * @function getTodaysPlan
   * @description
   *   Shortcut for today’s plan. Complexity O(D).
   */
  const getTodaysPlan = useCallback(() => {
    return getDailyPlan(new Date());
  }, [getDailyPlan]);

  /**
   * @function clearSchedule
   * @description
   *   Clears all in-memory state immediately, and calls `api.clearAll()` to drop remote state. This is the
   *   only destructive flow. Complexity O(1).
   */
  const clearSchedule = useCallback(() => {
    console.log('[CalendarContext.tsx][9901] › Clear schedule');
    setSelectedNotebooks([]);
    setCurrentMonth(null);
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

    // Utils
    getDailyPlan,
    getSessionsForDay,
    getTodaysPlan,
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
    getDailyPlan,
    getSessionsForDay,
    getTodaysPlan,
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
