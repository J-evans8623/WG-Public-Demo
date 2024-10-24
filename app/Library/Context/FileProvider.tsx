'use client';

import React, { createContext, useReducer, useContext, ReactNode, useMemo } from 'react';
import { fileReducer, initialFileState } from './fileReducer';
import { FileAction } from '@/app/Library/Definitions/Definitions';

interface FileContextValue {
  fileName: string;
  dispatch: React.Dispatch<FileAction>;
}

const FileContext = createContext<FileContextValue | undefined>(undefined);

export const FileProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(fileReducer, initialFileState);

  const contextValue = useMemo(() => ({
    ...state,
    dispatch,
  }), [state]);

  return (
    <FileContext.Provider value={contextValue}>
      {children}
    </FileContext.Provider>
  );
};

export const useFileContext = () => {
  const context = useContext(FileContext);
  if (!context) {
    throw new Error('useFileContext must be used within a FileProvider');
  }
  return context;
};
