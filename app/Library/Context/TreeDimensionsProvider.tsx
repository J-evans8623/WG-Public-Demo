// bloom-maps/app/Library/Context/TreeDimensionsProvider.tsx

import React, { createContext, useContext, useState, ReactNode } from 'react';

// Define context type
interface TreeDimensionsContextType {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  treeMaxDepth: number; // Context value for maximum depth
  currentHorizontalSpacing: number; // Context value for horizontal spacing
  setMinX: (value: number) => void;
  setMaxX: (value: number) => void;
  setMinY: (value: number) => void;
  setMaxY: (value: number) => void;
  setTreeMaxDepth: (value: number) => void;
  setCurrentHorizontalSpacing: (value: number) => void;
  resetTreeDimensions: () => void; // Function to reset context values
}

// Create context
const TreeDimensionsContext = createContext<TreeDimensionsContextType | undefined>(undefined);

export const TreeDimensionsProvider = ({ children }: { children: ReactNode }) => {
  const [minX, setMinX] = useState<number>(0);
  const [maxX, setMaxX] = useState<number>(0);
  const [minY, setMinY] = useState<number>(0);
  const [maxY, setMaxY] = useState<number>(0);
  const [treeMaxDepth, setTreeMaxDepth] = useState<number>(1); // State for maximum depth
  const [currentHorizontalSpacing, setCurrentHorizontalSpacing] = useState<number>(600); // State for horizontal spacing

  // Function to reset all context values to their defaults
  const resetTreeDimensions = () => {
    setMinX(0);
    setMaxX(0);
    setMinY(0);
    setMaxY(0);
    setTreeMaxDepth(1);
    setCurrentHorizontalSpacing(600);
  };

  return (
    <TreeDimensionsContext.Provider
      value={{
        minX,
        maxX,
        minY,
        maxY,
        treeMaxDepth,
        currentHorizontalSpacing,
        setMinX,
        setMaxX,
        setMinY,
        setMaxY,
        setTreeMaxDepth,
        setCurrentHorizontalSpacing,
        resetTreeDimensions, // Provide reset function
      }}
    >
      {children}
    </TreeDimensionsContext.Provider>
  );
};

// Custom hook to use TreeDimensionsContext
export const useTreeDimensions = () => {
  const context = useContext(TreeDimensionsContext);
  if (context === undefined) {
    throw new Error('useTreeDimensions must be used within a TreeDimensionsProvider');
  }
  return context;
};
