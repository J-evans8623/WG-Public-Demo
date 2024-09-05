'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import {TreeSizeContextType} from '@/app/Definitions/Definitions';

const TreeSizeContext = createContext<TreeSizeContextType | undefined>(undefined);

  const TreeSizeProvider = ({ children }: { children: ReactNode }) => {
  const [treeWidth, setTreeWidth] = useState<number>(0);
  const [treeHeight, setTreeHeight] = useState<number>(0);
  const [minX, setMinX] = useState<number>(0);
  const [maxX, setMaxX] = useState<number>(0);
  const [maxY, setMaxY] = useState<number>(0);
  const [minY, setMinY] = useState<number>(0);

  const updateTreeSize = (minX: number, maxX: number, minY: number, maxY: number) => {
    setTreeWidth(Math.abs(maxX - minX));
    setTreeHeight(Math.abs(maxY - minY));
  };


  return (
    <TreeSizeContext.Provider
      value={{
        treeWidth,
        treeHeight,
        maxX,
        maxY,
        minY,
        minX,
        setMaxX,
        setMinX,
        setMaxY,
        setMinY,
        updateTreeSize,
      }}
    >
      {children}
    </TreeSizeContext.Provider>
  );
};

export const useTreeSizeContext = () => {
  const context = useContext(TreeSizeContext);
  if (context === undefined) {
    throw new Error('useTreeSizeContext must be used within a TreeSizeProvider');
  }
  return context;
};
export default TreeSizeProvider;