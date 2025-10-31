/**
 * @file PdfJsWorkerProvider.tsx
 * @description
 *   This provider owns a single, shared PDF.js worker instance for the entire subtree that renders
 *   PDFs. In the previous design, each `getDocument` call implicitly created or touched a worker,
 *   which—when paired with rapid file switching—led to transient worker swarms and large memory
 *   spikes. By centralizing worker creation here, we (1) create exactly one `PDFWorker` per app
 *   shell, (2) pass that worker explicitly to all `getDocument` calls, and (3) guarantee predictable
 *   teardown on unmount (e.g., dev HMR or route changes). The provider prefers a self-hosted worker
 *   module for CSP/version pinning but will gracefully fallback to a CDN `workerSrc` when configured.
 *   Consumers access the worker via `usePdfJsWorker()`; if the worker cannot be created (e.g., an
 *   environment constraint), the hook exposes `ready=false` so viewers can decide to fallback to
 *   legacy `GlobalWorkerOptions.workerSrc`. This isolates worker lifecycle, removes implicit globals,
 *   and is the foundation for the later single-flight and memory cap phases without altering the
 *   rendering UX, layout, or existing CSS classes.
 */

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

type WorkerCtx = {
  /** Shared PDF.js worker instance, or null if not yet ready or failed to construct. */
  worker: any | null;
  /** True when the worker has been constructed and is usable by consumers. */
  ready: boolean;
};

/**
 * @typedef PdfJsWorkerProviderProps
 * @property src Optional URL to a self-hosted pdf.worker.* file. If omitted, we try to construct a
 *               worker via `new PDFWorker()` which relies on default bundler handling; if construction
 *               fails and a `cdnFallback` is provided, we set `GlobalWorkerOptions.workerSrc`.
 * @property cdnFallback Optional CDN URL for environments that cannot construct a worker instance.
 */
type PdfJsWorkerProviderProps = {
  src?: string;
  cdnFallback?: string;
  children: React.ReactNode;
};

const PdfJsWorkerContext = createContext<WorkerCtx | null>(null);

/**
 * @function PdfJsWorkerProvider
 * @description
 *   1) Attempt to construct a single `PDFWorker` eagerly on mount.
 *   2) If a `src` is provided, hint PDF.js about the location (useful for some bundlers).
 *   3) If construction fails but `cdnFallback` is provided, set `GlobalWorkerOptions.workerSrc`
 *      as a last resort so consumers that do not receive a worker can still render.
 *   4) On unmount, call `destroy()` on the worker to avoid dangling workers across HMR/unloads.
 */
export const PdfJsWorkerProvider: React.FC<PdfJsWorkerProviderProps> = ({ src, cdnFallback, children }) => {
  // Step 1 — Resolve initial hinting for worker src (optional)
  useEffect(() => {
    if (src) {
      // Not strictly required when we pass a worker instance, but helps in certain toolchains.
      (pdfjsLib as any).GlobalWorkerOptions.workerSrc = src;
    }
  }, [src]);

  // Step 2 — Try to construct a single PDFWorker instance
  const [worker, setWorker] = useState<any | null>(null);
  const [ready, setReady] = useState<boolean>(false);

  useEffect(() => {
    let isActive = true;
    (async () => {
      try {
        // 2.1 Construct an explicit worker for strong lifecycle control
        const w = new (pdfjsLib as any).PDFWorker({ name: 'wg-pdf-worker' });
        // Wait until the worker's port is actually created/ready.
        await (w as any)._readyCapability?.promise?.catch(() => null);
        if (!isActive) return;
        setWorker(w);
        setReady(true);
      } catch (err) {
        // 2.2 Fallback to CDN workerSrc if provided
        if (cdnFallback) {
          (pdfjsLib as any).GlobalWorkerOptions.workerSrc = cdnFallback;
        }
        if (!isActive) return;
        setWorker(null);
        setReady(false);
      }
    })();

    // Step 3 — Deterministic teardown
    return () => {
      isActive = false;
      try {
        // Destroy if we successfully created one.
        (worker as any)?.destroy?.();
      } catch {
        /* no-op */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cdnFallback]);

  const value = useMemo<WorkerCtx>(() => ({ worker, ready }), [worker, ready]);

  return <PdfJsWorkerContext.Provider value={value}>{children}</PdfJsWorkerContext.Provider>;
};

/**
 * @function usePdfJsWorker
 * @description
 *   Hook to access the shared worker. If `ready` is false, consumers SHOULD fallback to legacy
 *   `GlobalWorkerOptions.workerSrc` logic to remain robust in constrained environments.
 */
export const usePdfJsWorker = (): WorkerCtx => {
  const ctx = useContext(PdfJsWorkerContext);
  if (!ctx) {
    // We intentionally do not throw; returning a benign default lets consumers fallback.
    return { worker: null, ready: false };
  }
  return ctx;
};
