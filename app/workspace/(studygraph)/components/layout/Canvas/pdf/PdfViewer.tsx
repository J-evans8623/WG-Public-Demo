// @\app\studygraph\(studygraph)\components\layout\Canvas\pdf\PdfViewer.tsx

/**
 * @file PdfViewer.tsx
 * @description
 * The core PDF presentation layer, acting as an Adapter around the EmbedPDF (Pdfium) engine.
 *
 * Patch (Context Menu Reliability + Selection Persistence):
 * 1) Never show the native browser context menu inside the PDF viewer.
 * 2) Prevent right-click from clearing selection by intercepting RIGHT-CLICK down events in CAPTURE phase.
 * 3) Show custom context menu reliably by (a) capture-phase contextmenu interception and (b) on-demand selection text pull.
 *
 * Responsibilities:
 * 1. Engine Initialization: Manages the async startup of the WASM worker.
 * 2. Plugin Registration: Configures plugins (Loader, Viewport, etc.).
 * 3. Interaction: Handles text selection and context menu placement via robust interception patterns.
 */

import React, {
  useEffect,
  useImperativeHandle,
  forwardRef,
  useState,
  useMemo,
  useRef,
  useCallback,
} from 'react';

// 1. EmbedPDF Core & Engine
import { EmbedPDF } from '@embedpdf/core/react';
import { createPluginRegistration } from '@embedpdf/core';
import { usePdfiumEngine } from '@embedpdf/engines/react';

// 2. EmbedPDF Plugins
import { LoaderPluginPackage } from '@embedpdf/plugin-loader/react';
import { ViewportPluginPackage, Viewport } from '@embedpdf/plugin-viewport/react';
import {
  ScrollPluginPackage,
  Scroller,
  useScroll,
  ScrollStrategy,
} from '@embedpdf/plugin-scroll/react';
import { RenderPluginPackage, RenderLayer } from '@embedpdf/plugin-render/react';
import { TilingPluginPackage, TilingLayer } from '@embedpdf/plugin-tiling/react';
import { ZoomPluginPackage, useZoom } from '@embedpdf/plugin-zoom/react';
import {
  SelectionPluginPackage,
  SelectionLayer,
  useSelectionCapability,
} from '@embedpdf/plugin-selection/react';
import {
  InteractionManagerPluginPackage,
  PagePointerProvider,
} from '@embedpdf/plugin-interaction-manager/react';

// 3. Application Contexts & Components
import PdfContextMenu, { PdfAction } from '../PdfContextMenu';
import { useSelectionAttachment } from '@/app/Library/Context/SelectionAttachmentContext';
import { copyText } from '../pdfActions';

// 4. Types
export type PdfViewerRefType = {
  handlePrev: () => void;
  handleNext: () => void;
  handleGoTo: (page: number) => void;
};

interface PdfViewerProps {
  fileUrl: string;
  scale?: number;
  onPageChange?: (current: number, total: number) => void;
}

/**
 * @component PdfViewerContent
 * @description
 * Internal component that consumes EmbedPDF contexts. It maps props to plugin commands
 * and orchestrates the text selection workflow + robust context menu interception.
 */
