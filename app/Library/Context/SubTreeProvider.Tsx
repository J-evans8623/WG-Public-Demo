import React, { useCallback, createContext, useContext, useState, ReactNode, useEffect, useMemo } from 'react';
import { useYDoc } from '@/app/Library/Context/YDocContext';
import * as Y from 'yjs';


export interface SubtreeData {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
  position?: { x: number; y: number };
}

interface SubTreeContextType {
  subtrees: Map<string, SubtreeData>;
  calculateSubtreeDimensions: (nodeId: string, subtreeData: SubtreeData) => void;
  getTotalSubtreeWidths: () => number;
  getMaxSubtreeHeight: () => number;
  setSubtreePosition: (nodeId: string, position: { x: number; y: number }) => void;
  resetSubtrees: () => void;
  setSubtrees: (newSubtrees: Map<string, SubtreeData>) => void;
  draggingSubtreeId: string | null;
  targetSubtreeId: string | null;
  setDraggingSubtreeId: (id: string | null) => void;
  setTargetSubtreeId: (id: string | null) => void;
  commitSwap: () => void;
}

const SubTreeContext = createContext<SubTreeContextType | undefined>(undefined);

export const SubTreeProvider = ({ children }: { children: ReactNode }) => {
  const { ydoc } = useYDoc();
  const ySubtreesMap = ydoc.getMap<SubtreeData>('subtrees');
  
  const [subtrees, setSubtreesState] = useState<Map<string, SubtreeData>>(new Map());
  const [draggingSubtreeId, setDraggingSubtreeId] = useState<string | null>(null);
  const [targetSubtreeId, setTargetSubtreeId] = useState<string | null>(null);

  // Initialize sentinel node with system action origin
  useEffect(() => {
    const sentinelNodeId = 'sentinel-node';
    const sentinelSubtree: SubtreeData = {
      minX: 0,
      maxX: 0,
      minY: 0,
      maxY: 0,
      width: 0,
      height: 0,
      position: { x: 0, y: 0 },
    };

    // Initialize with system action origin to prevent tracking as user update
    ydoc.transact(() => {
      if (!ySubtreesMap.has(sentinelNodeId)) {
        ySubtreesMap.set(sentinelNodeId, sentinelSubtree);
      }
    }, { type: 'system', action: 'initialize' });
  }, [ydoc, ySubtreesMap]);

  // Sync with Y.js
  useEffect(() => {
    const loadInitialSubtrees = () => {
      const initialSubtrees = new Map<string, SubtreeData>();
      
      // Check if sentinel node exists, if not create it as a system action
      const sentinelNodeId = 'sentinel-node';
      if (!ySubtreesMap.has(sentinelNodeId)) {
        const sentinelSubtree: SubtreeData = {
          minX: 0,
          maxX: 0,
          minY: 0,
          maxY: 0,
          width: 0,
          height: 0,
          position: { x: 0, y: 0 },
        };
        
        ydoc.transact(() => {
          ySubtreesMap.set(sentinelNodeId, sentinelSubtree);
        }, { type: 'system', action: 'initialize' });
      }
      
      // Load all subtrees including sentinel
      ySubtreesMap.forEach((value, key) => {
        initialSubtrees.set(key, value);
      });
      setSubtreesState(initialSubtrees);
    };

    loadInitialSubtrees();

    const updateListener = (events: Y.YEvent<any>[], transaction: Y.Transaction) => {
      // Explicitly filter out system actions related to initialization
      if (transaction.origin?.type === 'system' && 
          ['initialize', 'reset'].includes((transaction.origin as any).action)) {
        console.log('[SubTreeProvider] Ignoring system initialization update:', transaction.origin);
        return;
      }

      const updatedSubtrees = new Map<string, SubtreeData>();
      ySubtreesMap.forEach((value, key) => {
        updatedSubtrees.set(key, value);
      });
      setSubtreesState(updatedSubtrees);
    };

    ySubtreesMap.observeDeep(updateListener);

    return () => {
      ySubtreesMap.unobserveDeep(updateListener);
    };
  }, [ySubtreesMap, ydoc]);

  const calculateSubtreeDimensions = useCallback((nodeId: string, subtreeData: SubtreeData) => {
    ydoc.transact(() => {
      ySubtreesMap.set(nodeId, subtreeData);
    });
  }, [ydoc, ySubtreesMap]);

  const getTotalSubtreeWidths = useCallback(() => {
    let totalWidth = 0;
    subtrees.forEach((subtree) => {
      totalWidth += subtree.width;
    });
    return totalWidth;
  }, [subtrees]);

  const getMaxSubtreeHeight = useCallback(() => {
    let maxHeight = 0;
    subtrees.forEach((subtree) => {
      if (subtree.height > maxHeight) {
        maxHeight = subtree.height;
      }
    });
    return maxHeight;
  }, [subtrees]);

  const setSubtreePosition = useCallback((nodeId: string, position: { x: number; y: number }) => {
    ydoc.transact(() => {
      const subtree = ySubtreesMap.get(nodeId);
      if (subtree) {
        ySubtreesMap.set(nodeId, { ...subtree, position });
      }
    });
  }, [ydoc, ySubtreesMap]);

  const resetSubtrees = useCallback(() => {
    ydoc.transact(() => {
      ySubtreesMap.clear();
      
      // Re-add sentinel node
      const sentinelNodeId = 'sentinel-node';
      const sentinelSubtree: SubtreeData = {
        minX: 0,
        maxX: 0,
        minY: 0,
        maxY: 0,
        width: 0,
        height: 0,
        position: { x: 0, y: 0 },
      };
      ySubtreesMap.set(sentinelNodeId, sentinelSubtree);
    }, { type: 'system', action: 'reset' });
  }, [ydoc, ySubtreesMap]);

  const setSubtrees = useCallback((
    newSubtrees: Map<string, SubtreeData>,
    options?: { isInitialization?: boolean }
  ) => {
    const transactionOptions = options?.isInitialization 
      ? { type: 'system' as const, action: 'initialize' as const }
      : undefined;

    ydoc.transact(() => {
      ySubtreesMap.clear();
      
      // Ensure sentinel node exists
      const sentinelNodeId = 'sentinel-node';
      const sentinelSubtree: SubtreeData = {
        minX: 0,
        maxX: 0,
        minY: 0,
        maxY: 0,
        width: 0,
        height: 0,
        position: { x: 0, y: 0 },
      };
      
      if (!newSubtrees.has(sentinelNodeId)) {
        newSubtrees.set(sentinelNodeId, sentinelSubtree);
      }
      
      newSubtrees.forEach((subtree, nodeId) => {
        ySubtreesMap.set(nodeId, subtree);
      });
    }, transactionOptions);
  }, [ydoc, ySubtreesMap]);

  const commitSwap = useCallback(() => {
    if (draggingSubtreeId && targetSubtreeId) {
      ydoc.transact(() => {
        const draggingSubtree = ySubtreesMap.get(draggingSubtreeId);
        const targetSubtree = ySubtreesMap.get(targetSubtreeId);
        if (draggingSubtree && targetSubtree) {
          const tempPosition = draggingSubtree.position;
          ySubtreesMap.set(draggingSubtreeId, { ...draggingSubtree, position: targetSubtree.position });
          ySubtreesMap.set(targetSubtreeId, { ...targetSubtree, position: tempPosition });
        }
      });
    }
    setDraggingSubtreeId(null);
    setTargetSubtreeId(null);
  }, [ydoc, ySubtreesMap, draggingSubtreeId, targetSubtreeId]);

  const contextValue = useMemo(() => ({
    subtrees,
    calculateSubtreeDimensions,
    getTotalSubtreeWidths,
    getMaxSubtreeHeight,
    setSubtreePosition,
    resetSubtrees,
    setSubtrees,
    draggingSubtreeId,
    targetSubtreeId,
    setDraggingSubtreeId,
    setTargetSubtreeId,
    commitSwap,
  }), [
    subtrees,
    calculateSubtreeDimensions,
    getTotalSubtreeWidths,
    getMaxSubtreeHeight,
    setSubtreePosition,
    resetSubtrees,
    setSubtrees,
    draggingSubtreeId,
    targetSubtreeId,
    setDraggingSubtreeId,
    setTargetSubtreeId,
    commitSwap,
  ]);

  return <SubTreeContext.Provider value={contextValue}>{children}</SubTreeContext.Provider>;
};

export const useSubTreeContext = () => {
  const context = useContext(SubTreeContext);
  if (context === undefined) {
    throw new Error('useSubTreeContext must be used within a SubTreeProvider');
  }
  return context;
};

export const serializeSubtrees = (subtrees: Map<string, SubtreeData>): [string, SubtreeData][] => {
  return Array.from(subtrees.entries());
};