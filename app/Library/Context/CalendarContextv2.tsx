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
  useRef,
} from 'react';

import type {
  CalendarContextType,
  CalendarMonth,
  DailyStudyPlan,
  NotebookSummary,
  StudySession,
  PickerFileMeta,
  NotebookVersionState,
  NotebookMeta,
} from '@/app/Library/Definitions/CalendarDefinitions';
import { type DayOfWeek, type ScheduleConfig, ALL_DAYS} from '@/app/workspace/(studygraph)/components/layout/Calendar/study-planner/models/Configuration';
import { NotebooksApi } from '@/app/src/services/calendar/NotebooksApi';
import { CalendarPersistApi } from '@/app/src/services/calendar/CalendarPersistApi';
import { StudyPlanService, type PlanUpdateType } from '@/app/workspace/(studygraph)/components/layout/Calendar/study-planner/tentative/StudyPlanService';
import type { StudyPlanOutput} from '@/app/workspace/(studygraph)/components/layout/Calendar/study-planner/models/StudyPlanOutput.ts'
import { useYDoc } from '@/app/Library/Context/YDocContext';
import { useFileList, useApiContext, useAccountStatus  } from '@/app/src/context/ApiContext'; 
import type { UserFileMetadata } from '@/app/src/types/fileTypes';
import { useGlobalModal } from '@/app/workspace/(studygraph)/components/modals/GlobalModalProvider';

const Ctx = createContext<CalendarContextType | undefined>(undefined);


/**
 * Revives JSON-parsed / Firestore-decoded objects back into full StudyPlanOutput
 * with all Date-typed fields restored as real Date instances.
 * This walks:
 *   • planMetadata.startDate / endDate
 *   • state.nextAvailableDate
 *   • state.sessionsByDate[*].date
 *   • state.sessionsByDate[*].notebookMeta.lastUpdated
 *   • flat sessions[*].date / sessions[*].notebookMeta.lastUpdated
 *   • state.learningSets[*].notebooks[*].lastUpdated
 *   • state.notebookProgress[*].interleavedRevisionProgress.firstSessionDate
 *   • state.notebookProgress[*].interleavedRevisionProgress.scheduledDates[*]
 *   • state.notebookProgress[*].lessonProgress[*].completionDate
 *   • state.notebookProgress[*].lessonProgress[*].blockLearningSessions[*].date
 *   • state.notebookProgress[*].lessonProgress[*].blockRevisionSessions[*].date
 */
