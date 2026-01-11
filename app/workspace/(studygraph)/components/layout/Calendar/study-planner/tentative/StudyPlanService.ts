/**
 * @file StudyPlanService.ts
 * @description
 * [Responsibility & Scope]
 * This file implements the public service façade that applications call to generate
 * and extend study plans. It encapsulates dependency construction, input validation, 
 * and strategy routing.
 * * UPDATE: This service now routes "Extension" calls to two different internal strategies
 * based on the `updateType` parameter:
 * 1. 'InsertNotebook': Reconfigures the plan structure for new books.
 * 2. 'UpdateNotebook': Preserves structure and schedules new content for existing books.
 */

import type { NotebookMeta } from '@/app/Library/Definitions/CalendarDefinitions';
import type { StudyPlanOutput, StudyPlanState } from '../models/StudyPlanOutput';
import type { ScheduleConfig } from '../models/Configuration';

// Orchestrator and core components
import { StudyPlanOrchestrator } from './StudyPlanOrchestrator';
import { distribute as LearningSetDistribute } from '../core/LearningSetDistributor';
import { buildSchedulePattern as LearningSetBuildPattern } from '../core/LearningSetScheduler';
import { parseLessons, chunkLesson } from '../core/LessonParser';
import { scheduleBlockLearning } from '../core/BlockLearningScheduler';
import { scheduleBlockRevision } from '../core/BlockRevisionScheduler';
import { detectCompletions } from '../core/LessonCompletionDetector';
import { scheduleInterleavedRevisions } from '../core/InterLeavedRevisionScheduler';
import { aggregateSessions } from '../core/SessionAggregator';
import { mergeStudyPlans } from '../mergeStudyPlan';
import { reconfigureStateForUpdate } from '../ScheduleReconfigurator';

// Utilities & validators
import { validateNotebooks, validateScheduleConfig, validateStartDate } from '../utils/validators';

/**
 * Discriminator for the type of update being performed.
 * - InsertNotebook: Structural change (new book added).
 * - UpdateNotebook: Content change (new lessons in existing book).
 */
export type PlanUpdateType = 'InsertNotebook' | 'UpdateNotebook';

export class StudyPlanService {
  private orchestrator: StudyPlanOrchestrator;

  constructor() {
    // Dependency injection of core functions keeps orchestrator fully testable and swappable.
    this.orchestrator = new StudyPlanOrchestrator(
      { distribute: LearningSetDistribute, buildSchedulePattern: LearningSetBuildPattern },
      { parseLessons, chunkLesson },
      { scheduleBlockLearning, scheduleBlockRevision },
      { detectCompletions, scheduleInterleavedRevisions },
      { aggregateSessions }
    );
  }

  /**
   * @function generateStudyPlan
   * @description
   * Validates inputs and delegates to the orchestrator to produce a complete plan.
   */
  public generateStudyPlan(
    notebooks: NotebookMeta[],
    config: ScheduleConfig,
    startDate: Date
  ): StudyPlanOutput {
    const loc = 'StudyPlanService.ts#4101';
    // 1) Validate inputs
    validateNotebooks(notebooks);
    validateScheduleConfig(config);
    validateStartDate(startDate);

    // 2) Delegate orchestration
    try {
      const plan = this.orchestrator.generatePlan(notebooks, config, startDate);

      return plan;
    } catch (err) {

      throw new Error(`StudyPlanService.generateStudyPlan failed: ${(err as Error).message}`);
    }
  }

