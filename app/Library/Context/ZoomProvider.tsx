// app/Library/Context/ZoomProvider.tsx

/**
 * @file ZoomProvider.tsx
 * @description
 *   ZoomProvider supplies the application with a centralized, testable API for managing
 *   concept-map zoom state and—new in this phase—user-initiated re-centering. This file
 *   wraps the existing reducer-driven zoom model (zoomLevel, baseZoomLevel, dispatch)
 *   and adds a small imperative interface that coordinates re-center requests between
 *   non-DOM components (e.g., toolbars) and the DOM-owning renderers (MapRenderer).
 *
 *   The provider exposes:
 *   1) Standard zoom state (unchanged): zoomLevel, baseZoomLevel, dispatch.
 *   2) Imperative centering API (new):
 *      2.1) setInitialFitZoom(zoom: number) — records the initial “fit-to-viewport” zoom.
 *      2.2) registerMapCenterHandler(fn) / unregisterMapCenterHandler() — lets MapRenderer
 *           register its DOM-centered “recenter” handler without leaking DOM refs into state.
 *      2.3) requestMapRecenter(opts) — allows any component (e.g., a toolbar button) to
 *           request re-centering using the registered handler.
 *      2.4) getInitialFitZoom() — returns the last recorded initial fit zoom for clamping.
 *
 *   Separation of concerns:
 *   - The provider never manipulates DOM or scroll; it only brokers requests.
 *   - MapRenderer remains the single owner of scroll/transform math.
 *   - The reducer stays pure and unchanged; imperative pieces live in useRef.
 *
 *   Logging:
 *   - Purposeful console logs (with unique 4-digit codes) mark registration,
 *     updates to initial fit zoom, and external recenter requests for observability.
 *
 *   Performance:
 *   - All operations are O(1). useRef avoids re-renders on setter/registration calls.
 *   - Context memoization prevents unnecessary renders of consumers.
 */

'use client';

import React, {
  createContext,
  useReducer,
  useContext,
  ReactNode,
  useMemo,
  useRef,
  useCallback, // update - 1
} from 'react';
import { zoomReducer, initialZoomState } from './zoomReducer';
import { ZoomAction } from '@/app/Library/Definitions/Definitions';

type RecenterOpts = { clampToInitialFit?: boolean };

interface ZoomContextValue {
  // Existing state (unchanged)
  zoomLevel: number;
  baseZoomLevel: number;
  dispatch: React.Dispatch<ZoomAction>;

  // New imperative centering API (Phase 1)  // update - 2
  setInitialFitZoom: (z: number) => void;
  getInitialFitZoom: () => number | null;
  registerMapCenterHandler: (fn: (opts?: RecenterOpts) => void) => void;
  unregisterMapCenterHandler: () => void;
  requestMapRecenter: (opts?: RecenterOpts) => void;
}

const ZoomContext = createContext<ZoomContextValue | undefined>(undefined);

export const ZoomProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(zoomReducer, initialZoomState);

  // 1) Store the initial "fit-to-viewport" zoom        // update - 3
  const initialFitZoomRef = useRef<number | null>(null);

  // 2) Store a single map-centric handler (registered by MapRenderer) // update - 4
  const mapCenterHandlerRef = useRef<((opts?: RecenterOpts) => void) | null>(null);

  /**
   * @function setInitialFitZoom
   * @description
   *   Records the initial “fit-to-viewport” zoom calculated by MapRenderer after content
   *   is measured. This value is later used by a re-center request to clamp zoom level
   *   down to the initial fit (never upscaling). The useRef avoids re-renders and keeps
   *   this value accessible across unrelated component lifecycles at O(1) cost.
   */
  const setInitialFitZoom = useCallback((z: number) => { // update - 5
    initialFitZoomRef.current = z;
    // console.log('[ZoomProvider.tsx][6101] setInitialFitZoom recorded', { z });
  }, []);

  /**
   * @function getInitialFitZoom
   * @description
   *   Returns the last recorded initial-fit zoom value. Consumers (e.g., MapRenderer) can
   *   safely read it to determine whether a requested re-center should clamp zoom down
   *   to that baseline (never upscaling). O(1), ref-based lookup.
   */
  const getInitialFitZoom = useCallback((): number | null => { // update - 6
    return initialFitZoomRef.current;
  }, []);

  /**
   * @function registerMapCenterHandler
   * @description
   *   Registers a single MapRenderer-owned handler that performs actual DOM scrolling to
   *   the bed/content midpoint and optional zoom clamping. Only the latest registration
   *   is kept. This prevents DOM refs from leaking into reducer state and maintains a
   *   clean separation of responsibilities.
   */
  const registerMapCenterHandler = useCallback((fn: (opts?: RecenterOpts) => void) => { // update - 7
    mapCenterHandlerRef.current = fn;
    // console.log('[ZoomProvider.tsx][6102] registerMapCenterHandler installed');
  }, []);

  /**
   * @function unregisterMapCenterHandler
   * @description
   *   Unregisters the active MapRenderer handler (typically on unmount) to avoid calling
   *   stale references. O(1) reassignment; no side-effects beyond clearing the ref.
   */
  const unregisterMapCenterHandler = useCallback(() => { // update - 8
    mapCenterHandlerRef.current = null;
    // console.log('[ZoomProvider.tsx][6103] unregisterMapCenterHandler cleared');
  }, []);

  /**
   * @function requestMapRecenter
   * @description
   *   Entry point for re-centering requests originating from any component (e.g., the
   *   bottom toolbar). Invokes the handler registered by MapRenderer, if present. This
   *   function contains no DOM logic; it simply coordinates the call and provides a
   *   stable contract for future features (e.g., jump-to-selection).
   */
  const requestMapRecenter = useCallback((opts?: RecenterOpts) => { // update - 9
    if (mapCenterHandlerRef.current) {
      // console.log('[ZoomProvider.tsx][6104] requestMapRecenter invoked', { opts: opts ?? null });
      mapCenterHandlerRef.current(opts);
    } else {
      // console.log('[ZoomProvider.tsx][6105] requestMapRecenter ignored — no handler registered');
    }
  }, []);

  const contextValue: ZoomContextValue = useMemo(() => ({ // update - 10
    ...state,
    dispatch,
    setInitialFitZoom,
    getInitialFitZoom,
    registerMapCenterHandler,
    unregisterMapCenterHandler,
    requestMapRecenter,
  }), [
    state,
    dispatch,
    setInitialFitZoom,
    getInitialFitZoom,
    registerMapCenterHandler,
    unregisterMapCenterHandler,
    requestMapRecenter,
  ]);

  return (
    <ZoomContext.Provider value={contextValue}>
      {children}
    </ZoomContext.Provider>
  );
};

export const useZoomContext = () => {
  const context = useContext(ZoomContext);
  if (!context) {
    throw new Error('useZoomContext must be used within a ZoomProvider');
  }
  return context;
};
