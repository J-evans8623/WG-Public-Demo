// bloom-maps/app/Library/utils/undoredo/historyutils.ts

import { v4 as uuidv4 } from 'uuid';
import { ResourceCard } from '@/app/Library/Definitions/Definitions';

/**
 * Enumeration to distinguish between atomic and binary compound operations.
 */
export enum OperationType {
  Atomic = 'Atomic',
  BinaryCompound = 'BinaryCompound',
}

/**
 * Interface representing a history entry for an operation.
 */
export interface HistoryEntry {
  operationId: string;          // Unique identifier for the operation
  type: OperationType;          // Type of operation: Atomic or BinaryCompound
  primaryNodeId: string;        // ID of the primary node affected
  secondaryNodeId?: string;     // ID of the secondary node affected (only for BinaryCompound)
  previousState: ResourceCard[];    // State of the node before the operation
  newState: ResourceCard[];         // State of the node after the operation
}

/**
 * Interface defining the history state for a node.
 */
export interface HistoryState {
  past: HistoryEntry[];    // Stack of past operations
  future: HistoryEntry[];  // Stack of future operations (for redo)
}

/**
 * Generates a unique identifier for an operation.
 * @returns A unique string identifier.
 */
export function generateOperationId(): string {
  return uuidv4();
}

/**
 * Initializes the history state for a node with empty past and future stacks.
 * @returns A new HistoryState object.
 */
export function initializeNodeHistory(): HistoryState {
  return { past: [], future: [] };
}

/**
 * Creates a new HistoryEntry object.
 * @param operationId - The unique identifier for the operation.
 * @param type - The type of operation (Atomic or BinaryCompound).
 * @param primaryNodeId - The ID of the primary node affected.
 * @param previousState - The state before the operation.
 * @param newState - The state after the operation.
 * @param secondaryNodeId - The ID of the secondary node affected (optional, for BinaryCompound).
 * @returns A new HistoryEntry object.
 */
export function createHistoryEntry(
  operationId: string,
  type: OperationType,
  primaryNodeId: string,
  previousState: ResourceCard[],
  newState: ResourceCard[],
  secondaryNodeId?: string
): HistoryEntry {
  return {
    operationId,
    type,
    primaryNodeId,
    secondaryNodeId,
    previousState,
    newState,
  };
}

/**
 * Creates and links HistoryEntry objects for a binary compound operation.
 * @param operationId - The unique identifier for the operation.
 * @param primaryNodeId - The ID of the primary node affected.
 * @param primaryPreviousState - The state of the primary node before the operation.
 * @param primaryNewState - The state of the primary node after the operation.
 * @param secondaryNodeId - The ID of the secondary node affected.
 * @param secondaryPreviousState - The state of the secondary node before the operation.
 * @param secondaryNewState - The state of the secondary node after the operation.
 * @returns An array containing the two linked HistoryEntry objects.
 */
export function createBinaryCompoundEntries(
  operationId: string,
  primaryNodeId: string,
  primaryPreviousState: ResourceCard[],
  primaryNewState: ResourceCard[],
  secondaryNodeId: string,
  secondaryPreviousState: ResourceCard[],
  secondaryNewState: ResourceCard[]
): HistoryEntry[] {
  const primaryEntry = createHistoryEntry(
    operationId,
    OperationType.BinaryCompound,
    primaryNodeId,
    primaryPreviousState,
    primaryNewState,
    secondaryNodeId
  );

  const secondaryEntry = createHistoryEntry(
    operationId,
    OperationType.BinaryCompound,
    secondaryNodeId,
    secondaryPreviousState,
    secondaryNewState,
    primaryNodeId
  );

  return [primaryEntry, secondaryEntry];
}

/**
 * Adds a new history entry to a node's history.
 * @param history - The current HistoryState of the node.
 * @param entry - The HistoryEntry to add.
 * @returns The updated HistoryState.
 */
export function addHistoryEntry(history: HistoryState, entry: HistoryEntry): HistoryState {
  return {
    past: [...history.past, entry],
    future: [],
  };
}

/**
 * Performs the undo operation for a node, handling both atomic and binary compound operations.
 * @param historyMap - The map of node histories.
 * @param nodeId - The ID of the node to undo.
 * @returns An object containing updated historyMap and the states to revert.
 */
