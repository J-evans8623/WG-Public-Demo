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
import { mergeStudyPlans } from './mergeStudyPlan';

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
   * @function extendStudyPlan  // update - 001
   * @description
   *  Returns a **merged** plan by internally computing the tail then merging it with the
   *  caller-provided existing plan.
   * @steps
   *  1) Validate inputs (updated notebooks).
   *  2) Use orchestrator.extendPlan(existing.state, updatedNotebooks) to compute the tail.
   *  3) mergeStudyPlans(existing, tail) to produce a unified plan preserving progress.
   *  4) Log summary and return merged.
   */
  public extendStudyPlan( // update - 001
    existing: StudyPlanOutput,       // ⟵ signature changed to accept the full plan
    updatedNotebooks: NotebookMeta[] //   rather than only the state
  ): StudyPlanOutput {               // update - 001
    const loc = 'StudyPlanService.ts#4102';
    try {
      // 1) Validate
      validateNotebooks(updatedNotebooks);

      // 2) Compute tail from existing state
      const tail = this.orchestrator.extendPlan(existing.state, updatedNotebooks);

      // 3) Merge
      const merged = mergeStudyPlans(existing, tail);

      // 4) Log
      // eslint-disable-next-line no-console
      console.log(
        `[${loc}] extendStudyPlan -> PASS mergedSessions=${merged.planMetadata.totalSessions} (tail=${tail.planMetadata.totalSessions})`
      );
      return merged;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(`[${loc}] extendStudyPlan -> FAIL reason=${(err as Error).message}`);
      throw new Error(`StudyPlanService.extendStudyPlan failed: ${(err as Error).message}`);
    }
  }
}
