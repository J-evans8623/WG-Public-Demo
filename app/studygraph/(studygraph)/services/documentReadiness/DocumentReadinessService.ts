/*************************************************************************************************
 * @file DocumentReadinessService.ts
 * @description
 *   Centralized, dependency-free readiness state manager for decoupling “render-ready” from
 *   “save-ready” during the document boot sequence. This service provides production-grade,
 *   observable streams without introducing external libraries (no RxJS required) by implementing
 *   a lightweight BehaviorSubject-style signal internally. It enables any part of the app
 *   (e.g., AppLayout, documentSession, YDocContext, AutoSave, Version History UI, or Collaboration
 *   manager) to:
 *     (1) publish readiness transitions for a given docId,
 *     (2) subscribe to render/save readiness events,
 *     (3) await readiness via Promise helpers with robust error propagation,
 *     (4) perform cleanup when a document is closed or the app navigates away.
 *
 *   Why this matters: today, the network load blocks the UI, nullifying the benefits of local cache.
 *   By separating the readiness phases, we can render instantly from cache (render-ready) while the
 *   authoritative network load continues in the background and eventually flips save-ready. This
 *   service is intentionally small, auditable, strongly typed, and extensively documented, with
 *   purposeful logs (file-scoped unique codes) to provide traceability in production.
 *
 *   Responsibilities:
 *   - Maintain per-document readiness state with timestamps and last transition source.
 *   - Expose “observables” (behavior-style) for renderReady$ and saveReady$ with immediate replay.
 *   - Provide Promise helpers `waitForRenderReady` and `waitForSaveReady` with error short-circuit.
 *   - Handle error states and closures (e.g., if a load fails or the doc is closed).
 *   - Offer explicit cleanup for memory safety when documents are closed or replaced.
 *
 *   Performance:
 *   - All core lookups are O(1) via Maps. Broadcasting to subscribers is O(S) where S is the number
 *     of listeners (typically very small). No polling, no timers, no external deps.
 *
 *   Logging:
 *   - Every critical transition is logged with the file name and a unique 4-digit code so you can
 *     grep production logs quickly (e.g., “[DocumentReadinessService.ts][4101] …”).
 *************************************************************************************************/

type Phase = 'IDLE' | 'RENDER_READY' | 'SAVE_READY' | 'ERROR' | 'CLOSED';

export interface ReadinessState {
  docId: string;
  phase: Phase;
  error?: string;
  at: number;              // epoch ms of last transition
  source: 'cache' | 'network' | 'system' | 'user' | 'cleanup' | 'error'| 'bootstrap';
}

/**
 * Lightweight BehaviorSubject-like implementation with immediate replay.
 * - O(1) next/get; O(S) subscribe broadcast
 */
class MiniBehaviorSubject<T> {
  private listeners: Set<(value: T) => void> = new Set();
  private _value: T;

  constructor(initial: T) {
    this._value = initial;
  }

  /** @returns current value without subscribing (O(1)) */
  get value(): T {
    return this._value;
  }

  /**
   * Push a new value to all subscribers. O(S) where S is listener count.
   */
  next(value: T): void {
    this._value = value;
    // Purposeful log for signal fan-out.
    // [4101]
    // eslint-disable-next-line no-console
    console.log('[DocumentReadinessService.ts][4101] next() broadcast', value);
    this.listeners.forEach((fn) => {
      try {
        fn(value);
      } catch (err) {
        // [4102]
        // eslint-disable-next-line no-console
        console.error('[DocumentReadinessService.ts][4102] subscriber threw', err);
      }
    });
  }

  /**
   * Subscribe to updates. Immediately replays the last value.
   * Returns an unsubscribe handle. O(1).
   */
  subscribe(fn: (value: T) => void): { unsubscribe: () => void } {
    this.listeners.add(fn);
    // Immediate replay to behave like BehaviorSubject.
    try {
      fn(this._value);
    } catch (err) {
      // [4103]
      // eslint-disable-next-line no-console
      console.error('[DocumentReadinessService.ts][4103] immediate replay failed', err);
    }
    return {
      unsubscribe: () => {
        this.listeners.delete(fn);
      },
    };
  }

  /** Clear all listeners (used during shutdown/cleanup). O(S). */
  complete(): void {
    this.listeners.clear();
  }
}

/**
 * Internal per-doc bundle of subjects.
 */
interface DocSignals {
  render$: MiniBehaviorSubject<ReadinessState>;
  save$: MiniBehaviorSubject<ReadinessState>;
  lastState: ReadinessState;
}

/**
 * @class DocumentReadinessService
 * @description
 *   Singleton orchestrator exposing per-document readiness streams and imperative helpers.
 *   Consumers should import the default instance.
 */
class DocumentReadinessService {
  private static _instance: DocumentReadinessService | null = null;

  /** Per-doc signal bundle map. O(1) lookups. */
  private docs: Map<string, DocSignals> = new Map();

