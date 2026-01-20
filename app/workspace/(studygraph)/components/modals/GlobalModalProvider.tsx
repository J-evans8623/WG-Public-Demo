/**
 * @file GlobalModalProvider.tsx
 * @description
 * This file defines a production-grade, app-root modal system provider that guarantees a single,
 * persistent modal host for the entire application lifecycle. It encapsulates the modal
 * management logic using the existing `useModalManager()` hook and exposes a context-based API
 * for `showModal` and `hideModal` so feature components do not mount their own modal hosts.
 * The provider also renders exactly one <ModalRenderer /> to ensure all modals share a stable
 * ownership container—this eliminates ownership races and flicker during autosave or heavy
 * re-renders. The provider is designed to be mounted at the highest level (here: AppLayout)
 * to ensure that the portal target (#modal-root) and the host are always present across routes
 * and views. The implementation is lightweight, debuggable, and optimized for O(1) context
 * reads with clear lifecycle logs for observability. It does not alter visual styling or modal
 * content; it only orchestrates where and how modals are hosted. This separation of concerns
 * helps future-proof modal flows (upgrade prompts, rate limit, uploads, lesson generation),
 * ensuring they remain stable regardless of autosave or view switches while preserving a11y.
 *
 * Notable features:
 * 1) Single modal host mounted once for app lifetime.
 * 2) Context API for show/hide that is O(1) to access.
 * 3) Purposeful logs with file+code tags for diagnostics (e.g., [GlobalModalProvider.tsx][4101]).
 * 4) Step-by-step comments to support future maintenance and onboarding.
 */

'use client';

import React, { createContext, useContext, useMemo } from 'react';
import '@/app/workspace/(studygraph)/components/modals/registerLoadingOverlay';
import { useModalManager } from '@/app/workspace/(studygraph)/components/modals/AppModals';
import '@/app/workspace/(studygraph)/components/FlyerCampaigns/registerFlyerModal';

type GlobalModalContextValue = {
  showModal: ReturnType<typeof useModalManager>['showModal'];
  hideModal: ReturnType<typeof useModalManager>['hideModal'];
};

/**
 * @function GlobalModalProvider
 * @description
 * Provides a single, authoritative modal host and the public API for triggering modals from
 * anywhere in the React tree. It uses the existing modal manager hook and renders the
 * <ModalRenderer /> exactly once, guaranteeing a stable host that survives autosave and view
 * changes. Consumers should access `showModal` and `hideModal` via `useGlobalModal()`, which
 * are O(1) context lookups and avoid prop-drilling or duplicate hosts.
 */
const GlobalModalContext = createContext<GlobalModalContextValue | null>(null);

export const GlobalModalProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  // Step 1: Initialize the single modal manager at the root (one time for app lifetime).
  const { showModal, hideModal, ModalRenderer } = useModalManager();
  // console.log('[GlobalModalProvider.tsx][4101] GlobalModalProvider mounted; single host established');

  // Step 2: Memoize the context value for O(1) consumption without re-computation.
  const ctx = useMemo<GlobalModalContextValue>(() => {
    // console.log('[GlobalModalProvider.tsx][4102] Global modal context prepared');
    return { showModal, hideModal };
  }, [showModal, hideModal]);

  // Step 3: Render children and exactly one ModalRenderer at root to avoid re-mounts.
  return (
    <GlobalModalContext.Provider value={ctx}>
      {children}
      <ModalRenderer />
    </GlobalModalContext.Provider>
  );
};

/**
 * @function useGlobalModal
 * @description
 * Hook that provides access to the global modal API (`showModal` and `hideModal`) via context.
 * It is intentionally thin and O(1) for lookups, making it safe to call anywhere in the app
 * without performance concerns. If the provider is not found, an error is thrown to surface
 * incorrect usage early during development and testing.
 */
export const useGlobalModal = (): GlobalModalContextValue => {
  const value = useContext(GlobalModalContext);
  if (!value) {
    console.error('[GlobalModalProvider.tsx][4103] useGlobalModal called without provider');
    throw new Error('useGlobalModal must be used within GlobalModalProvider');
  }
  return value;
};
