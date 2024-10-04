'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useDocumentContext } from '@/app/Library/Context/DocumentProvider';
import { FaPencilAlt } from 'react-icons/fa';

interface ModernModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    nodeTitle: string,
    cueCardTitle: string,
    cueCardContent: string,
    bloomLevel: 1 | 2 | 3 | 4 | 5 | 6,
    image?: File | null,
    source?: string
  ) => void;
  initialNodeTitle: string;
  mode: 'addChild' | 'addCueCard' | 'editCueCard';  // Extend to include editCueCard
  initialCueCardTitle?: string;   // Optional initial title for editing
  initialCueCardContent?: string; // Optional initial content for editing
  initialBloomLevel?: 1 | 2 | 3 | 4 | 5 | 6;  // Optional initial Bloom level for editing
  initialSource?: string; // Optional initial source for editing
}


const bloomLevelLabels = [
  { level: 1, label: 'Remember' },
  { level: 2, label: 'Understand' },
  { level: 3, label: 'Apply' },
  { level: 4, label: 'Analyze' },
  { level: 5, label: 'Evaluate' },
  { level: 6, label: 'Create' },
];

const ModernModal: React.FC<ModernModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialNodeTitle,
  mode,
  initialCueCardTitle,
  initialCueCardContent,
  initialBloomLevel,
  initialSource,
}) => {
  // State variables for user input and selections
  const [nodeTitle, setNodeTitle] = useState(initialNodeTitle || 'New Concept');
  const [isEditingTitle, setIsEditingTitle] = useState(mode === 'addChild'); // Editable from start in 'addChild' mode

  const [cueCardTitle, setCueCardTitle] = useState('');
  const [cueCardContent, setCueCardContent] = useState('');
  const [bloomLevel, setBloomLevel] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [image, setImage] = useState<File | null>(null);
  const [source, setSource] = useState('');



  // In useEffect, reset the source when modal opens
  useEffect(() => {
    if (isOpen) {
      setNodeTitle(initialNodeTitle || 'New Concept');
      setIsEditingTitle(mode === 'addChild');
      setCueCardTitle(mode === 'editCueCard' ? initialCueCardTitle || '' : '');
      setCueCardContent(mode === 'editCueCard' ? initialCueCardContent || '' : '');
      setBloomLevel(mode === 'editCueCard' ? initialBloomLevel || 1 : 1);
      setImage(null);
      setSource(mode === 'editCueCard' ? initialSource || '' : '');
      setFocusIndex(0);
  
      if (mode === 'addChild') {
        titleInputRef.current?.focus();
      } else {
        cueCardTitleRef.current?.focus();
      }
    }
  }, [isOpen, initialNodeTitle, mode, initialCueCardTitle, initialCueCardContent, initialBloomLevel, initialSource]);
  

  // Access the current color theme from context
  const { state } = useDocumentContext();
  const { colorTheme } = state;

  // Refs to handle focus between inputs and radio buttons
  const titleInputRef = useRef<HTMLInputElement>(null);
  const cueCardTitleRef = useRef<HTMLInputElement>(null);
  const cueCardContentRef = useRef<HTMLTextAreaElement>(null);
  const bloomLevelRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus index to keep track of current focus state
  const [focusIndex, setFocusIndex] = useState(0);

  // Handle keyboard events
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle Enter key navigation
    if (e.key === 'Enter') {
      e.preventDefault();
      if (focusIndex === 0 && isEditingTitle) {
        // Move focus to Cue Card Title
        setFocusIndex(1);
        cueCardTitleRef.current?.focus();
      } else if (focusIndex === 1) {
        // Move focus to Cue Card Content
        setFocusIndex(2);
        cueCardContentRef.current?.focus();
      } else if (focusIndex === 2) {
        // Move focus to Bloom level radio buttons
        setFocusIndex(3);
        const currentRadioRef = bloomLevelRefs.current[bloomLevel - 1];
        currentRadioRef?.focus();
      } else if (focusIndex === 3) {
        // Trigger the save action
        handleSave();
      }
    }
    // Handle up and down arrow keys for Bloom level selection
    if (focusIndex === 3) {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setBloomLevel((prevLevel) => {
          const newLevel = prevLevel > 1 ? (prevLevel - 1) as typeof bloomLevel : 1;
          const newRadioRef = bloomLevelRefs.current[newLevel - 1];
          newRadioRef?.focus();
          return newLevel;
        });
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setBloomLevel((prevLevel) => {
          const newLevel = prevLevel < 6 ? (prevLevel + 1) as typeof bloomLevel : 6;
          const newRadioRef = bloomLevelRefs.current[newLevel - 1];
          newRadioRef?.focus();
          return newLevel;
        });
      }
    }
  };

  // Handle saving the data
  const handleSave = () => {
    // Check if cue card fields are both filled or both empty
    const isCueCardTitleEmpty = cueCardTitle.trim() === '';
    const isCueCardContentEmpty = cueCardContent.trim() === '';

    if (
      (!isCueCardTitleEmpty && isCueCardContentEmpty) ||
      (isCueCardTitleEmpty && !isCueCardContentEmpty)
    ) {
      // One of the fields is filled, but not the other
      alert('Please fill in both the Cue Card Title and Content, or leave both empty.');
      return;
    }

    // Call the onSave function with the data
    onSave(nodeTitle, cueCardTitle, cueCardContent, bloomLevel, image, source);
    handleClose();
  };

  // Reset state and close the modal
  const handleClose = () => {
    onClose();
  };

  // Handle image or GIF attachment
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImage(e.target.files[0]);
    }
  };

  if (!isOpen) return null;

  // Determine modal background color based on the current color theme
  const modalBackgroundColor =
    colorTheme === 'cool-spring'
      ? 'bg-gray-100'
      : colorTheme === 'warm-summer'
      ? 'bg-gray-100'
      : 'bg-white';

  return (
    <div
      className="fixed bottom-[150px] left-1/2 transform -translate-x-1/2 z-50"
      onKeyDown={handleKeyDown}
    >
      <div
        className={`relative ${modalBackgroundColor} shadow-lg rounded-lg p-6 w-[600px] border border-black`}
      >
        {/* Title Field with Edit Icon */}
        <div className="flex items-center">
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              value={nodeTitle}
              onChange={(e) => setNodeTitle(e.target.value)}
              className="w-full text-lg font-semibold p-2 focus:outline-none bg-transparent"
              onFocus={() => setFocusIndex(0)}
            />
          ) : (
            <h2 className="w-full text-lg font-semibold p-2">{nodeTitle}</h2>
          )}
          {mode === 'addCueCard' && (
            <button
              onClick={() => {
                setIsEditingTitle(true);
                setFocusIndex(0);
                titleInputRef.current?.focus();
              }}
              className="ml-2 text-gray-600 hover:text-gray-800"
              title="Edit Title"
            >
              <FaPencilAlt />
            </button>
          )}
        </div>

        {/* Horizontal separator line */}
        <hr className="my-2 border-gray-300" />

        {/* Container for body input and Bloom level selection */}
        <div className="flex">
          {/* Content text area */}
          <div className="flex-1">
            {/* Cue Card Title */}
            <input
              ref={cueCardTitleRef}
              type="text"
              placeholder="Cue Card Title"
              value={cueCardTitle}
              onChange={(e) => setCueCardTitle(e.target.value)}
              className="w-full p-2 border rounded focus:outline-none bg-transparent"
              onFocus={() => setFocusIndex(1)}
            />

            {/* Cue Card Content */}
            <textarea
              ref={cueCardContentRef}
              placeholder="Cue Card Content"
              value={cueCardContent}
              onChange={(e) => setCueCardContent(e.target.value)}
              className="w-full mt-2 p-2 h-[150px] resize-none border rounded focus:outline-none bg-transparent"
              onFocus={() => setFocusIndex(2)}
            />

            {/* Image/GIF attachment option */}
            <div className="mt-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="file"
                  accept="image/*,image/gif"
                  onChange={handleImageChange}
                  className="hidden"
                />
                <span className="text-gray-600 hover:text-gray-800">Attach Image/GIF</span>
              </label>

              {/* Display selected image name */}
              {image && (
                <div className="mt-2">
                  <p className="text-sm text-gray-600">Selected file: {image.name}</p>
                </div>
              )}
            </div>
          </div>

          {/* Bloom Level selection */}
          <div className="ml-4">
            {/* Vertical column of square radio buttons */}
            <div className="flex flex-col space-y-2">
              {bloomLevelLabels.map(({ level, label }, index) => (
                <label key={level} className="flex items-center space-x-2">
                  <input
                    ref={(el) => {
                      bloomLevelRefs.current[index] = el;
                    }}
                    type="radio"
                    name="bloomLevel"
                    value={level}
                    checked={bloomLevel === level}
                    onChange={() => setBloomLevel(level as 1 | 2 | 3 | 4 | 5 | 6)}
                    className="form-radio h-4 w-4 text-gray-600 border-gray-400 rounded-none"
                    onFocus={() => setFocusIndex(3)}
                  />
                  <span className="text-gray-600">{label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-2">
  <input
    type="text"
    placeholder="Source (optional)"
    value={source}
    onChange={(e) => setSource(e.target.value)}
    className="w-full p-2 border rounded focus:outline-none bg-transparent"
  />
</div>;

        {/* Action Buttons */}
        <div className="mt-4 flex justify-end space-x-2">
          {/* Save Button */}
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700 focus:outline-none"
          >
            Save
          </button>
          {/* Cancel Button */}
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 focus:outline-none"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModernModal;
