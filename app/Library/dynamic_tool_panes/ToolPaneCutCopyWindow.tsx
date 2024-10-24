// ToolPaneCutCopyWindow.tsx
import React, { useState } from 'react';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { useCueCardContext } from '@/app/Library/Context/CueCardContext'; // Import CueCard context
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import CueCardEntry from '@/app/Library/ui/CueCardEntry'; // Reuse the CueCardEntry component

interface ToolPaneCutCopyWindowProps {
  sourceNodeId: string;
}



const ToolPaneCutCopyWindow: React.FC<ToolPaneCutCopyWindowProps> = ({ sourceNodeId }) => {
  const { nodes } = useNodesContext();
  const { selectCueCards, transferCueCard } = useCueCardContext();
  const { targetNodeId } = useNodeSelection();

  const [selectedCueCardId, setSelectedCueCardId] = useState<string | null>(null);
  const [cutCueCardId, setCutCueCardId] = useState<string | null>(null);


  // Fetch the source node's cue cards
  const cueCards = selectCueCards(sourceNodeId);

  // Fetch the target node's cue cards
  const targetCueCards = targetNodeId ? selectCueCards(targetNodeId) : [];

  const sourceNode = nodes.get(sourceNodeId);
  const targetNode = targetNodeId ? nodes.get(targetNodeId) : null;

  // Handle cue card selection
  const handleCueCardSelect = (cueCardId: string) => {
    setSelectedCueCardId(cueCardId);
    setCutCueCardId(null); // Reset cut state if selecting a different card
  };

  // Handle cue card cut operation
  const handleCueCardCut = (cueCardId: string) => {
    setCutCueCardId(cueCardId);
    setSelectedCueCardId(cueCardId); // Mark the cue card for cutting
  };

  // Handle paste operation
  const handlePasteCueCard = () => {
    if (cutCueCardId && targetNodeId) {
      transferCueCard(sourceNodeId, targetNodeId, cutCueCardId);
      setCutCueCardId(null); // Clear cut state after pasting
    }
  };

  // Display the selected node's title and cue cards

  return (
    <div className="tool-pane-window">
      <h3>Cut/Copy Options</h3>
      {sourceNode ? (
        <div>
          <h4>Source Node: {sourceNode.title}</h4>
          {cueCards.length > 0 ? (
            <div>
              {cueCards.map((cueCard) => (
                <CueCardEntry
                  key={cueCard.id}
                  cueCard={cueCard}
                  isSelected={selectedCueCardId === cueCard.id}
                  isCut={cutCueCardId === cueCard.id}
                  onSelect={handleCueCardSelect}
                  onCut={handleCueCardCut}
                />
              ))}
            </div>
          ) : (
            <p>No resources available in this node.</p>
          )}
        </div>
      ) : (
        <p>No source node selected.</p>
      )}

      {targetNode ? (
        <div>
          <h4>Target Node: {targetNode.title}</h4>
          {targetCueCards.length > 0 ? (
            <div>
              {targetCueCards.map((cueCard) => (
                <CueCardEntry
                  key={cueCard.id}
                  cueCard={cueCard}
                  isSelected={false}
                  isCut={false}
                  onSelect={() => {}}
                  onCut={() => {}}
                />
              ))}
            </div>
          ) : (
            <p>No resources in target node.</p>
          )}
        </div>
      ) : (
        <p>No target node selected.</p>
      )}

      <button onClick={handlePasteCueCard} disabled={!cutCueCardId || !targetNodeId}>
        Paste
      </button>
    </div>
  );
};

export default ToolPaneCutCopyWindow;
