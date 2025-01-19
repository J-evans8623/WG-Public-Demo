// FileContext.tsx
import React, { createContext, useReducer, useContext, ReactNode } from 'react';
import { fileReducer, initialFileState, FileState } from './fileReducer';
import { FileAction } from '@/app/Library/Definitions/Definitions';

interface FileContextValue extends FileState {
  dispatch: React.Dispatch<FileAction>;
}

const FileContext = createContext<FileContextValue | undefined>(undefined);

export const FileProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(fileReducer, initialFileState);

  const contextValue = React.useMemo(() => ({
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
