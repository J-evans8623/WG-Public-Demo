// components/PdfViewer.tsx

/**
 * @file PdfViewer.tsx
 * @description
 *   React component to display a multi-page PDF with:
 *     - Lazy rendering, invisible selectable text layer.
 *     - Custom context menu for Copy / Ask / Explore / Quiz.
 *     - Full-page text fallback if nothing selected.
 *     - Visual flash feedback on action.
 *     - Centralized “attachment” routing into Chat/Topic/Quiz flows.
 *
 * Responsibilities:
 *   - Load & cache PDF via PDF.js with retry logic.
 *   - Render pages on scroll via IntersectionObserver.
 *   - Capture text selection & preserve it across right-click.
 *   - Delegate menu actions: copy vs. trigger our attachment context.
 *   - Highlight page briefly when an action runs.
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
import { copyText } from './pdfActions'; 
import { useSelectionAttachment } from '@/app/Library/Context/SelectionAttachmentContext';

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

const MAX_RETRIES = 3;
const HIGHLIGHT_DURATION_MS = 800;

type PageSlot = {
  wrapperRef: HTMLDivElement | null;
  canvasRef: HTMLCanvasElement | null;
  textLayerRef: HTMLDivElement | null;
  renderTask?: RenderTask;
};

const PdfViewer = forwardRef<PdfViewerRefType, PdfViewerProps>(
  ({ fileUrl, scale = 1.0, onPageChange }, ref) => {
    const { cachePdf, getCachedPdf } = useViewSwitch();
    const { triggerAsk, triggerExplore, triggerQuiz } = useSelectionAttachment();

    // PDF document & state
    const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
    const [numPages, setNumPages] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState<number>(0);
    const [currentPage, setCurrentPage] = useState<number>(1);

    // Context menu
    const [menuState, setMenuState] = useState<{ visible: boolean; x: number; y: number; pageNum: number }>({
      visible: false,
      x: 0,
      y: 0,
      pageNum: 1,
    });

    // Selection & highlights
    const [lastSelection, setLastSelection] = useState<string>('');
    const [highlightedPages, setHighlightedPages] = useState<number[]>([]);

    // Page refs
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
     * Load PDF with retry logic.
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
     * Render a page into its canvas & text layer.
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

          // Resize
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

          // Draw PDF
          const ctx = canvas.getContext('2d')!;
          const task = page.render({ canvasContext: ctx, viewport });
          slot.renderTask = task;
          await task.promise;

          // Invisible text spans
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

    // Kick off load
    useEffect(() => {
      setRetryCount(0);
      loadPdf();
    }, [fileUrl, loadPdf]);

    // Observe pages for lazy render & current-page tracking
    useEffect(() => {
      if (!pdfDoc || numPages === 0) return;
      const renderObserver = new IntersectionObserver(
        ents => {
          ents.forEach(e => {
            if (e.isIntersecting) {
              const idx = Number(e.target.getAttribute('data-page-index'));
              renderPage(idx + 1);
              renderObserver.unobserve(e.target);
            }
          });
        },
        { rootMargin: '200px 0px', threshold: 0.1 }
      );
      const pageObserver = new IntersectionObserver(
        ents => {
          ents.forEach(e => {
            if (e.isIntersecting) {
              const idx = Number(e.target.getAttribute('data-page-index'));
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

    // Re-render on zoom change
    useEffect(() => {
      if (!pdfDoc) return;
      pageRefs.current.forEach((_, idx) => {
        if (pageRefs.current[idx].canvasRef && pageRefs.current[idx].textLayerRef) {
          renderPage(idx + 1);
        }
      });
    }, [scale, pdfDoc, renderPage]);

    // Imperative handles: prev/next/goTo
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

    // Capture selection on mouse/key up
    const captureSelection = () => setLastSelection(getSelectedText());

    // Right-click opens menu & captures
    const openMenu = (e: React.MouseEvent, pageNum: number) => {
      e.preventDefault();
      captureSelection();
      setMenuState({ visible: true, x: e.clientX, y: e.clientY, pageNum });
    };

    // Handle user action from the context menu
    const handleAction = async (action: PdfAction) => {
      if (!pdfDoc) return;
      const { pageNum } = menuState;
      const sel = lastSelection.trim();
      const textToUse = sel !== '' ? sel : await getPageText(pdfDoc, pageNum);

      // Flash highlight
      setHighlightedPages(prev => [...prev, pageNum]);
      setTimeout(() => {
        setHighlightedPages(prev => prev.filter(n => n !== pageNum));
      }, HIGHLIGHT_DURATION_MS);

      // Delegate
      switch (action) {
        case 'copy':
          await copyText(textToUse);
          break;
        case 'ask':
          triggerAsk(textToUse);
          break;
        case 'explore':
          triggerExplore(textToUse);
          break;
        case 'quiz':
          triggerQuiz(textToUse);
          break;
      }

      // Close menu
      setMenuState(ms => ({ ...ms, visible: false }));
    };

    // Loading / error
    if (loading) return <div className="text-gray-500">Loading PDF...</div>;
    if (error) return <div className="text-red-500">Error: {error}</div>;

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
                    top: 0, left: 0,
                    width: '100%', height: '100%',
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
