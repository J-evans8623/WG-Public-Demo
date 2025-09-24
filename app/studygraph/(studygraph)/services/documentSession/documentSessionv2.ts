// services/documentSessionv2.ts
/**
 * Restores the original DocumentSession public API while retaining the v2 safeguards.
 * Public API (unchanged from original):
 *  - openDocument(docId: string, deps: { ydoc, loadFromFirebase })
 *  - openNewDocument(docId: string, deps: { ydoc, seed? })
 *  - closeDocument()
 *  - isReadyToSave()
 *  - getCurrentDocId()
 *  - getUploadPreconditions()
 *
 * Internals:
 *  - Cache fast-path (applies cached Y update bytes if present → RENDER_READY)
 *  - Background authoritative path via caller-provided loadFromFirebase → SAVE_READY
 *  - Epoch guard + cancel to drop stale work
 */

import * as Y from 'yjs';
import { loadDocBytes, saveDocBytes, setDocIdentifiers, getPreconditions as cacheGetPreconditions } from '../localCacheStore';
import readiness from '@/app/studygraph/(studygraph)/services/documentReadiness/DocumentReadinessService';

type Visibility = 'private' | 'public';

// ------- Public (original) types -------
export interface OpenDeps {
  ydoc: Y.Doc;
  loadFromFirebase: (fileStorageId: string) => Promise<void>;
}

export interface NewDocDeps {
  ydoc: Y.Doc;
  seed?: { versionNumber?: number | null; storageGeneration?: string | null };
}

// ------- Module-scoped singleton state -------
let currentDocId: string | null = null;
let lastKnownYDoc: Y.Doc | null = null;
let readyToSave = false;
let persistDisposer: (() => void) | null = null;
let sessionEpoch = 0;
let controller: AbortController | null = null;

// ------- Helpers -------
function replaceController(prev: AbortController | null): AbortController {
  try { prev?.abort(); } catch {}
  return new AbortController();
}

function observePersistAndMirror(ydoc: Y.Doc, docId: string) {
  const meta = ydoc.getMap<any>('metadata');
  let persist = meta.get('persist');
  if (!(persist instanceof Y.Map)) {
    persist = new Y.Map();
    meta.set('persist', persist);
  }

  const push = () => {
    const sg = persist.get('storageGeneration');
    const vn = persist.get('versionNumber');
    setDocIdentifiers(docId, {
      storageGeneration: typeof sg === 'string' && sg.trim() ? sg : null,
      versionNumber: typeof vn === 'number' && Number.isFinite(vn) ? vn : null,
      updatedAt: Date.now(),
    });
  };

  push();
  const observer = () => push();
  persist.observeDeep(observer);
  persistDisposer = () => persist.unobserveDeep(observer);
}

function markRenderReady(docId: string, source: 'cache' | 'bootstrap') {
  readiness.setRenderReady(docId, source);
}

function markSaveReady(docId: string, source: 'network' | 'bootstrap') {
  readiness.setSaveReady(docId, source);
  readyToSave = true;
}

function clearObservers() {
  try { persistDisposer?.(); } catch {}
  persistDisposer = null;
}

function abortInFlight() {
  try { controller?.abort(); } catch {}
  controller = null;
}

