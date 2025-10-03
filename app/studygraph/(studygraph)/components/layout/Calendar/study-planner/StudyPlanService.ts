/**
 * @file StudyPlanService.ts
 * @description
 * [Responsibility & Scope]
 * This file implements the **public service façade** that applications call to generate
 * and extend study plans. It encapsulates dependency construction (orchestrator + core
 * schedulers), input validation, and top-level error handling. The service exposes two
 * methods: `generateStudyPlan` builds a brand-new plan from notebooks, configuration,
 * and a start date; `extendStudyPlan` resumes from a previously returned state to append
 * new sessions after content changes. Internally, the service delegates all scheduling
 * logic to `StudyPlanOrchestrator`, which executes the day-by-day algorithm. By keeping
 * orchestration separate from this API layer, we preserve testability and allow future
 * policy changes (constants, spacing rules) without altering the public interface. All
 * logs are concise and only indicate checkpoints such as entry/exit, success/failure,
 * and computed sizes—suitable for production observability without noisy outputs.
 */

import type { NotebookMeta } from '@/app/Library/Definitions/CalendarDefinitions';
import type { StudyPlanOutput, StudyPlanState } from './models/StudyPlanOutput';
import type { ScheduleConfig } from './models/Configuration';

// Orchestrator and core components
import { StudyPlanOrchestrator } from './core/StudyPlanOrchestrator';
import { distribute as LearningSetDistribute } from './core/LearningSetDistributor';
import { buildSchedulePattern as LearningSetBuildPattern } from './core/LearningSetScheduler';
import { parseLessons, chunkLesson } from './core/LessonParser';
import { scheduleBlockLearning } from './core/BlockLearningScheduler';
import { scheduleBlockRevision } from './core/BlockRevisionScheduler';
import { detectCompletions } from './core/LessonCompletionDetector';
import {
  scheduleInterleavedRevisions,
} from './core/InterLeavedRevisionScheduler';
import { aggregateSessions } from './core/SessionAggregator';

// Utilities & validators
import { validateNotebooks, validateScheduleConfig, validateStartDate } from './utils/validators';

export class StudyPlanService {
  private orchestrator: StudyPlanOrchestrator;

  constructor() {
    // Dependency injection of core functions keeps orchestrator fully testable and swappable.
    this.orchestrator = new StudyPlanOrchestrator(
      {
        distribute: LearningSetDistribute,
        buildSchedulePattern: LearningSetBuildPattern,
      },
      {
        parseLessons,
        chunkLesson,
      },
      {
        scheduleBlockLearning,
        scheduleBlockRevision,
      },
      {
        detectCompletions,
        scheduleInterleavedRevisions,
      },
      {
        aggregateSessions,
      }
    );
  }

  /**
   * @function generateStudyPlan
   * @description
   * Validates inputs and delegates to the orchestrator to produce a complete plan.
   * This is the main entry point: pass notebooks, a `ScheduleConfig`, and a start date
   * and receive a calendar-ready `StudyPlanOutput`. The method logs key checkpoints
   * and wraps any thrown error with contextual information for easier triage.
   */
  public generateStudyPlan(
    notebooks: NotebookMeta[],
    config: ScheduleConfig,
    startDate: Date
  ): StudyPlanOutput {
    const loc = 'StudyPlanService.ts#4101';
    // 1) Validate inputs (O(N) over notebooks due to shape checks).
    validateNotebooks(notebooks);
    validateScheduleConfig(config);
    validateStartDate(startDate);

    // 2) Delegate orchestration.
    try {
      const plan = this.orchestrator.generatePlan(notebooks, config, startDate);
      // eslint-disable-next-line no-console
      console.log(`[${loc}] generateStudyPlan -> PASS sessions=${plan.planMetadata.totalSessions}`);
      return plan;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(`[${loc}] generateStudyPlan -> FAIL reason=${(err as Error).message}`);
      throw new Error(`StudyPlanService.generateStudyPlan failed: ${(err as Error).message}`);
    }
  }

  /**
   * @function extendStudyPlan
   * @description
   * Continues a plan using the saved internal `StudyPlanState` and (optionally) updated
   * notebooks. The orchestrator restores progress, recalculates bounds, and appends new
   * sessions after the last scheduled date. This method is O(N) in notebook changes and
   * preserves previously scheduled sessions unchanged. See orchestrator docs for details.
   */
  public extendStudyPlan(
    existingState: StudyPlanState,
    updatedNotebooks: NotebookMeta[]
  ): StudyPlanOutput {
    const loc = 'StudyPlanService.ts#4102';
    try {
      // When extending, validation focuses on notebooks (structure) since config/state are trusted.
      validateNotebooks(updatedNotebooks);
      const plan = this.orchestrator.extendPlan(existingState, updatedNotebooks);
      // eslint-disable-next-line no-console
      console.log(`[${loc}] extendStudyPlan -> PASS sessions=${plan.planMetadata.totalSessions}`);
      return plan;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(`[${loc}] extendStudyPlan -> FAIL reason=${(err as Error).message}`);
      throw new Error(`StudyPlanService.extendStudyPlan failed: ${(err as Error).message}`);
    }
  }
}
