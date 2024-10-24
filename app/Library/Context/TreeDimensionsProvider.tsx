import React, { createContext, useContext, useState, ReactNode, useMemo } from 'react';

interface TreeDimensionsContextType {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  treeMaxDepth: number;
  currentHorizontalSpacing: number;
  setMinX: (value: number) => void;
  setMaxX: (value: number) => void;
  setMinY: (value: number) => void;
  setMaxY: (value: number) => void;
  setTreeMaxDepth: (value: number) => void;
  setCurrentHorizontalSpacing: (value: number) => void;
  resetTreeDimensions: () => void;
}

const TreeDimensionsContext = createContext<TreeDimensionsContextType | undefined>(undefined);

export const TreeDimensionsProvider = ({ children }: { children: ReactNode }) => {
  const [minX, setMinX] = useState<number>(0);
  const [maxX, setMaxX] = useState<number>(0);
  const [minY, setMinY] = useState<number>(0);
  const [maxY, setMaxY] = useState<number>(0);
  const [treeMaxDepth, setTreeMaxDepth] = useState<number>(1);
  const [currentHorizontalSpacing, setCurrentHorizontalSpacing] = useState<number>(600);

  const resetTreeDimensions = () => {
    setMinX(0);
    setMaxX(0);
    setMinY(0);
    setMaxY(0);
    setTreeMaxDepth(1);
    setCurrentHorizontalSpacing(600);
  };

  const contextValue = useMemo(() => ({
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
    resetTreeDimensions,
  }), [minX, maxX, minY, maxY, treeMaxDepth, currentHorizontalSpacing]);

  return (
    <TreeDimensionsContext.Provider value={contextValue}>
      {children}
    </TreeDimensionsContext.Provider>
  );
};

export const useTreeDimensions = () => {
  const context = useContext(TreeDimensionsContext);
  if (context === undefined) {
    throw new Error('useTreeDimensions must be used within a TreeDimensionsProvider');
  }
  return context;
};