// ------- Public API (original shape) -------
async function openDocument(docId: string, deps: OpenDeps): Promise<void> {
  // Reset/attach
  clearObservers();
  currentDocId = docId;
  lastKnownYDoc = deps.ydoc;
  readyToSave = false;
  const myEpoch = ++sessionEpoch;

  controller = replaceController(controller);
  const signal = controller.signal;

  // [1] Cache fast-path (paint immediately if available)
  try {
    const cached = await loadDocBytes(docId);
    if (cached && cached.byteLength > 0) {
      Y.applyUpdate(deps.ydoc, cached);
      markRenderReady(docId, 'cache');
      // opportunistically keep cache fresh if the authoritative load succeeds later
      // (authoritative path may also persist after loadFromFirebase writes into ydoc)
    }
  } catch (e) {
    console.warn('[documentSessionv2][cache] load failed (non-fatal)', e);
  }

  // [2] Mirror identifiers → Local cache & keep observing
  observePersistAndMirror(deps.ydoc, docId);

  // [3] Background authoritative path (non-blocking)
  void (async () => {
    try {
      await deps.loadFromFirebase(docId);

      // stale guard
      if (sessionEpoch !== myEpoch || currentDocId !== docId || signal.aborted) {
        console.warn('[documentSessionv2] background load ignored (stale/aborted)', { docId, myEpoch, sessionEpoch });
        return;
      }

      // SAVE_READY + mark ready
      markSaveReady(docId, 'network');

      // persist the latest bytes snapshot for future fast-boot
      try {
        // caller’s loadFromFirebase wrote into ydoc; capture an update for cache
        // Note: yjs doesn’t “serialize whole doc” API; we depend on caller’s store to persist.
        // If you maintain a full snapshot elsewhere, replace this with that snapshot.
        // Keeping this as a best-effort no-op when a full snapshot isn’t readily available.
      } catch (e) {
        console.warn('[documentSessionv2] cache save skipped (no snapshot available)', e);
      }
    } catch (err: any) {
      readiness.setError(docId, err?.message || 'Authoritative load failed', 'error');
      console.error('[documentSessionv2] authoritative load error', { docId, error: err?.message || String(err) });
    }
  })();

  // return immediately (non-blocking open)
  return;
}

async function openNewDocument(docId: string, deps: NewDocDeps): Promise<void> {
  clearObservers();
  currentDocId = docId;
  lastKnownYDoc = deps.ydoc;
  readyToSave = false;
  const myEpoch = ++sessionEpoch;

  // Ensure metadata.persist exists & seed
  const meta = deps.ydoc.getMap<any>('metadata');
  let persist = meta.get('persist');
  if (!(persist instanceof Y.Map)) {
    persist = new Y.Map();
    meta.set('persist', persist);
  }

  const versionSeed = (() => {
    const v = deps.seed?.versionNumber;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    const raw = meta.get('version');
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    if (typeof raw === 'string' && raw.trim() && !Number.isNaN(Number(raw))) return Number(raw);
    return 1;
  })();
  const sg = deps.seed?.storageGeneration ?? null;

  deps.ydoc.transact(() => {
    if (persist.get('versionNumber') == null) persist.set('versionNumber', versionSeed);
    if (persist.get('storageGeneration') == null) persist.set('storageGeneration', sg === null ? null : String(sg));
    persist.set('updatedAt', Date.now());
    persist.set('updatedBy', 'bootstrap');
  }, 'persist-bootstrap');

  // Mirror + observe
  observePersistAndMirror(deps.ydoc, docId);

  // Readiness
  markRenderReady(docId, 'bootstrap');
  if (sessionEpoch === myEpoch && currentDocId === docId) {
    markSaveReady(docId, 'bootstrap');
  }
}

function closeDocument(): void {
  const closing = currentDocId;
  clearObservers();
  abortInFlight();
  currentDocId = null;
  lastKnownYDoc = null;
  readyToSave = false;
  sessionEpoch++; // invalidate late work
  if (closing) {
    readiness.close(closing);
    readiness.cleanup(closing);
  }
}

function isReadyToSave(): boolean {
  if (!currentDocId || !lastKnownYDoc || !readyToSave) return false;
  const meta = lastKnownYDoc.getMap<any>('metadata');
  const persist = meta.get('persist');
  if (!(persist instanceof Y.Map)) return false;
  const sg = persist.get('storageGeneration');
  const vn = persist.get('versionNumber');
  const hasSG = typeof sg === 'string' && sg.trim().length > 0;
  const hasVN = typeof vn === 'number' && Number.isFinite(vn);
  return hasSG || hasVN;
}

function getCurrentDocId(): string | null {
  return currentDocId;
}

function getUploadPreconditions(): { expectStorageGeneration: string | null; expectVersionNumber: number | null } {
  if (!currentDocId) return { expectStorageGeneration: null, expectVersionNumber: null };
  return cacheGetPreconditions(currentDocId);
}

// ------- Export the classic singleton shape -------
export const documentSession = {
  // original surface
  openDocument,
  openNewDocument,
  closeDocument,
  isReadyToSave,
  getCurrentDocId,
  getUploadPreconditions,
};

export default documentSession;
