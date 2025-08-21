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
import AddResourceDropdown from './ROAddResourceDropdown';

export interface ActionFooterProps {
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
  askHandler
}) => {

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
        justifyContent: 'flex-start',
        padding: '0.5rem 1rem',
        background: 'var(--header-tint, var(--surface))',
        borderTop: '1px solid var(--edge)',
        zIndex: 30,
        // Prevent any overflow that might cause blank space
        overflow: 'hidden',
      }}
    >
      { (
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
            askHandler={askHandler}
          />
        </div>
      )}
    </footer>
  );
};

export default ActionFooter;