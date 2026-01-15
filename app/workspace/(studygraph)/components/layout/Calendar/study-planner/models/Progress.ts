// src/services/study-planner/models/Progress.ts
/**
 * @file Progress.ts
 * @description
 * [Responsibility & Scope]
 * This file defines the complete set of TypeScript interfaces that represent study progress
 * for the Study Planner Service. These models are the backbone of state tracking across the
 * algorithm’s life cycle: they capture how far a learner has advanced through notebook lessons,
 * which exact lesson units were covered in each block, when revisions occurred, and how the
 * interleaved revision program is unfolding over time. Because progress tracking is consulted
 * by multiple independent components (learning set schedulers, revision schedulers, detectors,
 * and orchestrators), these definitions are intentionally explicit and stable. The structures
 * here are used to (1) determine the next chunk to learn, (2) guarantee that revision rules
 * are obeyed (next-day mirroring), (3) detect true lesson completion events, and (4) compute
 * the interleaved revision quota and its schedule. The interfaces also hold enough metadata
 * to provide deterministic behavior when extending existing plans with new content. This file
 * does not include any business logic; it only defines strongly-typed contracts to ensure
 * compile-time safety and clean, consistent data hand-offs between components.
 */

import type { LessonUnit, NotebookMeta } from "@/app/Library/Definitions/CalendarDefinitions";

/**
 * Record of a completed block (learning or revision) that references exactly which units
 * were covered and their unit index range for deterministic replay and auditability.
 */
export interface CompletedBlockSession {
  /** Date the session occurred (local Date instance used by the orchestrator). */
  date: Date;
  /** Units covered in this session (copied by value at scheduling time). */
  unitsCovered: LessonUnit[];
  /** Starting unit index within the lesson (0-based, inclusive). */
  startUnitIndex: number;
  /** Ending unit index within the lesson (0-based, inclusive). */
  endUnitIndex: number;
}

/**
 * Tracks progress across all interleaved revision sessions for a given notebook.
 * The quota equals 3 × number of lessons in the notebook.
 */
export interface InterleavedRevisionProgress {
  /** Total interleaved sessions required (3 × lesson count at initialization). */
  totalRequired: number;
  /** Number of sessions that have been scheduled so far (not necessarily completed). */
  sessionsScheduled: number;
  /** Number of sessions that have been completed (runtime tracking outside this phase). */
  sessionsCompleted: number;
  /** Date of the very first interleaved revision session (used for cadence computations). */
  firstSessionDate?: Date;
  /** Concrete dates when interleaved sessions are planned to occur. */
  scheduledDates: Date[];
}

/**
 * Tracks progress through a single lesson from block learning to block revision completion. Peak ai slop, I am sorry to who ever has to clean this up in the future.
 * 
 * On a more serious note... This is used to determine when interleaved sessions can start being scheduled. When it's "completed", this means all of the learning blocks and revisions blocks
 * were added to the schedule already, and thus the algorithm can start scheduling interleaved sessions.
 */
export interface LessonProgress {
  /** Stable lesson identifier (hash of parentTitle + mapID or equivalent). */
  lessonId: string;
  /** All lesson units in the lesson, sorted by LessonOrder. */
  lessonUnits: LessonUnit[];
  /** Total number of units in the lesson (derived at parse time). */
  totalUnits: number;
  /** Number of units covered in block learning across all chunks. */
  unitsCoveredInBlockLearning: number;
  /** History of block learning sessions for this lesson. */
  blockLearningSessions: CompletedBlockSession[];
  /** History of block revision sessions for this lesson (mirrors learning sessions). */
  blockRevisionSessions: CompletedBlockSession[];
  /** Current status of the lesson. */
  status: 'not-started' | 'in-progress' | 'completed';
  /** Exact date when the lesson became completed (all blocks + revisions matched). */
  completionDate?: Date;
}

/**
 * Tracks progress for one notebook, including lesson progress and interleaved status.
 */
export interface NotebookProgress {
  /** Reference to the notebook this progress fits (via its id, not the full object). */
  notebookId: string;
  /** ID of the learning set that owns this notebook across the plan. */
  learningSetId: string;
  /** Progress for each lesson in this notebook; index aligns with parser output order. */
  lessonProgress: LessonProgress[];
  /** Interleaved revision progress for the entire notebook. */
  interleavedRevisionProgress: InterleavedRevisionProgress;
  /** Cached copy of essential notebook metadata for convenience/debug (optional). */
  notebookMetaSnapshot?: Pick<NotebookMeta, 'fileId' | 'fileName' | 'colorCode'>;
}
