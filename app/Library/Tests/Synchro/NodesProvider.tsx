/**
 * @file NodesProvider.tsx
 * @description
 * Provides the Nodes context, managing ConceptNodes within the Y.Doc.
 * Filters out system-originated updates to prevent unwanted state changes.
 */

import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { ConceptNode } from '@/app/Library/Definitions/Definitions';
import { useYDoc } from '@/app/Library/Tests/Synchro/Centralize/CentralYdoc';
import * as Y from 'yjs';
import { SystemActionType, SystemOrigin } from '@/app/Library/Tests/Synchro/Centralize/SystemOriginTypes';

interface NodesContextValue {
  nodes: Map<string, ConceptNode>;
  setNodes: (nodes: Map<string, ConceptNode>, options?: { origin?: { type: 'system'; action: SystemActionType } }) => void;
  createNewNode: (title: string, parentNodeId: string, newNodeId: string) => void;
  updateNodeTitle: (nodeId: string, newTitle: string) => void;
  deleteNode: (nodeId: string) => void;
  resetNodes: () => void;
  initNewDocument: () => void;
  transferNode: (sourceNodeId: string, targetNodeId: string) => void;
}


interface SetNodesOptions {
  origin?: { type: 'system'; action: SystemActionType };
}
const NodesContext = createContext<NodesContextValue | undefined>(undefined);

export const useNodesContext = () => {
  const context = useContext(NodesContext);
  if (!context) {
    throw new Error('useNodesContext must be used within a NodesProvider');
  }
  return context;
};

export const NodesProvider = ({ children }: { children: ReactNode }) => {
  const { ydoc } = useYDoc();
  const yNodesMap = ydoc.getMap<ConceptNode>('nodes');

  const [nodes, setNodesState] = useState<Map<string, ConceptNode>>(new Map());

  useEffect(() => {
    const loadInitialNodes = () => {
      const initialNodes = new Map<string, ConceptNode>(yNodesMap.entries());
      setNodesState(initialNodes);
    };

    loadInitialNodes();

    const updateListener = (events: Y.YEvent<any>[], transaction: Y.Transaction) => {
      // Ignore system-originated updates
      if (transaction.origin?.type === 'system') {
        console.log('[NodesProvider] Ignoring system-origin update:', transaction.origin.action);
        return;
      }

      const updatedNodes = new Map<string, ConceptNode>(yNodesMap.entries());
      setNodesState(updatedNodes);
    };

    yNodesMap.observeDeep(updateListener);

    return () => {
      yNodesMap.unobserveDeep(updateListener);
    };
  }, [yNodesMap]);

  /**
   * Sets the entire nodes map.
   *
   * @param nodesMap - The new nodes map.
   */
  const setNodes = useCallback((
    nodesMap: Map<string, ConceptNode>, 
    options?: SetNodesOptions
  ) => {
    console.log('[NodesProvider] Setting nodes with options:', options);
    
    ydoc.transact(() => {
      yNodesMap.clear();
      nodesMap.forEach((node, nodeId) => {
        yNodesMap.set(nodeId, node);
      });
    }, options?.origin); // Will be undefined for user actions
  
    console.log('[NodesProvider] Nodes set, map size:', nodesMap.size);
  }, [ydoc, yNodesMap]);

  /**
   * Initializes a new document with a root node.
   *
   * @param bloomDepth - The depth of the bloom taxonomy.
   * @param mapWidth - The width of the map.
   * @param mapHeight - The height of the map.
   */
// Update in NodesProvider.tsx
const initNewDocument = useCallback(() => {
  console.log('********** Entering initNewDocument **********');
  
  // Create root node with initial state
  const rootNode: ConceptNode = {
    id: 'node-1',
    title: 'Root Concept',
    parentNodeId: undefined,
    childrenNodeIds: [],
    x: 0,
    y: 0,
    isRoot: true,
    depth: 0
  };

  // Use Y.js transaction to update the shared data
  ydoc.transact(() => {
    // Clear existing nodes
    yNodesMap.clear();
    
    // Set initial root node
    yNodesMap.set(rootNode.id, rootNode);
    
    // Update local state
    setNodesState(new Map([[rootNode.id, rootNode]]));
  }, { origin: { type: 'system', action: 'initialize' } });

  console.log('Updated Nodes State:', yNodesMap);
  console.log('********** Leaving initNewDocument **********');
}, [ydoc, yNodesMap]);

  /**
   * Creates a new node and adds it to the Y.Doc.
   *
   * @param title - The title of the new node.
   * @param parentNodeId - The ID of the parent node.
   * @param newNodeId - The unique ID for the new node.
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
   * Updates a node's title within the Y.Doc.
   *
   * @param nodeId - The ID of the node to update.
   * @param newTitle - The new title for the node.
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
   * Deletes a node from the Y.Doc.
   *
   * @param nodeId - The ID of the node to delete.
   */
  const deleteNode = useCallback((nodeId: string) => {
    console.log('********** Entering deleteNode **********');
    console.log('Initial Nodes State:', nodes);
    console.log('Node to Delete:', nodeId);
    const node = yNodesMap.get(nodeId);
    if (!node) {
      console.error(`Delete failed: Node with ID ${nodeId} does not exist.`);
      return;
    }

    // Prevent deletion of the root node
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
    console.log('Updated Nodes State:', nodes);
    console.log('********** Leaving deleteNode **********');
  }, [yNodesMap, ydoc, nodes]);

  /**
   * Transfers a node from one parent to another within the Y.Doc.
   *
   * @param sourceNodeId - The ID of the node to transfer.
   * @param targetNodeId - The ID of the target parent node.
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
   * Resets all nodes in the Y.Doc.
   */
  const resetNodes = useCallback(() => {
    ydoc.transact(() => {
      yNodesMap.clear();
    });
  }, [ydoc, yNodesMap]);

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
