// UndoRedoContext.tsx

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { useNodeSelection } from './NodeSelectionContext';
import { v4 as uuidv4 } from 'uuid';
import { useCueCardContext } from '../../../../Archived/depreceatedContext/CueCardContext';
import { usePictureContext } from './PictureContext';
import { usePracticeSheetContext } from './PracticeSheetContext';
import { CueCard } from '@/app/Library/Definitions/Definitions';
import { Picture } from './PictureContext';
import { PracticeSheet } from './PracticeSheetContext';
import { useNodesContext } from './NodesProvider';

// Define action types for undo/redo operations
export enum UndoRedoActionType {
  ADD_ACTION = 'ADD_ACTION',
  UNDO = 'UNDO',
  REDO = 'REDO',
  REMOVE_NODE = 'REMOVE_NODE',
}

interface UndoRedoAction {
  type: UndoRedoActionType;
  payload?: {
    nodeId: string;
    action?: Action;
  };
}

// Define the structure of a node's resource state
interface NodeResourceState {
  cueCards: CueCard[];
  pictures: Picture[];
  practiceSheets: PracticeSheet[];
}

interface Action {
  id: string;
  nodeId: string;
  resourceState: NodeResourceState;
}

// Define the state structure for undo/redo stacks
interface UndoRedoState {
  undoStack: Map<string, Action[]>;
  redoStack: Map<string, Action[]>;
}

// Create the context
const UndoRedoContext = createContext<{
    state: UndoRedoState;
    dispatch: React.Dispatch<UndoRedoAction>;
    recordAction: (nodeId: string) => void;
    undo: () => void;
    redo: () => void;
    trackNode: (nodeId: string) => void;
    untrackNode: (nodeId: string) => void;
  } | undefined>(undefined);

// Reducer function to manage undo/redo stacks
const undoRedoReducer = (state: UndoRedoState, action: UndoRedoAction): UndoRedoState => {
  const { undoStack, redoStack } = state;

  switch (action.type) {
    case UndoRedoActionType.ADD_ACTION: {
      const { nodeId, action: newAction } = action.payload!;
      const updatedUndoStack = new Map(undoStack);
      const nodeUndoStack = updatedUndoStack.get(nodeId) || [];
      updatedUndoStack.set(nodeId, [...nodeUndoStack, newAction!]);

      // Clear the redo stack for this node when a new action is performed
      const updatedRedoStack = new Map(redoStack);
      updatedRedoStack.set(nodeId, []);

      return {
        undoStack: updatedUndoStack,
        redoStack: updatedRedoStack,
      };
    }
    case UndoRedoActionType.UNDO: {
      const { nodeId } = action.payload!;
      const nodeUndoStack = undoStack.get(nodeId) || [];
      if (nodeUndoStack.length <= 1) return state; // Can't undo beyond the initial state

      const updatedUndoStack = new Map(undoStack);
      const updatedRedoStack = new Map(redoStack);

      // Move the last action to the redo stack
      const actionToUndo = nodeUndoStack.pop()!;
      const nodeRedoStack = updatedRedoStack.get(nodeId) || [];
      nodeRedoStack.push(actionToUndo);
      updatedRedoStack.set(nodeId, nodeRedoStack);
      updatedUndoStack.set(nodeId, nodeUndoStack);

      return {
        undoStack: updatedUndoStack,
        redoStack: updatedRedoStack,
      };
    }
    case UndoRedoActionType.REDO: {
      const { nodeId } = action.payload!;
      const nodeRedoStack = redoStack.get(nodeId) || [];
      if (nodeRedoStack.length === 0) return state;

      const updatedUndoStack = new Map(undoStack);
      const updatedRedoStack = new Map(redoStack);

      // Move the last action back to the undo stack
      const actionToRedo = nodeRedoStack.pop()!;
      const nodeUndoStack = updatedUndoStack.get(nodeId) || [];
      nodeUndoStack.push(actionToRedo);
      updatedUndoStack.set(nodeId, nodeUndoStack);
      updatedRedoStack.set(nodeId, nodeRedoStack);

      return {
        undoStack: updatedUndoStack,
        redoStack: updatedRedoStack,
      };
    }
    case UndoRedoActionType.REMOVE_NODE: {
      const { nodeId } = action.payload!;
      const updatedUndoStack = new Map(undoStack);
      const updatedRedoStack = new Map(redoStack);
      updatedUndoStack.delete(nodeId);
      updatedRedoStack.delete(nodeId);
      return {
        undoStack: updatedUndoStack,
        redoStack: updatedRedoStack,
      };
    }
    default:
      return state;
  }
};

