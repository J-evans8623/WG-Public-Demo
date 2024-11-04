/* bloom-maps/app/Library/ui/CardEntry.tsx */

import React, { useCallback } from 'react';
import './CardEntry.css'; // Ensure this path is correct based on your project structure

interface CardEntryProps {
  resource: {
    id: string;
    title: string;
    // Optionally include other resource-specific fields, e.g., image for pictures, quiz type for practice sheets
  };
  resourceType: 'cueCard' | 'picture' | 'practiceSheet' | 'conceptNode'; // Added 'conceptNode'
  isSelected: boolean;
  isCut: boolean;
  onSelect: (resourceId: string) => void;
  command?: 'cut' | 'copy' | 'edit' | 'delete'; // Make command optional
  onDelete?: (resourceId: string) => void; // Added onDelete for delete actions
}

const CardEntry: React.FC<CardEntryProps> = ({
  resource,
  resourceType,
  isSelected,
  isCut,
  onSelect,
  command,
  onDelete,
}) => {
  // Handle resource click (selection)
  const handleResourceClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent event propagation to parent
      onSelect(resource.id); // Trigger selection
    },
    [resource.id, onSelect]
  );

  // Determine classes based on state
  // Determine classes based on state
  const containerClasses = `card-entry-container ${
    isSelected ? (command === 'delete' ? 'selected-delete' : 'selected') : ''
  } ${isCut ? 'cut' : ''}`;
  const buttonClasses = 'card-entry-button';

  // Determine icon based on resource type
  const getResourceIcon = () => {
    switch (resourceType) {
      case 'cueCard':
        return '📝'; // Icon for Cue Card
      case 'picture':
        return '🖼️'; // Icon for Picture
      case 'practiceSheet':
        return '📄'; // Icon for Practice Sheet
      default:
        return ''; // Default icon
    }
  };

  return (
    <div className={containerClasses} onClick={handleResourceClick}>
      {/* Resource Type Icon */}
      <span className="card-entry-icon">{getResourceIcon()}</span>

      {/* Resource Title */}
      <span className="card-entry-title">{resource.title}</span>

      {/* Action Buttons */}
      <div className="card-entry-actions">
        {/* Conditionally render the Delete button if command is 'delete' and onDelete is provided */}
        {command === 'delete' && onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation(); // Prevent triggering selection
              onDelete(resource.id); // Trigger delete action
            }}
            className={`${buttonClasses} delete-action-button`}
            aria-label={`Delete ${resource.title}`}
          >
            Delete
          </button>
        )}

        {/* Conditionally render other action buttons based on command */}
        {command && command !== 'delete' && (
          <button
            onClick={handleResourceClick}
            className={buttonClasses}
            aria-label={`${command.charAt(0).toUpperCase() + command.slice(1)} ${resource.title}`}
          >
            {command.charAt(0).toUpperCase() + command.slice(1)}
          </button>
        )}
      </div>
    </div>
  );
};

export default CardEntry;
