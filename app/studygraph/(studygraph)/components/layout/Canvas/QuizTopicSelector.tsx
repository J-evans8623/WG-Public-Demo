/**
 * QuizTopicSelector.tsx
 *
 * Responsibilities:
 *   - Retrieve the set of all concept nodes from the active concept map.
 *   - For each node, check whether it contains at least one cue card or note card.
 *   - Render a scrollable list of checkboxes for only those “valid” nodes
 *     (i.e., nodes that have ≥1 cue card or ≥1 note).
 *   - Notify the parent component of any changes to the selected topic IDs.
 */

import React, { useEffect, useState } from 'react';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { useLessonModule } from '@/app/Library/Context/LessonModuleContext';
import { useResourceContext } from '@/app/Library/Context/ResourceContext';

interface QuizTopicSelectorProps {
  selectedTopicIds: string[];
  onChangeSelectedTopics: (newSelected: string[]) => void;
}

const QuizTopicSelector: React.FC<QuizTopicSelectorProps> = ({
  selectedTopicIds,
  onChangeSelectedTopics,
}) => {
  const { nodes } = useNodesContext();
  const { activeConceptMapId } = useLessonModule();
  const { selectCueCards, selectResources } = useResourceContext();

  // allNodeIds contains every node ID in the active concept map.
  const [allNodeIds, setAllNodeIds] = useState<string[]>([]);

  // validNodeIds filters out any node that has zero cue cards AND zero note cards.
  const [validNodeIds, setValidNodeIds] = useState<string[]>([]);

  useEffect(() => {
    // 1. Gather every node ID from the shared "nodes" map.
    const nodeIds = Array.from(nodes.keys());
    setAllNodeIds(nodeIds);
  }, [nodes]);

  useEffect(() => {
    // 2. Compute validNodeIds by checking each node's resources.
    const filtered = allNodeIds.filter((nodeId) => {
      // Check for at least one cue card
      const hasCueCards = selectCueCards(nodeId).length > 0;
      // Check for at least one note card (or other non-quiz resources)
      const hasNotes = selectResources(nodeId).some((r) => r.type === 'note');
      return hasCueCards || hasNotes;
    });
    setValidNodeIds(filtered);
  }, [allNodeIds, selectCueCards, selectResources]);

  // Toggle a topic's selection status.
  const handleToggleTopic = (topicId: string) => {
    if (selectedTopicIds.includes(topicId)) {
      onChangeSelectedTopics(selectedTopicIds.filter((id) => id !== topicId));
    } else {
      onChangeSelectedTopics([...selectedTopicIds, topicId]);
    }
  };

  return (
    <div className="border rounded p-2 max-h-40 overflow-y-auto">
      {validNodeIds.map((nodeId) => {
        const nodeTitle = nodes.get(nodeId)?.title || 'Untitled';
        return (
          <label key={nodeId} className="flex items-center mb-1 text-sm">
            <input
              type="checkbox"
              className="mr-2"
              checked={selectedTopicIds.includes(nodeId)}
              onChange={() => handleToggleTopic(nodeId)}
            />
            <span>{nodeTitle}</span>
          </label>
        );
      })}

      {validNodeIds.length === 0 && (
        <p className="text-sm text-gray-500">No eligible topics available.</p>
      )}
    </div>
  );
};

export default QuizTopicSelector;
