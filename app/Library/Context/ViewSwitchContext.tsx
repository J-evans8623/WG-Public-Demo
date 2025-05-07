// ViewSwitchContext.tsx

import React, { createContext, useContext, useState, useCallback } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';

type ViewType = 'conceptMap' | 'pdf';

interface ViewSwitchContextProps {
  activeView: ViewType;
  selectedPdfUrl: string | null;
  setActiveView: (view: ViewType) => void;
  setSelectedPdfUrl: (url: string | null) => void;
  /**
   * Clears out any loaded PDF state (URL + cache).
   * Use this before loading a new file to unmount the old PDF completely.
   */
  resetPdfState: () => void;
  pdfCache: Map<string, PDFDocumentProxy>;
  cachePdf: (url: string, pdf: PDFDocumentProxy) => void;
  getCachedPdf: (url: string) => PDFDocumentProxy | undefined;
}

const ViewSwitchContext = createContext<ViewSwitchContextProps | undefined>(undefined);

export const ViewSwitchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeView, setActiveView] = useState<ViewType>('conceptMap');
  const [selectedPdfUrl, setSelectedPdfUrl] = useState<string | null>(null);
  const [pdfCache] = useState<Map<string, PDFDocumentProxy>>(new Map());

  const cachePdf = useCallback((url: string, pdf: PDFDocumentProxy) => {
    pdfCache.set(url, pdf);
  }, [pdfCache]);

  const getCachedPdf = useCallback(
    (url: string) => pdfCache.get(url),
    [pdfCache]
  );

  const resetPdfState = useCallback(() => {
    setSelectedPdfUrl(null);
    pdfCache.clear();
  }, [pdfCache]);

  return (
    <ViewSwitchContext.Provider
      value={{
        activeView,
        selectedPdfUrl,
        setActiveView,
        setSelectedPdfUrl,
        resetPdfState,
        pdfCache,
        cachePdf,
        getCachedPdf,
      }}
    >
      {children}
    </ViewSwitchContext.Provider>
  );
};

export const useViewSwitch = () => {
  const ctx = useContext(ViewSwitchContext);
  if (!ctx) throw new Error('useViewSwitch must be used within ViewSwitchProvider');
  return ctx;
};
