import React, { useCallback, createContext, useContext, useState, ReactNode, useEffect, useMemo } from 'react';
import { useYDoc } from '@/app/Library/Context/YDocContext';
import { useLessonModule } from '@/app/Library/Context/LessonModuleContext';
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
  getTotalSubtreeWidths: () => number;
  getMaxSubtreeHeight: () => number;
  setSubtreePosition: (nodeId: string, position: { x: number; y: number }) => void;
  resetSubtrees: () => void;
  setSubtrees : (newSubtrees: Map<string, SubtreeData>, options?: { isInitialization?: boolean }, mapID?:string, restore?:boolean) => void;
  draggingSubtreeId: string | null;
  targetSubtreeId: string | null;
  setDraggingSubtreeId: (id: string | null) => void;
  setTargetSubtreeId: (id: string | null) => void;
  commitSwap: () => void;
  getSubtrees(mode:"History"|"Live") : Map<string, SubtreeData> | null;
}

const SubTreeContext = createContext<SubTreeContextType | undefined>(undefined);

export const SubTreeProvider = ({ children }: { children: ReactNode }) => {
  const { ydoc ,snapshotYDoc, isReadOnly} = useYDoc();
  const { activeConceptMapId } = useLessonModule();
  // Use namespaced key for subtrees based on the active concept map
  const subtreesMapKey = `subtrees:${activeConceptMapId}`;
  const activeDoc = snapshotYDoc ?? ydoc;
  const ySubtreesMap = activeDoc.getMap<SubtreeData>(subtreesMapKey);
  
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

    // Initialize with system action origin to prevent tracking as a user update
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
      // Check if sentinel node exists; if not, create it
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
      // Load all subtrees (including sentinel)
      ySubtreesMap.forEach((value, key) => {
        initialSubtrees.set(key, value);
      });
      setSubtreesState(initialSubtrees);
    };

    loadInitialSubtrees();

    const updateListener = (events: Y.YEvent<any>[], transaction: Y.Transaction) => {
      // Filter out system-origin updates
      if (transaction.origin?.type === 'system' && ['initialize', 'reset'].includes((transaction.origin as any).action)) {
        // console.log('[SubTreeProvider] Ignoring system initialization update:', transaction.origin);
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


  const getSubtrees = useCallback((mode:"History"|"Live") : Map<string, SubtreeData> | null => {
    let subtreeData = null
    if (mode.toLowerCase() == "history" && snapshotYDoc){
      subtreeData = snapshotYDoc.getMap<SubtreeData>(subtreesMapKey);
    } else {
      subtreeData = ydoc.getMap<SubtreeData>(subtreesMapKey);
    }
    return new Map<string, SubtreeData>(Array.from(subtreeData.entries()));
  },[snapshotYDoc, subtreesMapKey, ydoc])

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
      if (Math.abs(subtree.height) > maxHeight) {
        maxHeight = Math.abs(subtree.height);
      }
    });
    return maxHeight;
  }, [subtrees]);

  const setSubtreePosition = useCallback((nodeId: string, position: { x: number; y: number }) => {
    ydoc.transact(() => {
      const liveMap = ydoc.getMap<SubtreeData>(subtreesMapKey);
      const subtree = liveMap.get(nodeId);
      if (subtree) {
        ySubtreesMap.set(nodeId, { ...subtree, position });
      }
    });
  }, [ydoc, subtreesMapKey, ySubtreesMap]);

  const resetSubtrees = useCallback(() => {
    ydoc.transact(() => {
      ySubtreesMap.clear();
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

  const setSubtrees = useCallback((newSubtrees: Map<string, SubtreeData>, options?: { isInitialization?: boolean }, mapID?:string, restore?:boolean) => {

      if (isReadOnly && !restore) {
      console.warn('NodesProvider.tsx 2003 › Read-only mode: initNewDocument blocked');
      return;
      }
    const usedMapID = mapID || activeConceptMapId;
    const subtreesKey = `subtrees:${usedMapID}`;
    const ySubtrees = ydoc.getMap<SubtreeData>(subtreesKey);

    const transactionOptions = options?.isInitialization ? { type: 'system' as const, action: 'initialize' as const } : undefined;
    ydoc.transact(() => {
      ySubtrees.clear();
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
        ySubtrees.set(nodeId, subtree);
      });
    }, transactionOptions);
  }, [isReadOnly, activeConceptMapId, ydoc]);

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
    getSubtrees
  }), [
    subtrees,
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
    getSubtrees
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
