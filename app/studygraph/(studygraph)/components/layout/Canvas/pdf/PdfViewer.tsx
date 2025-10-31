/***************************************************************************************************
 * @file PdfViewer.tsx
 * @description
 *   Production PDF viewer for React that coordinates document loading, a bounded render window,
 *   and selection actions—while enforcing **deterministic teardown** to arrest DOM-retention
 *   leaks observed during rapid file switching.
 *
 *   (new update - deterministic teardown)
 *   Before starting a different `fileUrl` and on unmount, we:
 *     1) Disconnect observers
 *     2) Release page slots (cancel, zero canvases, clear text)
 *     3) Hard-detach wrappers + null all refs (breaks closure-based retention)
 *     4) Delete old URL from LRU and **await waitForPdfDestructions()**
 *     5) Destroy any active loading task
 *
 *   (new update - hard-detach refs)
 *   `releasePageSlot()` now calls `wrapperRef.replaceChildren()` and nulls all refs so no live
 *   arrays/closures keep DOM nodes reachable.
 *
 *   (new update - layout guard)
 *   Root container enforces `overflow-x-hidden` and canvases/text layers cap at 100% width to
 *   eliminate horizontal overflow from text layer width creep.
 *
 * Responsibilities:
 *   1) Load exactly one PDF at a time (SingleFlight latest-wins).
 *   2) Maintain a 7-page live window (current ±3); prune everything else.
 *   3) Build text layers only for live pages to bound DOM size.
 *   4) Periodically hint `pdfDoc.cleanup()` to trim worker-side caches.
 *   5) Expose imperative navigation + context menu actions.
 *
 * Complexity:
 *   Control path O(1). Rendering O(W) with W ≤ 7. Memory bounded by window size.
 **************************************************************************************************/

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
import { SingleFlight, microDelay } from '@/app/Library/Context/pdf/SingleFlight';
import PdfContextMenu, { PdfAction } from '../PdfContextMenu';
import { getPageText, getSelectedText } from '../../../utils/pdfTextUtils';
import { copyText } from '../pdfActions';
import { useSelectionAttachment } from '@/app/Library/Context/SelectionAttachmentContext';

// Defensive fallback kept (legacy path)
(pdfjsLib as any).GlobalWorkerOptions.workerSrc =
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc;

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

/** Tracks per-page DOM/ref bindings and any in-flight render task. */
type PageSlot = {
  wrapperRef: HTMLDivElement | null;
  canvasRef: HTMLCanvasElement | null;
  textLayerRef: HTMLDivElement | null;
  renderTask?: RenderTask;
};

/** (new update - 7-page window) Window bounds around the current page. */
const WINDOW_BACK = 3;
const WINDOW_FORWARD = 3;

