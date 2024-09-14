// bloom-maps/app/ui/CueCardDisplay.tsx

import React from 'react';
import CueCard from './CueCard'; // Assuming CueCard component already exists
import { CueCard as CueCardInterface } from '@/app/Library/Definitions/Definitions';
import { useCueCardContext } from '../Context/CueCardContext'; // Use new context
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext'; // Use refined context

// Define a default blank cue card
const defaultCueCards: CueCardInterface[] = [
  { id: 'default', title: 'Add a new concept to get started!', content: 'Select a concept from the map', bloomLevel: 1 },
];

function CueCardDisplay() {
  const { getSelectedNodeIds } = useNodeSelection(); // Get selected node IDs
  const { selectCueCards } = useCueCardContext(); // Access cue card data using new context

  // Get the list of selected node IDs
  const selectedNodeIds = getSelectedNodeIds();

  // Retrieve cue cards associated with the selected node IDs
  const cueCards = selectedNodeIds.flatMap(nodeId => selectCueCards(nodeId));

  return (
    <div className="flex flex-col space-y-2" data-testid="cue-card-display">
      {cueCards.length > 0 ? (
        cueCards.map((cueCard) => (
          <CueCard
            key={cueCard.id}
            title={cueCard.title}
            content={cueCard.content}
            bloomLevel={cueCard.bloomLevel || 1} // Pass bloomLevel to CueCard, default to 1 if not specified
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
          />
        ))
      )}
    </div>
  );
}

export default CueCardDisplay;