  private constructor() {
    // [4104]
    // eslint-disable-next-line no-console
    console.log('[DocumentReadinessService.ts][4104] singleton constructed');
  }

  /** Acquire singleton instance. O(1). */
  static getInstance(): DocumentReadinessService {
    if (!this._instance) this._instance = new DocumentReadinessService();
    return this._instance;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public API: Observables & State Access
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * @function renderReady$
   * @description
   *   Returns a Behavior-style observable for the specified docId’s “render-ready” stream.
   *   New subscribers immediately receive the latest value (replay), then future updates.
   *   Use this inside UI components or services that should react as soon as cached bytes
   *   have been applied and the document is safe to render skeletons, titles, or local
   *   content. The observable never throws; errors are surfaced via state.phase === 'ERROR'.
   */
  renderReady$(docId: string): { subscribe: (fn: (s: ReadinessState) => void) => { unsubscribe: () => void }, value: ReadinessState } {
    const sig = this.ensureDoc(docId);
    return {
      subscribe: (fn) => sig.render$.subscribe(fn),
      get value() {
        return sig.render$.value;
      },
    } as const;
  }

  /**
   * @function saveReady$
   * @description
   *   Returns a Behavior-style observable for the specified docId’s “save-ready” stream.
   *   Subscribe when you need to know that authoritative bytes and identifiers are loaded
   *   (e.g., to allow autosave, connect collaboration, or enable share actions). The
   *   observable emits transitions from IDLE → RENDER_READY (may mirror render) → SAVE_READY
   *   and short-circuits to ERROR/CLOSED as needed.
   */
  saveReady$(docId: string): { subscribe: (fn: (s: ReadinessState) => void) => { unsubscribe: () => void }, value: ReadinessState } {
    const sig = this.ensureDoc(docId);
    return {
      subscribe: (fn) => sig.save$.subscribe(fn),
      get value() {
        return sig.save$.value;
      },
    } as const;
  }

  /**
   * @function getSnapshot
   * @description
   *   Retrieves the most recent readiness snapshot for a given docId without subscribing.
   *   Useful for synchronous guards. Returns undefined if the doc was never initialized.
   */
  getSnapshot(docId: string): ReadinessState | undefined {
    return this.docs.get(docId)?.lastState;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public API: Declarative Transitions
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * @function setRenderReady
   * @description
   *   Marks the document as “render-ready” — typically immediately after applying cached
   *   bytes to the live Y.Doc. This call should happen *before* authoritative network load
   *   begins to remove the network path from the critical render path. Downstream UI can
   *   safely render cached content while background work continues.
   */
  setRenderReady(docId: string, source: Readonly<ReadinessState['source']> = 'cache'): void {
    const sig = this.ensureDoc(docId);
    const state: ReadinessState = {
      docId,
      phase: 'RENDER_READY',
      at: Date.now(),
      source,
    };
    sig.lastState = state;
    // [4105]
    // eslint-disable-next-line no-console
    console.log('[DocumentReadinessService.ts][4105] setRenderReady', state);
    sig.render$.next(state);
    // We also advance save$ from IDLE→RENDER_READY to inform consumers that phase progressed.
    if (sig.save$.value.phase === 'IDLE') sig.save$.next(state);
  }

  /**
   * @function setSaveReady
   * @description
   *   Marks the document as “save-ready” — call this once authoritative network bytes and
   *   identifiers (e.g., storage generation / version) are confirmed. This is the signal
   *   that enables autosave, collaboration connect, and UI that depends on authoritative
   *   state. If a component waited on render-ready, it can still listen to this to flip
   *   indicators from “preview” to “synced”.
   */
  setSaveReady(docId: string, source: Readonly<ReadinessState['source']> = 'network'): void {
    const sig = this.ensureDoc(docId);
    const state: ReadinessState = {
      docId,
      phase: 'SAVE_READY',
      at: Date.now(),
      source,
    };
    sig.lastState = state;
    // [4106]
    // eslint-disable-next-line no-console
    console.log('[DocumentReadinessService.ts][4106] setSaveReady', state);
    sig.save$.next(state);
  }

  /**
   * @function setError
   * @description
   *   Publishes an error state for both streams. Any pending waiters will be unblocked
   *   by the Promise helpers (they reject on ERROR), and subscribers can surface the
   *   error. Use this when network load fails or decoding the document bytes throws.
   */
  setError(docId: string, message: string, source: Readonly<ReadinessState['source']> = 'error'): void {
    const sig = this.ensureDoc(docId);
    const state: ReadinessState = {
      docId,
      phase: 'ERROR',
      error: message,
      at: Date.now(),
      source,
    };
    sig.lastState = state;
    // [4107]
    // eslint-disable-next-line no-console
    console.error('[DocumentReadinessService.ts][4107] setError', state);
    sig.render$.next(state);
    sig.save$.next(state);
  }

  /**
   * @function close
   * @description
   *   Marks the document as “closed” and completes both streams. Subscribers should
   *   treat this as a terminal state and unsubscribe. The internal signals remain
   *   allocated until `cleanup(docId)` is called, so that late subscribers can detect
   *   that the previous doc was closed.
   */
  close(docId: string): void {
    const sig = this.ensureDoc(docId);
    const state: ReadinessState = {
      docId,
      phase: 'CLOSED',
      at: Date.now(),
      source: 'cleanup',
    };
    sig.lastState = state;
    // [4108]
    // eslint-disable-next-line no-console
    console.log('[DocumentReadinessService.ts][4108] close', state);
    sig.render$.next(state);
    sig.save$.next(state);
  }

  /**
   * @function cleanup
   * @description
   *   Fully removes the per-doc subjects and listeners to avoid memory leaks when a document
   *   is permanently closed or the app navigates away. New subscriptions after cleanup will
   *   reinitialize with IDLE state automatically.
   */
  cleanup(docId: string): void {
    const sig = this.docs.get(docId);
    if (!sig) return;
    sig.render$.complete();
    sig.save$.complete();
    this.docs.delete(docId);
    // [4109]
    // eslint-disable-next-line no-console
    console.log('[DocumentReadinessService.ts][4109] cleanup complete', { docId });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public API: Promise Helpers (await readiness)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * @function waitForRenderReady
   * @description
   *   Returns a Promise that resolves when the given docId reaches RENDER_READY. If the
   *   document transitions to ERROR or CLOSED first, the Promise rejects. This is useful
   *   for transitional UI that must pause until cached bytes are applied.
   */
  async waitForRenderReady(docId: string): Promise<void> {
    const sig = this.ensureDoc(docId);
    const current = sig.render$.value;
    if (current.phase === 'RENDER_READY' || current.phase === 'SAVE_READY') return;
    if (current.phase === 'ERROR') throw new Error(current.error || 'Render-ready failed');
    if (current.phase === 'CLOSED') throw new Error('Document closed before render-ready');

    return new Promise<void>((resolve, reject) => {
      const sub = sig.render$.subscribe((s) => {
        if (s.docId !== docId) return;
        if (s.phase === 'RENDER_READY' || s.phase === 'SAVE_READY') {
          sub.unsubscribe();
          resolve();
        } else if (s.phase === 'ERROR') {
          sub.unsubscribe();
          reject(new Error(s.error || 'Render-ready error'));
        } else if (s.phase === 'CLOSED') {
          sub.unsubscribe();
          reject(new Error('Document closed before render-ready'));
        }
      });
    });
  }

  /**
   * @function waitForSaveReady
   * @description
   *   Returns a Promise that resolves when the given docId reaches SAVE_READY. If the
   *   document transitions to ERROR or CLOSED first, the Promise rejects. This is useful
   *   for enabling autosave, collaboration, or any action that requires authoritative
   *   identifiers from the server.
   */
  async waitForSaveReady(docId: string): Promise<void> {
    const sig = this.ensureDoc(docId);
    const current = sig.save$.value;
    if (current.phase === 'SAVE_READY') return;
    if (current.phase === 'ERROR') throw new Error(current.error || 'Save-ready failed');
    if (current.phase === 'CLOSED') throw new Error('Document closed before save-ready');

    return new Promise<void>((resolve, reject) => {
      const sub = sig.save$.subscribe((s) => {
        if (s.docId !== docId) return;
        if (s.phase === 'SAVE_READY') {
          sub.unsubscribe();
          resolve();
        } else if (s.phase === 'ERROR') {
          sub.unsubscribe();
          reject(new Error(s.error || 'Save-ready error'));
        } else if (s.phase === 'CLOSED') {
          sub.unsubscribe();
          reject(new Error('Document closed before save-ready'));
        }
      });
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Internals
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * @function ensureDoc
   * @description
   *   Idempotently constructs per-doc subjects with IDLE state and returns them.
   *   O(1) average time; allocates two behavior-style subjects if missing.
   */
  private ensureDoc(docId: string): DocSignals {
    let sig = this.docs.get(docId);
    if (!sig) {
      const init: ReadinessState = {
        docId,
        phase: 'IDLE',
        at: Date.now(),
        source: 'system',
      };
      sig = {
        render$: new MiniBehaviorSubject<ReadinessState>(init),
        save$: new MiniBehaviorSubject<ReadinessState>(init),
        lastState: init,
      };
      this.docs.set(docId, sig);
      // [4110]
      // eslint-disable-next-line no-console
      console.log('[DocumentReadinessService.ts][4110] ensureDoc(init)', { docId });
    }
    return sig;
  }
}

// Export singleton instance for app-wide use.
const readiness = DocumentReadinessService.getInstance();
export default readiness;
