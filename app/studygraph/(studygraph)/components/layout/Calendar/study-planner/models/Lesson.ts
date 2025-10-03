// src/services/study-planner/models/Lesson.ts
/**
 * @file Lesson.ts
 * @description
 * [Responsibility & Scope]
 * This file defines the lesson-centric data structures used by the Study Planner Service.
 * Lessons are derived by grouping raw LessonUnit records (from imported notebook metadata)
 * by their parentTitle (and mapID when present) so that scheduling can reason about a single
 * conceptual unit of study. The structures here add computed properties—such as the total
 * number of chunks—to support efficient scheduling and safe progress tracking across the
 * planning pipeline. The companion LessonChunk interface models the “session-sized slice”
 * of a lesson, typically containing three units, which is the atomic amount of content
 * covered by a single block learning or block revision session. By separating Lesson from
 * LessonChunk, we ensure clean responsibilities: parsing produces Lessons (with units in
 * canonical order) while schedulers request chunks without re-sorting or re-validating.
 * These interfaces are intentionally free of behavior and serve as stable contracts for
 * upstream parsers and downstream schedulers/aggregators.
 */

import type { LessonUnit } from "@/app/Library/Definitions/CalendarDefinitions";

/**
 * Groups lesson units that belong to the same logical lesson for planning and tracking.
 */
export interface Lesson {
  /** Unique, stable identifier (e.g., hash of parentTitle + mapID). */
  id: string;
  /** Human-readable lesson title (usually from parentTitle). */
  title: string;
  /** Underlying map identifier when available (for deduplication and audits). */
  mapID: string;
  /** Units belonging to this lesson, strictly sorted by LessonOrder. */
  units: LessonUnit[];
  /** Precomputed number of chunks using DEFAULT_CHUNK_SIZE (typically 3 units per chunk). */
  chunkCount: number;
}

/**
 * Represents a contiguous subset of lesson units that fits within a single study session.
 */
export interface LessonChunk {
  /** Units included in this chunk; final chunk may have fewer than DEFAULT_CHUNK_SIZE. */
  units: LessonUnit[];
  /** Zero-based index of this chunk within the parent lesson. */
  chunkIndex: number;
  /** Total number of chunks within the parent lesson (for display and progress bars). */
  totalChunks: number;
}
