/**
 * @file ViewSwitchContext.tsx
 * @description
 *   Central coordinator for (1) primary view switching, (2) PDF document cache + lifecycle,
 *   and (3) navigation panel UI state. It composes the shared PDF.js worker provider so all
 *   viewers reuse a single worker instance. The LRU cache owns deterministic teardown of both
 *   the PDFDocumentLoadingTask and the PDFDocumentProxy objects to prevent worker/document
 *   overlap during rapid file switches.
 *
 *   (new update - expose destruction wait)
 *   Exposes `waitForPdfDestructions()` which awaits the cache’s serialized destruction queue.
 *   Viewers call this before starting a different file to *block* until the previous PDF has
 *   fully torn down, eliminating overlapping lifetimes and DOM-retention leaks.
 *
 * Responsibilities:
 *   1) Manage active view ('conceptMap' | 'pdf') and selectedPdfUrl.
 *   2) Provide LRU-backed cache for (pdf, loadingTask) pairs with deterministic destruction.
 *   3) Expose deletion and *awaitable* destruction (`waitForPdfDestructions`).
 *   4) Compose a single shared PDF.js worker to avoid worker proliferation.
 *   5) Manage nav panel open/expand state and toggles.
 *
 * Complexity:
 *   Lookup/insert/delete are O(1) via Map; eviction is O(1) amortized.
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from 'react';
import type {
  PDFDocumentProxy,
  PDFDocumentLoadingTask,
} from 'pdfjs-dist/types/src/display/api';
import { LruPdfCache } from './LruPdfCache';
import { PdfJsWorkerProvider } from './PdfJsWorkerProvider';

export type ViewType = 'conceptMap' | 'pdf';

interface ViewSwitchContextProps {
  // Primary view control
  activeView: ViewType;
  selectedPdfUrl: string | null;
  setActiveView: (view: ViewType) => void;
  setSelectedPdfUrl: (url: string | null) => void;
  resetPdfState: () => void;

  // PDF cache API
  cachePdf: (url: string, pdf: PDFDocumentProxy, loadingTask: PDFDocumentLoadingTask) => void;
  getCachedPdf: (url: string) => PDFDocumentProxy | undefined;
  deleteCachedPdf: (url: string) => void;

  // (new update - expose destruction wait)
  waitForPdfDestructions: () => Promise<void>;

  // Navigation panel UI
  isPanelManuallyOpen: boolean;
  isPanelExpanded: boolean;
  togglePanel: () => void;
  setPanelExpanded: (expanded: boolean) => void;
  setPanelManuallyOpen: (open: boolean) => void;
}

const ViewSwitchContext = createContext<ViewSwitchContextProps | undefined>(undefined);

/**
 * @function InnerViewSwitchProvider
 * @description
 *   Implements the core context value. Holds the LRU cache (capacity=1 for tight memory
 *   discipline when rapidly switching files) and forwards awaitable destruction semantics.
 */
const InnerViewSwitchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // -------- View state --------
  const [activeView, setActiveView] = useState<ViewType>('conceptMap');
  const [selectedPdfUrl, setSelectedPdfUrl] = useState<string | null>(null);

  // (new update - memory cap stays strict)
  const lru = useMemo(() => new LruPdfCache(1), []);

  // -------- Navigation panel UI --------
  const [isPanelManuallyOpen, setIsPanelManuallyOpen] = useState(false);
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);

  // -------- Cache API --------
  const cachePdf = useCallback(
    (url: string, pdf: PDFDocumentProxy, loadingTask: PDFDocumentLoadingTask) => {
      lru.set(url, pdf, loadingTask);
    },
    [lru]
  );

  const getCachedPdf = useCallback(
    (url: string) => lru.get(url),
    [lru]
  );

  const deleteCachedPdf = useCallback(
    (url: string) => { lru.delete(url); },
    [lru]
  );

  // (new update - expose destruction wait)
  const waitForPdfDestructions = useCallback(async () => {
    await lru.waitForPendingDestructions();
  }, [lru]);

  // -------- State resets --------
  const resetPdfState = useCallback(() => {
    setSelectedPdfUrl(null);
    // NB: `clear()` already awaits the internal destruction queue.
    void lru.clear();
  }, [lru]);

  // -------- Nav UI controls --------
  const togglePanel = useCallback(() => {
    setIsPanelManuallyOpen(prev => !prev);
  }, []);

  const setPanelExpanded = useCallback((expanded: boolean) => {
    setIsPanelExpanded(expanded);
  }, []);

  const setPanelManuallyOpen = useCallback((open: boolean) => {
    setIsPanelManuallyOpen(open);
  }, []);

  return (
    <ViewSwitchContext.Provider
      value={{
        // view
        activeView,
        selectedPdfUrl,
        setActiveView,
        setSelectedPdfUrl,
        resetPdfState,

        // cache
        cachePdf,
        getCachedPdf,
        deleteCachedPdf,
        waitForPdfDestructions, // (new update - expose destruction wait)

        // nav UI
        isPanelManuallyOpen,
        isPanelExpanded,
        togglePanel,
        setPanelExpanded,
        setPanelManuallyOpen,
      }}
    >
      {children}
    </ViewSwitchContext.Provider>
  );
};

/**
 * @function ViewSwitchProvider
 * @description
 *   Wrap the inner context with the shared PDF.js worker provider. We prefer a self-hosted
 *   worker (stable/CSP-friendly), with a CDN fallback pinned to your version.
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
 *   Hook guard around the context. Throws if used outside the provider to aid debugging.
 */
export const useViewSwitch = () => {
  const ctx = useContext(ViewSwitchContext);
  if (!ctx) {
    console.error('[ViewSwitchContext] useViewSwitch called outside of ViewSwitchProvider');
    throw new Error('useViewSwitch must be used within ViewSwitchProvider');
  }
  return ctx;
};