function reviveStudyPlan(rawPlan: any): StudyPlanOutput | null {
  if (!rawPlan || !rawPlan.state) return null;

  // Helper for any date-like value (string | number | Timestamp-like | Date | null/undefined)
  const reviveDate = (d: any): Date => {
    if (!d) return new Date();
    if (d instanceof Date) return d;
    if (typeof d?.toDate === 'function') {
      const asDate = d.toDate();
      return isNaN(asDate.getTime()) ? new Date() : asDate;
    }
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  };

  // ---- notebookProgress: Object/Map → Map and deep revive progress dates ----
  let progressMap = rawPlan.state.notebookProgress;
  if (!(progressMap instanceof Map)) {
    if (typeof progressMap === 'object' && progressMap !== null) {
      progressMap = new Map(Object.entries(progressMap));
    } else {
      progressMap = new Map();
    }
  }

  // Deep-walk each NotebookProgress
  for (const [nbId, progAny] of (progressMap as Map<string, any>).entries()) {
    const prog = progAny ?? {};

    // 1) InterleavedRevisionProgress dates
    const ilp = prog.interleavedRevisionProgress;
    if (ilp && typeof ilp === 'object') {
      if (ilp.firstSessionDate) {
        ilp.firstSessionDate = reviveDate(ilp.firstSessionDate);
      }
      if (Array.isArray(ilp.scheduledDates)) {
        ilp.scheduledDates = ilp.scheduledDates.map((d: any) => reviveDate(d));
      } else {
        ilp.scheduledDates = [];
      }
    }

    // 2) LessonProgress dates (completion + block session dates)
    const lessons = Array.isArray(prog.lessonProgress) ? prog.lessonProgress : [];
    prog.lessonProgress = lessons.map((lp: any) => {
      const next = { ...lp };

      if (next.completionDate) {
        next.completionDate = reviveDate(next.completionDate);
      }

      const reviveBlockArray = (arr: any) =>
        Array.isArray(arr)
          ? arr.map((b: any) => ({
              ...b,
              date: reviveDate(b?.date),
            }))
          : [];

      next.blockLearningSessions = reviveBlockArray(next.blockLearningSessions);
      next.blockRevisionSessions = reviveBlockArray(next.blockRevisionSessions);

      return next;
    });

    (progressMap as Map<string, any>).set(nbId, prog);
  }

  // ---- sessionsByDate: Object → Map + revive session + notebookMeta dates ----
  let sessionsMap = rawPlan.state.sessionsByDate;
  if (!(sessionsMap instanceof Map)) {
    if (typeof sessionsMap === 'object' && sessionsMap !== null) {
      const entries = Object.entries(sessionsMap).map(([key, val]) => {
        const sessions = Array.isArray(val) ? val : [];
        const revivedSessionsForDay = sessions.map((s: any) => ({
          ...s,
          date: reviveDate(s.date),
          notebookMeta: {
            ...s.notebookMeta,
            lastUpdated: reviveDate(s.notebookMeta?.lastUpdated),
          },
        }));
        return [key, revivedSessionsForDay];
      });
      sessionsMap = new Map(entries as any);
    } else {
      sessionsMap = new Map();
    }
  }

  // ---- Flat sessions array: revive session + notebookMeta dates ----
  const revivedSessions = (rawPlan.sessions || []).map((s: any) => ({
    ...s,
    date: reviveDate(s.date),
    notebookMeta: {
      ...s.notebookMeta,
      lastUpdated: reviveDate(s.notebookMeta?.lastUpdated),
    },
  }));

  // ---- planMetadata dates ----
  const revivedMetadata = {
    ...rawPlan.planMetadata,
    startDate: reviveDate(rawPlan.planMetadata?.startDate),
    endDate: reviveDate(rawPlan.planMetadata?.endDate),
  };

  // ---- learningSets: revive NotebookMeta.lastUpdated inside each set ----
  const revivedLearningSets = Array.isArray(rawPlan.state.learningSets)
    ? rawPlan.state.learningSets.map((ls: any) => ({
        ...ls,
        notebooks: Array.isArray(ls.notebooks)
          ? ls.notebooks.map((nb: any) => ({
              ...nb,
              lastUpdated: reviveDate(nb?.lastUpdated),
            }))
          : [],
      }))
    : [];

  // ---- Assemble final revived StudyPlanOutput ----
  return {
    ...rawPlan,
    sessions: revivedSessions,
    planMetadata: revivedMetadata,
    state: {
      ...rawPlan.state,
      learningSets: revivedLearningSets,
      notebookProgress: progressMap,
      sessionsByDate: sessionsMap,
      nextAvailableDate: reviveDate(rawPlan.state.nextAvailableDate),
    },
  };
}

/**
 * Serializes Maps into Objects for the Persistence Layer (JSON.stringify).
 * This prevents Maps from being saved as empty objects "{}".
 */
function serializeStudyPlan(plan: StudyPlanOutput): any {
  if (!plan) return null;

  const sessionsByDateObj = plan.state.sessionsByDate instanceof Map
    ? Object.fromEntries(plan.state.sessionsByDate)
    : plan.state.sessionsByDate;

  const notebookProgressObj = plan.state.notebookProgress instanceof Map
    ? Object.fromEntries(plan.state.notebookProgress)
    : plan.state.notebookProgress;

  return {
    ...plan,
    state: {
      ...plan.state,
      sessionsByDate: sessionsByDateObj,
      notebookProgress: notebookProgressObj,
    }
  };
}


/**
 * @function syncPlanMetaWithFileList
 * @description
 * Pure helper that deep-walks the StudyPlanOutput and updates notebook display metadata
 * (fileName, colorCode) to match the current authoritative file list.
 * Returns the original plan object if no changes were needed, ensuring referential stability.
 */
