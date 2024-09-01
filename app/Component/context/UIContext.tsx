// bloom-maps/app/Component/context/UIContext.tsx

'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

// Define the context type
interface UIContextType {
  createNewDocument: () => void;
  isNewDocumentRequested: boolean;
  resetNewDocumentRequest: () => void;
}

// Create the context with an initial undefined value
const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider = ({ children }: { children: ReactNode }) => {
  const [isNewDocumentRequested, setIsNewDocumentRequested] = useState(false);

  const createNewDocument = () => {
    setIsNewDocumentRequested(true);
  };

  const resetNewDocumentRequest = useCallback(() => {
    setIsNewDocumentRequested(false);
  }, []);

  return (
    <UIContext.Provider value={{ createNewDocument, isNewDocumentRequested, resetNewDocumentRequest }}>
      {children}
    </UIContext.Provider>
  );
};

// Custom hook to use the UIContext
export const useUIContext = () => {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error('useUIContext must be used within a UIProvider');
  }
  return context;
};
