/*****************************************************************************************
 * @file documentSession.ts
 * @description
 *   Front-end orchestrator for opening documents with Phase-3 caching + preconditions, now
 *   refactored (Phase 2) to fully support a non-blocking boot path. The session applies any
 *   locally cached bytes to the live Y.Doc immediately (fast-boot) and emits a Render-Ready
 *   signal so the UI can paint instantly. The authoritative network load (Firebase download,
 *   identifier seeding, and collaboration connect) proceeds in the background; upon success,
 *   a Save-Ready signal is emitted to enable autosave and collaboration. Session state tracks
 *   the currently targeted doc and uses an epoch token to prevent late async work from a prior
 *   session from mutating a newly opened document (race-condition safety). Readiness events are
 *   produced through the singleton DocumentReadinessService without introducing RxJS; logs with
 *   unique codes trace critical transitions. This module keeps no UI state and mirrors Y.Doc
 *   `metadata.persist` identifiers into LocalCacherStore so upload preconditions are always O(1)
 *   to read. All map lookups are O(1); observer fan-out is O(S) where S is listener count.
 *
 * Exports:
 *   - class DocumentSession (singleton)
 *   - const documentSession (named singleton instance)
 *   - default documentSession (default export for convenience)
 *
 * Notes:
 *   1) This module keeps no UI state. It only coordinates between YDocContext and cache.
 *   2) Identifiers are mirrored continuously via a deep observer on `metadata.persist`.
 *   3) Phase 2 objective: openDocument returns immediately after cache apply; authoritative
 *      load + collab run in background with robust cancelation via epoch checks.
 *****************************************************************************************/

import * as Y from 'yjs';
import {
  setDocIdentifiers,
  getPreconditions as cacheGetPreconditions,
  loadDocBytes,
} from '../localCacheStore';
import readiness from '@/app/studygraph/(studygraph)/services/documentReadiness/DocumentReadinessService'; // update - 26

// ───────────────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────────────────

type Visibility = 'private' | 'public';

export interface OpenDeps {
  ydoc: Y.Doc;
  loadFromFirebase: (fileStorageId: string) => Promise<void>;
}

export interface NewDocDeps {
  ydoc: Y.Doc;
  seed?: { versionNumber?: number | null; storageGeneration?: string | null };
}

// ───────────────────────────────────────────────────────────────────────────────
// Singleton class
// ───────────────────────────────────────────────────────────────────────────────

export class DocumentSession {
  // Static singleton handle
  private static _instance: DocumentSession | null = null;

  // Instance state (replaces module-level globals)
  private currentDocId: string | null = null;               // update - 14
  private lastKnownYDoc: Y.Doc | null = null;               // update - 15
  private readyToSave = false;                               // update - 16
  private persistDisposer: (() => void) | null = null;       // update - 17

  // Epoch token increments on every open to cancel prior background tasks
  private sessionEpoch = 0;                                  // update - 27

  private constructor() {}

  /** Returns the singleton instance. */
  static getInstance(): DocumentSession {                    // update - 18
    if (!DocumentSession._instance) {
      DocumentSession._instance = new DocumentSession();
    }
    return DocumentSession._instance;
  }



  async openNewDocument(docId: string, deps: NewDocDeps): Promise<void> {
    // Tear down any existing observers
    if (this.persistDisposer) {
      try { this.persistDisposer(); } catch {}
      this.persistDisposer = null;
    }

    // Record session & cancel any prior background work
    this.currentDocId = docId;
    this.lastKnownYDoc = deps.ydoc;
    this.readyToSave = false;
    const myEpoch = ++this.sessionEpoch;

    console.log('[documentSession.ts][5201] openNewDocument start', { docId, epoch: myEpoch });

    // 1) Ensure metadata.persist exists and seed identifiers
    const meta = deps.ydoc.getMap<any>('metadata');
    let persist = meta.get('persist');
    if (!(persist instanceof Y.Map)) {
      persist = new Y.Map();
      meta.set('persist', persist);
    }

    // Seed versionNumber (required for isReadyToSave gate)
    const rawVer =
      deps.seed?.versionNumber ??
      (() => {
        const raw = meta.get('version');
        if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
        if (typeof raw === 'string' && raw.trim() && !Number.isNaN(Number(raw))) return Number(raw);
        return 1;
      })();

    const sg = deps.seed?.storageGeneration ?? null;

    deps.ydoc.transact(() => {
      // Only set if missing; if createNewDocument already wrote persist, keep it
      if (persist.get('versionNumber') == null) persist.set('versionNumber', rawVer);
      if (persist.get('storageGeneration') == null && sg !== undefined) {
        if (sg === null) {
          // explicitly clear to null (helps isReadyToSave: VN will be enough anyway)
          persist.set('storageGeneration', null);
        } else {
          persist.set('storageGeneration', String(sg));
        }
      }
      persist.set('updatedAt', Date.now());
      persist.set('updatedBy', 'bootstrap');
    }, 'persist-bootstrap');

    // 2) Mirror identifiers → LocalCacherStore and observe deep for future updates
    const syncToCache = () => {
      const v = persist.get('versionNumber');
      const g = persist.get('storageGeneration');
      if (!this.currentDocId) return;
      setDocIdentifiers(this.currentDocId, {
        versionNumber: (typeof v === 'number' && Number.isFinite(v)) ? v : null,
        storageGeneration: (typeof g === 'string' && g.trim()) ? g : null,
        updatedAt: Date.now(),
      });
    };
    syncToCache();
    const observer = () => syncToCache();
    persist.observeDeep(observer);
    this.persistDisposer = () => persist.unobserveDeep(observer);

    // 3) We can render immediately from the in-memory ydoc
    readiness.setRenderReady(docId, 'bootstrap');
    console.log('[documentSession.ts][5202] RENDER_READY (bootstrap)', { docId });


    // Guard against stale epoch/doc after any awaits
    if (this.sessionEpoch !== myEpoch || this.currentDocId !== docId) {
      console.warn('[documentSession.ts][5292] bootstrap ignored (stale epoch/doc)', {
        docId, myEpoch, currentEpoch: this.sessionEpoch, currentDocId: this.currentDocId,
      });
      return;
    }

    // 5) We’re allowed to save now: flip the gate and emit SAVE_READY
    this.readyToSave = true;
    readiness.setSaveReady(docId, 'bootstrap');
    console.log('[documentSession.ts][5203] SAVE_READY (bootstrap)', { docId, epoch: myEpoch });
  }

