// TreeSizeContext.tsx
'use client';

import React, { createContext, useContext, useReducer, ReactNode, useMemo } from 'react';
import { TreeSizeContextType } from '@/app/Definitions/Definitions';

// Define the initial state for the tree size
const initialState = {
  treeWidth: 0,
  treeHeight: 0,
  minX: 0,
  maxX: 0,
  minY: 0,
  maxY: 0,
};

// Define the action types for the reducer
type Action =
  | { type: 'SET_MIN_X'; payload: number }
  | { type: 'SET_MAX_X'; payload: number }
  | { type: 'SET_MIN_Y'; payload: number }
  | { type: 'SET_MAX_Y'; payload: number }
  | { type: 'UPDATE_TREE_SIZE'; payload: { minX: number; maxX: number; minY: number; maxY: number } };

// Reducer function to manage the state
function treeSizeReducer(state: typeof initialState, action: Action) {
  switch (action.type) {
    case 'SET_MIN_X':
      return { ...state, minX: action.payload };
    case 'SET_MAX_X':
      return { ...state, maxX: action.payload };
    case 'SET_MIN_Y':
      return { ...state, minY: action.payload };
    case 'SET_MAX_Y':
      return { ...state, maxY: action.payload };
    case 'UPDATE_TREE_SIZE':
      const { minX, maxX, minY, maxY } = action.payload;
      return {
        ...state,
        minX,
        maxX,
        minY,
        maxY,
        treeWidth: Math.abs(maxX - minX),
        treeHeight: Math.abs(maxY - minY),
      };
    default:
      return state;
  }
}

const TreeSizeContext = createContext<TreeSizeContextType | undefined>(undefined);

const TreeSizeProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(treeSizeReducer, initialState);

  const updateTreeSize = (minX: number, maxX: number, minY: number, maxY: number) => {
    dispatch({ type: 'UPDATE_TREE_SIZE', payload: { minX, maxX, minY, maxY } });
  };

  const contextValue = useMemo(
    () => ({
      ...state,
      updateTreeSize,
    }),
    [state]
  );

  return <TreeSizeContext.Provider value={contextValue}>{children}</TreeSizeContext.Provider>;
};

export const useTreeSizeContext = () => {
  const context = useContext(TreeSizeContext);
  if (context === undefined) {
    throw new Error('useTreeSizeContext must be used within a TreeSizeProvider');
  }
  return context;
};

export default TreeSizeProvider;
