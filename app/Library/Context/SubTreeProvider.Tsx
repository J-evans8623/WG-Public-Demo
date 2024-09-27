// bloom-maps\app\Library\context\SubTreeProvider.Tsx
import React, { createContext, useContext, useState, ReactNode } from 'react';
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
}

const SubTreeContext = createContext<SubTreeContextType | undefined>(undefined);

export const SubTreeProvider = ({ children }: { children: ReactNode }) => {
  const [subtrees, setSubtreesState] = useState<Map<string, SubtreeData>>(new Map());

  const calculateSubtreeDimensions = (nodeId: string, subtreeData: SubtreeData) => {
    console.log(`Calculating dimensions for subtree ${nodeId}`);
    setSubtreesState((prevSubtrees) => {
      const updatedSubtrees = new Map(prevSubtrees);
      updatedSubtrees.set(nodeId, subtreeData);
      console.log(`${nodeId} Added to subtree map.`);
      return updatedSubtrees;
    });
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
        resetSubtrees, // Provide reset function
        setSubtrees,
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