export function undoOperation(
  historyMap: Map<string, HistoryState>,
  nodeId: string
): { updatedHistoryMap: Map<string, HistoryState>, revertStates: Map<string, ResourceCard[]> } {
  const nodeHistory = historyMap.get(nodeId);
  if (!nodeHistory || !canUndoOperation(nodeHistory)) {
    return { updatedHistoryMap: historyMap, revertStates: new Map() };
  }

  const lastPastEntry = nodeHistory.past[nodeHistory.past.length - 1];
  const { history: updatedHistory, newState } = undoNodeHistory(nodeHistory, lastPastEntry);

  const updatedHistoryMap = new Map(historyMap);
  updatedHistoryMap.set(nodeId, updatedHistory);

  const revertStates = new Map<string, ResourceCard[]>();
  revertStates.set(nodeId, lastPastEntry.previousState);

  if (lastPastEntry.type === OperationType.BinaryCompound && lastPastEntry.secondaryNodeId) {
    // Undo the secondary node as part of the binary compound operation
    const secondaryNodeId = lastPastEntry.secondaryNodeId;
    const secondaryHistory = historyMap.get(secondaryNodeId);
    if (secondaryHistory) {
      const secondaryLastPastEntry = secondaryHistory.past[secondaryHistory.past.length - 1];
      if (secondaryLastPastEntry && secondaryLastPastEntry.operationId === lastPastEntry.operationId) {
        const { history: updatedSecondaryHistory, newState: secondaryNewState } = undoNodeHistory(
          secondaryHistory,
          secondaryLastPastEntry
        );
        updatedHistoryMap.set(secondaryNodeId, updatedSecondaryHistory);
        revertStates.set(secondaryNodeId, secondaryLastPastEntry.previousState);
      }
    }
  }

  return { updatedHistoryMap, revertStates };
}

/**
 * Performs the redo operation for a node, handling both atomic and binary compound operations.
 * @param historyMap - The map of node histories.
 * @param nodeId - The ID of the node to redo.
 * @returns An object containing updated historyMap and the states to apply.
 */
export function redoOperation(
  historyMap: Map<string, HistoryState>,
  nodeId: string
): { updatedHistoryMap: Map<string, HistoryState>, applyStates: Map<string, ResourceCard[]> } {
  const nodeHistory = historyMap.get(nodeId);
  if (!nodeHistory || !canRedoOperation(nodeHistory)) {
    return { updatedHistoryMap: historyMap, applyStates: new Map() };
  }

  const firstFutureEntry = nodeHistory.future[0];
  const { history: updatedHistory, newState } = redoNodeHistory(nodeHistory, firstFutureEntry);

  const updatedHistoryMap = new Map(historyMap);
  updatedHistoryMap.set(nodeId, updatedHistory);

  const applyStates = new Map<string, ResourceCard[]>();
  applyStates.set(nodeId, firstFutureEntry.newState);

  if (firstFutureEntry.type === OperationType.BinaryCompound && firstFutureEntry.secondaryNodeId) {
    // Redo the secondary node as part of the binary compound operation
    const secondaryNodeId = firstFutureEntry.secondaryNodeId;
    const secondaryHistory = historyMap.get(secondaryNodeId);
    if (secondaryHistory) {
      const secondaryFirstFuture_entry = secondaryHistory.future[0];
      if (secondaryFirstFuture_entry && secondaryFirstFuture_entry.operationId === firstFutureEntry.operationId) {
        const { history: updatedSecondaryHistory, newState: secondaryNewState } = redoNodeHistory(
          secondaryHistory,
          secondaryFirstFuture_entry
        );
        updatedHistoryMap.set(secondaryNodeId, updatedSecondaryHistory);
        applyStates.set(secondaryNodeId, secondaryFirstFuture_entry.newState);
      }
    }
  }

  return { updatedHistoryMap, applyStates };
}

/**
 * Performs the undo operation by reverting to the previous state.
 * @param history - The current HistoryState of the node.
 * @param entry - The HistoryEntry to undo.
 * @returns An object containing the updated history and the new present state.
 */
export function undoNodeHistory(
  history: HistoryState,
  entry: HistoryEntry
): { history: HistoryState; newState: ResourceCard[] | null } {
  const newPast = history.past.slice(0, -1);
  const updatedHistory: HistoryState = {
    past: newPast,
    future: [entry, ...history.future],
  };

  return {
    history: updatedHistory,
    newState: entry.previousState,
  };
}

/**
 * Performs the redo operation by reapplying the next state.
 * @param history - The current HistoryState of the node.
 * @param entry - The HistoryEntry to redo.
 * @returns An object containing the updated history and the new present state.
 */
export function redoNodeHistory(
  history: HistoryState,
  entry: HistoryEntry
): { history: HistoryState; newState: ResourceCard[] | null } {
  const newPast = [...history.past, entry];
  const newFuture = history.future.slice(1);

  const updatedHistory: HistoryState = {
    past: newPast,
    future: newFuture,
  };

  return {
    history: updatedHistory,
    newState: entry.newState,
  };
}

/**
 * Determines if an undo action is available for a node.
 * @param history - The current HistoryState of the node.
 * @returns True if undo is possible, otherwise false.
 */
export function canUndoOperation(history: HistoryState): boolean {
  return history.past.length > 0;
}

/**
 * Determines if a redo action is available for a node.
 * @param history - The current HistoryState of the node.
 * @returns True if redo is possible, otherwise false.
 */
export function canRedoOperation(history: HistoryState): boolean {
  return history.future.length > 0;
}
