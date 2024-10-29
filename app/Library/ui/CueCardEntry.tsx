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
  command : 'cut' | 'copy';
}

const CueCardEntry: React.FC<CueCardEntryProps> = ({ cueCard, isSelected, isCut, onSelect, onCut, command }) => {
  const handleCueCardClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent event propagation to parent node
      onSelect(cueCard.id); // Call the onSelect handler
    },
    [cueCard.id, onSelect]
  );

  const handleCueCardCut = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent event propagation to parent node
      onCut(cueCard.id); // Call the onCut handler to trigger cut action
    },
    [cueCard.id, onCut]
  );

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
        {command}
      </button>
    </div>
  );
};

export default CueCardEntry;
