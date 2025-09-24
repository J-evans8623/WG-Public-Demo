// app/studygraph/(studygraph)/services/documentInit/OptimisticInitController.ts
/**
 * @file OptimisticInitController.ts
 * @description
 * This controller centralizes the “optimistic init” behavior for document-opening flows (select,
 * create, redeem). Its job is to immediately flip the app toward the Map experience while a
 * lightweight, non-dismissable Loading Overlay remains visible until we receive a renderable or
 * authoritative readiness signal. Responsibilities include: (1) generating a unique requestId for
 * each begin() invocation to guard against races when users quickly switch documents; (2) showing
 * the registered "loadingOverlay" modal with scenario-aware titles/subtitles; (3) wiring to the
 * DocumentReadinessService (renderReady$ and saveReady$) to hide the overlay on the first event
 * that makes the UI renderable—RENDER_READY or SAVE_READY; (4) on SAVE_READY for the *current*
 * request, calling LoadUserData to ensure user-scoped data is initialized; and (5) disposing all
 * subscriptions cleanly on supersession or unmount. This file does not render UI. It is designed
 * to be dependency-injected with view setters and modal show/hide functions so it can be used in
 * non-React modules or within React components without creating additional hosts or contexts.
 * Time complexity: all operations are O(1). Each begin() stores constant-sized state and sets up
 * two subscriptions; there are no unbounded loops or data scans performed in this controller.
 */

import readiness from '@/app/studygraph/(studygraph)/services/documentReadiness/DocumentReadinessService';
import { ViewType } from '@/app/Library/Context/ViewSwitchContext';
import { ModalType } from '../../components/modals/AppModals';

type BeginMode = 'select' | 'create' | 'redeem';

export type BeginOptions = {
  /** Target document id to observe readiness for. */
  docId: string;
  /** Scenario for copy. Affects the overlay title/subtitle. */
  mode: BeginMode;

  /** View-layer setters injected from the caller. */
  setActiveView: (v: ViewType) => void;
  setCurrentView: (v: 'home' | 'map' | 'user') => void;
  setDefaultMap: () => void;

  /** App service injected to initialize user data once authoritative doc is ready. */
  LoadUserData: (docId: string) => void;

  /** Modal controls from GlobalModalProvider/useGlobalModal. */
  showModal: (type: ModalType, props?: any) => void;
  hideModal: () => void;
};

type Unsub = (() => void) | null;

export class OptimisticInitController {
  /** The active request, if any; used to guard against stale readiness events. */
  private current: { docId: string; requestId: string } | null = null;

  /** Current subscriptions for render/save readiness; disposed on supersession. */
  private unsubRender: Unsub = null;
  private unsubSave: Unsub = null;

