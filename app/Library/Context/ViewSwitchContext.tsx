// ViewSwitchContext.tsx
import React, { createContext, useContext, useState } from 'react';
import { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';

type ViewType = 'conceptMap' | 'pdf';

interface ViewSwitchContextProps {
  activeView: ViewType;
  selectedPdfUrl: string | null;
  setActiveView: (view: ViewType) => void;
  setSelectedPdfUrl: (url: string | null) => void;
  // PDF cache: mapping file URL -> loaded PDF document
  pdfCache: Map<string, PDFDocumentProxy>;
  cachePdf: (url: string, pdf: PDFDocumentProxy) => void;
  getCachedPdf: (url: string) => PDFDocumentProxy | undefined;
}

const ViewSwitchContext = createContext<ViewSwitchContextProps | undefined>(undefined);

export const ViewSwitchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeView, setActiveView] = useState<ViewType>('conceptMap');
  const [selectedPdfUrl, setSelectedPdfUrl] = useState<string | null>(null);
  const [pdfCache] = useState<Map<string, PDFDocumentProxy>>(new Map());

  const cachePdf = (url: string, pdf: PDFDocumentProxy) => {
    pdfCache.set(url, pdf);
  };

  const getCachedPdf = (url: string): PDFDocumentProxy | undefined => {
    return pdfCache.get(url);
  };

  return (
    <ViewSwitchContext.Provider
      value={{ activeView, selectedPdfUrl, setActiveView, setSelectedPdfUrl, pdfCache, cachePdf, getCachedPdf }}
    >
      {children}
    </ViewSwitchContext.Provider>
  );
};

export const useViewSwitch = () => {
  const context = useContext(ViewSwitchContext);
  if (!context) {
    throw new Error('useViewSwitch must be used within a ViewSwitchProvider');
  }
  return context;
};
