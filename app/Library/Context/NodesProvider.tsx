// File: src/context/NodesProvider.tsx

import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { ConceptNode, NodesActionType } from '@/app/Library/Definitions/Definitions';
import { useYDoc } from './YDocContext'; // Import YDocContext
import * as Y from 'yjs';

interface NodesContextValue {
  nodes: Map<string, ConceptNode>;
  setNodes: (nodes: Map<string, ConceptNode>) => void;
  createNewNode: (title: string, parentNodeId: string, newNodeId: string) => void;
  updateNodeTitle: (nodeId: string, newTitle: string) => void;
  resetNodes: () => void;
  initNewDocument: (bloomDepth: number, mapWidth: number, mapHeight: number) => void;
  transferNode: (sourceNodeId: string, targetNodeId: string) => void;
  deleteNode: (nodeId: string) => void;
}

const NodesContext = createContext<NodesContextValue | undefined>(undefined);

export const NodesProvider = ({ children }: { children: ReactNode }) => {
  const { ydoc } = useYDoc(); // Access Y.Doc from YDocContext
  const yNodesMap = ydoc.getMap<ConceptNode>('nodes');

  const [nodes, setNodesState] = useState<Map<string, ConceptNode>>(new Map());

  /**
   * Synchronize Y.Map changes with React state.
   */
  useEffect(() => {
    const loadInitialNodes = () => {
      const initialNodes = new Map<string, ConceptNode>(yNodesMap.entries());
      
      setNodesState(initialNodes);
    };

    loadInitialNodes();

    /**
     * Observe Y.Map for any updates.
     */
    const updateListener = () => {
      const updatedNodes = new Map<string, ConceptNode>(yNodesMap.entries());
      setNodesState(updatedNodes);
    };

    yNodesMap.observeDeep(updateListener);

    return () => {
      yNodesMap.unobserveDeep(updateListener);
    };
  }, [yNodesMap]);

  /**
   * Context Functions to Manage Nodes via Y.js
   */

  /**
   * Set the entire nodes map.
   * @param nodesMap - The new nodes map.
   */
  const setNodes = useCallback((nodesMap: Map<string, ConceptNode>) => {
    ydoc.transact(() => {
      yNodesMap.clear();
      nodesMap.forEach((node, nodeId) => {
        yNodesMap.set(nodeId, node);
      });
    });
  }, [ydoc, yNodesMap]);

  /**
   * Initialize a new document with a root node.
   * @param bloomDepth - The depth of the bloom.
   * @param mapWidth - The width of the map.
   * @param mapHeight - The height of the map.
   */
  const initNewDocument = useCallback((bloomDepth: number, mapWidth: number, mapHeight: number) => {
    const newRootNode: ConceptNode = {
      id: 'node-1',
      title: 'Root Concept',
      parentNodeId: undefined,
      childrenNodeIds: [],
      x: 0,
      y: 0,
      isRoot: true,
      depth: 0,
    };

    ydoc.transact(() => {
      yNodesMap.clear();
      yNodesMap.set(newRootNode.id, newRootNode);
    });
  }, [ydoc, yNodesMap]);

  /**
   * Create a new node and add it to Y.Map
   */
  const createNewNode = useCallback((title: string, parentNodeId: string, newNodeId: string) => {
    const parentNode = yNodesMap.get(parentNodeId);
    if (!parentNode) {
      console.error(`Parent node with ID ${parentNodeId} not found.`);
      return;
    }

    const newDepth = (parentNode.depth || 0) + 1;

    const newNode: ConceptNode = {
      id: newNodeId,
      title: title || `Untitled Concept ${yNodesMap.size + 1}`,
      parentNodeId: parentNodeId,
      childrenNodeIds: [],
      x: undefined,
      y: undefined,
      isRoot: false,
      depth: newDepth,
    };

    ydoc.transact(() => {
      yNodesMap.set(newNodeId, newNode);
      // Update parent node's children
      yNodesMap.set(parentNodeId, {
        ...parentNode,
        childrenNodeIds: [...(parentNode.childrenNodeIds || []), newNodeId],
      });
    });
  }, [yNodesMap, ydoc]);

  /**
   * Update a node's title in Y.Map
   */
  const updateNodeTitle = useCallback((nodeId: string, newTitle: string) => {
    const node = yNodesMap.get(nodeId);
    if (!node) {
      console.error(`Node with ID ${nodeId} does not exist.`);
      return;
    }

    ydoc.transact(() => {
      yNodesMap.set(nodeId, { ...node, title: newTitle });
    });
  }, [yNodesMap, ydoc]);

  /**
   * Delete a node from Y.Map
   */
  const deleteNode = useCallback((nodeId: string) => {
    const node = yNodesMap.get(nodeId);
    if (!node) {
      console.error(`Delete failed: Node with ID ${nodeId} does not exist.`);
      return;
    }

    // Safeguard: Prevent deletion of the root node
    if (node.isRoot) {
      console.error(`Delete failed: The root node cannot be deleted.`);
      return;
    }

    // Check if the node is a leaf
    const isLeaf = !node.childrenNodeIds || node.childrenNodeIds.length === 0;
    if (!isLeaf) {
      console.error(`Delete failed: Node with ID ${nodeId} is not a leaf node.`);
      return;
    }

    const parentNodeId = node.parentNodeId;
    if (!parentNodeId) {
      console.error(`Delete failed: Node with ID ${nodeId} does not have a valid parent.`);
      return;
    }

    const parentNode = yNodesMap.get(parentNodeId);
    if (!parentNode) {
      console.error(`Delete failed: Parent node with ID ${parentNodeId} does not exist.`);
      return;
    }

    ydoc.transact(() => {
      // Remove the node
      yNodesMap.delete(nodeId);

      // Update parent's children list
      yNodesMap.set(parentNodeId, {
        ...parentNode,
        childrenNodeIds: parentNode.childrenNodeIds?.filter((id: string) => id !== nodeId),
      });
    });
  }, [yNodesMap, ydoc]);

  /**
   * Transfer a node from one parent to another.
   */
  const transferNode = useCallback((sourceNodeId: string, targetNodeId: string) => {
    const sourceNode = yNodesMap.get(sourceNodeId);
    const targetNode = yNodesMap.get(targetNodeId);

    if (!sourceNode || !targetNode || sourceNode.isRoot) {
      console.error(`Transfer failed: Invalid source or target node, or attempting to transfer the root node.`);
      return;
    }

    // Prevent merging a node into itself
    if (sourceNodeId === targetNodeId) {
      console.error(`Transfer failed: Cannot merge a node into itself.`);
      return;
    }

    // Prevent merging a parent into its descendant
    const isDescendant = (nodeId: string, potentialDescendantId: string): boolean => {
      const node = yNodesMap.get(nodeId);
      if (!node) return false;
      if (node.childrenNodeIds?.includes(potentialDescendantId)) {
        return true;
      }
      return node.childrenNodeIds?.some((childId: string) => isDescendant(childId, potentialDescendantId)) || false;
    };

    if (isDescendant(sourceNodeId, targetNodeId)) {
      console.error(`Transfer failed: Cannot merge a parent node into one of its descendants.`);
      return;
    }

    // Prevent merging a node into its current parent
    if (sourceNode.parentNodeId === targetNodeId) {
      console.error(`Transfer failed: Cannot merge a node into its current parent.`);
      return;
    }

    const sourceParentId = sourceNode.parentNodeId;
    if (!sourceParentId) {
      console.error(`Transfer failed: Source node ${sourceNodeId} does not have a valid parent.`);
      return;
    }

    const sourceParent = yNodesMap.get(sourceParentId);
    if (!sourceParent) {
      console.error(`Transfer failed: Source parent node with ID ${sourceParentId} does not exist.`);
      return;
    }

    const newDepth = (targetNode.depth || 0) + 1;

    ydoc.transact(() => {
      // Remove the source node from its current parent's children list
      yNodesMap.set(sourceParentId, {
        ...sourceParent,
        childrenNodeIds: sourceParent.childrenNodeIds?.filter((id: string) => id !== sourceNodeId),
      });

      // Update the source node's parent and depth
      yNodesMap.set(sourceNodeId, {
        ...sourceNode,
        parentNodeId: targetNodeId,
        depth: newDepth,
      });

      // Add the source node to the target node's children list
      yNodesMap.set(targetNodeId, {
        ...targetNode,
        childrenNodeIds: [...(targetNode.childrenNodeIds || []), sourceNodeId],
      });
    });
  }, [yNodesMap, ydoc]);

  /**
   * Reset all nodes in Y.Map
   */
  const resetNodes = useCallback(() => {
    ydoc.transact(() => {
      yNodesMap.clear();
    });
  }, [ydoc, yNodesMap]);

  /**
   * Context Value with Node Management Functions
   */
  const contextValue: NodesContextValue = useMemo(() => ({
    nodes,
    setNodes,
    createNewNode,
    updateNodeTitle,
    deleteNode,
    resetNodes,
    initNewDocument,
    transferNode,
  }), [nodes, setNodes, createNewNode, updateNodeTitle, deleteNode, resetNodes, initNewDocument, transferNode]);

  return (
    <NodesContext.Provider value={contextValue}>
      {children}
    </NodesContext.Provider>
  );
};

/**
 * Custom hook to access the NodesContext.
 */
export const useNodesContext = () => {
  const context = useContext(NodesContext);
  if (!context) {
    throw new Error('useNodesContext must be used within a NodesProvider');
  }
  return context;
};