const PdfViewer = forwardRef<PdfViewerRefType, PdfViewerProps>(
  ({ fileUrl, scale = 1.0, onPageChange }, ref) => {
    /***********************************************************************************************
     * Context, state, and intent
     **********************************************************************************************/
    const {
      cachePdf,
      getCachedPdf,
      deleteCachedPdf,
      waitForPdfDestructions, // (new update - deterministic teardown)
    } = useViewSwitch();
    const { triggerAsk, triggerExplore, triggerQuiz } = useSelectionAttachment();
    const { worker, ready: workerReady } = usePdfJsWorker();

    // Limits cleanup collisions while painting
    const activeRendersRef = useRef(0);

    // Single-flight: only the latest navigation is allowed to resolve
    const singleFlightRef = useRef<SingleFlight>(new SingleFlight());

    // PDF state
    const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
    const [numPages, setNumPages] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState<number>(1);

    // Active loading task for deterministic teardown
    const loadingTaskRef = useRef<PDFDocumentLoadingTask | null>(null);

    // Context menu + selection state
    const [menuState, setMenuState] = useState<{ visible: boolean; x: number; y: number; pageNum: number }>(
      { visible: false, x: 0, y: 0, pageNum: 1 }
    );
    const [lastSelection, setLastSelection] = useState<string>('');
    const [highlightedPages, setHighlightedPages] = useState<number[]>([]);

    // Page refs for canvases/text layers
    const pageRefs = useRef<PageSlot[]>([]);
    const currentFileUrl = useRef<string>('');

    // (new update - deterministic teardown) Keep a handle to the page observer for early disconnect.
    const pageObserverRef = useRef<IntersectionObserver | null>(null);

    /***********************************************************************************************
     * Utilities
     **********************************************************************************************/

    /**
     * @function releasePageSlot
     * @description
     *   Cancel any in-flight render, zero canvases, clear text, hard-detach wrapper’s children,
     *   and NULL OUT ALL REFS to break any closure/array reachability.
     *   (new update - hard-detach refs)
     */
    const releasePageSlot = (slot: PageSlot) => {
      try { slot.renderTask?.cancel(); } catch { /* no-op */ }

      // Zero the bitmap
      if (slot.canvasRef) {
        slot.canvasRef.width = 0;
        slot.canvasRef.height = 0;
        const ctx = slot.canvasRef.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, 0, 0);
      }

      // Drop text spans
      if (slot.textLayerRef) {
        slot.textLayerRef.innerHTML = '';
      }

      // Hard-detach children so wrapper doesn't retain text/canvas nodes
      if (slot.wrapperRef) {
        try { slot.wrapperRef.replaceChildren(); } catch { /* no-op */ }
      }

      // (new update - hard-detach refs)
      slot.renderTask = undefined;
      slot.canvasRef = null;
      slot.textLayerRef = null;
      slot.wrapperRef = null;
    };

    /**
     * @function initializePageRefs
     * @description
     *   Release existing slots, then allocate a new array sized to pageCount.
     */
    const initializePageRefs = useCallback((pageCount: number) => {
      pageRefs.current.forEach(releasePageSlot);
      pageRefs.current = Array.from({ length: pageCount }, () => ({
        wrapperRef: null,
        canvasRef: null,
        textLayerRef: null,
        renderTask: undefined,
      }));
    }, []);

    /**
     * @function setPageRef
     * @description Attach element refs into the appropriate page slot by index.
     */
    const setPageRef = useCallback((idx: number, refType: keyof PageSlot, element: any) => {
      if (idx >= 0 && idx < pageRefs.current.length && pageRefs.current[idx]) {
        (pageRefs.current[idx] as any)[refType] = element;
      }
    }, []);

    /**
     * @function destroyActiveLoadingTask
     * @description Ensure the previous loading task is torn down before starting a new one.
     */
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

    /**
     * @function guardedSetState
     * @description Only run state changes if this call still owns the SingleFlight token.
     */
    const guardedSetState = useCallback((token: number, fn: () => void) => {
      if (singleFlightRef.current.isCurrent(token)) fn();
    }, []);

    /***********************************************************************************************
     * Windowed rendering
     **********************************************************************************************/

    /** True if page number belongs to the current render window. */
    const inWindow = useCallback(
      (p: number, current: number) =>
        p >= Math.max(1, current - WINDOW_BACK) && p <= Math.min(numPages, current + WINDOW_FORWARD),
      [numPages]
    );

    /**
     * @function renderPage
     * @description
     *   Paint page bitmap and (invisible) text layer. Skip if page slips out of window mid-flight.
     */
    const renderPage = useCallback(
      async (pageNum: number) => {
        if (!pdfDoc || pageNum < 1 || pageNum > numPages) return;

        // (window guard) avoid painting outside the window
        if (!inWindow(pageNum, currentPage)) return;

        activeRendersRef.current += 1;
        const idx = pageNum - 1;
        const slot = pageRefs.current[idx];
        if (!slot) {
          activeRendersRef.current = Math.max(0, activeRendersRef.current - 1);
          return;
        }

        if (slot.renderTask) {
          try { slot.renderTask.cancel(); } catch { /* no-op */ }
        }

        try {
          const page = await pdfDoc.getPage(pageNum);
          const viewport = page.getViewport({ scale });
          const canvas = slot.canvasRef;
          const textLayer = slot.textLayerRef;
          if (!canvas || !textLayer) {
            activeRendersRef.current = Math.max(0, activeRendersRef.current - 1);
            return;
          }

          // Resize canvas to match viewport (bitmap only; CSS clamps width visually)
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          // Prepare text layer container
          Object.assign(textLayer.style, {
            position: 'absolute',
            top: '0',
            left: '0',
            width: `${viewport.width}px`,
            height: `${viewport.height}px`,
            maxWidth: '100%',           // (new update - layout guard)
            overflow: 'hidden',         // (new update - layout guard)
            opacity: '0.3',
          });
          textLayer.innerHTML = '';

          // Paint bitmap using PDF.js renderer
          const ctx = canvas.getContext('2d')!;
          const task = (page as any).render({ canvasContext: ctx, viewport });
          slot.renderTask = task;
          await task.promise;

          // Hint to drop per-page caches
          try { (page as any).cleanup?.(); } catch { /* no-op */ }
          finally { activeRendersRef.current = Math.max(0, activeRendersRef.current - 1); }

          // Build text spans only if still inside the window
          if (!inWindow(pageNum, currentPage)) {
            textLayer.innerHTML = '';
            return;
          }

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
        } catch {
          // Swallow per-page render errors to keep viewer resilient.
        }
      },
      [pdfDoc, scale, numPages, inWindow, currentPage]
    );

    /**
     * @function ensurePageInWindow
     * @description Reconcile a single page against the window: prune or render.
     */
    const ensurePageInWindow = useCallback(
      async (pageNum: number) => {
        if (!pdfDoc) return;
        const slot = pageRefs.current[pageNum - 1];
        if (!slot) return;

        if (!inWindow(pageNum, currentPage)) {
          try { slot.renderTask?.cancel(); } catch { /* no-op */ }
          if (slot.canvasRef) {
            slot.canvasRef.width = 0;
            slot.canvasRef.height = 0;
            const ctx = slot.canvasRef.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, 0, 0);
          }
          if (slot.textLayerRef) {
            slot.textLayerRef.innerHTML = '';
          }
          return;
        }

        await renderPage(pageNum);
      },
      [pdfDoc, currentPage, inWindow, renderPage]
    );

    /**
     * @function updateRenderWindow
     * @description The single switchboard enforcing "only 7 live pages".
     */
    const updateRenderWindow = useCallback(() => {
      if (!pdfDoc || numPages === 0) return;
      for (let p = 1; p <= numPages; p += 1) {
        void ensurePageInWindow(p);
      }
    }, [pdfDoc, numPages, ensurePageInWindow]);

    /***********************************************************************************************
     * Document load (+ deterministic teardown sequencing)
     **********************************************************************************************/

    /**
     * @function loadPdf
     * @description
     *   Cache-first, single-flight loader that also enforces *blocking* destruction when switching
     *   between different URLs. This achieves the “no overlapping lifetimes” requirement.
     *
     *   (new update - deterministic teardown)
     *   If `currentFileUrl` differs from incoming `fileUrl`, we:
     *     1) Disconnect observer
     *     2) Release+null page refs
     *     3) deleteCachedPdf(oldUrl) → await waitForPdfDestructions()
     *     4) await destroyActiveLoadingTask()
     *     5) Reset state and proceed to load the new file
     */
    const loadPdf = useCallback(async () => {
      const { token, signal } = singleFlightRef.current.begin();

      guardedSetState(token, () => {
        setLoading(true);
        setError(null);
      });

      // (new update - deterministic teardown) Do full blocking destruction before switching URLs
      if (currentFileUrl.current && currentFileUrl.current !== fileUrl) {
        // 1) Disconnect observers first to avoid holding targets
        try { pageObserverRef.current?.disconnect(); } catch { /* no-op */ }

        // 2) Release all slots + null refs
        pageRefs.current.forEach(releasePageSlot);
        pageRefs.current = [];

        // 3) Evict old URL & await full destruction chain
        deleteCachedPdf(currentFileUrl.current);
        await waitForPdfDestructions();

        // 4) Ensure no active loading task survives
        await destroyActiveLoadingTask();

        // 5) Reset core state
        guardedSetState(token, () => {
          setNumPages(0);
          setPdfDoc(null);
          initializePageRefs(0);
        });
      }

      // Record the current URL we're going after
      currentFileUrl.current = fileUrl;

      let attempt = 0;
      const max = MAX_RETRIES;
      let lastErr: any = null;

      while (attempt < max) {
        if (!singleFlightRef.current.isCurrent(token)) return;

        try {
          // --- Cache path with health probe ---
          let cached = getCachedPdf(fileUrl);
          if (cached) {
            try { await cached.getPage(1); }
            catch { deleteCachedPdf(fileUrl); cached = undefined; }
          }

          if (cached) {
            if (!singleFlightRef.current.isCurrent(token)) return;
            guardedSetState(token, () => {
              initializePageRefs(cached!.numPages);
              setPdfDoc(cached!);
              setNumPages(cached!.numPages);
              setLoading(false);
              onPageChange?.(1, cached!.numPages);
            });
            return;
          }

          // --- Network path ---
          const res = await fetch(fileUrl, { signal });
          if (!singleFlightRef.current.isCurrent(token)) return;
          if (res.status === 404) throw new Error('File not found (404)');
          if (!res.ok) throw new Error(`Failed to fetch PDF: ${res.status}`);

          const buffer = await res.arrayBuffer();
          if (!singleFlightRef.current.isCurrent(token)) return;

          // Disable speculative auto-fetch to reduce churn
          const loadingTask = (pdfjsLib as any).getDocument(
            workerReady && worker
              ? { data: buffer, worker, disableAutoFetch: true }
              : { data: buffer, disableAutoFetch: true }
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
            setLoading(false);
            onPageChange?.(1, doc.numPages);
          });
          return;
        } catch (err: any) {
          if (!singleFlightRef.current.isCurrent(token)) return;
          if (err?.name === 'AbortError') return;

          lastErr = err;
          if (String(err?.message).includes('404') || !navigator.onLine) break;

          attempt += 1;
          if (attempt >= max) break;
          await microDelay(250 * Math.pow(2, attempt - 1));
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
      waitForPdfDestructions, // (new update - deterministic teardown)
    ]);

    // Kick off (or refresh) load on URL changes
    useEffect(() => {
      loadPdf();
      const sf = singleFlightRef.current;
      return () => { sf.cancelPrevious(); };
    }, [fileUrl, loadPdf]);

    /***********************************************************************************************
     * Track current page (drives render window)
     **********************************************************************************************/
    useEffect(() => {
      if (!pdfDoc || numPages === 0) return;

      // Disconnect any previous observer before creating a new one (paranoia)
      try { pageObserverRef.current?.disconnect(); } catch { /* no-op */ }

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

      pageObserverRef.current = pageObserver;

      pageRefs.current.forEach((slot) => {
        if (slot?.wrapperRef) pageObserver.observe(slot.wrapperRef);
      });

      return () => {
        // (new update - deterministic teardown) Disconnect first so targets can GC
        try { pageObserver.disconnect(); } catch { /* no-op */ }
        if (pageObserverRef.current === pageObserver) {
          pageObserverRef.current = null;
        }
      };
    }, [pdfDoc, numPages, onPageChange]);

    /***********************************************************************************************
     * Window driver: reconcile whenever current page/scale/pageCount changes
     **********************************************************************************************/
    useEffect(() => {
      updateRenderWindow();
    }, [currentPage, pdfDoc, scale, numPages, updateRenderWindow]);

    /***********************************************************************************************
     * Unmount cleanup (block until previous PDF fully destroyed)
     **********************************************************************************************/
    useEffect(() => {
      const sf = singleFlightRef.current;
      return () => {
        // 1) Disconnect observer first
        try { pageObserverRef.current?.disconnect(); } catch { /* no-op */ }
        pageObserverRef.current = null;

        // 2) Release every slot & null refs
        pageRefs.current.forEach(releasePageSlot);
        pageRefs.current = [];

        // 3) Evict cached URL (queued destruction)
        if (currentFileUrl.current) deleteCachedPdf(currentFileUrl.current);

        // 4) Cancel any pending single-flight + drop loading task ref
        sf.cancelPrevious();
        loadingTaskRef.current = null;

        // 5) (new update - deterministic teardown) Await destruction queue (fire-and-forget here)
        void waitForPdfDestructions();
      };
    }, [deleteCachedPdf, waitForPdfDestructions]);

    /***********************************************************************************************
     * Periodic doc-level cleanup: hint PDF.js to trim safe caches after activity settles
     **********************************************************************************************/
    useEffect(() => {
      if (!pdfDoc) return;
      let cancelled = false;

      const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

      const schedule = async () => {
        await sleep(2000);
        if (cancelled) return;

        if (activeRendersRef.current > 0) {
          await sleep(2000);
          if (cancelled) return;
          if (activeRendersRef.current > 0) return;
        }

        try { (pdfDoc as any).cleanup?.(); } catch { /* no-op */ }
      };

      schedule();
      return () => { cancelled = true; };
    }, [pdfDoc, currentPage]);

    /***********************************************************************************************
     * Imperative navigation
     **********************************************************************************************/
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

    /***********************************************************************************************
     * Selection helpers + context menu actions
     **********************************************************************************************/
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
        case 'copy':    await copyText(textToUse); break;
        case 'ask':     triggerAsk(textToUse);     break;
        case 'explore': triggerExplore(textToUse); break;
        case 'quiz':    triggerQuiz(textToUse);    break;
      }
      setMenuState((ms) => ({ ...ms, visible: false }));
    };

    /***********************************************************************************************
     * Render
     **********************************************************************************************/
    if (loading) return <div className="text-gray-500">Loading PDF...</div>;
    if (error)   return <div className="text-red-500">Error: {error}</div>;

    return (
      <div
        className="flex flex-col items-center w-full overflow-x-hidden"  // (new update - layout guard)
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
              style={{ maxWidth: '100%', overflowX: 'hidden' }}  // (new update - layout guard)
              onContextMenu={(e) => openMenu(e, pageNum)}
            >
              <canvas
                ref={(el) => setPageRef(idx, 'canvasRef', el)}
                // (new update - layout guard) ensure no horizontal creep
                style={{ display: 'block', maxWidth: '100%', border: '1px solid #ccc' }}
              />
              <div
                ref={(el) => setPageRef(idx, 'textLayerRef', el)}
                className="textLayer"
                style={{ maxWidth: '100%', overflow: 'hidden' }} // (new update - layout guard)
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