  /**
   * update - 28
   * @method openDocument
   * @description
   *   Non-blocking open sequence that immediately attempts a fast-boot from local cache and
   *   returns, while authoritative load continues in the background. The method:
   *   1) Resets previous session, attaches to the provided Y.Doc, and bumps the epoch.
   *   2) Attempts cached byte application; on success emits Render-Ready via readiness service.
   *   3) Observes `metadata.persist` to mirror identifiers into LocalCacherStore (O(1) lookups).
   *   4) Starts background job: loadFromFirebase(docId) → connectCollab → mark readyToSave true
   *      → emit Save-Ready. Late completions are ignored via epoch checks and docId matching.
   *   This function never throws for expected network conditions; errors are surfaced through
   *   readiness.setError and logs, preserving a smooth UI path.
   */
  async openDocument(docId: string, deps: OpenDeps): Promise<void> {
    // 1) Reset previous session and attach to new Y.Doc instance
    if (this.persistDisposer) {
      try { this.persistDisposer(); } catch {}
      this.persistDisposer = null;
    }
    this.currentDocId = docId;
    this.lastKnownYDoc = deps.ydoc;
    this.readyToSave = false;

    // Bump epoch to cancel any in-flight work from prior opens
    const myEpoch = ++this.sessionEpoch;                    // update - 29
    // [documentSession.ts][4201]
    // eslint-disable-next-line no-console
    console.log('[documentSession.ts][4201] openDocument start', { docId, epoch: myEpoch });

    // 2) Fast-boot from local cache if available (non-authoritative)
    let appliedCache = false;                               // update - 30
    try {
      const cached = await loadDocBytes(docId);
      if (cached && cached.byteLength > 0) {
        Y.applyUpdate(deps.ydoc, cached);
        appliedCache = true;
        // Emit Render-Ready as soon as cached state is visible
        readiness.setRenderReady(docId, 'cache');          // update - 31
        // [documentSession.ts][4202]
        // eslint-disable-next-line no-console
        console.log('[documentSession.ts][4202] fast-boot from cache applied', {
          docId,
          bytes: cached.byteLength,
        });
      } else {
        // [documentSession.ts][4203]
        // eslint-disable-next-line no-console
        console.log('[documentSession.ts][4203] no cached bytes found', { docId });
      }
    } catch (e) {
      // [documentSession.ts][4291]
      // eslint-disable-next-line no-console
      console.warn('[documentSession.ts][4291] fast-boot from cache failed (non-fatal)', e);
    }

    // 3) Observe metadata.persist and mirror identifiers → LocalCacherStore
    const meta = deps.ydoc.getMap<any>('metadata');
    let persist = meta.get('persist');
    if (!(persist instanceof Y.Map)) {
      persist = new Y.Map();
      meta.set('persist', persist);
    }

    const syncToCache = () => {
      const sg = persist.get('storageGeneration');
      const vn = persist.get('versionNumber');
      if (!this.currentDocId) return;
      setDocIdentifiers(this.currentDocId, {
        storageGeneration: typeof sg === 'string' && sg.trim() ? sg : null,
        versionNumber: typeof vn === 'number' && Number.isFinite(vn) ? vn : null,
        updatedAt: Date.now(),
      });
    };

    // Push once immediately and observe deep for updates
    syncToCache();
    const observer = () => syncToCache();
    persist.observeDeep(observer);
    this.persistDisposer = () => persist.unobserveDeep(observer);

    // 4) Kick off authoritative load in the background (non-blocking return)
    //    Note: we intentionally do not await this task to unblock the UI path.
    //    Epoch + docId checks ensure race-safety.
    // [documentSession.ts][4204]
    // eslint-disable-next-line no-console
    console.log('[documentSession.ts][4204] scheduling background authoritative load', { docId, epoch: myEpoch });

    void (async () => {                                     // update - 32
      try {
        await deps.loadFromFirebase(docId);

        // Abort if the session was superseded or doc changed
        if (this.sessionEpoch !== myEpoch || this.currentDocId !== docId) {
          // [documentSession.ts][4292]
          // eslint-disable-next-line no-console
          console.warn('[documentSession.ts][4292] background load ignored (stale epoch/doc)', {
            docId,
            myEpoch,
            currentEpoch: this.sessionEpoch,
            currentDocId: this.currentDocId,
          });
          return;
        }

        // Final epoch/doc guard before flipping readyToSave
        if (this.sessionEpoch !== myEpoch || this.currentDocId !== docId) {
          // [documentSession.ts][4293]
          // eslint-disable-next-line no-console
          console.warn('[documentSession.ts][4293] collab connect result ignored (stale epoch/doc)', {
            docId,
            myEpoch,
            currentEpoch: this.sessionEpoch,
            currentDoc: this.currentDocId,
          });
          return;
        }

        // Mark session Save-Ready and emit readiness transition
        this.readyToSave = true;
        readiness.setSaveReady(docId, 'network');          // update - 33

        // [documentSession.ts][4205]
        // eslint-disable-next-line no-console
        console.log('[documentSession.ts][4205] authoritative load complete (SAVE_READY)', {
          docId,
          epoch: myEpoch,
          appliedCache,
        });
      } catch (err: any) {
        // On failure, publish error state for subscribers; do not throw
        readiness.setError(docId, err?.message || 'Authoritative load failed', 'error'); // update - 34
        // [documentSession.ts][4294]
        // eslint-disable-next-line no-console
        console.error('[documentSession.ts][4294] background authoritative load error', {
          docId,
          epoch: myEpoch,
          error: err?.message || String(err),
        });
      }
    })();

    // Return immediately to keep the UI path non-blocking
    return; // update - 35
  }

