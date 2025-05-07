// app/Library/components/layout/Canvas/TopicGeneratorModal.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { generateTopic } from '@/app/Library/utils/aiServiceApi';
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
 *
 * Opens when the user selects “Explore Topic” (PDF) or explicitly
 * invokes it from the map.  After generating new nodes it:
 *   1. Highlights them via groupSelect(...)
 *   2. Leaves the Explore flag set so CardDisplay can switch to Notes
 *   3. Finally calls onClose() to clear attachment & dismiss
 */
const TopicGeneratorModal: React.FC<TopicGeneratorModalProps> = ({
  isOpen,
  onClose,
  targetNodeId,
}) => {
  // —— Contexts —————————————————————————————————————————————————————
  const { attachedText, clearAttachment } = useSelectionAttachment();
  const { nodes, updateNodeTitle, setNodes } = useNodesContext();
  const { subtrees, setSubtrees } = useSubTreeContext();
  const { createResource } = useCardCrudOperations();
  const exportStudyData = useExportStudyData();
  const { activeConceptMapId } = useLessonModule();
  const { docFileID } = useYDoc();
  const { groupSelect } = useNodeSelection();     // NEW: select many at once

  // —— Local state ——————————————————————————————————————————————————
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

  // Wrap setNodes / setSubtrees into the parser API shape
  const wrappedSetNodes = useCallback(
    (m: Map<string, any>, mapID?: string) => setNodes(m, undefined, mapID),
    [setNodes]
  );
  const wrappedSetSubtrees = useCallback(
    (m: Map<string, any>, mapID?: string) => setSubtrees(m, undefined, mapID),
    [setSubtrees]
  );

  // Are we in the PDF “Explore” pipeline?
  const usingPdf = attachedText.trim().length > 0;
  // Which node to attach new topics under?
  const rootNodeId = usingPdf ? selectedNodeId : targetNodeId;
  // All nodes for dropdown in PDF mode
  const nodeArray = Array.from(nodes.values());

  // Close handler: prevent mid-generate, then clear the attachment
  const handleClose = useCallback(() => {
    if (!isLoading) {
      onClose();
      if (usingPdf) clearAttachment();
    }
  }, [isLoading, onClose, usingPdf, clearAttachment]);

  // When user clicks “Generate”
  const handleGenerate = async () => {
    // basic validation
    if (!topicRequest.trim()) return;
    if (usingPdf && !rootNodeId) {
      setError('Please select a topic from the dropdown above.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 1) export existing map state
      const exportData = exportStudyData([rootNodeId]);
      // 2) call the AI API
      const aiResponse = await generateTopic(
        topicRequest.trim(),
        exportData,
        docFileID || '',
        attachedText
      );
      // 3) parse & insert nodes
      const { createdNodeIds } = await parseTopicResponse(
        aiResponse,
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

      console.log(`[TopicGenerator Modal returned creatednodes : ${createdNodeIds}]`);
      // 4) highlight all new nodes at once
      groupSelect(createdNodeIds);

      // 5) dismiss
      handleClose();
    } catch (err) {
      console.error('[TopicGeneratorModal] Error generating topic:', err);
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
            : 'Select a topic on the map, then describe what you’d like to explore:'}
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