function syncPlanMetaWithFileList(
  plan: StudyPlanOutput,
  files: UserFileMetadata[]
): StudyPlanOutput {
  if (!plan || !files || files.length === 0) return plan;

  // 1. Build a lookup map for O(1) access
  const fileMap = new Map<string, { fileName: string; colorCode: string }>();
  for (const f of files) {
    fileMap.set(f.fileId, { fileName: f.fileName, colorCode: f.colorCode! });
  }

  let hasChanges = false;

  // Helper to patch a NotebookMeta object if needed
  const patchMeta = (meta: NotebookMeta): NotebookMeta => {
    const fresh = fileMap.get(meta.fileId);
    if (fresh && (fresh.fileName !== meta.fileName || fresh.colorCode !== meta.colorCode)) {
      hasChanges = true;
      return { ...meta, fileName: fresh.fileName, colorCode: fresh.colorCode };
    }
    return meta;
  };

  // 2. Patch flat sessions array
  const newSessions = plan.sessions.map(s => {
    const newMeta = patchMeta(s.notebookMeta);
    return newMeta === s.notebookMeta ? s : { ...s, notebookMeta: newMeta };
  });

  // 3. Patch sessionsByDate (Map)
  const newSessionsByDate = new Map(plan.state.sessionsByDate);
  for (const [dateKey, daySessions] of plan.state.sessionsByDate.entries()) {
    let dayChanged = false;
    const newDaySessions = daySessions.map((s: any) => {
      const newMeta = patchMeta(s.notebookMeta);
      if (newMeta !== s.notebookMeta) {
        dayChanged = true;
        return { ...s, notebookMeta: newMeta };
      }
      return s;
    });

    if (dayChanged) {
      newSessionsByDate.set(dateKey, newDaySessions);
    }
  }

  // 4. Patch learningSets
  // learningSets structure: { notebooks: NotebookMeta[], ... }
  const newLearningSets = plan.state.learningSets.map((ls: any) => {
    let setChanged = false;
    const newNotebooks = ls.notebooks.map((nb: NotebookMeta) => {
      const newMeta = patchMeta(nb);
      if (newMeta !== nb) {
        setChanged = true;
        return newMeta;
      }
      return nb;
    });

    return setChanged ? { ...ls, notebooks: newNotebooks } : ls;
  });

  // If nothing changed, return original to preventing rendering loops
  if (!hasChanges) return plan;

  // Return new object with patches
  return {
    ...plan,
    sessions: newSessions,
    state: {
      ...plan.state,
      sessionsByDate: newSessionsByDate,
      learningSets: newLearningSets,
    },
  };
}


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
          colorCode: s.notebookMeta.colorCode,
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
  //const [availableNotebooks, setAvailableNotebooks] = useState<NotebookSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [saveNeeded, setSaveNeeded] =useState(false);
  const { userEmail } = useApiContext();

  // update - 2: New Freemium & Sync State
  const { accountStatus } = useAccountStatus();
  const { showModal } = useGlobalModal();
  
  const [hasUnseenUpdates, setHasUnseenUpdates] = useState(false);

  const [pendingIntegrations, setPendingIntegrations] =useState<Map<string, number>>(new Map());

  // Version tracking (unchanged conceptually)
  const [notebookVersions, setNotebookVersions] = useState<Map<string, NotebookVersionState>>(new Map());
  const [extensionInProgress, setExtensionInProgress] = useState(false);

  const autosyncHistory = useRef<Set<string>>(new Set());

  // Local-only config (not persisted)
 const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>({
    DayAvailability: ALL_DAYS,
  });

  const [planStartDate, setPlanStartDate] = useState<Date>(new Date());

  // Services
  const notebooksApi = useMemo(() => new NotebooksApi(), []);
  const persistApi = useMemo(() => new CalendarPersistApi(), []);
  const service = useMemo(() => new StudyPlanService(), []);

  // External context for optional version wiring
  const { docFileID, version: currentDocVersion } = useYDoc();

    // ── File list (canonical) from ApiContext
   const { ownedFiles, sharedFiles, isRefreshing: listRefreshing, lastError: listError, refresh: refreshFileList } = useFileList(); 

   const availableNotebooks: NotebookSummary[] = useMemo(() => { 
    // Step 1: calc totalUnits from lessonUnitsMeta or unitsByMap
    const calcUnits = (meta: any): number => {
      if (!meta) return 0;
      if (typeof meta.totalUnits === 'number') return meta.totalUnits;
      if (meta.unitsByMap && typeof meta.unitsByMap === 'object') {
        let total = 0;
        for (const arr of Object.values(meta.unitsByMap)) {
          if (Array.isArray(arr)) total += arr.length;
        }
        return total;
      }
      if (Array.isArray(meta.units)) return meta.units.length;
      return 0;
    };

    // Combine sources
    const allFiles = [...ownedFiles, ...sharedFiles];

    // Step 2: map to NotebookSummary and filter empty notebooks
    const mapped = (allFiles || []).map((f: any) => ({
      fileId: f.fileId,
      fileName: f.fileName,
      totalUnits: calcUnits((f as any).lessonUnitsMeta),
      lastUpdated: new Date(f.updatedAt || f.timestamp || Date.now()),
      hasLessonMeta: !!(f as any).lessonUnitsMeta,
      colorCode: f.colorCode,
    })).filter(n => n.totalUnits > 0);
    return mapped;
  }, [ownedFiles]);


  /**
   * @effect Metadata Reconciliation
   * @description
   * Watches `studyPlan` and `ownedFiles`. If the plan contains stale metadata (e.g., old names),
   * creates a new plan reference with updated metadata and commits it to state.
   * The `syncPlanMetaWithFileList` helper is stable (returns same ref) if no changes occur,
   * preventing infinite loops.
   */
  useEffect(() => {
    if (!studyPlan || ownedFiles.length === 0) return;

    const reconciled = syncPlanMetaWithFileList(studyPlan, ownedFiles);
    
    // Strict reference check ensures we only trigger a re-render if data actually changed
    if (reconciled !== studyPlan) {

      setStudyPlan(reconciled);
    }
  }, [studyPlan, ownedFiles]);

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
      const revived = reviveStudyPlan(data.studyPlan);
      setStudyPlan(revived);

      setHasUnseenUpdates(false);

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
      // FIX: Serialize Maps -> Objects before sending
      const wirePlan = serializeStudyPlan(studyPlan);
      await persistApi.store({
        studyPlan: wirePlan as any, // Cast to satisfy strict type check (transport layer will JSON.stringify)
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
   * @description Thin delegator to the centralized `ApiContext.refreshList()` which coalesces,
   * caches, and dedupes file list loads. This keeps the calendar’s selection UI in sync with the
   * single authoritative list and prevents racing `/api/files/list` requests. It returns a promise
   * for convenient awaiting by callers but exposes no local side effects beyond `ApiContext` state.
   * This path also suppresses soft “deferred” states, surfacing only hard network errors via context.
   * @steps
   *  1) Call `refreshFileList()` from `useFileList()`.
   */
  const refreshNotebooks = useCallback(async () => { 
    await refreshFileList();
  }, [refreshFileList]);


  //useEffect(() => { void refreshNotebooks(); }, [refreshNotebooks]);


  useEffect(() => {
  // Suppress soft deferrals; they are expected during superseded calls / Retry-After
  if (!listError || listError === 'LIST_DEFERRED') return;
  setError(listError);
}, [listError]);


  /**
   * @function selectNotebook
   * @description Add notebook ID and persist envelope (if a plan exists).
   * 
   */
  const selectNotebook = useCallback((id: string) => {
    // Check Freemium Constraints

    console.log(`888 The id that was selected is ${id} and the selected notebooks include ${JSON.stringify(selectNotebook)}`)

    if (accountStatus?.subscriptionTier === 'freemium' && selectedNotebooks.length >= 2 && !selectedNotebooks.includes(id)) {

      const booleans = {
        subscriptionTier:accountStatus?.subscriptionTier,
        notebookLength: selectedNotebooks.length,
        includesTest: selectedNotebooks.includes(id)
      }
      console.log(`Here are the values that triggered the subscription modal ${JSON.stringify(booleans)}`)
      showModal('subscribe', { featureName: "Study Plan Limit" }); // update - 5
      return;
    }

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
      setSaveNeeded(true);
      return next;
    });
  }, [currentDocVersion, docFileID, accountStatus, selectedNotebooks, showModal]);

  /**
   * @function deselectNotebook
   * @description Remove notebook ID and persist envelope (if a plan exists).
   * 
   */
  const deselectNotebook = useCallback((id: string) => {
    setSelectedNotebooks(prev => {
      const next = prev.filter(x => x !== id);
      setNotebookVersions(m => {
        const mm = new Map(m); mm.delete(id); return mm;
      });
      setSaveNeeded(true)
      return next;
    });
  }, []);


  /**
   * @function removeNotebook
   * @description
   * Calls the service layer to surgically remove a notebook from the plan state,
   * then updates local state and persists changes.
   */
  const removeNotebook = useCallback(async (notebookId: string) => {
    if (!studyPlan) return;

    try {
      // 1. Call Service (Pure Function)
      const newPlan = service.removeNotebook(studyPlan, notebookId);

      // 2. Update Local State
      setStudyPlan(newPlan);
      // Also remove from selection UI state if present
      setSelectedNotebooks(prev => prev.filter(id => id !== notebookId));
      
      // 3. Persist
      const wirePlan = serializeStudyPlan(newPlan);
      await persistApi.store({
        studyPlan: wirePlan,
        selectedNotebooks: selectedNotebooks.filter(id => id !== notebookId),
        completedSessions
      });

      // 4. Clean up version tracking
      setNotebookVersions(prev => {
        const next = new Map(prev);
        next.delete(notebookId);
        return next;
      });

    } catch (e: any) {
      console.error('[CalendarContext] removeNotebook failed', e);
      setError(e?.message ?? 'Failed to remove notebook');
    }
  }, [studyPlan, service, persistApi, selectedNotebooks, completedSessions]);

