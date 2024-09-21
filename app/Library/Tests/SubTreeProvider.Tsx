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
}

const SubTreeContext = createContext<SubTreeContextType | undefined>(undefined);

export const SubTreeProvider = ({ children }: { children: ReactNode }) => {
  const [subtrees, setSubtrees] = useState<Map<string, SubtreeData>>(new Map());

  const calculateSubtreeDimensions = (nodeId: string, subtreeData: SubtreeData) => {
    console.log(`Calculating dimensions for subtree ${nodeId}`);
    setSubtrees((prevSubtrees) => {
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
    setSubtrees((prevSubtrees) => {
      const updatedSubtrees = new Map(prevSubtrees);
      const subtree = updatedSubtrees.get(nodeId);
      if (subtree) {
        updatedSubtrees.set(nodeId, { ...subtree, position });
      }
      return updatedSubtrees;
    });
  };

  const resetSubtrees = () => {
    setSubtrees(new Map());
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
