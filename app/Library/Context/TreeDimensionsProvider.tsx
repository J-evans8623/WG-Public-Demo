// bloom-maps/app/Library/Context/TreeDimensionsProvider.tsx

import React, { createContext, useContext, useState, ReactNode } from 'react';

// Define context type
interface TreeDimensionsContextType {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  treeWidth: number;
  treeHeight: number;
  treeMaxDepth: number; // Context value for maximum depth
  currentHorizontalSpacing: number; // New context value for horizontal spacing
  setMinX: (value: number) => void;
  setMaxX: (value: number) => void;
  setMinY: (value: number) => void;
  setMaxY: (value: number) => void;
  setTreeWidth: (value: number) => void;
  setTreeHeight: (value: number) => void;
  setTreeMaxDepth: (value: number) => void;
  setCurrentHorizontalSpacing: (value: number) => void; // New setter function for horizontal spacing
}

// Create context
const TreeDimensionsContext = createContext<TreeDimensionsContextType | undefined>(undefined);

export const TreeDimensionsProvider = ({ children }: { children: ReactNode }) => {
  const [minX, setMinX] = useState<number>(0);
  const [maxX, setMaxX] = useState<number>(0);
  const [minY, setMinY] = useState<number>(0);
  const [maxY, setMaxY] = useState<number>(0);
  const [treeWidth, setTreeWidth] = useState<number>(1800); // Default map width
  const [treeHeight, setTreeHeight] = useState<number>(1800); // Default map height
  const [treeMaxDepth, setTreeMaxDepth] = useState<number>(1); // State for maximum depth
  const [currentHorizontalSpacing, setCurrentHorizontalSpacing] = useState<number>(600); // State for horizontal spacing

  return (
    <TreeDimensionsContext.Provider
      value={{
        minX,
        maxX,
        minY,
        maxY,
        treeWidth,
        treeHeight,
        treeMaxDepth,
        currentHorizontalSpacing,
        setMinX,
        setMaxX,
        setMinY,
        setMaxY,
        setTreeWidth,
        setTreeHeight,
        setTreeMaxDepth,
        setCurrentHorizontalSpacing, // Provide setter function for horizontal spacing
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
