// bloom-maps/Library/components/ModernModal.tsx

'use client';

import React, { useState, ReactNode, useEffect } from 'react';
import useModalKeyBindings from '../hooks/useModalKeyBindings'; // Import custom hook for keyboard shortcuts
import useImageAttachment from '../hooks/useImageAttachment'; // Import custom hook for image attachment

interface ModernModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateCueCard?: (title: string, content: string, bloomLevel: 1 | 2 | 3 | 4 | 5 | 6) => void;
  children?: ReactNode;
}

const ModernModal: React.FC<ModernModalProps> = ({ isOpen, onClose, onCreateCueCard, children }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedBloomLevel, setSelectedBloomLevel] = useState<1 | 2 | 3 | 4 | 5 | 6>(1); // Default to bloom level 1
  const { image, handleImageChange, removeImage } = useImageAttachment(); // Custom hook for image attachment

  // Apply keyboard bindings using custom hook
  useModalKeyBindings({
    onClose,
    onCreate: () => onCreateCueCard && onCreateCueCard(title, content, selectedBloomLevel),
    moveFocusToContent: () => document.getElementById('modal-content')?.focus(), // Move focus to content input
    moveFocusToTitle: () => document.getElementById('modal-title')?.focus(), // Move focus to title input
  });

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setContent('');
      setSelectedBloomLevel(1);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black bg-opacity-30 backdrop-blur-sm transition-opacity duration-300">
      <div className="relative bg-white p-6 rounded-lg shadow-lg w-11/12 max-w-lg mb-12 flex flex-col">
        <div className="flex-1 flex flex-row"> {/* Container for inputs and radio buttons */}
          <div className="flex-1 pr-4"> {/* Left section for inputs */}
            {children ? (
              children
            ) : (
              <>
                <h2 className="text-xl font-bold mb-4">Create New Cue Card</h2>
                <input
                  id="modal-title"
                  type="text"
                  placeholder="Cue Card Title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mb-2 p-2 border rounded w-full"
                />
                <textarea
                  id="modal-content"
                  placeholder="Cue Card Content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="mb-4 p-2 border rounded w-full h-32" // Allocate more space for the body
                />
                <div className="mt-4 flex items-center">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                    <span className="text-sm text-blue-500 hover:underline">Attach Image/GIF</span>
                  </label>
                  {image && (
                    <div className="flex items-center space-x-2">
                      <img src={URL.createObjectURL(image)} alt="Preview" className="h-10 w-10 rounded object-cover" />
                      <button onClick={removeImage} className="text-red-500 text-sm">Remove</button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          {/* Right section for Bloom Level radio dials */}
          <div className="flex flex-col items-end space-y-2 pl-4"> {/* Align vertically on the right */}
            {[1, 2, 3, 4, 5, 6].map((level) => (
              <label key={level} className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="bloomLevel"
                  value={level}
                  checked={selectedBloomLevel === level}
                  onChange={() => setSelectedBloomLevel(level as 1 | 2 | 3 | 4 | 5 | 6)}
                  className="form-radio text-blue-600"
                />
                <span>Bloom Level {level}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="mt-4 flex justify-end space-x-2"> {/* Buttons positioned at the bottom within modal boundaries */}
          <button
            onClick={() => onCreateCueCard && onCreateCueCard(title, content, selectedBloomLevel)}
            className="px-4 py-2 bg-gray-200 text-black rounded hover:bg-gray-300"
          >
            Save
          </button>
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-black rounded hover:bg-gray-300">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModernModal;
