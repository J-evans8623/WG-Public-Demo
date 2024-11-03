/* bloom-maps/app/Library/ui/CardEntry.tsx */

import React, { useCallback } from 'react';
import './CardEntry.css'; // Import the new CSS file

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
  command?: 'cut' | 'copy' | 'edit' | 'delete'; // Make command optional
}

const CardEntry: React.FC<CardEntryProps> = ({ resource, resourceType, isSelected, isCut, onSelect, command }) => {
  // Handle resource click (selection)
  const handleResourceClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent event propagation to parent node
      onSelect(resource.id); // Call the onSelect handler with the resource ID
    },
    [resource.id, onSelect]
  );

  // Handle resource cut action
 /** const handleResourceCut = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent event propagation to parent node
      onCut(resource.id); // Call the onCut handler with the resource ID
    },
    [resource.id, onCut]
  ); */

  // Determine classes based on state
  const containerClasses = `card-entry-container ${isSelected ? 'selected' : ''} ${isCut ? 'cut' : ''}`;
  const buttonClasses = 'card-entry-button';

  // Determine icon based on resource type
  const getResourceIcon = () => {
    switch (resourceType) {
      case 'cueCard':
        return '📝'; // Example icon
      case 'picture':
        return '🖼️'; // Example icon
      case 'practiceSheet':
        return '📄'; // Example icon
      default:
        return '❓'; // Default icon
    }
  };

  return (
    <div className={containerClasses} onClick={handleResourceClick}>
      {/* Resource Type Icon */}
      <span className="card-entry-icon">{getResourceIcon()}</span>

      {/* Resource Title */}
      <span className=" card-entry-title">{resource.title}</span>

      {/* Action Buttons */}
      <div className="card-entry-actions">
        {/* Conditionally render the Cut button if command is provided */}
        {command && (
          <button
            onClick={handleResourceClick}
            className={buttonClasses}
            aria-label={`Cut ${resource.title}`}
          >
            {command}
          </button>
        )}
      </div>
    </div>
  );
};

export default CardEntry;
