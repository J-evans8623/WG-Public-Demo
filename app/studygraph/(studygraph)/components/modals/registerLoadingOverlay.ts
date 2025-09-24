// app/studygraph/(studygraph)/components/modals/registerLoadingOverlay.ts
/**
 * @file registerLoadingOverlay.ts
 * @description
 * This side-effect module self-registers the LoadingOverlayModal with the global Modal Registry so
 * that the rest of the application can render it via the central modal host without importing the
 * component directly. Its responsibilities are intentionally narrow to support modularity:
 * 1) Import the `LoadingOverlayModal` component and associate it to a stable registry key
 *    ("loadingOverlay") using a lightweight factory function. The factory receives props from the
 *    modal host and returns a React element. This decouples feature components from the host.
 * 2) Provide precise console diagnostics that confirm both the one-time registration at bootstrap
 *    and each subsequent factory invocation with a small payload preview. These logs assist with
 *    debugging during development, hot reloads, and production triage with minimal noise.
 * 3) Avoid JSX in this file. Because the file uses a `.ts` extension and some projects disallow
 *    JSX outside `.tsx`, the factory returns elements using `React.createElement` to keep parsing
 *    compliant, portable across build systems, and free of TypeScript “value used as type” errors.
 * The module performs no DOM operations by itself; it relies on the app’s modal provider to mount
 * the element into the dedicated `#modal-root`. This keeps concerns clean and maintainable.
 */

import React from 'react';
import LoadingOverlayModal from './LoadingOverlayModal';
import { registerModal } from './ModalRegistry';

// update - 1: Use React.createElement in a .ts file (no JSX). Register the factory under a unique key.
registerModal('loadingOverlay', (props: any) => {
  console.log('[registerLoadingOverlay.ts][6302] Factory invoked for loadingOverlay', {
    hasProps: !!props,
    keys: props ? Object.keys(props).slice(0, 5) : [],
  });
  return React.createElement(LoadingOverlayModal, { ...props });
});

// update - 2: Keep bootstrap visibility log to confirm registration executed once per app lifetime.
console.log('[registerLoadingOverlay.ts][6301] LoadingOverlay registered with ModalRegistry');
