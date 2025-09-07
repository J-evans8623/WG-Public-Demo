/**
 * @file TopicGeneratorModal.tsx (Enhanced with Centralized API Integration)
 * @description
 * Enhanced topic generation modal that integrates with the centralized API service system for
 * consistent subscription management and error handling across both map and PDF exploration
 * pipelines. This updated implementation replaces direct legacy API calls with the centralized
 * EnhancedApiService while maintaining the existing visual design and dual-mode functionality.
 * The component supports both map-based topic expansion and PDF text exploration workflows
 * while providing backend-driven subscription validation where freemium users are automatically
 * prompted for upgrades when attempting to access premium topic exploration features. The enhanced
 * implementation ensures seamless integration with the event-driven error handling system that
 * triggers appropriate modals for subscription requirements and rate limiting scenarios without
 * disrupting the core user experience. All topic generation operations are processed through
 * the unified API service with comprehensive error handling and node management capabilities.
 * 
 * Responsibilities:
 * - Provide dual-mode interface for topic exploration from map nodes or PDF text selections
 * - Integrate with enhanced API service for consistent subscription management and error handling
 * - Maintain existing visual design, accessibility, and dual-pipeline functionality
 * - Handle subscription validation through backend-driven error handling and modal triggering
 * - Process successful topic generation through existing node creation and management systems
 * - Support comprehensive logging for debugging and user interaction tracking
 * - Ensure seamless integration with centralized modal management for error scenarios
 */

