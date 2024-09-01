// bloom-maps/app/ui/CueCardDisplay.tsx

import React from 'react';
import CueCard from './CueCard'; // Assuming CueCard component already exists
import { CueCard as CueCardInterface, CueCardDisplayProps } from '@/app/Definitions/Definitions';

// Define a default blank cue card
const defaultCueCards: CueCardInterface[] = [
  { id: 'default', title: 'No Cue Cards Available', content: 'Add new cue cards to get started!' },
];

function CueCardDisplay({ cueCards = defaultCueCards }: CueCardDisplayProps) {
  return (
    <div
      className="flex flex-col space-y-2"
      data-testid="cue-card-display" // Add a unique identifier for the CueCardDisplay
    >
      {/* Use the provided cueCards or fallback to defaultCueCards */}
      {cueCards.map((cueCard) => (
        <CueCard key={cueCard.id} title={cueCard.title} content={cueCard.content} />
      ))}
    </div>
  );
}

export default CueCardDisplay;