const PdfViewerContent = ({
  fileUrl,
  scale = 1.0,
  onPageChange,
  forwardedRef,
  engine,
}: PdfViewerProps & { forwardedRef: React.Ref<PdfViewerRefType>; engine: any }) => {
  // --- Hooks from Plugins ---
  const { provides: scroll, state: scrollState } = useScroll();
  const { provides: zoom } = useZoom();
  const { provides: selection } = useSelectionCapability();

  // --- App Contexts ---
  const { triggerAsk, triggerExplore, triggerQuiz } = useSelectionAttachment();

  // --- Local Interaction State ---
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [selectedText, setSelectedText] = useState<string>('');

  // --- 1. Zoom Adapter ---
  useEffect(() => {
    if (zoom && scale) {
      zoom.requestZoom(scale);
    }
  }, [zoom, scale]);

  // --- 2. Page Change Adapter ---
  useEffect(() => {
    if (scrollState && onPageChange) {
      onPageChange(scrollState.currentPage, scrollState.totalPages);
    }
  }, [scrollState, onPageChange]);

  // --- 3. Imperative Handle Adapter ---
  useImperativeHandle(
    forwardedRef,
    () => ({
      handlePrev: () => scroll?.scrollToPreviousPage(),
      handleNext: () => scroll?.scrollToNextPage(),
      handleGoTo: (page: number) => scroll?.scrollToPage({ pageNumber: page, behavior: 'smooth' }),
    }),
    [scroll]
  );

  // --- 4. Selection tracking (keep selectedText updated, but do NOT open menu here) ---
  useEffect(() => {
    if (!selection) return;

    const unsubscribeEnd = selection.onEndSelection(async () => {
      try {
        const lines = await selection.getSelectedText().toPromise();
        const text = lines.join(' ').trim();
        setSelectedText(text || '');
      } catch (e) {
        //console.error('[PdfViewer] Selection text extraction failed', e);
        setSelectedText('');
      }
    });

    const unsubscribeChange = selection.onSelectionChange((range) => {
      if (!range) {
        setMenuPosition(null);
        setSelectedText('');
      }
    });

    return () => {
      unsubscribeEnd();
      unsubscribeChange();
    };
  }, [selection]);

  // ----------------------------------------------------------------------------------
  // PATCH: Right-click interception to preserve selection + suppress native menu
  // ----------------------------------------------------------------------------------

  /**
   * stopNativeRightClick
   * - Blocks the engine/selection layer from receiving the right-click down event that clears selection.
   * - Works defensively by stopping both React synthetic propagation and the underlying native event.
   */
  const stopNativeRightClick = useCallback((e: any) => {
    try {
      e.preventDefault?.();
      e.stopPropagation?.();
      // Stop other native listeners (engine/plugins) if they attached at the same phase.
      e.nativeEvent?.stopImmediatePropagation?.();
    } catch {
      /* no-op */
    }
  }, []);

  /**
   * fetchSelectedTextNow
   * - Eliminates timing races: if state hasn't updated yet, pull selection text directly on demand.
   */
  const fetchSelectedTextNow = useCallback(async (): Promise<string> => {
    if (!selection) return '';
    try {
      const lines = await selection.getSelectedText().toPromise();
      return (lines.join(' ').trim() || '');
    } catch {
      return '';
    }
  }, [selection]);

  /**
   * Right-click DOWN (capture)
   * - Most engines clear selection on mouse/pointer down (button=2) before contextmenu fires.
   * - Intercepting here is what actually preserves the highlight.
   */
  const handlePointerDownCapture = useCallback(
    (e: React.PointerEvent) => {
      if (e.button === 2) {
        stopNativeRightClick(e);
      }
    },
    [stopNativeRightClick]
  );

  const handleMouseDownCapture = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 2) {
        stopNativeRightClick(e);
      }
    },
    [stopNativeRightClick]
  );

  /**
   * Context menu (capture)
   * - Always suppress the browser menu in the PDF viewer.
   * - If there is selected text (state or on-demand fetch), open our custom menu at cursor.
   */
  const handleContextMenuCapture = useCallback(
    async (e: React.MouseEvent) => {
      // Always block the native browser menu inside the PDF viewer (success criteria #1).
      stopNativeRightClick(e);

      const x = e.clientX;
      const y = e.clientY;

      // Prefer state (fast). If empty, fetch on-demand to avoid races.
      let text = (selectedText || '').trim();
      if (!text) {
        text = await fetchSelectedTextNow();
        if (text) setSelectedText(text);
      }

      if (text) {
        setMenuPosition({ x, y });
      } else {
        // No selection: do not show menu, but still suppress native menu.
        setMenuPosition(null);
      }
    },
    [fetchSelectedTextNow, selectedText, stopNativeRightClick]
  );

  const handleMenuAction = useCallback(
    (action: PdfAction) => {
      if (!selectedText) return;

      switch (action) {
        case 'copy':
          copyText(selectedText);
          break;
        case 'ask':
          triggerAsk(selectedText);
          break;
        case 'explore':
          triggerExplore(selectedText);
          break;
        case 'quiz':
          triggerQuiz(selectedText);
          break;
      }
      setMenuPosition(null);
    },
    [selectedText, triggerAsk, triggerExplore, triggerQuiz]
  );

  return (
    <div
      className="w-full h-full relative bg-[#FDFDF8] pdf-viewer-root"
      // PATCH: Capture phase interception (beats engine/plugin listeners)
      onPointerDownCapture={handlePointerDownCapture}
      onMouseDownCapture={handleMouseDownCapture}
      onContextMenuCapture={handleContextMenuCapture}
      style={{
        userSelect: 'none',
        WebkitUserDrag: 'none',
      } as React.CSSProperties}
    >
      <style>{`
        .pdf-viewer-root img,
        .pdf-viewer-root canvas {
          -webkit-user-drag: none;
          user-drag: none;
          user-select: none;
          pointer-events: auto; /* Keep clicks working for selection engine */
        }
      `}</style>

      <Viewport className="w-full h-full overflow-auto">
        <Scroller
          renderPage={({ width, height, pageIndex, scale, rotation }) => (
            <div
              style={{ width, height, position: 'relative' }}
              className="shadow-sm bg-white mb-4"
              draggable={false}
            >
              <PagePointerProvider
                pageIndex={pageIndex}
                pageWidth={width}
                pageHeight={height}
                rotation={rotation}
                scale={scale}
              >
                <RenderLayer pageIndex={pageIndex} scale={scale} />

                {/* TilingLayer: guard scale */}
                {scale > 0 && <TilingLayer pageIndex={pageIndex} scale={scale} />}

                <SelectionLayer pageIndex={pageIndex} scale={scale} />
              </PagePointerProvider>
            </div>
          )}
        />
      </Viewport>

      {menuPosition && (
        <PdfContextMenu
          x={menuPosition.x}
          y={menuPosition.y}
          onSelect={handleMenuAction}
          onClose={() => setMenuPosition(null)}
        />
      )}
    </div>
  );
};

