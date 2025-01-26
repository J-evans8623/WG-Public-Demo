/* bloom-maps/app/Library/ui/CardEntry.tsx */

import React, { useCallback } from 'react';
import './CardEntry.css'; // Ensure this path is correct based on your project structure

interface CardEntryProps {
  resource: {
    id: string;
    title: string;
  };
  resourceType: 'cueCard' | 'picture' | 'practiceSheet' | 'conceptNode';
  isSelected: boolean;
  isCut: boolean;
  isLoading?: boolean;  // Added
  hasError?: boolean;   // Added
  disabled?: boolean;   // Added
  onSelect: (resourceId: string) => void;
  command?: 'cut' | 'copy' | 'edit' | 'delete';
  onDelete?: (resourceId: string) => void;
}

const CardEntry: React.FC<CardEntryProps> = ({
  resource,
  resourceType,
  isSelected,
  isCut,
  isLoading = false,
  hasError = false,
  disabled = false,
  onSelect,
  command,
  onDelete,
}) => {
  const handleResourceClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!disabled) {
        onSelect(resource.id);
      }
    },
    [resource.id, onSelect, disabled]
  );

  const containerClasses = `card-entry-container 
    ${isSelected ? (command === 'delete' ? 'selected-delete' : 'selected') : ''} 
    ${isCut ? 'cut' : ''} 
    ${isLoading ? 'loading' : ''} 
    ${hasError ? 'error' : ''} 
    ${disabled ? 'disabled' : ''}`;

  const buttonClasses = 'card-entry-button';

  const getResourceIcon = () => {
    switch (resourceType) {
      case 'cueCard':
        return '📝';
      case 'picture':
        return isLoading ? '⌛' : hasError ? '❌' : '🖼️';
      case 'practiceSheet':
        return '📄';
      default:
        return '';
    }
  };

  return (
    <div className={containerClasses} onClick={handleResourceClick}>
      <span className="card-entry-icon">{getResourceIcon()}</span>

      <span className="card-entry-title">
        {resource.title}
        {isLoading && <span className="loading-text"> (Loading...)</span>}
        {hasError && <span className="error-text"> (Failed to load)</span>}
      </span>

      <div className="card-entry-actions">
        {command === 'delete' && onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(resource.id);
            }}
            className={`${buttonClasses} delete-action-button`}
            disabled={disabled}
            aria-label={`Delete ${resource.title}`}
          >
            Delete
          </button>
        )}

        {command && command !== 'delete' && (
          <button
            onClick={handleResourceClick}
            className={buttonClasses}
            disabled={disabled}
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
