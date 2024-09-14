// bloom-maps/ui/ModernModal.tsx

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useNewDocumentContext } from '@/app/Library/Context/newDocumentProvider';
import { colorThemes } from '@/app/Library/Definitions/Definitions';

interface ModernModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateCueCard: (
    title: string,
    content: string,
    bloomLevel: 1 | 2 | 3 | 4 | 5 | 6,
    image?: File | null
  ) => void;
}

const bloomLevelLabels = [
  { level: 1, label: 'Remember' },
  { level: 2, label: 'Understand' },
  { level: 3, label: 'Apply' },
  { level: 4, label: 'Analyze' },
  { level: 5, label: 'Evaluate' },
  { level: 6, label: 'Create' },
];

const ModernModal: React.FC<ModernModalProps> = ({ isOpen, onClose, onCreateCueCard }) => {
  // State variables for user input and selections
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [bloomLevel, setBloomLevel] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [image, setImage] = useState<File | null>(null);

  // Access the current color theme from context
  const { state } = useNewDocumentContext();
  const { colorTheme } = state;

  // Refs to handle focus between inputs and radio buttons
  const titleInputRef = useRef<HTMLInputElement>(null);
  const contentInputRef = useRef<HTMLTextAreaElement>(null);
  const bloomLevelRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus index to keep track of current focus state
  // 0: Title input, 1: Content textarea, 2: Bloom level radio buttons
  const [focusIndex, setFocusIndex] = useState(0);

  // Focus on the title input when the modal opens
  useEffect(() => {
    if (isOpen) {
      setFocusIndex(0);
      if (titleInputRef.current) {
        titleInputRef.current.focus();
      }
    }
  }, [isOpen]);

  // Handle keyboard events for Enter key and up/down arrows
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (focusIndex === 0) {
        // Move focus from title to content input
        setFocusIndex(1);
        contentInputRef.current?.focus();
      } else if (focusIndex === 1) {
        // Move focus from content input to Bloom level radio buttons
        setFocusIndex(2);
        // Focus the currently selected Bloom level radio button
        const currentRadioRef = bloomLevelRefs.current[bloomLevel - 1];
        currentRadioRef?.focus();
      } else if (focusIndex === 2) {
        // Trigger the save action
        handleCreate();
      }
    }

    // Handle up and down arrow keys when focus is on Bloom level radio buttons
    if (focusIndex === 2) {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setBloomLevel((prevLevel) => {
          const newLevel = prevLevel > 1 ? (prevLevel - 1) as 1 | 2 | 3 | 4 | 5 | 6 : 1;
          // Focus the new Bloom level radio button
          const newRadioRef = bloomLevelRefs.current[newLevel - 1];
          newRadioRef?.focus();
          return newLevel;
        });
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setBloomLevel((prevLevel) => {
          const newLevel = prevLevel < 6 ? (prevLevel + 1) as 1 | 2 | 3 | 4 | 5 | 6 : 6;
          // Focus the new Bloom level radio button
          const newRadioRef = bloomLevelRefs.current[newLevel - 1];
          newRadioRef?.focus();
          return newLevel;
        });
      }
    } else if (focusIndex === 0 || focusIndex === 1) {
      // Use up and down arrow keys to adjust Bloom level when not focusing on radio buttons
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setBloomLevel((prevLevel) =>
          prevLevel > 1 ? (prevLevel - 1) as 1 | 2 | 3 | 4 | 5 | 6 : 1
        );
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setBloomLevel((prevLevel) =>
          prevLevel < 6 ? (prevLevel + 1) as 1 | 2 | 3 | 4 | 5 | 6 : 6
        );
      }
    }
  };

  // Handle creating the cue card
  const handleCreate = () => {
    onCreateCueCard(title, content, bloomLevel, image);
    handleClose();
  };

  // Reset state and close the modal
  const handleClose = () => {
    setTitle('');
    setContent('');
    setBloomLevel(1);
    setImage(null);
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
    // Modal container fixed at the bottom center of the viewport
    <div
      className="fixed bottom-[150px] left-1/2 transform -translate-x-1/2 z-50"
      style={{
        // Adjust 'bottom-[150px]' to change vertical offset from the bottom
      }}
    >
      {/* Modal content area */}
      <div
        className={`relative ${modalBackgroundColor} shadow-lg rounded-lg p-6 w-[600px] border border-black`}
        style={{
          // Adjust 'w-[600px]' to change modal width
          // Adjust 'rounded-lg' to change corner rounding
        }}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        {/* Title input field */}
        <input
          ref={titleInputRef}
          type="text"
          placeholder="Cue Card Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full text-lg font-semibold p-2 focus:outline-none bg-transparent"
          onFocus={() => setFocusIndex(0)}
        />

        {/* Horizontal separator line */}
        <hr className="my-2 border-gray-300" />

        {/* Container for body input and Bloom level selection */}
        <div className="flex">
          {/* Content text area */}
          <textarea
            ref={contentInputRef}
            placeholder="Cue Card Content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full p-2 h-[150px] resize-none focus:outline-none bg-transparent"
            style={{
              // Adjust 'h-[150px]' to change height before scrollbar appears
            }}
            onFocus={() => setFocusIndex(1)}
          />

          {/* Bloom Level selection */}
          <div className="ml-4">
            {/* Vertical column of square radio buttons */}
            <div className="flex flex-col space-y-2">
              {bloomLevelLabels.map(({ level, label }, index) => (
                <label key={level} className="flex items-center space-x-2">
                  <input
                    ref={(el) => { bloomLevelRefs.current[index] = el; }}
                    type="radio"
                    name="bloomLevel"
                    value={level}
                    checked={bloomLevel === level}
                    onChange={() => setBloomLevel(level as 1 | 2 | 3 | 4 | 5 | 6)}
                    className="form-radio h-4 w-4 text-gray-600 border-gray-400 rounded-none"
                    style={{
                      // 'rounded-none' makes the radio buttons square-shaped
                    }}
                    onFocus={() => setFocusIndex(2)}
                  />
                  <span className="text-gray-600">{label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

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
              {/* Optionally, display a thumbnail preview here */}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="mt-4 flex justify-end space-x-2">
                      {/* Save button */}
          <button
            onClick={handleCreate}
            className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700 focus:outline-none"
          >
            Save
          </button>
          {/* Cancel button */}
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