/**
   * @function updateScheduleConfig
   * @description Update DayAvailability only. Ignores deprecated fields.
   * 
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
   * 
   */
  const generateSchedule = useCallback(async () => {
    if (selectedNotebooks.length === 0) {
      setError('Please select at least one notebook.');
      return;
    }

    if (accountStatus?.subscriptionTier === 'freemium' && selectedNotebooks.length > 2) {
       showModal('subscribe', { featureName: "Study Plan Limit" });
       return;
    }

    setIsLoading(true); setError(null);
    try {
      const metas = await notebooksApi.details(selectedNotebooks);
      const freshStartDate = new Date();
      const nextPlan = service.generateStudyPlan(metas, scheduleConfig, freshStartDate);

      if (!nextPlan || !nextPlan.sessions) {
         throw new Error("Service generated an invalid plan.");
      }

      setStudyPlan(nextPlan);
      // initialize versions
      const map = new Map<string, NotebookVersionState>();
      metas.forEach(nb => {
        map.set(nb.fileId, {
          notebookId: nb.fileId,
          trackedVersion: nb.version ?? 'unknown',
          currentVersion: nb.version ?? 'unknown',
          needsUpdate: false,
          lastChecked: new Date(),
        });
      });
      setNotebookVersions(map);
      const wirePlan = serializeStudyPlan(nextPlan);
      await persistApi.store({ studyPlan: wirePlan, selectedNotebooks, completedSessions });
    
      // ── STRATEGY: FLAG TRUE ──
      setHasUnseenUpdates(true);
      // ───────────────────────

    } catch (e: any) {
      setError(e?.message ?? 'Failed to generate plan');
    } finally {
      setIsLoading(false);
    }
  }, [selectedNotebooks, notebooksApi, service, scheduleConfig, planStartDate, persistApi, completedSessions, accountStatus]);

  /**
   * @function regenerateMonth
   * @description Move the visible window. The month is derived; no recompute needed.
   * 
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
      setSaveNeeded(true)
      return next;
    });
  }, []);

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
      setSaveNeeded(true);
      return next;
    });
  }, []);



  /**
   * @function updateStudyPlan
   * @description
   *  Extend the existing plan using updated NotebookMeta (from selection) and
   *  write the **merged** plan back to state + persistence.
   * @steps
   *  1) Guard: require an existing plan and at least one selected notebook.
   *  2) Load updated NotebookMeta[] via NotebooksApi.details(selectedNotebooks).
   *  3) Call service.extendStudyPlan(studyPlan, metas) to get a unified plan.
   *  4) setStudyPlan(merged) and POST envelope optimistically.
   *  5) Refresh version tracking snapshot.
   * (new update - detects structural changes vs content updates)
   */
  const updateStudyPlan = useCallback(async (isAutoSync = false) => { 
    if (!studyPlan) {
      setError('No existing plan to update. Generate a plan first.');
      return;
    }
    if (selectedNotebooks.length === 0) {
      setError('Please select at least one notebook.');
      return;
    }

    setIsLoading(true); setError(null);
    try {
      // 1. Fetch latest metadata for ALL selected notebooks
      const metas = await notebooksApi.details(selectedNotebooks);

      // 2. Determine Strategy:
      // If ANY selected notebook is NOT in the current plan, it's an Insertion.
      // If ALL selected notebooks are already in the plan, it's an Update.
      // Note: If a notebook was REMOVED from selection, we also treat as Structure Change (InsertNotebook).
      
      const currentPlanIds = new Set(studyPlan.state.notebookProgress.keys());
      const selectedSet = new Set(selectedNotebooks);

      const hasNewNotebooks = selectedNotebooks.some(id => !currentPlanIds.has(id));
      const hasRemovedNotebooks = Array.from(currentPlanIds).some(id => !selectedSet.has(id));

      const isStructureChange = hasNewNotebooks || hasRemovedNotebooks;
      const updateType: PlanUpdateType = isStructureChange ? 'InsertNotebook' : 'UpdateNotebook';


      // 3. Call Service with the specific strategy
      const merged = service.extendStudyPlan(studyPlan, metas, updateType);

      // 4. Commit State
      setStudyPlan(merged);
      const wirePlan = serializeStudyPlan(merged);
      await persistApi.store({
        studyPlan: wirePlan,
        selectedNotebooks,
        completedSessions,
      });

      // 5. Update Versions
      setNotebookVersions(prev => {
        const m = new Map(prev);
        metas.forEach(nb => {
          m.set(nb.fileId, {
            notebookId: nb.fileId,
            trackedVersion: nb.version ?? 'unknown',
            currentVersion: nb.version ?? 'unknown',
            needsUpdate: false,
            lastChecked: new Date(),
          });
        });
        return m;
      });

      if (!isAutoSync) {
        setHasUnseenUpdates(true);
      }

    } catch (e: any) {
      setError(e?.message ?? 'Failed to update plan');
    } finally {
      setIsLoading(false);
    }
  }, [studyPlan, selectedNotebooks, notebooksApi, service, persistApi, completedSessions]);



  /**
   * @function isNotebookTracked
   * @description Checks if a specific notebook ID is part of the active schedule.
   */
  const isNotebookTracked = useCallback((notebookId: string): boolean => {

    if (!studyPlan) return false;
    return studyPlan.state.notebookProgress.has(notebookId);
  }, [studyPlan]);

