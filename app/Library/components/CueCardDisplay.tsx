import React, { useState, useCallback, useEffect } from 'react';
import CueCard from './CueCard';
import { CueCard as CueCardInterface } from '@/app/Library/Definitions/Definitions';
import { useCueCardContext } from '../Context/CueCardContext';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import { useDocumentContext } from '@/app/Library/Context/DocumentProvider';
/**
 * Original Implementation
 * // bloom-maps\app\Library\components\CueCardDisplay.tsx
 * 
 */
const defaultCueCards: CueCardInterface[] = [
  {
    id: 'default',
    title: 'Add a new concept to get started!',
    content: 'Select a concept from the map',
    bloomLevel: 1,
  },
];

const CueCardDisplay = React.memo(() => {
  const { getSelectedNodeIds, clearSelection, deselectNode } = useNodeSelection();
  const { selectCueCards } = useCueCardContext();
  const [dismissedCueCardIds, setDismissedCueCardIds] = useState<Map<string, string[]>>(new Map());
  const { state } = useDocumentContext();
  const { nodes } = state;

  const selectedNodeIds = getSelectedNodeIds();

  // Clean up dismissed cue cards for nodes that are no longer selected
  useEffect(() => {
    setDismissedCueCardIds((prev) => {
      const newMap = new Map(prev);
  
      // Convert prev.keys() to an array to avoid iteration issues
      const prevKeysArray = Array.from(prev.keys());
  
      for (const nodeId of prevKeysArray) {
        if (!selectedNodeIds.includes(nodeId)) {
          newMap.delete(nodeId);
        }
      }
      return newMap;
    });
  }, [selectedNodeIds]);

  // Retrieve cue cards associated with the selected node IDs
  const cueCards = selectedNodeIds.flatMap((nodeId) =>
    selectCueCards(nodeId).map((cueCard) => ({
      ...cueCard,
      conceptNodeTitle: nodes.get(nodeId)?.title || 'Untitled',
      nodeId,
    }))
  );

  // Filter out dismissed cue cards
  const visibleCueCards = cueCards.filter(
    (cueCard) => !dismissedCueCardIds.get(cueCard.nodeId)?.includes(cueCard.id)
  );

  const handleDismissCueCard = useCallback(
    (cueCardId: string, nodeId: string) => {
      setDismissedCueCardIds((prev) => {
        const newMap = new Map(prev);
        const dismissedForNode = newMap.get(nodeId) || [];
        newMap.set(nodeId, [...dismissedForNode, cueCardId]);

        // After updating dismissedCueCardIds, check if all cue cards for this node are dismissed
        const allCueCardsForNode = selectCueCards(nodeId);
        const allCueCardIdsForNode = allCueCardsForNode.map((card) => card.id);

        const allDismissedForNode = allCueCardIdsForNode.every((id) =>
          newMap.get(nodeId)?.includes(id)
        );

        if (allDismissedForNode) {
          // Deselect the node
          deselectNode(nodeId);
          // Remove the dismissed cue cards for this node
          newMap.delete(nodeId);
        }

        return newMap;
      });
    },
    [selectCueCards, deselectNode]
  );

  return (
    <div className="flex flex-col space-y-2 pb-8" data-testid="cue-card-display">
      {/* Clear All Button */}
      <div className="flex justify-end">
        <button
          onClick={() => {
            clearSelection();
            setDismissedCueCardIds(new Map());
          }}
          className="px-2 py-1 bg-gray-300 rounded hover:bg-gray-400 text-sm"
        >
          Clear All
        </button>
      </div>

      {visibleCueCards.length > 0 ? (
        visibleCueCards.map((cueCard) => (
          <CueCard
            key={cueCard.id}
            title={cueCard.title}
            content={cueCard.content}
            bloomLevel={cueCard.bloomLevel || 1}
            conceptNodeTitle={cueCard.conceptNodeTitle}
            onDismiss={() => handleDismissCueCard(cueCard.id, cueCard.nodeId)}
            source={cueCard.source}
          />
        ))
      ) : (
        // Display a default message if no cue cards are selected
        defaultCueCards.map((cueCard) => (
          <CueCard
            key={cueCard.id}
            title={cueCard.title}
            content={cueCard.content}
            bloomLevel={cueCard.bloomLevel || 1}
            conceptNodeTitle="Welcome"
          />
        ))
      )}
    </div>
  );
});

export default CueCardDisplay;
