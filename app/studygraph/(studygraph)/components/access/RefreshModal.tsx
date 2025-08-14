/***************************************************************************************
 * @file app/src/access/RefreshModal.tsx
 * @description
 *   Standalone modal component for access transition notifications. Extracted from
 *   the original CanvasController to be rendered separately, preserving the modal
 *   functionality while allowing the main canvas layout to remain uninterrupted.
 ***************************************************************************************/

import React from 'react';

interface RefreshModalProps {
  isOpen: boolean;
  onDismiss: () => void;
  onRefresh: () => void;
}

export const RefreshModal: React.FC<RefreshModalProps> = ({
  isOpen,
  onDismiss,
  onRefresh,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="rounded-md bg-white shadow-lg p-4 w-[320px]">
        <h3 className="text-base font-semibold mb-2">Permissions changed</h3>
        <p className="text-sm text-gray-600 mb-4">
          Your access just changed. Click refresh to reinitialize collaboration.
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onDismiss}
            className="px-3 py-1 border rounded"
          >
            Dismiss
          </button>
          <button
            onClick={onRefresh}
            className="px-3 py-1 rounded bg-black text-white"
          >
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
};