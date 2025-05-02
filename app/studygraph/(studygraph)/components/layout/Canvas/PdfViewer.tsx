// PdfViewer.tsx

/**
 * @file PdfViewer.tsx
 * @description
 *   React component to display a multi-page PDF with:
 *     - Lazy rendering & page-visibility tracking.
 *     - Invisible, selectable text layer.
 *     - Fixed-position context menu with study actions.
 *     - Fallback to full-page text when no selection.
 *     - Instant visual feedback by highlighting the entire page.
 *     - Persistent selection capture so right-click retains highlighted text.
 *
 * Responsibilities:
 *   - Load & cache PDF documents with retry logic.
 *   - Render pages on-demand as they scroll into view.
 *   - Expose next/prev/goTo methods via a forwarded ref.
 *   - Provide “Copy”, “Ask Assistant”, “Explore Topic”, and “Create Quiz” actions
 *     in a custom context menu.
 *   - Capture and preserve user text selection across right-click events.
 *   - Highlight the page briefly when an action is triggered.
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist/types/src/display/api';
import { useViewSwitch } from '@/app/Library/Context/ViewSwitchContext';

import PdfContextMenu, { PdfAction } from './PdfContextMenu';
import { getPageText, getSelectedText } from '../../utils/pdfTextUtils';
import { copyText, askAssistant, exploreTopic, createQuiz } from './pdfActions';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.worker.min.mjs';

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

// Maximum retries for loading
const MAX_RETRIES = 3;
// Duration of visual highlight feedback (ms)
const HIGHLIGHT_DURATION_MS = 800;

// Slot for each page's refs and render task
type PageSlot = {
  wrapperRef: HTMLDivElement | null;
  canvasRef: HTMLCanvasElement | null;
  textLayerRef: HTMLDivElement | null;
  renderTask?: RenderTask;
};

const PdfViewer = forwardRef<PdfViewerRefType, PdfViewerProps>(
  ({ fileUrl, scale = 1.0, onPageChange }, ref) => {
    const { cachePdf, getCachedPdf } = useViewSwitch();

    // PDF document and navigation state
    const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
    const [numPages, setNumPages] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState<number>(0);
    const [currentPage, setCurrentPage] = useState<number>(1);

    // Context menu state
    const [menuState, setMenuState] = useState<{
      visible: boolean;
      x: number;
      y: number;
      pageNum: number;
    }>({ visible: false, x: 0, y: 0, pageNum: 1 });

    // Last captured text selection
    const [lastSelection, setLastSelection] = useState<string>('');

    // Pages that should show highlight overlay
    const [highlightedPages, setHighlightedPages] = useState<number[]>([]);

    // Refs per page for rendering
    const pageRefs = useRef<PageSlot[]>([]);
    if (pageRefs.current.length !== numPages) {
      pageRefs.current = Array.from({ length: numPages }, () => ({
        wrapperRef: null,
        canvasRef: null,
        textLayerRef: null,
        renderTask: undefined,
      }));
    }

    /**
     * Load the PDF document with retry on transient errors.
     */
    const loadPdf = useCallback(async () => {
      setLoading(true);
      setError(null);
      try {
        let pdf: PDFDocumentProxy;
        const cached = getCachedPdf(fileUrl);
        if (cached) {
          pdf = cached;
        } else {
          const res = await fetch(fileUrl);
          if (res.status === 404) throw new Error('File not found (404)');
          if (!res.ok) throw new Error(`Failed to fetch PDF: ${res.status}`);
          const buffer = await res.arrayBuffer();
          pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
          cachePdf(fileUrl, pdf);
        }
        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
        onPageChange?.(1, pdf.numPages);
      } catch (err: any) {
        if (retryCount < MAX_RETRIES && !err.message.includes('404') && navigator.onLine) {
          setRetryCount(c => c + 1);
          setTimeout(loadPdf, 1000);
        } else {
          setError(err.message || 'Error loading PDF');
        }
      } finally {
        setLoading(false);
      }
    }, [fileUrl, retryCount, getCachedPdf, cachePdf, onPageChange]);

    /**
     * Render a single page onto the canvas and text layer.
     */
    const renderPage = useCallback(
      async (pageNum: number) => {
        if (!pdfDoc) return;
        const slot = pageRefs.current[pageNum - 1];
        if (slot.renderTask) {
          try { slot.renderTask.cancel(); } catch {}
        }
        try {
          const page = await pdfDoc.getPage(pageNum);
          const viewport = page.getViewport({ scale });
          const canvas = slot.canvasRef;
          const textLayer = slot.textLayerRef;
          if (!canvas || !textLayer) return;

          // Resize canvas
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          // Prepare text layer
          Object.assign(textLayer.style, {
            position: 'absolute',
            top: '0',
            left: '0',
            width: `${viewport.width}px`,
            height: `${viewport.height}px`,
            opacity: '0.3',
          });
          textLayer.innerHTML = '';

          // Draw page
          const ctx = canvas.getContext('2d')!;
          const task = page.render({ canvasContext: ctx, viewport });
          slot.renderTask = task;
          await task.promise;

          // Overlay invisible text spans
          const textContent = await page.getTextContent();
          textContent.items.forEach((item: any) => {
            const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
            const fontHeight = Math.hypot(tx[2], tx[3]);
            const style = textContent.styles[item.fontName] || {};
            const span = document.createElement('span');
            span.textContent = item.str;
            Object.assign(span.style, {
              position: 'absolute',
              left: `${tx[4]}px`,
              top: `${tx[5] - fontHeight}px`,
              fontSize: `${fontHeight}px`,
              fontFamily: (style.fontFamily as string) || 'sans-serif',
              color: 'transparent',
              pointerEvents: 'all',
              userSelect: 'text',
            });
            textLayer.appendChild(span);
          });
        } catch (err) {
          console.error(`Error rendering page ${pageNum}:`, err);
        }
      },
      [pdfDoc, scale]
    );

    // Load PDF on everything-important change
    useEffect(() => {
      setRetryCount(0);
      loadPdf();
    }, [fileUrl, loadPdf]);

    // Lazy-render and track current page
    useEffect(() => {
      if (!pdfDoc || numPages === 0) return;

      const renderObserver = new IntersectionObserver(
        entries => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const idx = Number(entry.target.getAttribute('data-page-index'));
              renderPage(idx + 1);
              renderObserver.unobserve(entry.target);
            }
          });
        },
        { rootMargin: '200px 0px', threshold: 0.1 }
      );

      const pageObserver = new IntersectionObserver(
        entries => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const idx = Number(entry.target.getAttribute('data-page-index'));
              setCurrentPage(idx + 1);
              onPageChange?.(idx + 1, numPages);
            }
          });
        },
        { threshold: 0.5 }
      );

      pageRefs.current.forEach(slot => {
        if (slot.wrapperRef) {
          renderObserver.observe(slot.wrapperRef);
          pageObserver.observe(slot.wrapperRef);
        }
      });

      return () => {
        renderObserver.disconnect();
        pageObserver.disconnect();
      };
    }, [pdfDoc, numPages, renderPage, onPageChange]);

    // Cancel in-flight renders on unmount
    useEffect(() => () => {
      pageRefs.current.forEach(slot => {
        try { slot.renderTask?.cancel(); } catch {}
      });
    }, []);

    // Re-render pages on zoom change
    useEffect(() => {
      if (!pdfDoc) return;
      pageRefs.current.forEach((slot, idx) => {
        if (slot.canvasRef && slot.textLayerRef) {
          renderPage(idx + 1);
        }
      });
    }, [scale, pdfDoc, renderPage]);

    // Imperative navigation API
    const scrollToPage = useCallback(
      (page: number) => {
        const idx = Math.min(Math.max(page, 1), numPages) - 1;
        const wrapper = pageRefs.current[idx].wrapperRef;
        if (!wrapper) return;
        wrapper.scrollIntoView({ behavior: 'smooth' });
        setCurrentPage(idx + 1);
        onPageChange?.(idx + 1, numPages);
      },
      [numPages, onPageChange]
    );

    useImperativeHandle(
      ref,
      () => ({
        handlePrev: () => scrollToPage(currentPage - 1),
        handleNext: () => scrollToPage(currentPage + 1),
        handleGoTo: p => scrollToPage(p),
      }),
      [currentPage, scrollToPage]
    );

    /** Capture and store current selection */
    const captureSelection = () => {
      setLastSelection(getSelectedText());
    };

    /** Open context menu at (x,y) and capture selection */
    const openMenu = (e: React.MouseEvent, pageNum: number) => {
      e.preventDefault();
      captureSelection();
      setMenuState({ visible: true, x: e.clientX, y: e.clientY, pageNum });
    };

    /** Handle a context-menu action */
    const handleAction = async (action: PdfAction) => {
      if (!pdfDoc) return;
      const { pageNum } = menuState;
      const sel = lastSelection.trim();
      const textToUse = sel !== '' ? sel : await getPageText(pdfDoc, pageNum);

      // Visual feedback
      setHighlightedPages(prev => [...prev, pageNum]);
      setTimeout(() => {
        setHighlightedPages(prev => prev.filter(n => n !== pageNum));
      }, HIGHLIGHT_DURATION_MS);

      // Execute action
      switch (action) {
        case 'copy':
          await copyText(textToUse);
          break;
        case 'ask':
          await askAssistant(textToUse);
          break;
        case 'explore':
          await exploreTopic(textToUse);
          break;
        case 'quiz':
          await createQuiz(textToUse);
          break;
      }

      // Close menu
      setMenuState(ms => ({ ...ms, visible: false }));
    };

    // Loading & error states
    if (loading) return <div className="text-gray-500">Loading PDF...</div>;
    if (error)   return <div className="text-red-500">Error: {error}</div>;

    // Render pages, highlight overlays, and context menu
    return (
      <div
        className="flex flex-col items-center"
        style={{ backgroundColor: 'var(--right-pane-bg)' }}
        onMouseUp={captureSelection}
        onKeyUp={captureSelection}
      >
        {Array.from({ length: numPages }, (_, idx) => {
          const pageNum = idx + 1;
          const isHighlighted = highlightedPages.includes(pageNum);

          return (
            <div
              key={idx}
              ref={el => { pageRefs.current[idx].wrapperRef = el; }}
              data-page-index={idx}
              className="relative mb-4 first:mb-0"
              onContextMenu={e => openMenu(e, pageNum)}
            >
              <canvas
                ref={el => { pageRefs.current[idx].canvasRef = el; }}
                style={{ border: '1px solid #ccc' }}
              />
              <div
                ref={el => { pageRefs.current[idx].textLayerRef = el; }}
                className="textLayer"
              />
              {isHighlighted && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    backgroundColor: 'rgba(255,255,0,0.3)',
                    pointerEvents: 'none',
                    zIndex: 2,
                  }}
                />
              )}
            </div>
          );
        })}

        {menuState.visible && (
          <PdfContextMenu
            x={menuState.x}
            y={menuState.y}
            onSelect={handleAction}
            onClose={() => setMenuState(ms => ({ ...ms, visible: false }))}
          />
        )}
      </div>
    );
  }
);

PdfViewer.displayName = 'PdfViewer';
export default PdfViewer;
