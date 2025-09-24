/***************************************************************************************
 * @file NavigationController.tsx
 * @description
 *   This smart controller chooses between the read-only and read/write navigation panels.
 *   Historically, it queried the DocumentAccessManager singleton directly to infer the
 *   current user capability for the active document. That approach created multiple
 *   scattered consumers of the access layer and is now deprecated in favor of the
 *   centralized subscription owned by `ApiProvider`. In this update, the component reads
 *   a narrow, memoized access snapshot from `useAccessSnapshot()` and a precomputed
 *   `editReady` boolean from `useEditReady()`. This eliminates duplicate subscriptions,
 *   avoids unnecessary re-renders, and keeps the `ApiContext` value stable. The visual
 *   structure and props contract remain unchanged. Focused console logs (file tag plus a
 *   unique 4-digit code) mark access decisions and selected panel to support production
 *   debugging. All logic is O(1); rendering complexity remains unchanged.
 *
 * Responsibilities:
 *   - Consume centralized access state via ApiProvider fan-out contexts.
 *   - Select the proper navigation panel (read-only vs read/write) based on capability.
 *   - Forward all props to the chosen panel without altering the interface.
 *   - Provide concise, high-signal logs for access-driven branching.
 *   - Preserve existing CSS/DOM structure by delegating to existing panels.
 ***************************************************************************************/

import React from 'react';
import NavigationPanel from './components/layout/Sidebar/NavigationPanel';
import ReadOnlyNavigationPanel from './components/layout/ReadOnly/navigation/ReadOnlyNavigationPanel';
// update - 1
import { useAccessSnapshot, useEditReady } from '@/app/src/context/ApiContext'; // update - 1


/**
 * The top-level view types that can be displayed.
 */
type TopLevelView = 'home' | 'map' | 'user';

/**
 * @interface NavigationControllerProps
 * @description Props for the NavigationController component that will be forwarded
 *              to whichever navigation panel component is selected based on access control.
 * @property {boolean} [isManuallyOpen] - If true, the panel is forced open by manual toggle.
 * @property {TopLevelView} currentView - The currently active top-level view.
 * @property {(view: TopLevelView) => void} onSetView - Callback to set the top-level view.
 * @property {(expanded: boolean) => void} [onExpandedChange] - Optional callback to inform
 *           parent components of the panel's expanded/collapsed state.
 */
interface NavigationControllerProps {
  isManuallyOpen?: boolean;
  currentView: TopLevelView;
  onSetView: (view: TopLevelView) => void;
  onExpandedChange?: (expanded: boolean) => void;
}

/**
 * @function NavigationController
 * @description
 *   Selects the appropriate navigation panel for the current access state. It uses the centralized
 *   `useAccessSnapshot()` hook to obtain `{ mode, status, docId }` and the precomputed `useEditReady()`
 *   to decide if the user can perform write actions. When `editReady` is true, the read/write
 *   NavigationPanel is rendered; otherwise the read-only variant is shown. All props are forwarded
 *   unchanged to preserve the existing interface. This strategy avoids duplicate access subscriptions,
 *   keeps reactivity narrow, and ensures consistent access gating. Time complexity is O(1); no lists
 *   or heavy computations are performed here.
 */
const NavigationController: React.FC<NavigationControllerProps> = (props) => {
  console.log('[NavigationController.tsx][3101] render', {
    currentView: props.currentView,
    isManuallyOpen: props.isManuallyOpen ?? null,
  });

  // update - 2
  const { mode, status, docId } = useAccessSnapshot(); // update - 2
  // update - 3
  const editReady = useEditReady(); // update - 3

  console.log('[NavigationController.tsx][3102] access snapshot', {
    docId,
    mode,
    status,
    editReady,
  });

  // update - 4
  const canEdit = editReady; // single source of truth (provider-precomputed) // update - 4

  if (canEdit) {
    console.log('[NavigationController.tsx][3103] rendering RW NavigationPanel', { docId });
    return <NavigationPanel {...props} />;
  } else {
    console.log('[NavigationController.tsx][3104] rendering RO NavigationPanel', { docId });
    return <ReadOnlyNavigationPanel {...props} />;
  }
};

export default NavigationController;
