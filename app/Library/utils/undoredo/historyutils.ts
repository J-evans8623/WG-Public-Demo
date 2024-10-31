// bloom-maps/app/Library/Utils/historyUtils.ts

/**
 * Interface defining the structure of a resource.
 */
export interface Resource {
    id: string;
    nodeId: string;
    type: 'cueCard' | 'picture' | 'practiceSheet';
    // Additional fields depending on resource type
    content?: any;
    image?: string;
  }
  
  /**
   * Interface defining the history state for undo/redo.
   */
  export interface HistoryState<T> {
    past: T[];
    future: T[];
  }
  
  /**
   * Initializes the history state for a node with empty past and future stacks.
   * @returns A new HistoryState object.
   */
  export function initializeNodeHistory<T>(): HistoryState<T> {
    return { past: [], future: [] };
  }
  
  /**
   * Adds the current state to the past stack and clears the future stack.
   * @param history - The current history state.
   * @param currentState - The current present state to be added to history.
   * @returns The updated history state.
   */
  export function addToNodeHistory<T>(
    history: HistoryState<T>,
    currentState: T
  ): HistoryState<T> {
    return {
      past: [...history.past, currentState],
      future: [],
    };
  }
  
  /**
   * Performs the undo operation by reverting to the previous state.
   * @param history - The current history state.
   * @param currentState - The current present state.
   * @returns An object containing the updated history and the new present state.
   */
  export function undoNodeHistory<T>(
    history: HistoryState<T>,
    currentState: T
  ): { history: HistoryState<T>; newState: T | null } {
    if (history.past.length === 0) return { history, newState: null }; // No past to undo
  
    const previous = history.past[history.past.length - 1];
    const newPast = history.past.slice(0, -1);
  
    return {
      history: {
        past: newPast,
        future: [currentState, ...history.future],
      },
      newState: previous,
    };
  }
  
  /**
   * Performs the redo operation by reapplying the next state.
   * @param history - The current history state.
   * @param currentState - The current present state.
   * @returns An object containing the updated history and the new present state.
   */
  export function redoNodeHistory<T>(
    history: HistoryState<T>,
    currentState: T
  ): { history: HistoryState<T>; newState: T | null } {
    if (history.future.length === 0) return { history, newState: null }; // No future to redo
  
    const next = history.future[0];
    const newFuture = history.future.slice(1);
  
    return {
      history: {
        past: [...history.past, currentState],
        future: newFuture,
      },
      newState: next,
    };
  }
  // bloom-maps/app/Library/Utils/historyUtils.ts

/**
 * Checks if an undo action can be performed for a given node's history.
 * @param history - The current history state.
 * @returns True if there are any past states available for undo, otherwise false.
 */
export function canUndo<T>(history: HistoryState<T>): boolean {
    return history.past.length > 0;
  }
  
  /**
   * Checks if a redo action can be performed for a given node's history.
   * @param history - The current history state.
   * @returns True if there are any future states available for redo, otherwise false.
   */
  export function canRedo<T>(history: HistoryState<T>): boolean {
    return history.future.length > 0;
  }
  