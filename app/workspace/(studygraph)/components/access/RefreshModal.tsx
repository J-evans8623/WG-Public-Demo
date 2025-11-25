/***************************************************************************************
 * @file RefreshModal.tsx
 * @description
 *   Enhanced modal component for access transition notifications that integrates with
 *   DocumentAccessHistoryManager to provide intelligent access change detection. This
 *   component now distinguishes between legitimate document-level access changes and
 *   routine file switching operations, eliminating false positive modal triggers that
 *   previously created a "spammy" user experience. The modal automatically monitors
 *   the AccessLayerContext for role changes and uses session-based access history to
 *   determine when user notification is genuinely required.
 *
 *   The component implements smart trigger logic that considers document context, change
 *   significance, temporal cooldowns, and source attribution to ensure modals only appear
 *   for meaningful access transitions such as edit capability loss or privilege escalation.
 *   Integration with the existing collaboration refresh workflow provides seamless user
 *   experience while maintaining backward compatibility with existing modal dismissal
 *   and refresh action handlers. The modal remains styled consistently with the existing
 *   design system while providing enhanced functionality through the new access tracking.
 *
 * Responsibilities:
 *   - Monitor AccessLayerContext for role changes with document-aware detection
 *   - Integrate with DocumentAccessHistoryManager for intelligent trigger decisions
 *   - Display access transition notifications only for significant changes
 *   - Support existing refresh and dismiss workflows with enhanced context
 *   - Maintain consistent UI styling and user experience patterns
 *   - Provide debug logging for access change troubleshooting and observability
 ***************************************************************************************/

import React, { useEffect, useState } from 'react';
import { useAccessLayer } from '@/app/Library/Context/AccessLayerContext';
import DocumentAccessHistoryManager from '@/app/workspace/(studygraph)/components/hooks/access/DocumentAccessHistoryManager';

interface RefreshModalProps {
  onRefresh?: () => void;
}

/**
 * @component RefreshModal
 * @description
 *   Smart access transition modal that automatically detects legitimate document access
 *   changes and presents appropriate user notifications. Eliminates false positives from
 *   file switching while ensuring users are notified of meaningful access revocations
 *   or privilege changes that require immediate attention and potential collaboration refresh.
 */
export const RefreshModal: React.FC<RefreshModalProps> = ({ onRefresh }) => {
  // Step 1: Initialize modal state and access layer integration
  const [isOpen, setIsOpen] = useState(false);
  const [changeDetails, setChangeDetails] = useState<{
    fromRole: string;
    toRole: string;
    docId: string;
  } | null>(null);
  
  const access = useAccessLayer();
  const historyManager = DocumentAccessHistoryManager.getInstance();

  /**
   * @effect AccessLayerMonitor
   * @description
   *   Monitors the AccessLayerContext for role changes and uses DocumentAccessHistoryManager
   *   to determine when modal display is appropriate. Handles both document initialization
   *   and legitimate access changes while filtering out file switching operations through
   *   comprehensive access history analysis and change significance evaluation.
   */
  useEffect(() => {

    // Step 2: Validate required context for modal evaluation
    if (!access.docId || !access.lastEvent) {
      // console.log('[RefreshModal.tsx][3002] › Insufficient context for modal evaluation');
      return;
    }

    // Step 3: Update document access history with current state
    const accessChanged = historyManager.updateDocumentAccess(
      access.docId,
      access.role,
      'bootstrap'
    );

    if (!accessChanged) {
      // console.log('[RefreshModal.tsx][3003] › No access change detected, modal evaluation skipped');
      return;
    }

    // Step 4: Evaluate modal trigger conditions through history manager
    const shouldTrigger = historyManager.shouldTriggerModal(
      access.docId,
      access.role,
    );

    if (shouldTrigger) {
      // Step 5: Extract change details for user-friendly display
      const history = historyManager.getDocumentHistory(access.docId);
      if (history && history.previousRole) {
        setChangeDetails({
          fromRole: history.previousRole,
          toRole: access.role,
          docId: access.docId
        });
        
        setIsOpen(true);
      }
    } 
  }, [access.docId, access.role, access.lastEvent, historyManager, access.prevRole]);

  /**
   * @method handleDismiss
   * @description
   *   Handles modal dismissal by resetting display state and clearing change details.
   *   Maintains user control over notification visibility while preserving access
   *   history for future change detection. Provides logging for user interaction
   *   tracking and debugging modal behavior patterns.
   */
  const handleDismiss = (): void => {

    
    setIsOpen(false);
    setChangeDetails(null);
  };

  /**
   * @method handleRefresh
   * @description
   *   Handles collaboration refresh action by invoking the provided refresh callback
   *   and closing the modal. Integrates with existing refresh workflows while providing
   *   enhanced context about the access change that triggered the refresh requirement.
   *   Supports optional refresh callback for backward compatibility.
   */
  const handleRefresh = (): void => {
    
    if (onRefresh) {
      onRefresh();
    }
    
    setIsOpen(false);
    setChangeDetails(null);
  };

  /**
   * @method getModalMessage
   * @description
   *   Generates user-friendly access change messages based on role transition details.
   *   Provides clear communication about access changes while maintaining appropriate
   *   tone for different types of privilege modifications. Handles both upgrade and
   *   downgrade scenarios with contextually appropriate messaging and action guidance.
   */
  const getModalMessage = (): { title: string; message: string; action: string } => {
    if (!changeDetails) {
      return {
        title: 'Permissions changed',
        message: 'Your access level has been modified.',
        action: 'Refresh'
      };
    }

    const { fromRole, toRole } = changeDetails;
    const fromCanEdit = (fromRole === 'Owner' || fromRole === 'Editor');
    const toCanEdit = (toRole === 'Owner' || toRole === 'Editor');

    // Step 1: Handle privilege downgrade scenarios
    if (fromCanEdit && !toCanEdit) {
      return {
        title: 'Edit access removed',
        message: `Your access has changed from ${fromRole} to ${toRole}. You now have read-only access to this document.`,
        action: 'Refresh to read-only mode'
      };
    }

    // Step 2: Handle privilege upgrade scenarios  
    if (!fromCanEdit && toCanEdit) {
      return {
        title: 'Edit access granted',
        message: `Your access has been upgraded from ${fromRole} to ${toRole}. You can now edit this document.`,
        action: 'Refresh to enable editing'
      };
    }

    // Step 3: Handle lateral role changes (same privilege level)
    return {
      title: 'Role updated',
      message: `Your role has changed from ${fromRole} to ${toRole}.`,
      action: 'Refresh'
    };
  };

  // Step 4: Early return for hidden modal state
  if (!isOpen) {
    return null;
  }

  const { title, message, action } = getModalMessage();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="rounded-md bg-white shadow-lg p-4 w-[400px]">
        <h3 className="text-base font-semibold mb-2">{title}</h3>
        <p className="text-sm text-gray-600 mb-4">
          {message}
        </p>
        {changeDetails && (
          <div className="text-xs text-gray-500 mb-4 font-mono">
            Document: {changeDetails.docId.substring(0, 8)}...
          </div>
        )}
        <div className="flex gap-2 justify-end">
          <button
            onClick={handleDismiss}
            className="px-3 py-1 border rounded hover:bg-gray-50 transition-colors"
          >
            Dismiss
          </button>
          <button
            onClick={handleRefresh}
            className="px-3 py-1 rounded bg-black text-white hover:bg-gray-800 transition-colors"
          >
            {action}
          </button>
        </div>
      </div>
    </div>
  );
};