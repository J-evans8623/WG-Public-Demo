// @\app\studygraph\(studygraph)\components\layout\Canvas\pdf\ViewSwitchContext.tsx

/**
 * @file ViewSwitchContext.tsx
 * @description
 * Central coordinator for (1) primary view switching (Concept Map vs PDF), (2) PDF document 
 * URL state, and (3) navigation panel UI state.
 * * Phase 1 Update:
 * This file has been stripped of the legacy `pdf.js` worker management and LRU cache logic.
 * It now serves as a lightweight UI state container. The heavy lifting of PDF memory management
 * is now handled internally by the new EmbedPDF engine in `PdfViewer.tsx`.
 *
 * Responsibilities:
 * 1) Manage active view ('conceptMap' | 'pdf') and selectedPdfUrl.
 * 2) Manage nav panel open/expand state.
 * 3) Provide a clean API for consumers to switch views without knowing about workers.
 *
 * Complexity:
 * State updates are O(1).
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
} from 'react';

export type ViewType = 'conceptMap' | 'pdf';

interface ViewSwitchContextProps {
  // Primary view control
  activeView: ViewType;
  selectedPdfUrl: string | null;
  setActiveView: (view: ViewType) => void;
  setSelectedPdfUrl: (url: string | null) => void;
  resetPdfState: () => void;

  // Navigation panel UI
  isPanelManuallyOpen: boolean;
  isPanelExpanded: boolean;
  togglePanel: () => void;
  setPanelExpanded: (expanded: boolean) => void;
  setPanelManuallyOpen: (open: boolean) => void;
}

const ViewSwitchContext = createContext<ViewSwitchContextProps | undefined>(undefined);

/**
 * @function ViewSwitchProvider
 * @description
 * The top-level provider for view state. It holds simple string/boolean state
 * for the UI and exposes methods to toggle the navigation panel and main viewport.
 * update - 1: Renamed from InnerViewSwitchProvider and exported to fix build error.
 */
export const ViewSwitchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // -------- View state --------
  const [activeView, setActiveView] = useState<ViewType>('conceptMap');
  const [selectedPdfUrl, setSelectedPdfUrl] = useState<string | null>(null);

  // -------- Navigation panel UI --------
  const [isPanelManuallyOpen, setIsPanelManuallyOpen] = useState(false);
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);

  // -------- State resets --------
  const resetPdfState = useCallback(() => {
    setSelectedPdfUrl(null);
  }, []);

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
 * @function useViewSwitch
 * @description
 * Hook guard around the context. Throws if used outside the provider to aid debugging.
 */
export const useViewSwitch = () => {
  const ctx = useContext(ViewSwitchContext);
  if (!ctx) {
    console.error('[ViewSwitchContext] useViewSwitch called outside of ViewSwitchProvider');
    throw new Error('useViewSwitch must be used within ViewSwitchProvider');
  }
  return ctx;
};