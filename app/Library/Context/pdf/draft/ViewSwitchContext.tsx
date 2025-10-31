/**
 * @file ViewSwitchContext.tsx
 * @description
 *   Enhanced ViewSwitchContext that manages both view switching (conceptMap/PDF) and navigation
 *   panel state throughout the application. This context centralizes the control of which primary
 *   view is active, PDF document caching for performance optimization, and navigation panel
 *   visibility/expansion states. The context maintains PDF document proxies in memory to avoid
 *   expensive re-parsing when switching between documents, and provides methods to reset state when
 *   loading new files. This version (update - 1) composes the new `PdfJsWorkerProvider` around its
 *   children to ensure a single shared PDF.js worker is available to all PDF viewers, eliminating
 *   worker proliferation and stabilizing memory during rapid document switching. The public API and
 *   CSS remain unchanged; only the provider composition and a few internal lines are updated.
 *
 * Responsibilities:
 *   1) Manage active view state between concept map and PDF viewer
 *   2) Handle PDF URL selection and document proxy caching for performance
 *   3) Provide PDF state reset functionality for clean document transitions
 *   4) Control navigation panel manual open/close state across the application
 *   5) Track navigation panel expansion state for UI feedback and positioning
 *   6) Offer centralized navigation toggle functionality for nested components
 *   7) Compose the shared PDF.js worker provider for one-worker-per-app-shell behavior (update - 1)
 */

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { PDFDocumentProxy, PDFDocumentLoadingTask } from 'pdfjs-dist/types/src/display/api'; // update - 2
import { LruPdfCache } from '../LruPdfCache';
import { PdfJsWorkerProvider } from '../PdfJsWorkerProvider'; // update - 3

export type ViewType = 'conceptMap' | 'pdf';

interface ViewSwitchContextProps {
  // View switching functionality
  activeView: ViewType;
  selectedPdfUrl: string | null;
  setActiveView: (view: ViewType) => void;
  setSelectedPdfUrl: (url: string | null) => void;
  resetPdfState: () => void;

  // PDF caching functionality
  cachePdf: (url: string, pdf: PDFDocumentProxy, loadingTask: PDFDocumentLoadingTask) => void; // update - 4
  getCachedPdf: (url: string) => PDFDocumentProxy | undefined;

  // Navigation panel functionality
  isPanelManuallyOpen: boolean;
  isPanelExpanded: boolean;
  togglePanel: () => void;
  setPanelExpanded: (expanded: boolean) => void;
  setPanelManuallyOpen: (open: boolean) => void;
  deleteCachedPdf: (url: string) => void;
}

const ViewSwitchContext = createContext<ViewSwitchContextProps | undefined>(undefined);

const InnerViewSwitchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Step 1: Initialize view switching state
  const [activeView, setActiveView] = useState<ViewType>('conceptMap');
  const [selectedPdfUrl, setSelectedPdfUrl] = useState<string | null>(null);

  // update - 5: LRU capacity currently set to 1 for tighter memory (Phase 3 will revisit if needed)
  const lru = useMemo(() => new LruPdfCache(1), []);

  // Step 2: Initialize navigation panel state
  const [isPanelManuallyOpen, setIsPanelManuallyOpen] = useState(false);
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);

  // Step 3: PDF caching functionality via LRU
  const cachePdf = useCallback((url: string, pdf: PDFDocumentProxy, loadingTask: PDFDocumentLoadingTask) => {
    // update - 6
    lru.set(url, pdf, loadingTask);
  }, [lru]);

  const getCachedPdf = useCallback(
    (url: string) => {
      return lru.get(url);
    },
    [lru]
  );

  // Step 4: PDF state reset for clean transitions
  const resetPdfState = useCallback(() => {
    // update - 7
    setSelectedPdfUrl(null);
    lru.clear();
  }, [lru]);

  // Step 5: Navigation panel controls
  const togglePanel = useCallback(() => {
    setIsPanelManuallyOpen(prev => !prev);
  }, []);

  const setPanelExpanded = useCallback((expanded: boolean) => {
    setIsPanelExpanded(expanded);
  }, []);

  const setPanelManuallyOpen = useCallback((open: boolean) => {
    setIsPanelManuallyOpen(open);
  }, []);

  /**
   * @function deleteCachedPdf  (update - 8)
   * @description
   *   Remove a URL from the LRU cache and trigger queued destruction. Components should avoid
   *   destroying workers directly; centralized cache owns lifecycle.
   */
  const deleteCachedPdf = useCallback((url: string) => {
    lru.delete(url);
  }, [lru]);

  return (
    <ViewSwitchContext.Provider
      value={{
        // View switching
        activeView,
        selectedPdfUrl,
        setActiveView,
        setSelectedPdfUrl,
        resetPdfState,

        // PDF caching
        cachePdf, // update - 9
        getCachedPdf,

        // Navigation panel
        isPanelManuallyOpen,
        isPanelExpanded,
        togglePanel,
        setPanelExpanded,
        setPanelManuallyOpen,
        deleteCachedPdf
      }}
    >
      {children}
    </ViewSwitchContext.Provider>
  );
};

/**
 * @function ViewSwitchProvider  (update - 10)
 * @description
 *   Compose the shared PDF.js worker provider around the original context provider so all nested
 *   PDF viewers get the same worker. We pass the project’s pinned CDN as a safe fallback, while
 *   allowing self-hosting later by configuring `src` at a higher level if desired.
 */
export const ViewSwitchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <PdfJsWorkerProvider
      src="/vendor/pdfjs/pdf.worker.min.mjs" 
      cdnFallback="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.worker.min.mjs" 
    >
      <InnerViewSwitchProvider>{children}</InnerViewSwitchProvider>
    </PdfJsWorkerProvider>
  );
};

/**
 * @function useViewSwitch
 * @description
 *   Hook to access the ViewSwitchContext for managing view states, PDF handling, and navigation panel
 *   controls. Validates context availability and throws descriptive error if used outside provider
 *   boundaries to aid development debugging.
 */
export const useViewSwitch = () => {
  const ctx = useContext(ViewSwitchContext);
  if (!ctx) {
    // update - 11
    console.error('[ViewSwitchContext.tsx] useViewSwitch called outside of ViewSwitchProvider');
    throw new Error('useViewSwitch must be used within ViewSwitchProvider');
  }
  return ctx;
};
