/**
 * @file BackButton.tsx
 * @description
 *   The BackButton component provides a dedicated UI control for exiting chat mode
 *   and returning to the notes view within CardDisplay. It renders a left-pointing arrow
 *   and the text “Back”, supports keyboard accessibility via aria-label, and logs user
 *   interactions for observability. This component is only rendered when the CardDisplay
 *   panel is in chat mode. Responsibilities:
 *     1. Render a clickable Back button with clear affordance.
 *     2. Invoke the provided onClick callback to switch modes.
 *     3. Log clicks with a unique identifier for debugging.
 *     4. Encapsulate styling via .back-button CSS class.
 *
 * ------------------------------------------------------------------------------------------------
 */

import React from 'react';
import './BackButton.css';

export interface BackButtonProps {
  /**
   * Step 1: Callback triggered when the user clicks the Back button.
   * Step 2: Provided by CardDisplay to switch the panel back to notes mode.
   */
  onClick: () => void;
}

/**
 * BackButton
 *
 * Renders a left-arrow “← Back” button for navigating from chat to notes.
 * Logs the click event for debugging. Ensures accessibility with aria-label
 * and keyboard focus. Calls the onClick prop to perform the actual navigation.
 */
const BackButton: React.FC<BackButtonProps> = ({ onClick }) => {
  return (
    <button
      className="back-button"
      aria-label="Back to Notes"
      onClick={() => {
        console.log('[BackButton.tsx][4001] › BackButton clicked');
        onClick();
      }}
    >
      ← Back
    </button>
  );
};

export default BackButton;