  /**
   * @function begin
   * @description
   * Start an optimistic initialization cycle for a specific document and scenario. This (1) creates
   * a unique requestId and stores a guard pair {docId, requestId}; (2) flips the view towards the
   * Map immediately for responsive UX; (3) opens the registered loading overlay via showModal; and
   * (4) subscribes to both renderReady$ and saveReady$ for the provided docId. On the first arrival
   * of RENDER_READY or SAVE_READY *matching the current request*, the overlay is dismissed and the
   * map remains visible (default map may be set by the caller). Additionally, on SAVE_READY we call
   * LoadUserData(docId) to seed user-scoped state. All subscriptions are cleaned up on supersession
   * or explicit dispose(). Time complexity is O(1): constant state and two event subscriptions.
   */
  public begin(opts: BeginOptions): { requestId: string } {
    const { docId, mode, setActiveView, setCurrentView, setDefaultMap, LoadUserData, showModal } = opts;

    // 1) Generate request guard and store as “current”
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.current = { docId, requestId };
    console.log('[OptimisticInitController.ts][7201] begin() called', { docId, mode, requestId });

    // 2) Flip to map view optimistically (paint cached or skeleton)
    try {
      setActiveView('conceptMap');
      setCurrentView('map');
      setDefaultMap();
      console.log('[OptimisticInitController.ts][7202] view flipped to map optimistically', { docId, requestId });
    } catch (err) {
      console.warn('[OptimisticInitController.ts][7291] view flip failed (non-fatal)', { err });
    }

    // 3) Show loading overlay with scenario-aware copy
    const copy = this.copyForMode(mode);
    showModal('loadingOverlay', {
      title: copy.title,
      subtitle: copy.sub,
      size: 'large',
      // no onClose: controlled by controller/hide on readiness
    });
    console.log('[OptimisticInitController.ts][7203] loading overlay shown', { docId, requestId, mode });

    // 4) Wire readiness subscriptions (supersede existing)
    this.disposeSubscriptionsOnly();
    const rSub = readiness.renderReady$(docId).subscribe((s: any) => {
      console.log('[OptimisticInitController.ts][7204] renderReady$ event', { s, guard: this.current });
      if (!this.isCurrent(docId, requestId)) return;
      if (s && (s.phase === 'RENDER_READY' || s.phase === 'SAVE_READY')) {
        // First renderable signal – hide overlay
        this.safeHide();
      }
      if (s && s.phase === 'ERROR') {
        // Do not hide unless something renderable arrived; allow caller UI to decide
        console.warn('[OptimisticInitController.ts][7292] render-ready error observed', { error: s.error });
      }
    });

    const sSub = readiness.saveReady$(docId).subscribe((s: any) => {
      console.log('[OptimisticInitController.ts][7205] saveReady$ event', { s, guard: this.current });
      if (!this.isCurrent(docId, requestId)) return;
      if (s && s.phase === 'SAVE_READY') {
        // Authoritative state is ready: hide overlay (if still open) and load user data.
        this.safeHide();
        try {
          LoadUserData(docId);
          console.log('[OptimisticInitController.ts][7206] LoadUserData invoked post SAVE_READY', { docId });
        } catch (err) {
          console.warn('[OptimisticInitController.ts][7293] LoadUserData failed (non-fatal)', { err });
        }
      }
    });

    this.unsubRender = () => rSub.unsubscribe();
    this.unsubSave = () => sSub.unsubscribe();

    return { requestId };
  }

  /**
   * @function dispose
   * @description
   * Fully clears the active request and unsubscribes from any readiness streams. This must be
   * called when the owning component unmounts or when abandoning an initialization sequence
   * explicitly. Complexity is O(1) and frees minimal resources (two subscriptions).
   */
  public dispose(): void {
    console.log('[OptimisticInitController.ts][7207] dispose() called', { hadCurrent: !!this.current });
    this.current = null;
    this.disposeSubscriptionsOnly();
  }

  // ========== Internal helpers ==========

  private hideModalFn: (() => void) | null = null;

  /** Inject the hide function for the active cycle. Called by begin() via safeHide binding. */
  private setHide(hide: () => void) {
    this.hideModalFn = hide;
  }

  /** Safely hide overlay if injected; leaves guard state intact. */
  private safeHide() {
    if (this.hideModalFn) {
      try {
        this.hideModalFn();
        console.log('[OptimisticInitController.ts][7208] overlay hidden via safeHide()');
      } catch (e) {
        console.warn('[OptimisticInitController.ts][7294] overlay hide failed (non-fatal)', e);
      }
      // Only hide once per cycle; keep function for idempotence in rare dupe events.
    }
  }

  /** True if the provided pair matches the controller’s current guard. */
  private isCurrent(docId: string, requestId: string): boolean {
    return !!this.current && this.current.docId === docId && this.current.requestId === requestId;
  }

  /** Dispose only the subscriptions; retain/clear current explicitly at callsite. */
  private disposeSubscriptionsOnly() {
    try { this.unsubRender?.(); } catch {}
    try { this.unsubSave?.(); } catch {}
    this.unsubRender = null;
    this.unsubSave = null;
  }

  /** Scenario copy. Kept internal and pure for testability. */
  private copyForMode(mode: BeginMode): { title: string; sub: string } {
    switch (mode) {
      case 'select':
        return { title: 'Opening Notebook…', sub: 'Loading document and cached content' };
      case 'create':
        return { title: 'Creating Notebook…', sub: 'Preparing a fresh workspace' };
      case 'redeem':
        return { title: 'Opening Shared Notebook…', sub: 'Resolving access and loading content' };
      default:
        return { title: 'Loading…', sub: 'Please wait while we prepare things' };
    }
  }

  /**
   * @function bindHide
   * @description
   * Public helper used by callers to bind the hide function for the *current* cycle. This keeps
   * modal wiring testable and avoids direct imports from React contexts inside the controller.
   */
  public bindHide(hide: () => void) {
    this.setHide(hide);
  }
}
