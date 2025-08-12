/***************************************************************************************
 * @file bloom-maps\app\studygraph\(studygraph)\controllers\CanvasModeController.ts
 * @description
 *   Client-side controller (small reducer + hook) that orchestrates opening a document
 *   in the correct mode (viewer vs editor) using the authoritative Bootstrap endpoint.
 *   It centralizes the sequence for **file switches**: (1) stop DocAutoSave (if running),
 *   (2) best-effort flush of per-user data (delegated to caller), (3) call
 *   `/api/document/bootstrap`, then (4) mount the correct canvas based on `{isOwner||canEdit}`.
 *   The controller deliberately carries only minimal state and emits clear transitions
 *   that your `AppLayout` and contexts (YDoc, UserData) can listen to without
 *   duplicating logic. Purposeful console logs mark entry, decisions, and failures.
 *   No styling is modified; this module is pure orchestration logic.
 ***************************************************************************************/

import { useCallback, useMemo, useReducer, useRef } from 'react';

export type CanvasView =
  | { kind: 'idle' }
  | { kind: 'opening'; docId: string }
  | { kind: 'viewing:viewer'; docId: string; acl: BootstrapAcl }
  | { kind: 'viewing:editor'; docId: string; acl: BootstrapAcl }
  | { kind: 'error'; docId: string; message: string; code?: string };

export type BootstrapAcl = {
  docId: string;
  isOwner: boolean;
  role: 'owner' | 'editor' | 'viewer' | null;
  canRead: boolean;
  canEdit: boolean;
  publicView: boolean;
  publicEdit: boolean;
};

type State = {
  view: CanvasView;
  lastAcl?: BootstrapAcl;
  lastError?: { message: string; code?: string };
};

type Action =
  | { type: 'OPEN_START'; docId: string }
  | { type: 'OPEN_OK_VIEWER'; docId: string; acl: BootstrapAcl }
  | { type: 'OPEN_OK_EDITOR'; docId: string; acl: BootstrapAcl }
  | { type: 'OPEN_ERROR'; docId: string; message: string; code?: string }
  | { type: 'RESET' };

const initialState: State = { view: { kind: 'idle' } };

export interface UseCanvasModeControllerOptions {
  /**
   * Called before a new doc is opened. Use this to stop DocAutoSave (shared doc channel).
   * It should be idempotent and safe to call when no autosave is running.
   */
  stopDocAutoSave?: (prevDocId?: string) => Promise<void> | void;

  /**
   * Best-effort flush of per-user data for the previous doc (bookmarks, stats, etc.).
   * Should resolve quickly; the controller does not block forever.
   */
  tryFlushUserData?: (prevDocId?: string, timeoutMs?: number) => Promise<void> | void;

  /**
   * Optional callback for visibility into ACL results (telemetry or side-effects).
   */
  onAcl?: (acl: BootstrapAcl) => void;

  /**
   * Optional fetcher (for testing). Defaults to window.fetch with credentials included.
   */
  fetcher?: (url: string) => Promise<Response>;
}

/**
 * @function useCanvasModeController
 * @description
 *   A small, focused state machine that exposes an `openDoc(docId)` function. On call,
 *   it executes the file-switch choreography: stop DocAutoSave, best-effort flush of
 *   per-user data, call the Bootstrap API, then transition to `viewing:viewer` or
 *   `viewing:editor`. Errors are captured and exposed in state. It emits concise console
 *   logs for entry points and decisions to support field debugging without noisy spam.
 */
export function useCanvasModeController(opts: UseCanvasModeControllerOptions = {}) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const currentDocIdRef = useRef<string | undefined>(undefined);

  const fetcher = opts.fetcher ?? defaultFetcher;

  const openDoc = useCallback(async (docId: string) => {
    const prevDocId = currentDocIdRef.current;
    currentDocIdRef.current = docId;

    try {
      console.log('[CanvasModeController.ts][6201] › openDoc start', { prevDocId, nextDocId: docId });

      // 1) Stop DocAutoSave (shared document writes)
      if (opts.stopDocAutoSave) {
        await Promise.resolve(opts.stopDocAutoSave(prevDocId));
        console.log('[CanvasModeController.ts][6202] › stopDocAutoSave done');
      }

      // 2) Best-effort flush per-user data (debounced user data channel)
      if (opts.tryFlushUserData) {
        // Do not block indefinitely; let caller implement internal timeouts.
        await Promise.resolve(opts.tryFlushUserData(prevDocId, 1500));
        console.log('[CanvasModeController.ts][6203] › tryFlushUserData done');
      }

      // 3) Bootstrap
      dispatch({ type: 'OPEN_START', docId });
      const url = `/api/document/bootstrap?docId=${encodeURIComponent(docId)}`;
      console.log('[CanvasModeController.ts][6204] › fetching bootstrap', { url });
      const resp = await fetcher(url);

      if (!resp.ok) {
        const err = await safeJson(resp);
        console.warn('[CanvasModeController.ts][6291] › bootstrap denied', err);
        const message = err?.message || 'Access denied';
        const code = err?.code || 'ACL_DENIED_READ';
        dispatch({ type: 'OPEN_ERROR', docId, message, code });
        return;
      }

      const acl = (await resp.json()) as BootstrapAcl;
      console.log('[CanvasModeController.ts][6205] › bootstrap ok', acl);
      opts.onAcl?.(acl);

      // 4) Decide mode
      if (acl.isOwner || acl.canEdit) {
        dispatch({ type: 'OPEN_OK_EDITOR', docId, acl });
      } else {
        dispatch({ type: 'OPEN_OK_VIEWER', docId, acl });
      }
    } catch (err: any) {
      console.error('[CanvasModeController.ts][6299] › openDoc fatal', err);
      dispatch({ type: 'OPEN_ERROR', docId, message: 'Unexpected error' });
    }
  }, [opts, fetcher]);

  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);

  const api = useMemo(() => ({
    state,
    openDoc,
    reset,
    isIdle: state.view.kind === 'idle',
    isOpening: state.view.kind === 'opening',
    isViewer: state.view.kind === 'viewing:viewer',
    isEditor: state.view.kind === 'viewing:editor',
    docId: state.view.kind.startsWith?.('viewing') ? (state.view as any).docId : (state.view.kind === 'opening' ? (state.view as any).docId : undefined),
    acl: state.view.kind.startsWith?.('viewing') ? (state.view as any).acl as BootstrapAcl : state.lastAcl,
    error: state.view.kind === 'error' ? state.lastError : undefined,
  }), [state, openDoc, reset]);

  return api;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'OPEN_START':
      return { view: { kind: 'opening', docId: action.docId } };
    case 'OPEN_OK_VIEWER':
      return {
        view: { kind: 'viewing:viewer', docId: action.docId, acl: action.acl },
        lastAcl: action.acl,
      };
    case 'OPEN_OK_EDITOR':
      return {
        view: { kind: 'viewing:editor', docId: action.docId, acl: action.acl },
        lastAcl: action.acl,
      };
    case 'OPEN_ERROR':
      return {
        view: { kind: 'error', docId: action.docId, message: action.message, code: action.code },
        lastError: { message: action.message, code: action.code },
      };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

async function defaultFetcher(url: string): Promise<Response> {
  return fetch(url, { method: 'GET', credentials: 'include', headers: { 'Accept': 'application/json' } });
}

async function safeJson(resp: Response): Promise<any> {
  try { return await resp.json(); } catch { return {}; }
}