  /**
   * update - 20
   * @method closeDocument
   * @description
   *   Closes the current session:
   *   1) Unobserve `metadata.persist`.
   *   2) Clear instance state.
   *   3) Publish readiness CLOSE and cleanup so subscribers can release resources.
   *   4) Collaboration disconnect is handled by the caller as needed.
   */
  closeDocument(): void {
    const closingDoc = this.currentDocId;                  // update - 36
    if (this.persistDisposer) {
      try { this.persistDisposer(); } catch {}
      this.persistDisposer = null;
    }
    this.currentDocId = null;
    this.lastKnownYDoc = null;
    this.readyToSave = false;

    // Invalidate any in-flight background work
    this.sessionEpoch++;                                   // update - 37

    // Emit readiness CLOSE + cleanup to release listeners
    if (closingDoc) {
      readiness.close(closingDoc);                         // update - 38
      readiness.cleanup(closingDoc);                       // update - 39
      // [documentSession.ts][4206]
      // eslint-disable-next-line no-console
      console.log('[documentSession.ts][4206] closed session', { closingDoc, epoch: this.sessionEpoch });
    }
  }

  /**
   * update - 21
   * @method isReadyToSave
   * @description
   *   Returns true only when:
   *   1) A document is open.
   *   2) The authoritative load completed (internal `readyToSave`).
   *   3) The Y.Doc’s `metadata.persist` contains at least one identifier
   *      (storageGeneration or versionNumber).
   *   This reflects Save-Ready semantics and may be consumed by autosave gating.
   */
  isReadyToSave(): boolean {
    if (!this.currentDocId || !this.readyToSave || !this.lastKnownYDoc) return false;
    const meta = this.lastKnownYDoc.getMap<any>('metadata');
    const persist = meta.get('persist');
    if (!(persist instanceof Y.Map)) return false;
    const sg = persist.get('storageGeneration');
    const vn = persist.get('versionNumber');
    const hasSG = typeof sg === 'string' && sg.trim().length > 0;
    const hasVN = typeof vn === 'number' && Number.isFinite(vn);
    return hasSG || hasVN;
  }

  /**
   * update - 22
   * @method getCurrentDocId
   * @description
   *   Returns the id of the currently open document, or null if none.
   */
  getCurrentDocId(): string | null {
    return this.currentDocId;
  }

  /**
   * update - 23
   * @method getUploadPreconditions
   * @description
   *   Returns upload preconditions derived from the LocalCacherStore mirror:
   *   1) Reads identifiers from cache (mirrored from Y.Doc via observer).
   *   2) Returns `{ expectStorageGeneration, expectVersionNumber }` (nullable).
   *   Use this if you need the preconditions outside YDocContext (e.g., utilities).
   */
  getUploadPreconditions(): {
    expectStorageGeneration: string | null;
    expectVersionNumber: number | null;
  } {
    if (!this.currentDocId) {
      return { expectStorageGeneration: null, expectVersionNumber: null };
    }
    return cacheGetPreconditions(this.currentDocId);
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// Named + default exports to support both import styles
// ───────────────────────────────────────────────────────────────────────────────

export const documentSession = DocumentSession.getInstance(); // update - 24
export default documentSession;                                 // update - 25
