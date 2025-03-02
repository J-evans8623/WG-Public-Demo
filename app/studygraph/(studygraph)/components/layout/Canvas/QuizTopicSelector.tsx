/**
 * QuizTopicSelector.tsx
 *
 * Responsibilities:
 *   1) Render a list of concept nodes (topics) from the active concept map as checkboxes.
 *   2) Allow user to select or deselect topics.
 *   3) Report the selected topic IDs back to the parent component.
 */

import React, { useEffect, useState } from 'react';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { useLessonModule } from '@/app/Library/Context/LessonModuleContext';

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
  const [allNodeIds, setAllNodeIds] = useState<string[]>([]);

  useEffect(() => {
    // Gather all node IDs from the active concept map
    const nodeIds = Array.from(nodes.keys());
    setAllNodeIds(nodeIds);
  }, [nodes]);

  // Toggle a topic's selection
  const handleToggleTopic = (topicId: string) => {
    if (selectedTopicIds.includes(topicId)) {
      onChangeSelectedTopics(selectedTopicIds.filter((id) => id !== topicId));
    } else {
      onChangeSelectedTopics([...selectedTopicIds, topicId]);
    }
  };

  return (
    <div className="border rounded p-2 max-h-40 overflow-y-auto">
      {allNodeIds.map((nodeId) => {
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
      {allNodeIds.length === 0 && (
        <p className="text-sm text-gray-500">No topics found.</p>
      )}
    </div>
  );
};

export default QuizTopicSelector;
