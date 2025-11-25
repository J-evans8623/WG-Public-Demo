// src/app/workspace/(studygraph)/components/layout/CardDisplay/Cards/ActionFooter.tsx

/**
 * @file ActionFooter.tsx
 * @description
 *   Contextual footer at the bottom of CardDisplay:
 *   • read-mode: shows AddResourceDropdown (disabled in edit)
 *   • edit-mode: shows Save / Cancel buttons
 *   - Added a left border to connect with the card outline.
 */

import React from 'react';
import AddResourceDropdown from '../buttons/AddResourceDropdown';
import type { ResourceType as CardResourceType } from '../buttons/AddResourceDropdown';
import { Button } from '@/components/ui/button';

export interface ActionFooterProps {
  editing: boolean;
  onAddResource: (type: CardResourceType) => void;
  onSave: () => void;
  onCancel: () => void;
}

const ActionFooter: React.FC<ActionFooterProps> = ({
  editing,
  onAddResource,
  onSave,
  onCancel,
}) => (
  <footer
    className="
      footer-transition
      absolute bottom-0 left-0 w-full
      border-t border-l map-divider
      bg-[#F8FBFE]
      px-4 py-3 z-10
    "
  >
    {editing ? (
      <div className="flex justify-end space-x-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={onSave}>
          Save
        </Button>
      </div>
    ) : (
      <AddResourceDropdown disabled={editing} onSelectType={onAddResource} />
    )}
  </footer>
);

export default ActionFooter;
