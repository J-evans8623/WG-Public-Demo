/***************************************************************************************
 * @file app/src/access/useCanvasController.tsx
 * @description
 *   useCanvasController hook provides the logic for switching between editable and
 *   read-only canvas modes based on access state, without wrapping components in
 *   additional React boundaries that break layout inheritance. This preserves the
 *   original layout structure from AppLayout.tsx while providing the same access
 *   control functionality as the previous CanvasController component.
 *
 * Responsibilities:
 *   1) Subscribe to AccessLayerContext and determine which canvas to render
 *   2) Handle access transition signals and modal state
 *   3) Provide autosave pause/resume callbacks
 *   4) Return the appropriate canvas component and modal JSX
 ***************************************************************************************/

import { useEffect, useState, useCallback } from 'react';
import { useAccessLayer } from '@/app/Library/Context/AccessLayerContext';

interface UseCanvasControllerProps {
  /** Mirror prop for CanvasView to keep the header status unchanged. */
  autosaveStatus: 'saving' | 'saved';
  /** Optional: pause autosave when switching modes. */
  onPauseAutosave?: () => void;
  /** Optional: resume autosave after switch is complete. */
  onResumeAutosave?: () => void;
  /** Optional: trigger a Yjs reconnect when user clicks refresh. */
  onReconnectCollab?: () => void;
}

interface UseCanvasControllerReturn {
  canEdit: boolean;
  showRefreshModal: boolean;
  refreshModalProps: {
    onDismiss: () => void;
    onRefresh: () => void;
  };
}

export const useCanvasController = ({
  autosaveStatus,
  onPauseAutosave,
  onResumeAutosave,
  onReconnectCollab,
}: UseCanvasControllerProps): UseCanvasControllerReturn => {
  const { role, lastEvent, canEdit } = useAccessLayer();
  const [showRefreshModal, setShowRefreshModal] = useState(false);

  // 1) Watch transitions and surface refresh UI when appropriate
  useEffect(() => {
    if (!lastEvent) return;
    if (lastEvent.signal === 'EDIT_REVOKED' || lastEvent.signal === 'GRANT_EDIT') {
      console.log('[useCanvasController][9301] access transition', { roleAfter: role, event: lastEvent });
      setShowRefreshModal(true);
    }
  }, [lastEvent, role]);

  // 2) Pause/resume autosave around mode switches
  useEffect(() => {
    onPauseAutosave?.();
    const t = setTimeout(() => onResumeAutosave?.(), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit]);

  const handleRefresh = useCallback(() => {
    console.log('[useCanvasController][9302] refresh requested by user');
    setShowRefreshModal(false);
    onReconnectCollab?.();
  }, [onReconnectCollab]);

  const handleDismiss = useCallback(() => {
    console.log('[useCanvasController][9303] refresh dismissed');
    setShowRefreshModal(false);
  }, []);

  return {
    canEdit,
    showRefreshModal,
    refreshModalProps: {
      onDismiss: handleDismiss,
      onRefresh: handleRefresh,
    },
  };
};