/**
 * @function queueNotebookIntegration
 * @description
 * Registers a user's intent to add or refresh a notebook in the plan.
 * Instead of a bare ID set, we now capture a baseline unit count:
 *   • For new notebooks, baseline will be 0 (no lesson units yet).
 *   • For existing notebooks, baseline will be the current totalUnits.
 * The reactive effect will only integrate once totalUnits > baseline,
 * ensuring we do not race against stale cache snapshots.
 */
const queueNotebookIntegration = useCallback((notebookId: string) => {
  // Look up the notebook's current unit count in the canonical file list.
  // If it's not present or has no units yet, baseline defaults to 0.
  const baselineUnits =
    availableNotebooks.find(nb => nb.fileId === notebookId)?.totalUnits ?? 0;

  setPendingIntegrations(prev => {
    const next = new Map(prev);
    // Avoid overwriting an existing baseline if the notebook is already queued.
    if (!next.has(notebookId)) {
      next.set(notebookId, baselineUnits);

    }
    return next;
  });

  // Surface immediate feedback that work is in progress.
  setIsLoading(true);
}, [availableNotebooks]);


/**
 * @function integrateNotebook
 * @description
 * Atomically adds a notebook to the selection and triggers a plan update.
 *
 * IMPORTANT:
 *  - We no longer perform a "does it have any units yet?" retry loop here.
 *  - Instead, the reactive effect above ensures we only call this function
 *    once the cached notebook metadata has moved past its baseline unit
 *    count (0 → N for new notebooks, N → N+M for updates).
 *
 * This keeps the responsibilities clean:
 *  - queueNotebookIntegration: remembers the baseline unit count.
 *  - useEffect watcher: waits for totalUnits > baseline before integrating.
 *  - integrateNotebook: trusts that data is fresh and extends/generates the plan.
 */
