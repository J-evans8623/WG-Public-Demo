/**
 * TopicGeneratorModal.tsx
 *
 * This file implements a wizard-style modal for generating a new topic
 * using the AI service. It replaces the old "ExploreTab" from ChatTab.
 *
 * Responsibilities:
 *   1) Presents a modal with:
 *       - The selected node name (fetched via targetNodeId).
 *       - An input field for describing the topic to explore.
 *       - A "Merge content into selected topic" checkbox.
 *       - A Generate/Cancel button set.
 *   2) On Generate, it calls the "generateTopic" API with the exported
 *      study data for the target node, then parses the response using
 *      "parseTopicResponse."
 *   3) Closes the modal upon completion or on cancel.
 */

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
  // State for user input and merge option
  const [topicRequest, setTopicRequest] = useState('');
  const [mergeOption, setMergeOption] = useState(true);

  // Access to node data, map info, and resource creation
  const { nodes, updateNodeTitle, setNodes } = useNodesContext();
  const { subtrees, setSubtrees } = useSubTreeContext();
  const { createResource } = useCardCrudOperations();
  const exportStudyData = useExportStudyData();
  const { activeConceptMapId, getModuleSummary } = useLessonModule();
  const { docFileID } = useYDoc();

  // Retrieve the node title
  const nodeTitle = nodes.get(targetNodeId)?.title || '';

  // Keep track of loading state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clear fields when modal is opened
  useEffect(() => {
    if (isOpen) {
      setTopicRequest('');
      setMergeOption(true);
      setError(null);
      setIsLoading(false);
    }
  }, [isOpen]);
  
        // Wrap setNodes/setSubtrees to match your existing usage
        const wrappedSetNodes = useCallback(
          (nodesMap: Map<string, any>, mapID?: string) => {
            setNodes(nodesMap, undefined, mapID);
          },
          [setNodes]
        );
  
        const wrappedSetSubtrees = useCallback(
          (subtreesMap: Map<string, any>, mapID?: string) => {
            setSubtrees(subtreesMap, undefined, mapID);
          },
          [setSubtrees]
        );
  // Close modal
  const handleClose = useCallback(() => {
    if (!isLoading) {
      onClose();
    }
  }, [isLoading, onClose]);

  // Generate the new topic
  const handleGenerate = async () => {
    if (!topicRequest.trim()) return;
    try {
      setIsLoading(true);
      setError(null);

      // Export data from the selected node
      const exportData = exportStudyData([targetNodeId]);
      // Call the AI service
      const response = await generateTopic(
        topicRequest.trim(),
        exportData,
        docFileID as string
      );

      // Parse and update concept map
      await parseTopicResponse(
        response,
        {
          updateNodeTitle,
          setNodes: wrappedSetNodes,
          nodes,
          createResource,
          setSubtrees: wrappedSetSubtrees,
          subtrees,
          getRootNode: targetNodeId,
        },
        activeConceptMapId,
        mergeOption
      );

      // Done
      setIsLoading(false);
      onClose();
    } catch (err: any) {
      console.error("[TopicGeneratorModal] Error generating topic:", err);
      setError('Failed to generate topic. Please try again later.');
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Dimmed background */}
      <div
        className="absolute inset-0 bg-black opacity-50"
        onClick={handleClose}
      ></div>

      {/* Modal container with fixed max-height + scroll */}
      <div
        className="
          relative
          bg-white
          w-[450px]
          max-w-full
          rounded
          shadow-lg
          p-6
          z-10
          max-h-[80vh]
          overflow-y-auto
        "
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">
            Generate New Topic
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700"
            disabled={isLoading}
            aria-label="Close Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Instructions */}
        <p className="text-sm text-gray-600 mb-4">
          Select a topic on the map, tell me what you want like to explore, and I will expand your map with new insights.
        </p>

        {/* Display selected node info */}
        <div className="bg-gray-100 border border-gray-200 rounded p-3 mb-4">
          <p className="text-sm text-gray-500">Selected Topic:</p>
          <p className="text-sm font-semibold text-orange-600">{nodeTitle}</p>
        </div>

        {/* Topic request input */}
        <label className="block text-sm text-gray-700 mb-1">
          Describe the topic to explore:
        </label>
        <textarea
          className="w-full border border-gray-300 rounded p-2 mb-3 text-sm resize-vertical min-h-[80px]"
          rows={3}
          value={topicRequest}
          onChange={(e) => setTopicRequest(e.target.value)}
          disabled={isLoading}
        />

        {/* Merge option checkbox */}
        <div className="flex items-center mb-4">
          <input
            id="mergeCheckbox"
            type="checkbox"
            className="h-4 w-4 text-blue-600 border-gray-300 rounded"
            checked={mergeOption}
            onChange={(e) => setMergeOption(e.target.checked)}
            disabled={isLoading}
          />
          <label
            htmlFor="mergeCheckbox"
            className="ml-2 text-sm text-gray-700"
            title="This option will add content to the selected topic"
          >
            Merge content into selected topic
          </label>
        </div>

        {/* Error message */}
        {error && (
          <div className="text-sm text-red-500 mb-3">{error}</div>
        )}

        {/* Buttons */}
        <div className="flex justify-end gap-2">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700"
            disabled={isLoading || !topicRequest.trim()}
          >
            {isLoading ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TopicGeneratorModal;
