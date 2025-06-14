/**
 * @file ActionFooter.tsx
 * @description
 *   Contextual footer at the bottom of CardDisplay:
 *   • read-mode: shows AddResourceDropdown (disabled in edit)
 *   • edit-mode: shows Save / Cancel buttons
 *   - This update adds a new optional prop `isSaveDisabled` so that:
 *       • “Save” is rendered as a disabled button when the form is invalid.
 *   - All existing styling and logic are preserved.
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
  isSaveDisabled?: boolean; // ← New optional prop to disable Save
}

const ActionFooter: React.FC<ActionFooterProps> = ({
  editing,
  onAddResource,
  onSave,
  onCancel,
  isSaveDisabled = false,
}) => (
  <footer
    className="
      footer-transition
      absolute bottom-0 left-0 w-full
      border-t border-l map-divider
      bg-[#F8FBFE]
      px-4 py-3 z-100
    "
  >
    {editing ? (
      <div className="flex justify-end space-x-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        {/* Disable the Save button when form is invalid */}
        <Button size="sm" onClick={onSave} disabled={isSaveDisabled}>
          Save
        </Button>
      </div>
    ) : (
      <AddResourceDropdown disabled={editing} onSelectType={onAddResource} />
    )}
  </footer>
);

export default ActionFooter;
