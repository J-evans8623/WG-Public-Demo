// src/services/study-planner/models/StudyPlanOutput.ts
/**
 * @file StudyPlanOutput.ts
 * @description
 * [Responsibility & Scope]
 * This file defines the public output contract for the Study Planner Service as well as the
 * internal state object used to extend an existing plan. The StudyPlanOutput is returned by
 * the service’s API and contains: (1) all scheduled StudySession items, (2) plan-level
 * metadata calculated during orchestration (start/end dates, totals, and a breakdown by
 * session type), and (3) a serializable StudyPlanState that holds progress and structural
 * information necessary to resume or extend scheduling at a later time. Importantly, the
 * state includes learning sets, per-notebook progress, a date-indexed session map, and the
 * next available scheduling date. These definitions are free of behavior to maximize
 * portability and testability; all logic lives in orchestrators and schedulers. Maintaining
 * a clean separation here ensures the API remains stable even if internal algorithms evolve.
 */

import type { StudySession } from "@/app/Library/Definitions/CalendarDefinitions";
import type { LearningSet } from './LearningSet';
import type { NotebookProgress } from './Progress';
import type { ScheduleConfig } from './Configuration';

/**
 * Summary statistics and metadata that describe a generated study plan.
 */
export interface PlanMetadata {
  /** Inclusive start date of the plan. */
  startDate: Date;
  /** Projected end date based on last scheduled session. */
  endDate: Date;
  /** Total number of sessions across the entire plan. */
  totalSessions: number;
  /** Count of learning sets created by the distributor. */
  learningSetCount: number;
  /** Count breakdown by session type for analytics and UI. */
  sessionBreakdown: {
    blockLearning: number;
    blockRevision: number;
    interleavedRevision: number;
  };
}

/**
 * Internal state captured to enable deterministic, incremental plan extensions.
 */
export interface StudyPlanState {
  /** Learning set assignments used by the plan. */
  learningSets: LearningSet[];
  /** Map of notebookId → NotebookProgress. */
  notebookProgress: Map<string, NotebookProgress>;
  /** Map of date key (YYYY-MM-DD) → array of sessions for that date. */
  sessionsByDate: Map<string, StudySession[]>;
  /** The next available date the orchestrator will consider for new sessions. */
  nextAvailableDate: Date;
  /** Schedule configuration used when generating this plan. */
  config: ScheduleConfig;
}

/**
 * The complete output returned by the Study Planner Service API.
 */
export interface StudyPlanOutput {
  /** Flat list of all sessions (already enriched for calendar display). */
  sessions: StudySession[];
  /** Plan-level metadata for summaries, analytics, and UI. */
  planMetadata: PlanMetadata;
  /** Internal state required to extend or resume the plan. */
  state: StudyPlanState;
}
