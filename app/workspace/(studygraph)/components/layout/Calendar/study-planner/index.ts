/**
 * @file Study Planner Service - Public API Entry Point
 * @description
 * [Responsibility & Scope]
 * This entry file exposes the public surface of the Study Planner Service in a clean,
 * dependency-light manner so consumers don’t need to know about the internal directory
 * structure. Its responsibilities are deliberately minimal yet important: (1) export
 * the `StudyPlanService` class, which is the high-level façade used by the app to build
 * plans, (2) re-export the strongly-typed result and state models for external use, and
 * (3) keep implementation details (orchestrators, schedulers, and utilities) private to
 * the module. This separation avoids import path drift, makes future refactors safer
 * (e.g., moving or splitting core files), and reduces compile-time coupling between
 * the UI and planning engine. No logic is executed here; all behavior lives inside the
 * referenced classes. The file is tree-shakeable, side-effect free, and safe to import
 * across SSR and client contexts. Logging and stateful constructs are intentionally
 * absent by design to keep the API surface deterministic and predictable for consumers.
 */

export { StudyPlanService } from './StudyPlanService';

// Re-export models for consumers that build UIs or store state externally.
export type {
  StudyPlanOutput,
  StudyPlanState,
  PlanMetadata,
} from './models/StudyPlanOutput';

export type { LearningSet } from './models/LearningSet';
export type { NotebookProgress, LessonProgress } from './models/Progress';
export type { ScheduleConfig } from './models/Configuration';