const integrateNotebook = useCallback(async (notebookId: string) => {

  if (accountStatus?.subscriptionTier === 'freemium' && selectedNotebooks.length >= 2 && !selectedNotebooks.includes(notebookId)) {
     showModal('subscribe', { featureName: "Study Plan Limit" });
     return;
  }
  // Snapshot previous selection for rollback on failure
  const previousSelection = selectedNotebooks;

  // 1. Optimistically update local selection state
  setSelectedNotebooks(prev => {
    if (prev.includes(notebookId)) return prev;
    return [...prev, notebookId];
  });

  const targetIds = Array.from(new Set([...selectedNotebooks, notebookId]));

  setIsLoading(true);
  setError(null);

  try {
    // 2. Fetch latest metadata for all target notebooks
    const metas: NotebookMeta[] = await notebooksApi.details(targetIds, userEmail);

    // Sanity check: ensure the target notebook exists in the response
    const targetMeta = metas.find(m => m.fileId === notebookId);
    if (!targetMeta) {
      throw new Error(`Notebook metadata not found for id ${notebookId}.`);
    }

    // 3. Execute Study Plan Service logic
    let nextPlan: StudyPlanOutput;

    if (!studyPlan) {
      // CASE: No existing plan → generate a new one from scratch
      const config: ScheduleConfig = { DayAvailability: ALL_DAYS };
      const startDate = new Date();
      nextPlan = service.generateStudyPlan(metas, config, startDate);
    } else {
      // CASE: Plan exists → decide whether this is an insertion or an update
      const isAlreadyTracked = studyPlan.state.notebookProgress.has(notebookId);
      const updateType: PlanUpdateType = isAlreadyTracked ? 'UpdateNotebook' : 'InsertNotebook';
      nextPlan = service.extendStudyPlan(studyPlan, metas, updateType);
    }

    // 4. Commit plan + persist
    setStudyPlan(nextPlan);
    const wirePlan = serializeStudyPlan(nextPlan);
    await persistApi.store({
      studyPlan: wirePlan,
      selectedNotebooks: targetIds,
      completedSessions,
    });

    // 5. Refresh version tracking for all involved notebooks
    setNotebookVersions(prev => {
      const m = new Map(prev);
      metas.forEach(nb => {
        m.set(nb.fileId, {
          notebookId: nb.fileId,
          trackedVersion: nb.version ?? 'unknown',
          currentVersion: nb.version ?? 'unknown',
          needsUpdate: false,
          lastChecked: new Date(),
        });
      });
      return m;
    });


    // Increment Badge on Successful Integration (New Addition)
    // ── STRATEGY: FLAG TRUE ──
      setHasUnseenUpdates(true);
      // ───────────────────────

  } catch (e: any) {
    console.error('[CalendarContext] integrateNotebook failed', e);
    setError(e?.message ?? 'Failed to integrate notebook');

    // Roll back to previous selection on failure
    setSelectedNotebooks(previousSelection);
  } finally {
    setIsLoading(false);
  }
}, [studyPlan, selectedNotebooks, notebooksApi, service, persistApi, completedSessions, userEmail, accountStatus, showModal]);