/**
 * @component PdfViewer
 * @description
 * The outer shell that initializes the engine and provides the Context.
 */
const PdfViewer = forwardRef<PdfViewerRefType, PdfViewerProps>((props, ref) => {
  // 1. Initialize Engine
  const { engine, error } = usePdfiumEngine();
  const [isEngineReady, setIsEngineReady] = useState(false);

  useEffect(() => {
    if (engine && engine.initialize && !isEngineReady) {
      //console.warn('[PdfViewer] Engine found. Initializing...');
      engine
        .initialize()
        .toPromise()
        .then(() => {
          //console.warn('[PdfViewer] Engine initialized successfully');
          setIsEngineReady(true);
        })
        .catch((err: Error) => {
          //console.warn('[PdfViewer] CRITICAL: Engine initialization failed:', err);
        });
    }
  }, [engine, isEngineReady]);

  // 2. Define Plugins
  const plugins = useMemo(() => {
    const absoluteUrl = props.fileUrl
      ? new URL(
          props.fileUrl,
          typeof window !== 'undefined' ? window.location.origin : undefined
        ).href
      : '';

    //console.warn('[PdfViewer] Configuring LoaderPlugin with URL:', absoluteUrl);

    return [
      createPluginRegistration(LoaderPluginPackage, {
        loadingOptions: {
          type: 'url',
          pdfFile: {
            id: props.fileUrl,
            url: absoluteUrl,
          },
        },
      }),
      createPluginRegistration(ViewportPluginPackage),
      createPluginRegistration(ScrollPluginPackage, {
        strategy: ScrollStrategy.Vertical,
        pageGap: 20,
        initialPage: 1,
      }),
      createPluginRegistration(RenderPluginPackage),
      createPluginRegistration(TilingPluginPackage),
      createPluginRegistration(ZoomPluginPackage),
      createPluginRegistration(InteractionManagerPluginPackage),
      createPluginRegistration(SelectionPluginPackage),
    ];
  }, [props.fileUrl]);

  if (error) {
    //console.warn('[PdfViewer] usePdfiumEngine hook reported error:', error);
    return (
      <div className="flex items-center justify-center h-full text-red-500">
        Error loading PDF Engine: {error.message}
      </div>
    );
  }

  if (!isEngineReady || !engine) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Initializing PDF Engine...
      </div>
    );
  }

  return (
    <EmbedPDF engine={engine} plugins={plugins}>
      <PdfViewerContent {...props} forwardedRef={ref} engine={engine} />
    </EmbedPDF>
  );
});

PdfViewer.displayName = 'PdfViewer';
export default PdfViewer;
