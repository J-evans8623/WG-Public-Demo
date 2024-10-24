'use client';

import React, { createContext, useReducer, useContext, ReactNode, useMemo } from 'react';
import { layoutReducer, initialLayoutState } from './layoutReducer';
import { LayoutAction } from '@/app/Library/Definitions/Definitions';

interface LayoutContextValue {
  getLayout: boolean;
  defaultMapWidth: number;
  defaultMapHeight: number;
  groundWidth: number;
  resetMapSize: boolean;
  dispatch: React.Dispatch<LayoutAction>;
}

const LayoutContext = createContext<LayoutContextValue | undefined>(undefined);

export const LayoutProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(layoutReducer, initialLayoutState);

  const contextValue = useMemo(() => ({
    ...state,
    dispatch,
  }), [state]);

  return (
    <LayoutContext.Provider value={contextValue}>
      {children}
    </LayoutContext.Provider>
  );
};

export const useLayoutContext = () => {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error('useLayoutContext must be used within a LayoutProvider');
  }
  return context;
};
