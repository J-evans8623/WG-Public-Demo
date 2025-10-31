/**
 * @file TopicGeneratorModal.tsx (Branded)
 * Notes:
 * - Uses shared modalStyles.css for overlay/container/buttons/inputs.
 * - Shows the global loading overlay via showModal('loadingOverlay') + hideModal() in finally.
 * - While loading, this component keeps itself mounted but does NOT render its own overlay/container
 *   to avoid double-dimming and to match Navigation/Dropdown flows exactly.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { useGlobalModal } from '@/app/studygraph/(studygraph)/components/modals/GlobalModalProvider';
import AttachedTextBubble from './AttachedTextBubble';

// ✅ Apply branded modal styles (same file ShareModal uses)
import '@/app/studygraph/(studygraph)/components/modals/modalStyles.css';

interface TopicGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetNodeId: string;
}

const TopicGeneratorModal: React.FC<TopicGeneratorModalProps> = ({
  isOpen,
  onClose,
  targetNodeId,
}) => {
  const { attachedText, clearAttachment } = useSelectionAttachment();
  const { nodes, updateNodeTitle, setNodes } = useNodesContext();
  const { subtrees, setSubtrees } = useSubTreeContext();
  const { createResource } = useCardCrudOperations();
  const exportStudyData = useExportStudyData();
  const { activeConceptMapId } = useLessonModule();
  const { docFileID } = useYDoc();
  const { groupSelect } = useNodeSelection();
  const { showModal, hideModal } = useGlobalModal();

  const [topicRequest, setTopicRequest] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('');
  const mergeOption = true;

  // Focus ref for retry UX
  const promptRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTopicRequest('');
      setError(null);
      setIsLoading(false);
      setSelectedNodeId('');
    }
  }, [isOpen]);

  // When an error occurs and loading ends, focus the textarea for quick retry
  useEffect(() => {
    if (isOpen && !isLoading && error && promptRef.current) {
      promptRef.current.focus();
    }
  }, [isOpen, isLoading, error]);

  const wrappedSetNodes = useCallback(
    (m: Map<string, any>, mapID?: string) => setNodes(m, undefined, mapID),
    [setNodes]
  );
  const wrappedSetSubtrees = useCallback(
    (m: Map<string, any>, mapID?: string) => setSubtrees(m, undefined, mapID),
    [setSubtrees]
  );

  const usingPdf = attachedText.trim().length > 0;
  const rootNodeId = usingPdf ? selectedNodeId : targetNodeId;
  const nodeArray = Array.from(nodes.values());

  const handleClose = useCallback(() => {
    if (!isLoading) {
      onClose();
      if (usingPdf) clearAttachment();
    }
  }, [isLoading, onClose, usingPdf, clearAttachment]);

  /**
   * Branded loading + generate
   */
  const handleGenerate = async () => {
    if (!topicRequest.trim()) return;
    if (usingPdf && !rootNodeId) {
      setError('Please select a topic from the dropdown above.');
      return;
    }

    setIsLoading(true);
    setError(null);

    // Show the centralized global loading overlay (same as Navigation/Dropdown)
    showModal('blockingProgress', {
      title: 'Generating topic…',
      message: 'Parsing context and preparing your map additions.',
      ariaLabel: 'Generating topic',
    });

    try {
      const exportData = exportStudyData([rootNodeId]);

      const response = await apiService.exploreTopic(
        topicRequest.trim(),
        exportData,
        docFileID || '',
        attachedText
      );

      if (response.success && response.data) {
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

        groupSelect(createdNodeIds);
        handleClose();
      } else {
        setError('Failed to generate topic. Please try again later.');
      }
    } catch (err) {
      console.error('[TopicGeneratorModal] unexpected error', err);
      setError('Failed to generate topic. Please try again later.');
    } finally {
      // Hide the global loader and bring the form back (if still open)
      hideModal(); // single-active-modal host
      setIsLoading(false);
    }
  };

  // If the modal isn't open, render nothing
  if (!isOpen) return null;

  // While loading, DO NOT render the modal/backdrop.
  // Keep the component mounted to preserve local state for the error path.
  if (isLoading) return <span data-keep-mounted="true" />;

  // Stop overlay click from closing when clicking inside the panel
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Generate New Topic"
      onClick={handleClose}
    >
      <div
        className="modal-container"
        style={{ width: 520, maxWidth: '92vw' }}
        onClick={stop}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <h2 className="modal-title" style={{ flex: 1, marginBottom: 0, textAlign: 'left' }}>
            Generate New Topic
          </h2>
          <button
            onClick={handleClose}
            disabled={isLoading}
            aria-label="Close"
            title="Close"
            type="button"
            style={{
              border: 'none',
              background: 'transparent',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.5 : 1,
              padding: 4,
              lineHeight: 0,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Instruction */}
        <p className="modal-subtext" style={{ textAlign: 'left', marginTop: 8 }}>
          {usingPdf
            ? 'Select where on the map to place the new topic.'
            : 'Select a topic on the map, then describe what you would like to explore:'}
        </p>

        {/* Dropdown or fixed title */}
        <div className="form-section">
          <label className="form-label">
            {usingPdf ? 'Place under:' : 'Selected topic:'}
          </label>

          {usingPdf ? (
            <select
              className="text-input"
              value={selectedNodeId}
              onChange={(e) => setSelectedNodeId(e.target.value)}
              disabled={isLoading}
            >
              <option value="">— Select a topic —</option>
              {nodeArray.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.title}
                </option>
              ))}
            </select>
          ) : (
            <div
              className="text-input"
              style={{ backgroundColor: '#FAF8F5', pointerEvents: 'none' }}
              aria-readonly
            >
              {nodes.get(targetNodeId)?.title || '—'}
            </div>
          )}
        </div>

        {/* PDF attachment preview */}
        {usingPdf && (
          <div className="form-section">
            <AttachedTextBubble text={attachedText} onCancel={clearAttachment} />
          </div>
        )}

        {/* Prompt */}
        <div className="form-section">
          <label className="form-label">
            {usingPdf
              ? 'Describe the topic you want to explore from the selected text:'
              : 'Describe the topic to explore:'}
          </label>
          <textarea
            ref={promptRef}
            rows={3}
            className="text-input"
            value={topicRequest}
            onChange={(e) => setTopicRequest(e.target.value)}
            disabled={isLoading}
            style={{ resize: 'vertical' }}
          />
        </div>

        {/* Merge checkbox (kept simple; inline style only) */}
        <div className="form-section" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            id="mergeCheckbox"
            type="checkbox"
            checked={mergeOption}
            disabled
            className="radio-input"
            style={{ margin: 0 }}
          />
          <label htmlFor="mergeCheckbox" className="radio-label">
            Merge content into selected topic
          </label>
        </div>

        {/* Error */}
        {error && <div className="error-message" role="alert">{error}</div>}

        {/* Actions */}
        <div className="button-section">
          <button
            type="button"
            className="btn btn-cancel"
            onClick={handleClose}
            disabled={isLoading}
            style={isLoading ? { cursor: 'not-allowed', opacity: 0.7 } : undefined}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${isLoading || !topicRequest.trim() ? 'btn-disabled' : 'btn-primary'}`}
            onClick={handleGenerate}
            disabled={isLoading || !topicRequest.trim()}
          >
            {isLoading ? 'Generating…' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TopicGeneratorModal;
