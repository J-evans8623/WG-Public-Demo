/***************************************************************************************
 * @file AddResourceDropdown.tsx
 * @description
 *   Renders a button labeled "Add card" with a plus icon. When hovered
 *   or clicked, a small menu of resource types is displayed above the button.
 *   - Accepts an optional `disabled` prop to prevent opening while in edit mode.
 *   - Keeps an invisible hover-bridge to maintain the hover area between button & menu.
 *
 * Responsibilities:
 *   - Provide a single control to add different resource types (cue card, note, image).
 *   - Exclude the quiz option if it's deprecated (not rendered).
 *   - Position the dropdown to open upward (bottom-full, mb-1).
 *   - Ensure the user can hover from button to menu without closing it.
 ***************************************************************************************/

import React from 'react';
import { Plus, ChevronDown } from 'lucide-react';
import { FileText, NotepadText, Image as ImageIcon } from 'lucide-react';

export type ResourceType = 'cuecard' | 'note' | 'image' | 'quiz';

interface AddResourceDropdownProps {
  onSelectType: (type: ResourceType) => void;
  disabled?: boolean;
}

// Icons for each resource type. 'quiz' remains empty if deprecated.
const typeIcons: { [key in ResourceType]: JSX.Element } = {
  cuecard: <FileText className="h-4 w-4 text-sky-600 stroke-[1.5]" />,
  note:    <NotepadText className="h-4 w-4 text-teal-600 stroke-[1.5]" />,
  image:   <ImageIcon className="h-4 w-4 text-indigo-600 stroke-[1.5]" />,
  quiz:    <></>,
};

const typeLabels: { [key in ResourceType]: string } = {
  cuecard: 'Cue Card',
  note:    'Note',
  image:   'Image',
  quiz:    'Quiz',
};

/**
 * @function AddResourceDropdown
 * @description
 *   Renders the “Add card” trigger + upward‐opening dropdown of types.
 *   Honors an optional `disabled` flag to lock out new cards during edit.
 */
const AddResourceDropdown: React.FC<AddResourceDropdownProps> = ({
  onSelectType,
  disabled = false,
}) => {
  return (
    <div className="group inline-block relative">
      {/*
        Invisible hover bridge:
        - Covers the gap between the button and the menu to keep the dropdown open.
      */}
      <div className="absolute -top-6 left-0 w-full min-w-[8rem] h-6" />

      {/* Main trigger button */}
      <button
        type="button"
        disabled={disabled}
        className={`
          flex items-center gap-1.5 whitespace-nowrap font-medium
          transition-colors bg-gray-800 text-white rounded-md
          px-2.5 py-1.5 h-8 text-sm focus:outline-none
          ${disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:bg-[#1D4ED8]'}
        `}
      >
        <Plus className="h-4 w-4 stroke-[1.5]" />
        Add card
        <ChevronDown className="h-4 w-4 stroke-[1.5]" />
      </button>

      {/*
        Dropdown menu:
        - Only shown on hover when not disabled
        - Opens above the button (bottom-full)
      */}
      <div
        className={`
          absolute left-0 bottom-full mb-1 w-full min-w-[8rem]
          bg-white shadow-lg rounded-md border border-gray-200 py-1 z-10
          ${disabled ? '' : 'hidden group-hover:block'}
        `}
      >
        {(['cuecard', 'note', 'image'] as ResourceType[]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => onSelectType(type)}
            className="
              w-full text-left px-2.5 py-1.5 text-sm flex items-center gap-2.5
              hover:bg-gray-50 transition-colors
            "
          >
            {typeIcons[type]}
            <span className="text-gray-700">{typeLabels[type]}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default AddResourceDropdown;