import React, { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { apiService } from '@/app/src/services/ApiService';
import { parseTopicResponse } from '@/app/studygraph/(studygraph)/components/hooks/topicResponseParser';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { useSubTreeContext } from '@/app/Library/Context/SubTreeProvider';
import useCardCrudOperations from '@/app/studygraph/(studygraph)/components/hooks/useCardCrudOperations';
import useExportStudyData from '@/app/studygraph/(studygraph)/components/utils/exportStudyData';
import { useLessonModule } from '@/app/Library/Context/LessonModuleContext';
import { useYDoc } from '@/app/Library/Context/YDocContext';
import { useSelectionAttachment } from '@/app/Library/Context/SelectionAttachmentContext';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import AttachedTextBubble from './AttachedTextBubble';

interface TopicGeneratorModalProps {
  /** Whether modal is open */
  isOpen: boolean;
  /** Called when modal should close (clears attachment) */
  onClose: () => void;
  /** For non-PDF mode: the node to expand under */
  targetNodeId: string;
}

/**
 * TopicGeneratorModal
 * @description
 * Enhanced topic generation modal component that integrates with the centralized API service
 * system for consistent subscription management and error handling. The component maintains
 * existing dual-mode functionality (map vs PDF exploration) while replacing legacy API calls
 * with the unified service that automatically handles subscription validation, rate limiting,
 * and error modal triggering. This ensures consistent user experience across all AI services
 * while preserving the existing topic expansion and node generation workflows.
 * @param isOpen Boolean indicating whether the modal should be displayed
 * @param onClose Callback function executed when modal should be closed
 * @param targetNodeId Node identifier for map-based topic expansion target
 * @returns Enhanced topic generator modal with centralized API integration
 */
const TopicGeneratorModal: React.FC<TopicGeneratorModalProps> = ({
  isOpen,
  onClose,
  targetNodeId,
}) => {
  // Context hooks for existing functionality
  const { attachedText, clearAttachment } = useSelectionAttachment();
  const { nodes, updateNodeTitle, setNodes } = useNodesContext();
  const { subtrees, setSubtrees } = useSubTreeContext();
  const { createResource } = useCardCrudOperations();
  const exportStudyData = useExportStudyData();
  const { activeConceptMapId } = useLessonModule();
  const { docFileID } = useYDoc();
  const { groupSelect } = useNodeSelection();

  // Local state management
  const [topicRequest, setTopicRequest] = useState('');
  const [mergeOption, setMergeOption] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('');

  // Reset form whenever opened
  useEffect(() => {
    if (isOpen) {
      setTopicRequest('');
      setMergeOption(true);
      setError(null);
      setIsLoading(false);
      setSelectedNodeId('');
    }
  }, [isOpen]);

  // Wrapper functions for context setters to match parser API expectations
  const wrappedSetNodes = useCallback(
    (m: Map<string, any>, mapID?: string) => setNodes(m, undefined, mapID),
    [setNodes]
  );
  const wrappedSetSubtrees = useCallback(
    (m: Map<string, any>, mapID?: string) => setSubtrees(m, undefined, mapID),
    [setSubtrees]
  );

  // Pipeline detection and node management
  const usingPdf = attachedText.trim().length > 0;
  const rootNodeId = usingPdf ? selectedNodeId : targetNodeId;
  const nodeArray = Array.from(nodes.values());

  /**
   * handleClose
   * @description
   * Enhanced modal closure handler that manages PDF attachment cleanup and loading state
   * validation while maintaining existing modal closure behavior and preventing accidental
   * closure during active processing operations for optimal user experience and data integrity.
   * @returns Promise resolving when modal closure processing is complete
   */
  const handleClose = useCallback(() => {
    if (!isLoading) {
      onClose();
      if (usingPdf) clearAttachment();
    }
  }, [isLoading, onClose, usingPdf, clearAttachment]);

  /**
   * handleGenerate
   * @description
   * Enhanced topic generation handler that integrates with the centralized API service
   * for consistent subscription management and error handling. This method replaces legacy
   * API calls with the unified service that automatically handles subscription validation,
   * rate limiting, and error modal triggering while maintaining existing topic processing
   * and node creation workflows. The implementation ensures seamless user experience with
   * automatic error handling through the event-driven architecture.
   * @returns Promise resolving when topic generation is complete or error handling triggered
   */
  const handleGenerate = async () => {
    // Step 1: Validate input requirements
    if (!topicRequest.trim()) return;
    if (usingPdf && !rootNodeId) {
      setError('Please select a topic from the dropdown above.');
      return;
    }

    console.log('[TopicGeneratorModal.tsx][4013] Topic generation initiated', {
      usingPdf,
      hasRequest: !!topicRequest.trim(),
      rootNodeId,
      mergeOption
    });

    setIsLoading(true);
    setError(null);

    try {
      // Step 2: Export existing map state for context
      const exportData = exportStudyData([rootNodeId]);
      
      console.log('[TopicGeneratorModal.tsx][4014] Study data exported for topic generation', {
        dataLength: exportData.length,
        targetNode: rootNodeId
      });

      // Step 3: Call enhanced API service instead of legacy generateTopic
      const response = await apiService.exploreTopic(
        topicRequest.trim(),
        exportData,
        docFileID || '',
        attachedText
      );

      // Step 4: Process successful response
      if (response.success && response.data) {
        console.log('[TopicGeneratorModal.tsx][4015] Topic generation response received successfully');

        // Step 5: Parse and insert nodes using existing parser
        const { createdNodeIds } = await parseTopicResponse(
          response.data,
          {
            updateNodeTitle,
            setNodes: wrappedSetNodes,
            nodes,
            createResource,
            setSubtrees: wrappedSetSubtrees,
            subtrees,
            getRootNode: rootNodeId,
          },
          activeConceptMapId,
          mergeOption
        );

        console.log('[TopicGeneratorModal.tsx][4016] Topic nodes created successfully', {
          createdNodeCount: createdNodeIds.length
        });

        // Step 6: Highlight all new nodes and close modal
        groupSelect(createdNodeIds);
        handleClose();
      } else {
        // Step 7: Error handling is managed by the enhanced API service event system
        console.log('[TopicGeneratorModal.tsx][4017] Topic generation failed, error handled by event system', {
          success: response.success,
          errorType: response.error?.type
        });
        setError('Failed to generate topic. Please try again later.');
        setIsLoading(false);
      }
    } catch (err) {
      // Step 8: Catch-all error handling for unexpected failures
      console.error('[TopicGeneratorModal.tsx][4018] Unexpected error in topic generation:', err);
      setError('Failed to generate topic. Please try again later.');
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black opacity-50" onClick={handleClose} />

      {/* modal */}
      <div className="relative bg-white w-[450px] max-w-full rounded shadow-lg p-6 z-10 max-h-[80vh] overflow-y-auto">
        {/* header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Generate New Topic</h2>
          <button
            onClick={handleClose}
            disabled={isLoading}
            aria-label="Close"
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* instruction */}
        <p className="text-sm text-gray-600 mb-4">
          {usingPdf
            ? 'Select where on the map to place the new topic.'
            : 'Select a topic on the map, then describe what you would like to explore:'}
        </p>

        {/* dropdown or title */}
        <div className="bg-gray-100 border border-gray-200 rounded p-3 mb-4">
          {usingPdf ? (
            <select
              className="w-full border border-gray-300 rounded p-2 text-sm"
              value={selectedNodeId}
              onChange={e => setSelectedNodeId(e.target.value)}
              disabled={isLoading}
            >
              <option value="">— Select a topic —</option>
              {nodeArray.map(n => (
                <option key={n.id} value={n.id}>
                  {n.title}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm font-semibold text-orange-600">
              {nodes.get(targetNodeId)?.title || '—'}
            </p>
          )}
        </div>

        {/* PDF attachment preview */}
        {usingPdf && (
          <div className="mb-4">
            <AttachedTextBubble text={attachedText} onCancel={clearAttachment} />
          </div>
        )}

        {/* user prompt */}
        <label className="block text-sm text-gray-700 mb-1">
          {usingPdf
            ? 'Describe the topic you want to explore from the selected text:'
            : 'Describe the topic to explore:'}
        </label>
        <textarea
          rows={3}
          className="w-full border border-gray-300 rounded p-2 mb-3 text-sm resize-vertical"
          value={topicRequest}
          onChange={e => setTopicRequest(e.target.value)}
          disabled={isLoading}
        />

        {/* merge checkbox */}
        <div className="flex items-center mb-4">
          <input
            id="mergeCheckbox"
            type="checkbox"
            className="h-4 w-4 text-blue-600 border-gray-300 rounded"
            checked={mergeOption}
            onChange={e => setMergeOption(e.target.checked)}
            disabled={isLoading}
          />
          <label htmlFor="mergeCheckbox" className="ml-2 text-sm text-gray-700">
            Merge content into selected topic
          </label>
        </div>

        {/* error */}
        {error && <div className="text-sm text-red-500 mb-3">{error}</div>}

        {/* actions */}
        <div className="flex justify-end gap-2">
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={isLoading || !topicRequest.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            {isLoading ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TopicGeneratorModal;