/**
 * @effect Reactive Integration
 * @description
 * Watches `availableNotebooks` (fed by ApiContext / YDoc write-through cache)
 * and integrates notebooks only when their unit counts are demonstrably fresh.
 *
 * For each queued notebook:
 *   baselineUnits = unit count at the time of queuing
 *   currentUnits  = live unit count from `availableNotebooks`
 *
 * We integrate ONLY when:
 *   currentUnits > baselineUnits
 *
 * This prevents the race where an existing notebook (N units) is integrated
 * using its old snapshot before the N+M units from lesson generation have
 * propagated through the cache.
 */
useEffect(() => {
  if (pendingIntegrations.size === 0) return;

  const processQueue = async () => {
    const toProcess: string[] = [];

    // Debug visibility into the queue (Map → array for logging)
    const debugQueue = Array.from(pendingIntegrations.entries()).map(
      ([id, baseline]) => ({ id, baseline })
    );


    // Determine which queued notebooks are now "fresh enough" to integrate
    pendingIntegrations.forEach((baselineUnits, id) => {
      const meta = availableNotebooks.find(nb => nb.fileId === id);
      if (!meta) return;

      const currentUnits = meta.totalUnits ?? 0;

      // READY when the cache shows strictly more units than when we queued.
      if (currentUnits > baselineUnits) {

        toProcess.push(id);
      }
    });

    if (toProcess.length === 0) {
      return;
    }

    // Execute integration for ready items
    for (const id of toProcess) {
      await integrateNotebook(id);

      // Remove from queue after successful processing
      setPendingIntegrations(prev => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    }
  };

  void processQueue();
}, [availableNotebooks, pendingIntegrations, integrateNotebook]);


  // "Autosave mechanism"

  useEffect(()=>{
    if (saveNeeded) {
      void persistOptimistic();
      setSaveNeeded(false)
    }
  },[persistOptimistic, saveNeeded])



  
  /**
   * @effect Autosync / Self-Healing
   * @description
   * Comparison Strategy: Unit Counts.
   * Checks if the *quantity* of lesson units in the live file differs from the plan.
   * If they differ, it triggers `updateStudyPlan` ONCE per session per notebook.
   */
  useEffect(() => {
    // Only run if we have a plan, live data, and aren't already working
    if (!studyPlan || availableNotebooks.length === 0 || isLoading) return;

    let needsSync = false;

    // Iterate over tracked notebooks in the plan
    for (const [notebookId, progress] of studyPlan.state.notebookProgress) {
        // Skip if we have already attempted to sync this specific notebook in this session
        // This satisfies the "update once per session" requirement and prevents error loops
        console.log(` Autosync history 44: ${JSON.stringify(autosyncHistory.current)}`)
        if (autosyncHistory.current.has(notebookId)) continue;

        const liveFile = availableNotebooks.find(n => n.fileId === notebookId);
        console.log(` Autosync availableNotebooks 44: ${JSON.stringify(liveFile)}`)
        if (!liveFile) continue; 

        // 1. Calculate Plan Units (Sum of all lessons in the existing progress)
        const planUnits = progress.lessonProgress.reduce((acc, lp) => acc + lp.totalUnits, 0);
        console.log(` Autosync planUnits 44: ${JSON.stringify(planUnits)}`)

        // 2. Get Live Units
        const liveUnits = liveFile.totalUnits;
        console.log(` Autosync Live Units 44: ${JSON.stringify(liveUnits)}`)

        // 3. Content-Based Comparison (Ignore timestamps/color codes)
        if (liveUnits !== planUnits) {
             console.log(`[Autosync] 44 Detected unit mismatch for ${liveFile.fileName}. Plan: ${planUnits}, Live: ${liveUnits}`);
             
             // Mark as attempted immediately to prevent re-entry/loops during the async update
             autosyncHistory.current.add(notebookId);
             needsSync = true;
             
             // We found a discrepancy. Break loop to trigger the single update.
             // updateStudyPlan processes ALL selected notebooks, so one trigger handles everything.
             break; 
        }
    }

    if (needsSync) {
        // Trigger update silently (suppressed UI errors inside updateStudyPlan via internal try/catch)
        // Pass true to indicate this is an auto-sync (suppresses 'Unseen Updates' badge if desired)
        void updateStudyPlan(true); 
    }
  }, [availableNotebooks, studyPlan, isLoading, updateStudyPlan]);




  /**
   * @function clearSchedule
   * @description Clear local + remote envelope.
   * @steps
   *  1) Reset local state.
   *  2) DELETE on server (ignore errors).
   * 
   */
  const clearSchedule = useCallback(() => {
    setSelectedNotebooks([]);
    setStudyPlan(null);
    setCompletedSessions([]);
    setNotebookVersions(new Map());
    setError(null);
    void persistApi.clear();
  }, [persistApi]);


  /**
   * @function getSessionsForWeek
   * @description
   * Returns a filtered list of StudySession items scheduled for the week surrounding the
   * provided anchor date (Mon-Sun). This accessor allows the UI to calculate weekly loads
   * without exposing the raw (and potentially complex) studyPlan object.
   */
  const getSessionsForWeek = useCallback((anchorDate: Date): StudySession[] => {
    if (!studyPlan || !studyPlan.sessions) return [];

    const d = new Date(anchorDate);
    const day = d.getDay(); // 0 (Sun) to 6 (Sat)
    // Adjust to make Monday index 0, Sunday index 6
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
    
    // Start of week (Monday 00:00:00)
    const startOfWeek = new Date(d);
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);

    // End of week (Sunday 23:59:59)
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    // Filter sessions
    return studyPlan.sessions.filter(s => {
      if (!s.date) return false;
      const sd = new Date(s.date);
      return sd >= startOfWeek && sd <= endOfWeek;
    });
  }, [studyPlan]);

  const resetUnseenCount = useCallback(() => {
    // ── STRATEGY: FLAG TRUE ──
      setHasUnseenUpdates(false);
      // ───────────────────────
}, []);

  const value: CalendarContextType = useMemo(() => ({
    // state
    selectedNotebooks,
    currentMonth,
    scheduleConfig,
    planStartDate,
    setPlanStartDate,
    isLoading:isLoading || extensionInProgress || listRefreshing,
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
    removeNotebook,
    resetUnseenCount,

    // config
    updateScheduleConfig,

    // scheduling
    generateSchedule,
    updateStudyPlan,
    regenerateMonth,
    clearSchedule,

    // sessions
    createSessionLauncher,
    markSessionCompleted,
    markSessionIncomplete,
    completedSessions,

    // utilities
    notebookVersions,
    isNotebookTracked,
    integrateNotebook,
    queueNotebookIntegration,
    getSessionsForWeek,
    hasUnseenUpdates,
  }), [selectedNotebooks, removeNotebook, currentMonth, scheduleConfig, planStartDate, isLoading, extensionInProgress, listRefreshing, error, availableNotebooks, currentDate, navigateMonth, selectNotebook, deselectNotebook, refreshNotebooks, updateScheduleConfig, generateSchedule, updateStudyPlan, regenerateMonth, clearSchedule, createSessionLauncher, markSessionCompleted, markSessionIncomplete, completedSessions, notebookVersions, isNotebookTracked, integrateNotebook, queueNotebookIntegration, getSessionsForWeek, hasUnseenUpdates, resetUnseenCount]);

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

