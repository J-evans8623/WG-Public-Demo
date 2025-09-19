/**
 * @file ViewSwitchContext.tsx
 * @description
 * Enhanced ViewSwitchContext that manages both view switching (conceptMap/PDF) and navigation panel state
 * throughout the application. This context centralizes the control of which primary view is active, PDF
 * document caching for performance optimization, and navigation panel visibility/expansion states. The
 * navigation panel functionality allows deeply nested components like CanvasHeader to toggle the sidebar
 * without props drilling through multiple component layers. The context maintains PDF document proxies
 * in memory to avoid expensive re-parsing when switching between documents, and provides methods to
 * reset state when loading new files. Navigation state includes both manual toggle state (user-initiated)
 * and expansion state (hover/interaction based) to support rich sidebar interactions. All state changes
 * are logged with unique codes for debugging and observability in production environments.
 *
 * Responsibilities:
 *   1) Manage active view state between concept map and PDF viewer
 *   2) Handle PDF URL selection and document proxy caching for performance
 *   3) Provide PDF state reset functionality for clean document transitions
 *   4) Control navigation panel manual open/close state across the application
 *   5) Track navigation panel expansion state for UI feedback and positioning
 *   6) Offer centralized navigation toggle functionality for nested components
 *   7) Emit structured logging for state transitions and user interactions
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';

type ViewType = 'conceptMap' | 'pdf';

interface ViewSwitchContextProps {
  // View switching functionality
  activeView: ViewType;
  selectedPdfUrl: string | null;
  setActiveView: (view: ViewType) => void;
  setSelectedPdfUrl: (url: string | null) => void;
  resetPdfState: () => void;
  
  // PDF caching functionality
  pdfCache: Map<string, PDFDocumentProxy>;
  cachePdf: (url: string, pdf: PDFDocumentProxy) => void;
  getCachedPdf: (url: string) => PDFDocumentProxy | undefined;
  
  // Navigation panel functionality
  isPanelManuallyOpen: boolean;
  isPanelExpanded: boolean;
  togglePanel: () => void;
  setPanelExpanded: (expanded: boolean) => void;
  setPanelManuallyOpen: (open: boolean) => void;
}

const ViewSwitchContext = createContext<ViewSwitchContextProps | undefined>(undefined);

export const ViewSwitchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Step 1: Initialize view switching state
  const [activeView, setActiveView] = useState<ViewType>('conceptMap');
  const [selectedPdfUrl, setSelectedPdfUrl] = useState<string | null>(null);
  const [pdfCache] = useState<Map<string, PDFDocumentProxy>>(new Map());

  // Step 2: Initialize navigation panel state
  const [isPanelManuallyOpen, setIsPanelManuallyOpen] = useState(false);
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);

  // Step 3: PDF caching functionality for performance optimization
  const cachePdf = useCallback((url: string, pdf: PDFDocumentProxy) => {
    console.log('[ViewSwitchContext.tsx][4001] Caching PDF document:', url);
    pdfCache.set(url, pdf);
  }, [pdfCache]);

  const getCachedPdf = useCallback(
    (url: string) => {
      const cached = pdfCache.get(url);
      console.log('[ViewSwitchContext.tsx][4002] PDF cache lookup:', url, cached ? 'found' : 'not found');
      return cached;
    },
    [pdfCache]
  );

  // Step 4: PDF state reset for clean document transitions
  const resetPdfState = useCallback(() => {
    console.log('[ViewSwitchContext.tsx][4003] Resetting PDF state, clearing cache with', pdfCache.size, 'documents');
    setSelectedPdfUrl(null);
    pdfCache.clear();
  }, [pdfCache]);

  // Step 5: Navigation panel toggle functionality
  const togglePanel = useCallback(() => {
    setIsPanelManuallyOpen(prev => {
      const newState = !prev;
      console.log('[ViewSwitchContext.tsx][4004] Navigation panel toggled from', prev, 'to', newState);
      return newState;
    });
  }, []);

  // Step 6: Navigation panel expansion state management
  const setPanelExpanded = useCallback((expanded: boolean) => {
    console.log('[ViewSwitchContext.tsx][4005] Navigation panel expansion changed to:', expanded);
    setIsPanelExpanded(expanded);
  }, []);

  // Step 7: Direct panel open/close control
  const setPanelManuallyOpen = useCallback((open: boolean) => {
    console.log('[ViewSwitchContext.tsx][4006] Navigation panel manually set to:', open);
    setIsPanelManuallyOpen(open);
  }, []);

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
        pdfCache,
        cachePdf,
        getCachedPdf,
        
        // Navigation panel
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
 * Custom hook that provides access to the ViewSwitchContext for managing view states, PDF handling,
 * and navigation panel controls. Validates context availability and throws descriptive error if used
 * outside provider boundaries to aid development debugging.
 */
export const useViewSwitch = () => {
  const ctx = useContext(ViewSwitchContext);
  if (!ctx) {
    console.error('[ViewSwitchContext.tsx][4007] useViewSwitch called outside of ViewSwitchProvider');
    throw new Error('useViewSwitch must be used within ViewSwitchProvider');
  }
  return ctx;
};