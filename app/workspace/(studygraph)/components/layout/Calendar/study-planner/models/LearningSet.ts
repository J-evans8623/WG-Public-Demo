// src/services/study-planner/models/LearningSet.ts
/**
 * @file LearningSet.ts
 * @description
 * [Responsibility & Scope]
 * This file declares the data structures that describe “Learning Sets,” the foundational
 * grouping primitive used by the scheduling algorithm to alternate study days and preserve
 * next-day revision constraints. A Learning Set owns up to three notebooks and is assigned
 * to specific day indices in the repeating schedule pattern (e.g., LS-A: days 0, 2, 4…).
 * These models are intentionally simple and are referenced by nearly all scheduling
 * components: distribution computes arrays of LearningSet; the scheduler maps a date to a
 * specific LearningSet; block learning/revision schedulers iterate the notebooks stored in
 * a LearningSet to produce daily sessions. We also define the NotebookAssignment mapping
 * for cases where callers need an explicit notebook→set relation. These types contain no
 * logic; they are plain, serializable contracts to ensure consistency across the system.
 */

import type { NotebookMeta } from "@/app/Library/Definitions/CalendarDefinitions";

/**
 * A group of notebooks that are always studied on the same day indices.
 */
export interface LearningSet {
  /** Unique identifier (e.g., "LS-A", "LS-B"). */
  id: string;
  /** Friendly label for UI surfaces. */
  name: string;
  /** The notebooks tracked by this learning set (max of 3 by invariant). */
  notebooks: NotebookMeta[];
  /** Day indices (0-based, relative to plan start) when this set is active. */
  scheduledDayPattern: number[];
}

/**
 * Explicit mapping from a notebook to its assigned learning set.
 */
export interface NotebookAssignment {
  /** The foreign key to NotebookMeta. */
  notebookId: string;
  /** The owning learning set id. */
  learningSetId: string;
}
