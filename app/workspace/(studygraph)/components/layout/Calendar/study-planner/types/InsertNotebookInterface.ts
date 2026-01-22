import { 
  NotebookMeta, 
  StudySession, 
  PickerFileMeta 
} from '@/app/Library/Definitions/CalendarDefinitions';
import { 
  StudyPlanOutput, 
  LearningSet, 
  NotebookProgress, 
  ScheduleConfig, 
  LessonChunk,
  InterleavedRevisionProgress
} from '@/app/workspace/(studygraph)/components/layout/Calendar/study-planner/models';

/**
 * 1. SyncGlobalContext
 * Responsibility: Validates and filters incoming notebooks to ensure only untracked data enters 
 * the insertion pipeline. This prevents "idempotency" errors where clicking an action twice 
 * results in duplicate notebook records in the state.
 * Input: incomingMetas: NotebookMeta[], currentProgress: Map<string, NotebookProgress>.
 * Output: verifiedNewMetas: NotebookMeta[].
 * Significance: This is the "Gatekeeper." It ensures the algorithm remains strictly additive 
 * and never attempts to re-insert a notebook that already has a established progress history 
 * in the study plan.
 */
export interface ISyncGlobalContext {
  sync(
    incomingMetas: NotebookMeta[], 
    currentProgress: Map<string, NotebookProgress>
  ): NotebookMeta[];
}

/**
 * 2. BalanceStructuralLoad
 * Responsibility: Determines the optimal alternating schedule group (LS-A or LS-B) for the 
 * new notebooks based on the current distribution. It preserves the system's "Max 2 Sets" 
 * constraint while ensuring the study load is distributed evenly.
 * Input: newMetas: NotebookMeta[], existingSets: LearningSet[].
 * Output: assignments: Map<string, string>. (Map<notebookId, learningSetId>)
 * Significance: This abstraction eliminates the need for destructive reconfiguration. 
 * Instead of reshuffling existing notebooks, it "plugs" new notebooks into the lightest 
 * group to maintain a balanced daily workload.
 */
export interface IBalanceStructuralLoad {
  balance(
    newMetas: NotebookMeta[], 
    existingSets: LearningSet[]
  ): Map<string, string>;
}

/**
 * 3. IdentifyTemporalAnchor
 * Responsibility: Scans forward from the current time to find the first valid calendar slot 
 * where the assigned Learning Set is active and the user is available.
 * Input: learningSetId: string, config: ScheduleConfig, globalSchedulePattern: Map<string, LearningSet>, today: Date.
 * Output: anchorDate: Date.
 * Significance: By identifying a specific "Starting Slot" that respects the user's weekly 
 * availability pattern, we ensure the new notebook content starts as soon as legally possible 
 * without colliding with days reserved for other sets.
 */
export interface IIdentifyTemporalAnchor {
  findAnchor(
    learningSetId: string, 
    config: ScheduleConfig, 
    globalSchedulePattern: Map<string, LearningSet>, 
    today: Date
  ): Date;
}

/**
 * 4. MaterializeDelta
 * Responsibility: Converts raw file metadata into the scheduler's atomic units of work (Chunks). 
 * Since these are new notebooks, the "Delta" is the entire content of the file.
 * Input: notebookMeta: NotebookMeta.
 * Output: contentQueue: LessonChunk[].
 * Significance: This prepares the "payload" for scheduling. By abstracting the parsing 
 * and chunking logic, we ensure the actual scheduling loop only deals with standardized 
 * slices of work.
 */
export interface IMaterializeDelta {
  materialize(notebookMeta: NotebookMeta): LessonChunk[];
}

/**
 * 5. MapAdditiveSessions
 * Responsibility: Generates the concrete StudySession objects for the new content. It enforces 
 * the core semantic: Learning Block on the found set-day, followed by a Block Revision 
 * exactly 24 hours later.
 * Input: contentQueue: LessonChunk[], anchorDate: Date, notebookMetaSnapshot: NotebookMeta, config: ScheduleConfig, globalSchedulePattern: Map<string, LearningSet>.
 * Output: { newSessions: StudySession[], completionHorizon: Date }.
 * Significance: This is the "Placement Engine." It populates the calendar in an append-only 
 * fashion. Because it respects the alternating schedule pattern, these new sessions 
 * "weave" into the existing calendar without overwriting current data.
 */
