import React from 'react';
import { Plus, ChevronDown } from 'lucide-react';
import { FileText, NotepadText, Image as ImageIcon, Brain } from 'lucide-react';

export type ResourceType = 'cuecard' | 'note' | 'image' | 'quiz';

interface AddResourceDropdownProps {
  onSelectType: (type: ResourceType) => void;
}

const typeIcons: { [key in ResourceType]: JSX.Element } = {
  cuecard: <FileText className="h-4 w-4 text-sky-600 stroke-[1.5]" />,
  note: <NotepadText className="h-4 w-4 text-teal-600 stroke-[1.5]" />,
  image: <ImageIcon className="h-4 w-4 text-indigo-600 stroke-[1.5]" />,
  quiz: <Brain className="h-4 w-4 text-orange-600 stroke-[1.5]" />,
};

const typeLabels: { [key in ResourceType]: string } = {
  cuecard: 'Cue Card',
  note: 'Note',
  image: 'Image',
  quiz: 'Quiz',
};

const AddResourceDropdown: React.FC<AddResourceDropdownProps> = ({
  onSelectType,
}) => {
  return (
    <div className="group inline-block relative">
      <button
        type="button"
        className="flex items-center gap-1.5 whitespace-nowrap font-medium transition-colors bg-[#2563EB] text-white hover:bg-[#1D4ED8] rounded-md px-2.5 py-1.5 h-8 text-sm focus:outline-none"
      >
        <Plus className="h-4 w-4 stroke-[1.5]" />
        Add
        <ChevronDown className="h-4 w-4 stroke-[1.5]" />
      </button>
      {/* Add a transparent bridge to prevent menu from closing */}
      <div className="absolute w-full h-2 -bottom-2" />
      <div className="absolute left-0 mt-1 w-40 bg-white shadow-lg rounded-md z-10 hidden group-hover:block border border-gray-200 py-1">
        {(['cuecard', 'note', 'image', 'quiz'] as ResourceType[]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => onSelectType(type)}
            className="w-full text-left px-2.5 py-1.5 text-sm flex items-center gap-2.5 hover:bg-gray-50 transition-colors"
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