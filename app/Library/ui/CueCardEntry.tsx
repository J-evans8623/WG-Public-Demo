// bloom-maps/app/Library/components/CueCardEntry.tsx

import React, { useCallback } from 'react';

interface CueCardEntryProps {
  cueCard: {
    id: string;
    title: string;
  };
  isSelected: boolean;
  isCut: boolean;
  onSelect: (cueCardId: string) => void;
  onCut: (cueCardId: string) => void; // New cut handler prop
}

/**
 * Original
 * 
 * 
 */
const CueCardEntry: React.FC<CueCardEntryProps> = ({ cueCard, isSelected, isCut, onSelect, onCut }) => {
  // Handle cue card click for selection
  const handleCueCardClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent event propagation to parent node
      onSelect(cueCard.id); // Call the onSelect handler
    },
    [cueCard.id, onSelect]
  );

  // Handle cue card cut operation
  const handleCueCardCut = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent event propagation to parent node
      onCut(cueCard.id); // Call the onCut handler to trigger cut action
    },
    [cueCard.id, onCut]
  );

  // Apply styles for selected or cut cue cards
  const cueCardStyle = {
    backgroundColor: isSelected ? '#D5E6ED' : 'transparent', // Highlight selected cue card
    textDecoration: isCut ? 'line-through' : 'none', // Indicate cut by strikethrough
    padding: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  };

  return (
    <div style={cueCardStyle} onClick={handleCueCardClick}>
      <span>{cueCard.title}</span>
      <button onClick={handleCueCardCut} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }}>
        Cut
      </button> {/* Button to trigger cut operation */}
    </div>
  );
};

export default CueCardEntry;
