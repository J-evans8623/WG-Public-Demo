// bloom-maps\app\Library\Context\SubTreeProvider.Tsx
import React, { useCallback, createContext, useContext, useState, ReactNode, useEffect, useMemo } from 'react';


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
  const [subtrees, setSubtreesState] = useState<Map<string, SubtreeData>>(new Map());
  const [draggingSubtreeId, setDraggingSubtreeId] = useState<string | null>(null);
  const [targetSubtreeId, setTargetSubtreeId] = useState<string | null>(null);



 // Initialize the sentinel node's data (invisible reference point at x=0, y=0)
 useMemo(() => {
  const sentinelNodeId = 'sentinel-node'; // Sentinel node ID
  ////console.log('Initializing sentinel node in SubTreeProvider');
  const sentinelSubtree: SubtreeData = {
    minX: 0,
    maxX: 0,
    minY: 0,
    maxY: 0,
    width: 0,
    height: 0,
    position: { x: 0, y: 0 }, // Positioned at (0, 0) but invisible
  };

  
  setSubtreesState((prevSubtrees) => {
    const updatedSubtrees = new Map(prevSubtrees);
    
    // Safeguard: Check if the sentinel node already exists
    if (!updatedSubtrees.has(sentinelNodeId)) {
      updatedSubtrees.set(sentinelNodeId, sentinelSubtree); // Add the sentinel node if not already present
      ////console.log('Sentinel node added.');
    } else {
      ////console.log('Sentinel node already exists, skipping insertion.');
    }

    return updatedSubtrees;
  });
}, []); // Only initialized once on mount


  // Memoize functions
  const calculateSubtreeDimensions = useCallback((nodeId: string, subtreeData: SubtreeData) => {
    setSubtreesState((prevSubtrees) => {
      const updatedSubtrees = new Map(prevSubtrees);
      updatedSubtrees.set(nodeId, subtreeData);
      return updatedSubtrees;
    });
  }, []);

  const commitSwap = useCallback(() => {
    if (draggingSubtreeId && targetSubtreeId) {
      setSubtreesState((prevSubtrees) => {
        const updatedSubtrees = new Map(prevSubtrees);
        const draggingSubtree = updatedSubtrees.get(draggingSubtreeId);
        const targetSubtree = updatedSubtrees.get(targetSubtreeId);
        if (draggingSubtree && targetSubtree) {
          const tempPosition = draggingSubtree.position;
          updatedSubtrees.set(draggingSubtreeId, { ...draggingSubtree, position: targetSubtree.position });
          updatedSubtrees.set(targetSubtreeId, { ...targetSubtree, position: tempPosition });
        }
        return updatedSubtrees;
      });
    }
    setDraggingSubtreeId(null);
    setTargetSubtreeId(null);
  }, [draggingSubtreeId, targetSubtreeId]);

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
    setSubtreesState((prevSubtrees) => {
      const updatedSubtrees = new Map(prevSubtrees);
      const subtree = updatedSubtrees.get(nodeId);
      if (subtree) {
        updatedSubtrees.set(nodeId, { ...subtree, position });
      }
      //////console.log('Context state updated-subtrees-position:', updatedSubtrees);
      return updatedSubtrees;
    });
  }, []);

  const resetSubtrees = useCallback(() => {
    // Reset the subtree state to an empty map
    setSubtreesState(() => {
      const sentinelNodeId = 'sentinel-node';
      
      // Re-add the sentinel node after resetting
      //////console.log('Reinitializing sentinel node after reset in resetSubtrees');
      
      const sentinelSubtree: SubtreeData = {
        minX: 0,
        maxX: 0,
        minY: 0,
        maxY: 0,
        width: 0,
        height: 0,
        position: { x: 0, y: 0 }, // Positioned at (0, 0) but invisible
      };
      
      const updatedSubtrees = new Map();
      updatedSubtrees.set(sentinelNodeId, sentinelSubtree); // Add the sentinel node to the subtree map
      return updatedSubtrees;
    });
  }, []);
  

  const setSubtrees = useCallback((newSubtrees: Map<string, SubtreeData>) => {
    const sentinelNodeId = 'sentinel-node'; // Sentinel node ID
    const sentinelSubtree: SubtreeData = {
      minX: 0,
      maxX: 0,
      minY: 0,
      maxY: 0,
      width: 0,
      height: 0,
      position: { x: 0, y: 0 }, // Positioned at (0, 0) but invisible
    };
  
    // Safeguard: Check if the sentinel node exists in newSubtrees, if not, add it
    if (!newSubtrees.has(sentinelNodeId)) {
      //////console.log('Sentinel node is missing in the new subtree map, adding it.');
      newSubtrees.set(sentinelNodeId, sentinelSubtree); // Add the sentinel node if not present
    }
    //////console.log('Context state newSubtrees:', newSubtrees);
    setSubtreesState(newSubtrees); // Update state with the modified subtrees
  }, []);
  

  // Memoize context value
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
    draggingSubtreeId,
    targetSubtreeId,
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
