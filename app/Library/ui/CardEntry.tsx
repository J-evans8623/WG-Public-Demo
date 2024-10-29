import React, { useCallback } from 'react';

interface CardEntryProps {
  resource: {
    id: string;
    title: string;
    // Optionally include other resource-specific fields, e.g., image for pictures, quiz type for practice sheets
  };
  resourceType: 'cueCard' | 'picture' | 'practiceSheet';
  isSelected: boolean;
  isCut: boolean;
  onSelect: (resourceId: string) => void;
  onCut: (resourceId: string) => void;
  command?: 'cut' | 'copy'; // Make command optional
}

const CardEntry: React.FC<CardEntryProps> = ({ resource, resourceType, isSelected, isCut, onSelect, onCut, command }) => {
  // Handle resource click (selection)
  const handleResourceClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent event propagation to parent node
      onSelect(resource.id); // Call the onSelect handler with the resource ID
    },
    [resource.id, onSelect]
  );

  // Handle resource cut action
  const handleResourceCut = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent event propagation to parent node
      onCut(resource.id); // Call the onCut handler with the resource ID
    },
    [resource.id, onCut]
  );

  // Define styling to indicate selected or cut states
  const cardStyle = {
    backgroundColor: isSelected ? '#D5E6ED' : 'transparent', // Highlight selected resource
    textDecoration: isCut ? 'line-through' : 'none', // Indicate cut by strikethrough
    padding: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  };

  return (
    <div style={cardStyle} onClick={handleResourceClick}>
      {/* Render the resource title dynamically */}
      <span>{resource.title}</span>

      {/* Conditionally render the button if command is provided */}
      {command && (
        <button
          onClick={handleResourceCut}
          style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          {command}
        </button>
      )}
    </div>
  );
};

export default CardEntry;
