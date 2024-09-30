// bloom-maps\app\Library\context\SubTreeProvider.Tsx
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { ConceptNode } from '@/app/Library/Definitions/Definitions';

export interface SubtreeData {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
  position: { x: number; y: number };
}

interface SubTreeContextType {
  subtrees: Map<string, SubtreeData>;
  calculateSubtreeDimensions: (nodeId: string, subtreeData: SubtreeData) => void; // Updated signature
  getTotalSubtreeWidths: () => number;
  getMaxSubtreeHeight: () => number;
  setSubtreePosition: (nodeId: string, position: { x: number; y: number }) => void;
  resetSubtrees: () => void; // Added reset function
  setSubtrees : (newSubtrees: Map<string, SubtreeData>) => void;
  draggingSubtreeId: string | null;
  targetSubtreeId: string | null;
  setDraggingSubtreeId: (id: string | null) => void;
  setTargetSubtreeId: (id: string | null) => void;
  commitSwap: () => void;
}

const SubTreeContext = createContext<SubTreeContextType | undefined>(undefined);

export const SubTreeProvider = ({ children }: { children: ReactNode }) => {
  const [subtrees, setSubtreesState] = useState<Map<string, SubtreeData>>(new Map());
  const [draggingSubtreeId, setDraggingSubtreeId] = useState<string | null>(
    null
  );
  const [targetSubtreeId, setTargetSubtreeId] = useState<string | null>(null);
  const [tempSubtrees, setTempSubtrees] = useState<Map<string, SubtreeData>>(
    new Map()
  );

  useEffect(() => {
    if (draggingSubtreeId && targetSubtreeId) {
      setTempSubtrees((prevSubtrees) => {
        const updatedSubtrees = new Map(subtrees);
        const draggingSubtree = updatedSubtrees.get(draggingSubtreeId);
        const targetSubtree = updatedSubtrees.get(targetSubtreeId);
        if (draggingSubtree && targetSubtree) {
          const tempPosition = draggingSubtree.position;
          updatedSubtrees.set(draggingSubtreeId, {
            ...draggingSubtree,
            position: targetSubtree.position,
          });
          updatedSubtrees.set(targetSubtreeId, {
            ...targetSubtree,
            position: tempPosition,
          });
        }
        return updatedSubtrees;
      });
    } else {
      setTempSubtrees(new Map(subtrees));
    }
  }, [draggingSubtreeId, targetSubtreeId, subtrees]);

  const calculateSubtreeDimensions = (nodeId: string, subtreeData: SubtreeData) => {
    setSubtreesState((prevSubtrees) => {
      const updatedSubtrees = new Map(prevSubtrees);
      updatedSubtrees.set(nodeId, subtreeData);
      return updatedSubtrees;
    });
  };

  const commitSwap = () => {
    if (draggingSubtreeId && targetSubtreeId) {
      setSubtreesState((prevSubtrees) => {
        const updatedSubtrees = new Map(prevSubtrees);
        const draggingSubtree = updatedSubtrees.get(draggingSubtreeId);
        const targetSubtree = updatedSubtrees.get(targetSubtreeId);
        if (draggingSubtree && targetSubtree) {
          const tempPosition = draggingSubtree.position;
          updatedSubtrees.set(draggingSubtreeId, {
            ...draggingSubtree,
            position: targetSubtree.position,
          });
          updatedSubtrees.set(targetSubtreeId, {
            ...targetSubtree,
            position: tempPosition,
          });
        }
        return updatedSubtrees;
      });
    }
    setDraggingSubtreeId(null);
    setTargetSubtreeId(null);
  };

  const getTotalSubtreeWidths = () => {
    let totalWidth = 0;
    subtrees.forEach((subtree) => {
      totalWidth += subtree.width;
    });
    return totalWidth;
  };

  const getMaxSubtreeHeight = () => {
    let maxHeight = 0;
    subtrees.forEach((subtree) => {
      if (subtree.height > maxHeight) {
        maxHeight = subtree.height;
      }
    });
    return maxHeight;
  };

  const setSubtreePosition = (nodeId: string, position: { x: number; y: number }) => {
    setSubtreesState((prevSubtrees) => {
      const updatedSubtrees = new Map(prevSubtrees);
      const subtree = updatedSubtrees.get(nodeId);
      if (subtree) {
        updatedSubtrees.set(nodeId, { ...subtree, position });
      }
      return updatedSubtrees;
    });
  };

  const resetSubtrees = () => {
    setSubtreesState(new Map());
  };

  const setSubtrees = (newSubtrees: Map<string, SubtreeData>) => {
    setSubtreesState(newSubtrees);
  };

  return (
    <SubTreeContext.Provider
      value={{
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
      }}
    >
      {children}
    </SubTreeContext.Provider>
  );
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