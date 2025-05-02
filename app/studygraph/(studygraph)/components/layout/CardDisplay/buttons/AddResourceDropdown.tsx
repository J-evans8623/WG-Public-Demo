/***************************************************************************************
 * @file AddResourceDropdown.tsx
 * @description
 *   The AddResourceDropdown renders a button labeled "Add card" with a plus icon. When hovered
 *   or clicked (depending on the group-hover logic), a small menu of resource types is displayed.
 *   This version:
 *     1) Matches the dropdown width to the button using w-full + min-w-[8rem].
 *     2) Preserves an invisible "hover bridge" that is large enough to keep the menu open
 *        when the mouse moves from the button to the menu.
 *
 *   Responsibilities:
 *     - Provide a single control to add different resource types (cue card, note, image).
 *     - Exclude the quiz option if it's deprecated (commented out).
 *     - Position the dropdown so that it opens upward (bottom-full, mb-1).
 *     - Ensure the user can hover from button to menu without closing it.
 ***************************************************************************************/

import React from 'react';
import { Plus, ChevronDown } from 'lucide-react';
import { FileText, NotepadText, Image as ImageIcon } from 'lucide-react';

export type ResourceType = 'cuecard' | 'note' | 'image' | 'quiz';

interface AddResourceDropdownProps {
  onSelectType: (type: ResourceType) => void;
}

// Icons for each resource type. 'quiz' is left empty if deprecated.
const typeIcons: { [key in ResourceType]: JSX.Element } = {
  cuecard: <FileText className="h-4 w-4 text-sky-600 stroke-[1.5]" />,
  note: <NotepadText className="h-4 w-4 text-teal-600 stroke-[1.5]" />,
  image: <ImageIcon className="h-4 w-4 text-indigo-600 stroke-[1.5]" />,
  quiz: <></>,
};

const typeLabels: { [key in ResourceType]: string } = {
  cuecard: 'Cue Card',
  note: 'Note',
  image: 'Image',
  quiz: 'Quiz',
};

/**
 * @function AddResourceDropdown
 * @description
 *   Renders a button labeled "Add card" with a plus icon. When hovered, a dropdown menu
 *   appears above the button. The dropdown matches the button's width (w-full) but has
 *   a min-w-[8rem] to avoid being too narrow. A taller invisible bridge covers the gap
 *   between the button and the menu to keep the menu open when the mouse moves between them.
 *
 * @param {AddResourceDropdownProps} props - Callback to handle resource selection.
 */
const AddResourceDropdown: React.FC<AddResourceDropdownProps> = ({ onSelectType }) => {
  return (
    <div className="group inline-block relative">
      {/*
        Larger invisible bridge:
        - Stretches above the button (-top-6) to cover the gap
        - Matches or exceeds the button/menu width (w-full min-w-[8rem])
        - Ensures the user stays "hovered" within the group while moving to the menu
      */}
      <div className="absolute -top-6 left-0 w-full min-w-[8rem] h-6" />

      {/* The main button */}
      <button
        type="button"
        className="
          flex 
          items-center 
          gap-1.5 
          whitespace-nowrap 
          font-medium 
          transition-colors 
          bg-gray-800 
          text-white 
          hover:bg-[#1D4ED8] 
          rounded-md 
          px-2.5 
          py-1.5 
          h-8 
          text-sm 
          focus:outline-none
        "
      >
        <Plus className="h-4 w-4 stroke-[1.5]" />
        Add card
        <ChevronDown className="h-4 w-4 stroke-[1.5]" />
      </button>

      {/*
        Dropdown menu:
        - Opens above the button with bottom-full mb-1
        - Matches the parent's width: w-full
        - Has a min-w-[8rem] so it never becomes too narrow
      */}
      <div
        className="
          absolute 
          left-0 
          bottom-full 
          mb-1 
          w-full 
          min-w-[8rem]
          bg-white 
          shadow-lg 
          rounded-md 
          z-10 
          hidden 
          group-hover:block 
          border 
          border-gray-200 
          py-1
        "
      >
        {(['cuecard', 'note', 'image'] as ResourceType[]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => onSelectType(type)}
            className="
              w-full 
              text-left 
              px-2.5 
              py-1.5 
              text-sm 
              flex 
              items-center 
              gap-2.5 
              hover:bg-gray-50 
              transition-colors
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