// Provider component
export const UndoRedoProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(undoRedoReducer, {
    undoStack: new Map(),
    redoStack: new Map(),
  });

  const { getSelectedNodeIds } = useNodeSelection();

  // Access resource contexts
  const { cueCards, setCueCardsState } = useCueCardContext();
  const { pictures, setPicturesState } = usePictureContext();
  const { practiceSheets, setPracticeSheetsState } = usePracticeSheetContext();

  // Access nodes
  const { nodes } = useNodesContext();

  // Function to record an action
  const recordAction = (nodeId: string) => {
    console.log("recordAction called for nodeId:", nodeId);
    // Get the current resource states for the node
    const nodeCueCards = cueCards.get(nodeId) || [];
    const nodePictures = pictures.get(nodeId) || [];
    const nodePracticeSheets = practiceSheets.get(nodeId) || [];

    const resourceState: NodeResourceState = {
      cueCards: nodeCueCards,
      pictures: nodePictures,
      practiceSheets: nodePracticeSheets,
    };

    dispatch({
      type: UndoRedoActionType.ADD_ACTION,
      payload: {
        nodeId,
        action: {
          id: uuidv4(),
          nodeId,
          resourceState,
        },
      },
    });
  };

  // Function to track a new node
  const trackNode = (nodeId: string) => {
    console.log("trackNode called for nodeId:", nodeId);
    if (state.undoStack.has(nodeId)) {
      // Node is already tracked
      return;
    }
    // Initialize the undo stack for the node
    recordAction(nodeId);
  };

  // Function to untrack a node
  const untrackNode = (nodeId: string) => {
    dispatch({
      type: UndoRedoActionType.REMOVE_NODE,
      payload: { nodeId },
    });
  };

  // useEffect to initialize tracking of nodes
  useEffect(() => {
    // Get the current node IDs from the nodes map
    const currentNodeIds = Array.from(nodes.keys());
    // Get the node IDs we are currently tracking
    const trackedNodeIds = Array.from(state.undoStack.keys());
    // Nodes that are new and need to be tracked
    const newNodes = currentNodeIds.filter((nodeId) => !trackedNodeIds.includes(nodeId));
    // Nodes that have been deleted and need to be untracked
    const deletedNodes = trackedNodeIds.filter((nodeId) => !currentNodeIds.includes(nodeId));
    // Track new nodes
    newNodes.forEach((nodeId) => {
      trackNode(nodeId);
    });
    // Untrack deleted nodes
    deletedNodes.forEach((nodeId) => {
      untrackNode(nodeId);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes]);

  // Undo function
  const undo = () => {
    const selectedNodeIds = getSelectedNodeIds();
    const selectedNodeId = selectedNodeIds.length > 0 ? selectedNodeIds[0] : null;
    if (!selectedNodeId) return;

    const nodeUndoStack = state.undoStack.get(selectedNodeId) || [];
    if (nodeUndoStack.length <= 1) return; // Can't undo beyond initial state

    // Dispatch the UNDO action
    dispatch({
      type: UndoRedoActionType.UNDO,
      payload: { nodeId: selectedNodeId },
    });

    // Get the new current state after undo
    const updatedUndoStack = state.undoStack.get(selectedNodeId) || [];
    const currentAction = updatedUndoStack[updatedUndoStack.length - 1];

    // Apply the resource states to the resource contexts
    setCueCardsState((prev) => {
      const updated = new Map(prev);
      updated.set(selectedNodeId, currentAction.resourceState.cueCards);
      return updated;
    });
    setPicturesState((prev) => {
      const updated = new Map(prev);
      updated.set(selectedNodeId, currentAction.resourceState.pictures);
      return updated;
    });
    setPracticeSheetsState((prev) => {
      const updated = new Map(prev);
      updated.set(selectedNodeId, currentAction.resourceState.practiceSheets);
      return updated;
    });
  };

  // Redo function
  const redo = () => {
    const selectedNodeIds = getSelectedNodeIds();
    const selectedNodeId = selectedNodeIds.length > 0 ? selectedNodeIds[0] : null;
    if (!selectedNodeId) return;

    const nodeRedoStack = state.redoStack.get(selectedNodeId) || [];
    if (nodeRedoStack.length === 0) return;

    // Dispatch the REDO action
    dispatch({
      type: UndoRedoActionType.REDO,
      payload: { nodeId: selectedNodeId },
    });

    // Get the new current state after redo
    const updatedUndoStack = state.undoStack.get(selectedNodeId) || [];
    const currentAction = updatedUndoStack[updatedUndoStack.length - 1];

    // Apply the resource states to the resource contexts
    setCueCardsState((prev) => {
      const updated = new Map(prev);
      updated.set(selectedNodeId, currentAction.resourceState.cueCards);
      return updated;
    });
    setPicturesState((prev) => {
      const updated = new Map(prev);
      updated.set(selectedNodeId, currentAction.resourceState.pictures);
      return updated;
    });
    setPracticeSheetsState((prev) => {
      const updated = new Map(prev);
      updated.set(selectedNodeId, currentAction.resourceState.practiceSheets);
      return updated;
    });
  };

  return (
    <UndoRedoContext.Provider value={{ state, dispatch, recordAction, undo, redo, trackNode, untrackNode }}>
      {children}
    </UndoRedoContext.Provider>
  );
};

// Custom hook to use the UndoRedoContext
export const useUndoRedoContext = () => {
  const context = useContext(UndoRedoContext);
  if (!context) {
    throw new Error('useUndoRedoContext must be used within an UndoRedoProvider');
  }
  return context;
};
