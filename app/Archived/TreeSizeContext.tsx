// TreeSizeContext.tsx
'use client';

import React, { createContext, useContext, useState } from 'react';
import  TreeSizeContextType from '@/app/Archived/Definitions/Definitions';

// Create the context with a default value of undefined
const TreeSizeContext = createContext<TreeSizeContextType | undefined>(undefined);

// Provider component for the tree size context
export const TreeSizeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [minX, setMinX] = useState<number>(0);
  const [maxX, setMaxX] = useState<number>(0);
  const [minY, setMinY] = useState<number>(0);
  const [maxY, setMaxY] = useState<number>(0);
  const [treeWidth, setTreeWidth] = useState<number>(0);
  const [treeHeight, setTreeHeight] = useState<number>(0);

  return (
    <TreeSizeContext.Provider
      value={{
        minX,
        maxX,
        minY,
        maxY,
        treeWidth,
        treeHeight,
        setMinX,
        setMaxX,
        setMinY,
        setMaxY,
        setTreeWidth,
        setTreeHeight,
      }}
    >
      {children}
    </TreeSizeContext.Provider>
  );
}

// Custom hook to use the tree size context
export const useTreeSizeContext = (): TreeSizeContextType => {
  const context = useContext(TreeSizeContext);
  if (!context) {
    throw new Error('useTreeSizeContext must be used within a TreeSizeProvider');
  }
  return context;
}