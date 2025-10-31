// app/Library/components/PdfViewer/PdfViewer.tsx (original showing correct jsx styling)
/**
 * @file PdfViewer.tsx
 * @description
 *   The PDF viewer coordinates document loading, lazy page rendering, and selection actions
 *   while enforcing the Phase 1–3 stability guarantees. It integrates (a) the shared worker from
 *   `PdfJsWorkerProvider` to eliminate worker swarms, (b) **single-flight** loading so only the
 *   latest navigation can resolve, (c) deterministic destruction when switching files, and now in
 *   **Phase 3** (this update) (d) memory caps and safer defaults: we enable `disableAutoFetch: true`
 *   to stop speculative streaming when users switch quickly and add a lightweight `pdfDoc.cleanup()`
 *   pass after loads/scrolling so worker-side glyph/image caches don’t linger. Rendering behavior,
 *   DOM, and CSS classes are unchanged; changes are limited to loading options and cleanup hooks.
 *
 * Responsibilities:
 *   1) Load exactly one document at a time (latest-wins via SingleFlight).
 *   2) Use the shared PDF.js worker when available; fallback remains intact.
 *   3) Render pages lazily with intersection observers; keep page cleanup.
 *   4) Trim caches (`page.cleanup()` + periodic `pdfDoc.cleanup()`) to contain memory.
 *   5) Expose imperative scrolling and context menu actions; preserve UI/UX contracts.
 *
 * Complexity:
 *   Control path is O(1). Rendering work is O(N) in pages actually displayed. Observers are O(N)
 *   across visible slots; no unbounded structures are introduced.
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
import type {
  PDFDocumentProxy,
  RenderTask,
  PDFDocumentLoadingTask,
} from 'pdfjs-dist/types/src/display/api';
import { useViewSwitch } from '@/app/Library/Context/pdf/ViewSwitchContext';
import { usePdfJsWorker } from '@/app/Library/Context/pdf/PdfJsWorkerProvider';
import { SingleFlight, microDelay } from '@/app/Library/Context/pdf/SingleFlight'; // (existing)
import PdfContextMenu, { PdfAction } from '../../PdfContextMenu';
import { getPageText, getSelectedText } from '../../../../utils/pdfTextUtils';
import { copyText } from '../../pdfActions';
import { useSelectionAttachment } from '@/app/Library/Context/SelectionAttachmentContext';

// Defensive fallback (legacy path)
(pdfjsLib as any).GlobalWorkerOptions.workerSrc =
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc ||
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
    const { cachePdf, getCachedPdf, deleteCachedPdf } = useViewSwitch();
    const { triggerAsk, triggerExplore, triggerQuiz } = useSelectionAttachment();
    const { worker, ready: workerReady } = usePdfJsWorker();

    // Single-flight coord
    const singleFlightRef = useRef<SingleFlight>(new SingleFlight());

    // State
    const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
    const [numPages, setNumPages] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState<number>(1);

    // Active loading task
    const loadingTaskRef = useRef<PDFDocumentLoadingTask | null>(null);

    // Context menu state
    const [menuState, setMenuState] = useState<{ visible: boolean; x: number; y: number; pageNum: number }>(
      { visible: false, x: 0, y: 0, pageNum: 1 }
    );

    // Selection & highlight
    const [lastSelection, setLastSelection] = useState<string>('');
    const [highlightedPages, setHighlightedPages] = useState<number[]>([]);

    // Page refs
    const pageRefs = useRef<PageSlot[]>([]);
    const currentFileUrl = useRef<string>('');

    // ---------- Helpers ----------
    const releasePageSlot = (slot: PageSlot) => {
      try { slot.renderTask?.cancel(); } catch { /* no-op */ }
      if (slot.canvasRef) {
        slot.canvasRef.width = 0;
        slot.canvasRef.height = 0;
        const ctx = slot.canvasRef.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, 0, 0);
      }
      if (slot.textLayerRef) slot.textLayerRef.innerHTML = '';
    };

    const initializePageRefs = useCallback((pageCount: number) => {
      pageRefs.current.forEach(releasePageSlot);
      pageRefs.current = Array.from({ length: pageCount }, () => ({
        wrapperRef: null,
        canvasRef: null,
        textLayerRef: null,
        renderTask: undefined,
      }));
    }, []);

    const setPageRef = useCallback((idx: number, refType: keyof PageSlot, element: any) => {
      if (idx >= 0 && idx < pageRefs.current.length && pageRefs.current[idx]) {
        pageRefs.current[idx][refType] = element;
      }
    }, []);

    const destroyActiveLoadingTask = useCallback(async () => {
      if (loadingTaskRef.current) {
        try {
          await loadingTaskRef.current.destroy();
        } catch { /* no-op */ }
        finally {
          loadingTaskRef.current = null;
        }
        await microDelay(80);
      }
    }, []);

    const guardedSetState = useCallback(
      (token: number, fn: () => void) => {
        if (singleFlightRef.current.isCurrent(token)) fn();
      },
      []
    );

    /**
     * @function renderPage
     * @description
     *   Render a page to its canvas and build an invisible text layer to preserve selection.
     *   Cancels in-flight renders per page and calls `page.cleanup()` after painting to reduce
     *   per-page memory. Complexity is O(1) per call; aggregate work is proportional to pages drawn.
     */
    const renderPage = useCallback(
      async (pageNum: number) => {
        if (!pdfDoc || pageNum < 1 || pageNum > numPages) return;

        const idx = pageNum - 1;
        if (idx >= pageRefs.current.length || !pageRefs.current[idx]) return;

        const slot = pageRefs.current[idx];
        if (slot.renderTask) {
          try { slot.renderTask.cancel(); } catch { /* no-op */ }
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

          // Paint
          const ctx = canvas.getContext('2d')!;
          const task = (page as any).render({ canvasContext: ctx, viewport });
          slot.renderTask = task;
          await task.promise;
          try { (page as any).cleanup?.(); } catch { /* no-op */ }

          // Build invisible text spans
          const textContent = await page.getTextContent();
          textContent.items.forEach((item: any) => {
            const tx = (pdfjsLib as any).Util.transform(viewport.transform, item.transform);
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
      [pdfDoc, scale, numPages]
    );

    /**
     * @function loadPdf
     * @description
     *   Single-flight, cache-first loader with deterministic teardown and Phase-3 defaults.
     *   Important Phase-3 changes:
     *   (1) pass `disableAutoFetch: true` to stop speculative streaming during quick switches,
     *   (2) keep all previous guards, retries, and fallback behavior unchanged.
     */
    const loadPdf = useCallback(async () => {
      const { token, signal } = singleFlightRef.current.begin();

      guardedSetState(token, () => {
        setLoading(true);
        setError(null);
      });

      if (currentFileUrl.current !== fileUrl) {
        pageRefs.current.forEach(releasePageSlot);
        pageRefs.current = [];
        await destroyActiveLoadingTask();
        guardedSetState(token, () => {
          setNumPages(0);
          setPdfDoc(null);
          initializePageRefs(0);
          currentFileUrl.current = fileUrl;
        });
      }

      let attempt = 0;
      const max = MAX_RETRIES;
      let lastErr: any = null;

      while (attempt < max) {
        if (!singleFlightRef.current.isCurrent(token)) return;

        try {
          // Cache path with health probe
          let cached = getCachedPdf(fileUrl);
          if (cached) {
            try { await cached.getPage(1); } catch { deleteCachedPdf(fileUrl); cached = undefined; }
          }

          if (cached) {
            if (!singleFlightRef.current.isCurrent(token)) return;
            guardedSetState(token, () => {
              initializePageRefs(cached!.numPages);
              setPdfDoc(cached!);
              setNumPages(cached!.numPages);
              onPageChange?.(1, cached!.numPages);
              setLoading(false);
            });
            return;
          }

          // Network fetch with abort
          const res = await fetch(fileUrl, { signal });
          if (!singleFlightRef.current.isCurrent(token)) return;
          if (res.status === 404) throw new Error('File not found (404)');
          if (!res.ok) throw new Error(`Failed to fetch PDF: ${res.status}`);

          const buffer = await res.arrayBuffer();
          if (!singleFlightRef.current.isCurrent(token)) return;

          // update - 2: Phase-3 default — disableAutoFetch to curb speculative streaming.
          const loadingTask = (pdfjsLib as any).getDocument(
            workerReady && worker
              ? { data: buffer, worker, disableAutoFetch: true } // update - 2
              : { data: buffer, disableAutoFetch: true }         // update - 2
          ) as PDFDocumentLoadingTask;

          loadingTaskRef.current = loadingTask;

          const doc = (await loadingTask.promise) as PDFDocumentProxy;
          if (!singleFlightRef.current.isCurrent(token)) {
            try { await loadingTask.destroy(); } catch { /* no-op */ }
            await microDelay(20);
            return;
          }

          cachePdf(fileUrl, doc, loadingTask);
          loadingTaskRef.current = null;

          guardedSetState(token, () => {
            initializePageRefs(doc.numPages);
            setPdfDoc(doc);
            setNumPages(doc.numPages);
            onPageChange?.(1, doc.numPages);
            setLoading(false);
          });
          return;
        } catch (err: any) {
          if (!singleFlightRef.current.isCurrent(token)) return;
          if (err?.name === 'AbortError') return;

          lastErr = err;
          if (String(err?.message).includes('404') || !navigator.onLine) break;

          attempt += 1;
          if (attempt >= max) break;
          const backoff = 250 * Math.pow(2, attempt - 1);
          await microDelay(backoff);
        }
      }

      if (singleFlightRef.current.isCurrent(token)) {
        setError(lastErr?.message || 'Error loading PDF');
        setLoading(false);
      }
    }, [
      fileUrl,
      worker,
      workerReady,
      onPageChange,
      getCachedPdf,
      deleteCachedPdf,
      cachePdf,
      destroyActiveLoadingTask,
      guardedSetState,
      initializePageRefs,
    ]);

    // Kick off load on URL change; capture ref for cleanup
    useEffect(() => {
      loadPdf();
      const sf = singleFlightRef.current;
      return () => { sf.cancelPrevious(); };
    }, [fileUrl, loadPdf]);

    // Lazy render + current page tracking; include renderPage in deps (already ordered above)
    useEffect(() => {
      if (!pdfDoc || numPages === 0) return;

      const renderObserver = new IntersectionObserver(
        (ents) => {
          ents.forEach((e) => {
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
        (ents) => {
          ents.forEach((e) => {
            if (e.isIntersecting) {
              const idx = Number(e.target.getAttribute('data-page-index'));
              setCurrentPage(idx + 1);
              onPageChange?.(idx + 1, numPages);
            }
          });
        },
        { threshold: 0.5 }
      );

      pageRefs.current.forEach((slot) => {
        if (slot?.wrapperRef) {
          renderObserver.observe(slot.wrapperRef);
          pageObserver.observe(slot.wrapperRef);
        }
      });

      return () => {
        renderObserver.disconnect();
        pageObserver.disconnect();
      };
    }, [pdfDoc, numPages, onPageChange, renderPage]);

    /**
     * @effect Unmount cleanup
     * @description
     *   Cancel page tasks, evict current URL (queued destruction), and abort inflight network.
     */
    useEffect(() => {
      const sf = singleFlightRef.current;
      return () => {
        pageRefs.current.forEach(releasePageSlot);
        pageRefs.current = [];
        if (currentFileUrl.current) deleteCachedPdf(currentFileUrl.current);
        sf.cancelPrevious();
        loadingTaskRef.current = null;
      };
    }, [deleteCachedPdf]);

    /**
     * @effect Phase-3 doc-level cleanup (lightweight)
     * @description
     *   After a document becomes active (and intermittently when navigating pages), ask PDF.js to
     *   trim internal caches that are safe to release. This is a best-effort hint and inexpensive.
     *   We debounce by page to avoid excessive calls during fast scrolling.
     */
    useEffect(() => {
      if (!pdfDoc) return;
      let cancelled = false;
      const id = setTimeout(() => {
        if (!cancelled) {
          try { (pdfDoc as any).cleanup?.(); } catch { /* no-op */ }
        }
      }, 120); // small debounce window
      return () => { cancelled = true; clearTimeout(id); };
    }, [pdfDoc, currentPage]); // update - 3: new Phase-3 cleanup hook

    // Re-render on zoom change (lazy)
    useEffect(() => {
      if (!pdfDoc) return;
      pageRefs.current.forEach((_, idx) => {
        const wrapper = pageRefs.current[idx]?.wrapperRef;
        if (wrapper && wrapper.getBoundingClientRect().height > 0) {
          renderPage(idx + 1);
        }
      });
    }, [scale, pdfDoc, renderPage]);

    // Imperative handles
    const scrollToPage = useCallback(
      (page: number) => {
        const idx = Math.min(Math.max(page, 1), numPages) - 1;
        if (idx >= 0 && idx < pageRefs.current.length) {
          const wrapper = pageRefs.current[idx]?.wrapperRef;
          if (wrapper) {
            wrapper.scrollIntoView({ behavior: 'smooth' });
            setCurrentPage(idx + 1);
            onPageChange?.(idx + 1, numPages);
          }
        }
      },
      [numPages, onPageChange]
    );

    useImperativeHandle(
      ref,
      () => ({
        handlePrev: () => scrollToPage(currentPage - 1),
        handleNext: () => scrollToPage(currentPage + 1),
        handleGoTo: (p) => scrollToPage(p),
      }),
      [currentPage, scrollToPage]
    );

    // Selection helpers & menu
    const captureSelection = () => setLastSelection(getSelectedText());
    const openMenu = (e: React.MouseEvent, pageNum: number) => {
      e.preventDefault();
      captureSelection();
      setMenuState({ visible: true, x: e.clientX, y: e.clientY, pageNum });
    };
    const handleAction = async (action: PdfAction) => {
      if (!pdfDoc) return;
      const { pageNum } = menuState;
      const sel = lastSelection.trim();
      const textToUse = sel !== '' ? sel : await getPageText(pdfDoc, pageNum);

      setHighlightedPages((prev) => [...prev, pageNum]);
      setTimeout(() => {
        setHighlightedPages((prev) => prev.filter((n) => n !== pageNum));
      }, HIGHLIGHT_DURATION_MS);

      switch (action) {
        case 'copy':   await copyText(textToUse); break;
        case 'ask':    triggerAsk(textToUse);     break;
        case 'explore':triggerExplore(textToUse);  break;
        case 'quiz':   triggerQuiz(textToUse);     break;
      }
      setMenuState((ms) => ({ ...ms, visible: false }));
    };

    // Loading / error
    if (loading) return <div className="text-gray-500">Loading PDF...</div>;
    if (error)   return <div className="text-red-500">Error: {error}</div>;

    return (
      <div
        className="flex flex-col items-center"
        style={{ backgroundColor: '#FDFDF8' }}
        onMouseUp={captureSelection}
        onKeyUp={captureSelection}
      >
        {Array.from({ length: numPages }, (_, idx) => {
          const pageNum = idx + 1;
          const isHighlighted = highlightedPages.includes(pageNum);
          return (
            <div
              key={`${fileUrl}-${idx}`}
              ref={(el) => setPageRef(idx, 'wrapperRef', el)}
              data-page-index={idx}
              className="relative mb-4 first:mb-0"
              onContextMenu={(e) => openMenu(e, pageNum)}
            >
              <canvas
                ref={(el) => setPageRef(idx, 'canvasRef', el)}
                style={{ border: '1px solid #ccc' }}
              />
              <div
                ref={(el) => setPageRef(idx, 'textLayerRef', el)}
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
            onClose={() => setMenuState((ms) => ({ ...ms, visible: false }))}
          />
        )}
      </div>
    );
  }
);

PdfViewer.displayName = 'PdfViewer';
export default PdfViewer;
