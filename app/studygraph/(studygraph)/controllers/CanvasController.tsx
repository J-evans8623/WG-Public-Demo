/***************************************************************************************
 * @file app/src/access/CanvasController.tsx
 * @description
 *   CanvasController renders the correct canvas experience based on the resolved access
 *   state from AccessLayerContext. If the active role is Owner/Editor we render the
 *   interactive CanvasView; if the role is Viewer we render the read-only ROCanvasView.
 *   The controller also reacts to access transition signals (e.g., EDIT_REVOKED) and
 *   displays a tiny refresh modal that allows the user to re-bootstrap collaboration or
 *   simply dismiss. Optional hooks can pause/resume autosave and trigger a reconnect,
 *   but the default behavior is conservative (no reloads) to avoid UX flicker. Logs are
 *   concise and tagged with a consistent 4-digit code for troubleshooting.
 *
 * FIXED: Added proper theme wrapper with all necessary CSS classes and data attributes
 * to match the structure that was previously in AppLayout.tsx. This ensures:
 * - Card display renders correctly
 * - ConceptMap is properly centered  
 * - Background design (light brown dots) is fully applied
 *
 * Responsibilities:
 *   1) Subscribe to AccessLayerContext and branch RW/RO rendering.
 *   2) Show a lightweight modal on access transitions to guide user action.
 *   3) Offer optional callbacks to pause autosave and reconnect collab (if provided).
 *   4) Maintain proper theme scope and layout structure for consistent styling.
 ***************************************************************************************/

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAccessLayer } from '@/app/Library/Context/AccessLayerContext';
import { CanvasView } from '@/app/studygraph/(studygraph)/components/layout/Canvas/CanvasView';
import ROCanvasView from '@/app/studygraph/(studygraph)/components/layout/Canvas/ReadOnly/CanvasView';

interface CanvasControllerProps {
  /** Mirror prop for CanvasView to keep the header status unchanged. */
  autosaveStatus: 'saving' | 'saved';
  /** Optional: pause autosave when switching modes. */
  onPauseAutosave?: () => void;
  /** Optional: resume autosave after switch is complete. */
  onResumeAutosave?: () => void;
  /** Optional: trigger a Yjs reconnect when user clicks refresh. */
  onReconnectCollab?: () => void;
}

const CanvasController: React.FC<CanvasControllerProps> = ({
  autosaveStatus,
  onPauseAutosave,
  onResumeAutosave,
  onReconnectCollab,
}) => {
  const { role, lastEvent, canEdit } = useAccessLayer();
  const [showRefresh, setShowRefresh] = useState(false);

  // 1) Watch transitions and gently surface refresh UI when appropriate
  useEffect(() => {
    if (!lastEvent) return;
    if (lastEvent.signal === 'EDIT_REVOKED' || lastEvent.signal === 'GRANT_EDIT') {
      console.log('[CanvasController.tsx][9301] access transition', { roleAfter: role, event: lastEvent });
      setShowRefresh(true);
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
    console.log('[CanvasController.tsx][9302] refresh requested by user');
    setShowRefresh(false);
    onReconnectCollab?.();
    // We do NOT hard reload to preserve UX; reconnect hook can be wired later.
  }, [onReconnectCollab]);

  return (
    <>
      {/* FIXED: Add the same theme wrapper structure that was in AppLayout.tsx */}
      <div 
        className="flex-1 flex bg-white theme-warm-board theme-scope"
        data-theme="warm-board"
      >
        {canEdit ? (
          <CanvasView autosaveStatus={autosaveStatus} />
        ) : (
          <ROCanvasView />
        )}
      </div>

      {showRefresh && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="rounded-md bg-white shadow-lg p-4 w-[320px]">
            <h3 className="text-base font-semibold mb-2">Permissions changed</h3>
            <p className="text-sm text-gray-600 mb-4">
              Your access just changed. Click refresh to reinitialize collaboration.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { console.log('[CanvasController.tsx][9303] refresh dismissed'); setShowRefresh(false); }}
                className="px-3 py-1 border rounded"
              >
                Dismiss
              </button>
              <button
                onClick={handleRefresh}
                className="px-3 py-1 rounded bg-black text-white"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CanvasController;