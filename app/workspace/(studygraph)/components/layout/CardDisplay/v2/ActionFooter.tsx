/**
 * @file ActionFooter.tsx
 * @description
 * The ActionFooter component serves as a contextual control panel positioned at the bottom of the CardDisplay container.
 * It provides different sets of actions based on the current editing state of the resource cards. In read mode, it
 * displays the AddResourceDropdown component allowing users to create new resources of various types. In edit mode,
 * it switches to display Save and Cancel buttons with validation-aware states. The component ensures proper layout
 * alignment and spacing to prevent visual gaps or overlaps with the content area above it. It integrates with the
 * form validation system to disable the Save button when required fields are incomplete or invalid. The footer
 * maintains a fixed height and uses absolute positioning to stay anchored at the bottom of its container while
 * allowing the content area to scroll independently.
 * 
 * RESPONSIBILITIES:
 * - Toggle between read and edit mode interfaces
 * - Provide resource creation controls in read mode
 * - Display save/cancel actions with validation states in edit mode
 * - Maintain consistent positioning and spacing at container bottom
 * - Handle button click events and propagate to parent components
 */

import React from 'react';
import AddResourceDropdown from './AddResourceDropdown';
import type { ResourceType as CardResourceType } from './AddResourceDropdown';
import { Button } from '@/components/ui/button';

export interface ActionFooterProps {
  editing: boolean;
  onAddResource: (type: CardResourceType) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaveDisabled?: boolean;
  askHandler: ()=> void
}

/**
 * ActionFooter component that renders contextual controls based on editing state.
 * Provides a fixed-height footer with appropriate actions for the current mode.
 * 
 * @param editing - Boolean flag indicating if currently in edit mode
 * @param onAddResource - Callback when user selects a resource type to add
 * @param onSave - Callback when user clicks save in edit mode
 * @param onCancel - Callback when user cancels edit mode
 * @param isSaveDisabled - Optional flag to disable save button when form is invalid
 */
const ActionFooter: React.FC<ActionFooterProps> = ({
  editing,
  onAddResource,
  onSave,
  onCancel,
  isSaveDisabled = false,
  askHandler
}) => {
  // Step 1: Log current footer state for debugging
  console.log('[ActionFooter.tsx][8001] Rendering footer - Editing:', editing, 'SaveDisabled:', isSaveDisabled);

  // Step 2: Handle save button click with validation logging
  const handleSaveClick = () => {
    console.log('[ActionFooter.tsx][8002] Save button clicked - Disabled state:', isSaveDisabled);
    if (!isSaveDisabled) {
      onSave();
    }
  };

  // Step 3: Handle cancel button click with logging
  const handleCancelClick = () => {
    console.log('[ActionFooter.tsx][8003] Cancel button clicked');
    onCancel();
  };

  // Step 4: Handle resource type selection with logging
  const handleResourceSelect = (type: CardResourceType) => {
    console.log('[ActionFooter.tsx][8004] Resource type selected:', type);
    onAddResource(type);
  };

  return (
    <footer
      className="action-footer footer-transition"
      style={{
        // Step 5: Ensure proper positioning and dimensions
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: '56px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: editing ? 'flex-end' : 'flex-start',
        padding: '0.5rem 1rem',
        background: 'var(--header-tint, var(--surface))',
        borderTop: '1px solid var(--edge)',
        zIndex: 30,
        // Prevent any overflow that might cause blank space
        overflow: 'hidden',
      }}
    >
      {editing ? (
        // Step 6: Render edit mode controls with proper spacing
        <div 
          className="edit-actions-container"
          style={{
            display: 'flex',
            gap: '0.5rem',
            alignItems: 'center',
            height: '100%',
          }}
        >
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleCancelClick}
            style={{
              height: '32px',
              minWidth: '80px',
            }}
          >
            Cancel
          </Button>
          
          <Button 
            size="sm" 
            onClick={handleSaveClick} 
            disabled={isSaveDisabled}
            style={{
              height: '32px',
              minWidth: '80px',
              opacity: isSaveDisabled ? 0.5 : 1,
              cursor: isSaveDisabled ? 'not-allowed' : 'pointer',
            }}
            title={isSaveDisabled ? 'Please fill in all required fields' : 'Save changes'}
          >
            Save
          </Button>
        </div>
      ) : (
        // Step 7: Render read mode controls with dropdown
        <div 
          className="add-resource-container"
          style={{
            display: 'flex',
            alignItems: 'center',
            height: '100%',
          }}
        >
          <AddResourceDropdown 
            disabled={editing} 
            onSelectType={handleResourceSelect}
            askHandler={askHandler}
          />
        </div>
      )}
    </footer>
  );
};

export default ActionFooter;