'use client';

import React, { createContext, useReducer, useContext, ReactNode, useMemo } from 'react';
import { zoomReducer, initialZoomState } from './zoomReducer';
import { ZoomAction } from '@/app/Library/Definitions/Definitions';

interface ZoomContextValue {
  zoomLevel: number;
  baseZoomLevel: number;
  dispatch: React.Dispatch<ZoomAction>;
}

const ZoomContext = createContext<ZoomContextValue | undefined>(undefined);

export const ZoomProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(zoomReducer, initialZoomState);

  const contextValue = useMemo(() => ({
    ...state,
    dispatch,
  }), [state]);

  return (
    <ZoomContext.Provider value={contextValue}>
      {children}
    </ZoomContext.Provider>
  );
};

export const useZoomContext = () => {
  const context = useContext(ZoomContext);
  if (!context) {
    throw new Error('useZoomContext must be used within a ZoomProvider');
  }
  return context;
};
