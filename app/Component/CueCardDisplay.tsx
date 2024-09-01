// bloom-maps/app/ui/CueCardDisplay.tsx

import React from 'react';
import CueCard from './CueCard'; // Assuming CueCard component already exists
import { CueCard as CueCardInterface } from '@/app/Definitions/Definitions';
import { useDocumentContext } from '../Component/context/DocumentProvider'; // Import context

// Define a default blank cue card
const defaultCueCards: CueCardInterface[] = [
  { id: 'default', title: 'Add a new concept to get started!', content: 'Select a concept from the map' },
];

function CueCardDisplay() {
  const { selectedCueCards } = useDocumentContext(); // Access cue cards directly from context

  // Use the context-provided cue cards or fallback to default
  const cueCards = selectedCueCards.length > 0 ? selectedCueCards : defaultCueCards;

  return (
    <div
      className="flex flex-col space-y-2"
      data-testid="cue-card-display"
    >
      {cueCards.map((cueCard) => (
        <CueCard key={cueCard.id} title={cueCard.title} content={cueCard.content} />
      ))}
    </div>
  );
}

export default CueCardDisplay;