  /**
   * @function extendStudyPlan
   * @description
   * Routes the extension logic based on the updateType:
   * - 'InsertNotebook': Uses InsertionStrategy (Reconfigures state, truncates future, passive schedule).
   * - 'UpdateNotebook': Uses UpdateStrategy (Preserves state, active anchored schedule).
   * * (new update - routing logic based on updateType)
   */
  public extendStudyPlan(
    existing: StudyPlanOutput,
    updatedNotebooks: NotebookMeta[],
    updateType: PlanUpdateType
  ): StudyPlanOutput {
    const loc = 'StudyPlanService.ts#4102';
    try {
      validateNotebooks(updatedNotebooks);

      let tail: StudyPlanOutput;
      let stateToExtend = existing.state;
      let baseSessions = existing.sessions;

      // (new update - conditional logic for strategy selection)
      if (updateType === 'InsertNotebook') {
        // --- PATH A: INSERTION (Structure Change) ---

        
        // 1. Anchor Date: Use current date (midnight) to start the new schedule immediately
        const anchorDate = new Date();
        anchorDate.setHours(0, 0, 0, 0);

        // 2. Reconfigure State: Rebalance sets and clear future maps in state
        stateToExtend = reconfigureStateForUpdate(existing.state, updatedNotebooks, anchorDate);

        // 3. Truncate Base Sessions: Remove future sessions that will be replaced
        const anchorTime = anchorDate.getTime();
        baseSessions = existing.sessions.filter((s) => s.date.getTime() < anchorTime);

        // 4. Execute Insertion Strategy
        tail = this.orchestrator.extendPlan_InsertionStrategy(stateToExtend, updatedNotebooks);

      } else {
        // --- PATH B: UPDATE (Content Only) ---

        
        // 1. Preserve sessions: The merge utility will handle deduplication using semantic signatures
        baseSessions = existing.sessions;

        // 2. Execute Update Strategy: Uses "Active Anchoring" to ensure sparse updates are scheduled
        tail = this.orchestrator.extendPlan_UpdateStrategy(existing.state, updatedNotebooks);
      }

       // Merge results
      const merged = mergeStudyPlans(existing, tail);

      return merged;

    } catch (err) {

      throw new Error(`StudyPlanService.extendStudyPlan failed: ${(err as Error).message}`);
    }
  }



/**
   * @function removeNotebook
   * @description
   * Removes a specific notebook from the study plan state and filters out all associated sessions.
   * This is a pure operation that returns a new StudyPlanOutput object.
   * * Strategy:
   * 1. Remove from `state.notebookProgress` (Map).
   * 2. Filter `state.learningSets` to remove the notebook from groupings.
   * 3. Filter `state.sessionsByDate` (Map) to remove sessions linked to this fileId.
   * 4. Filter the flat `sessions` array.
   * 5. Recalculate `planMetadata` totals AND date boundaries (startDate/endDate).
   */
  public removeNotebook(
    currentPlan: StudyPlanOutput,
    notebookId: string
  ): StudyPlanOutput {
    if (!currentPlan || !currentPlan.state) {
      throw new Error('Invalid study plan provided for removal.');
    }

    // 1. Deep Clone / Setup new containers to ensure immutability
    const newNotebookProgress = new Map(currentPlan.state.notebookProgress);
    const newSessionsByDate = new Map<string, any[]>();
    
    // 2. Remove from Progress Map
    newNotebookProgress.delete(notebookId);

    // 3. Filter Learning Sets
    // Iterate through learning sets and filter the 'notebooks' array within them.
    // If a learning set becomes empty, it is removed entirely.
    const newLearningSets = currentPlan.state.learningSets
      .map(ls => ({
        ...ls,
        notebooks: ls.notebooks.filter(nb => nb.fileId !== notebookId)
      }))
      .filter(ls => ls.notebooks.length > 0);

    // 4. Filter Sessions (Flat Array)
    const newSessions = currentPlan.sessions.filter(
      s => s.notebookMeta.fileId !== notebookId
    );

    // 5. Filter Sessions (Date Map)
    // Reconstruct the map, filtering out sessions for the target notebook.
    // Clean up empty days to keep the map sparse.
    for (const [dateKey, sessions] of currentPlan.state.sessionsByDate.entries()) {
      const filteredDaySessions = sessions.filter(
        s => s.notebookMeta.fileId !== notebookId
      );
      if (filteredDaySessions.length > 0) {
        newSessionsByDate.set(dateKey, filteredDaySessions);
      }
    }

    // 6. Recalculate Metadata (Totals + Breakdown + Boundaries)
    const sessionBreakdown = {
      blockLearning: 0,
      blockRevision: 0,
      interleavedRevision: 0
    };

    let minDate = newSessions.length > 0 ? newSessions[0].date.getTime() : 0;
    let maxDate = newSessions.length > 0 ? newSessions[0].date.getTime() : 0;

    newSessions.forEach(s => {
      // Breakdown Stats
      if (s.type === 'block') sessionBreakdown.blockLearning++;
      else if (s.type === 'revision-block') sessionBreakdown.blockRevision++;
      else if (s.type === 'revision-interleaved') sessionBreakdown.interleavedRevision++;

      // Date Boundaries
      const t = s.date.getTime();
      if (t < minDate) minDate = t;
      if (t > maxDate) maxDate = t;
    });

    const newPlanMetadata = {
      ...currentPlan.planMetadata,
      totalSessions: newSessions.length,
      learningSetCount: newLearningSets.length,
      sessionBreakdown,
      // If no sessions remain, default to current dates or new Date() to avoid NaN
      startDate: newSessions.length > 0 ? new Date(minDate) : new Date(),
      endDate: newSessions.length > 0 ? new Date(maxDate) : new Date()
    };

    // 7. Return new Output
    return {
      ...currentPlan,
      sessions: newSessions,
      planMetadata: newPlanMetadata,
      state: {
        ...currentPlan.state,
        learningSets: newLearningSets,
        notebookProgress: newNotebookProgress,
        sessionsByDate: newSessionsByDate,
        // Preserve nextAvailableDate from old state as calculating a new one requires
        // the Orchestrator's full availability logic. 
        nextAvailableDate: currentPlan.state.nextAvailableDate
      }
    };
  }
}