export interface IMapAdditiveSessions {
  mapSessions(
    contentQueue: LessonChunk[], 
    anchorDate: Date, 
    notebookMetaSnapshot: NotebookMeta, 
    config: ScheduleConfig, 
    globalSchedulePattern: Map<string, LearningSet>
  ): { newSessions: StudySession[]; completionHorizon: Date };
}

/**
 * 6. SeedMaintenanceProgram
 * Responsibility: Sets up the long-term Spaced Repetition (Interleaved) program for the 
 * new notebook. It calculates the quota (Lessons × 4) and plans the review dates 
 * following the completion of the initial learning blocks.
 * Input: notebookId: string, totalLessons: number, completionHorizon: Date, learningSetId: string, globalSchedulePattern: Map<string, LearningSet>.
 * Output: initialInterleavedProgress: InterleavedRevisionProgress.
 * Significance: This ensures that once the initial "exposure" (blocks) is finished, the 
 * notebook enters the "spiral review" phase automatically, providing the long-term 
 * value of the study planner.
 */
export interface ISeedMaintenanceProgram {
  seed(
    notebookId: string, 
    totalLessons: number, 
    completionHorizon: Date, 
    learningSetId: string, 
    globalSchedulePattern: Map<string, LearningSet>
  ): InterleavedRevisionProgress;
}

/**
 * 7. ReconcileFinalState
 * Responsibility: Merges the newly generated progress records and sessions into the existing 
 * Study Plan. It performs the final "Commit" to the state and re-calculates high-level 
 * metadata (total sessions, plan end date).
 * Input: existingPlan: StudyPlanOutput, newSessions: StudySession[], newProgressEntries: Map<string, NotebookProgress>.
 * Output: updatedPlan: StudyPlanOutput.
 * Significance: This satisfies the State Integrity requirement. It produces a unified 
 * output that the UI can render and the persistence layer can save, ensuring the new 
 * notebooks are now a "permanent" part of the user's study lifecycle.
 */
export interface IReconcileFinalState {
  reconcile(
    existingPlan: StudyPlanOutput, 
    newSessions: StudySession[], 
    newProgressEntries: Map<string, NotebookProgress>
  ): StudyPlanOutput;
}



/**
 * 8. InferLearningSetPattern
 * Responsibility: Re-constructs or projects the underlying alternating learning set 
 * rhythm for the next year. This creates a continuous "ruleset" that the mapper 
 * can use to find valid slots without getting stuck on empty dates in the session map.
 * Input: startDate: Date, learningSets: LearningSet[], config: ScheduleConfig.
 * Output: futurePattern: Map<string, LearningSet>.
 * Significance: This provides the authoritative "calendar rules" needed to weave 
 * new notebooks into the future. It ensures the mapper always finds a match for 
 * a Set ID, preventing infinite loops.
 */
export interface IInferLearningSetPattern {
  infer(
    startDate: Date, 
    learningSets: LearningSet[], 
    config: ScheduleConfig
  ): Map<string, LearningSet>;
}



/**
 * 9. MaterializeInterleavedSessions
 * Responsibility: Transforms pre-calculated interleaved revision dates into concrete 
 * StudySession objects ready for the calendar.
 * Input: notebookId: string, progress: InterleavedRevisionProgress, notebookMeta: NotebookMeta.
 * Output: interleavedSessions: StudySession[].
 * Significance: This bridges the gap between planning and materialization. It ensures 
 * that long-term "Spiral Review" sessions are actually added to the schedule 
 * and visible in the UI, rather than just existing as metadata in the progress map.
 */
export interface IMaterializeInterleavedSessions {
  materialize(
    notebookId: string, 
    progress: InterleavedRevisionProgress, 
    notebookMeta: NotebookMeta
  ): StudySession[];
}