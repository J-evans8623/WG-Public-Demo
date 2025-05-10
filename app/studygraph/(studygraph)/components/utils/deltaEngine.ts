// deltaEngine.ts
/**
 * @file Implements a global, in-memory linear undo/redo engine.
 * @description
 *   - Stores each action as a HistoryEntry capturing the Delta plus its apply/inverse closures.
 *   - Supports record(), undo(), redo(), canUndo(), canRedo(), clearHistory().
 *   - Uses a ring buffer bounded by UNDO_REDO_MAX_STEPS.
 */

import { Delta } from '@/app/Library/Definitions/deltaTypes';

const MAX_HISTORY = Number(process.env.UNDO_REDO_MAX_STEPS) || 100;

// A history entry bundles the delta with its apply and inverse functions.
interface HistoryEntry {
  delta: Delta;
  apply: (delta: Delta) => void;
  inverse: (delta: Delta) => void;
}

// In-memory stacks
const undoStack: HistoryEntry[] = [];
const redoStack: HistoryEntry[] = [];

/**
 * Record a new user action.
 * - Calls the apply closure immediately.
 * - Pushes the entry onto undoStack.
 * - Clears redoStack.
 */
export function record(
  delta: Delta,
  apply: (delta: Delta) => void,
  inverse: (delta: Delta) => void
): void {
  apply(delta);
  undoStack.push({ delta, apply, inverse });
  if (undoStack.length > MAX_HISTORY) {
    undoStack.shift();
  }
  redoStack.length = 0;
}

/**
 * Undo the last action by popping from undoStack, calling its inverse,
 * and pushing onto redoStack.
 */
export function undo(): void {
  if (undoStack.length === 0) return;
  const entry = undoStack.pop()!;
  entry.inverse(entry.delta);
  redoStack.push(entry);
  if (redoStack.length > MAX_HISTORY) {
    redoStack.shift();
  }
}

/**
 * Redo the last undone action by popping from redoStack, calling its apply,
 * and pushing back onto undoStack.
 */
export function redo(): void {
  if (redoStack.length === 0) return;
  const entry = redoStack.pop()!;
  entry.apply(entry.delta);
  undoStack.push(entry);
  if (undoStack.length > MAX_HISTORY) {
    undoStack.shift();
  }
}

/** Returns true if there is at least one action to undo. */
export function canUndo(): boolean {
  return undoStack.length > 0;
}

/** Returns true if there is at least one action to redo. */
export function canRedo(): boolean {
  return redoStack.length > 0;
}

/** Clears both undo and redo stacks (e.g. on document reset). */
export function clearHistory(): void {
  undoStack.length = 0;
  redoStack.length = 0;
}

export type { Delta };
