// bloom-maps/ui/Modal.tsx

'use client';

import React, { useState, ReactNode } from 'react';
import { useDocumentContext } from '../Context/DocumentProvider'; // Import the DocumentProvider context

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateCueCard?: (title: string, content: string, bloomLevel: 1 | 2 | 3 | 4 | 5 | 6) => void; // Optional for general use
  children?: ReactNode; // Add children prop for general modal content
}

const Modal = ({ isOpen, onClose, onCreateCueCard, children }: ModalProps) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedBloomLevel, setSelectedBloomLevel] = useState<1 | 2 | 3 | 4 | 5 | 6>(1); // Default to bloom level 1

  const handleCreate = () => {
    if (onCreateCueCard) {
      onCreateCueCard(title, content, selectedBloomLevel); // Call the create handler with the selected values
    }
    onClose(); // Close the modal after creation
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-1/3">
        {/* Render children if provided */}
        {children ? (
          children
        ) : (
          <>
            <h2 className="text-xl font-bold mb-4">Create New Cue Card</h2>
            <input
              type="text"
              placeholder="Cue Card Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mb-2 p-2 border rounded w-full"
            />
            <textarea
              placeholder="Cue Card Content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="mb-4 p-2 border rounded w-full"
            />
            <p>Select a Bloom Level for this Cue Card:</p>
            {/* Bloom Level Radio Buttons */}
            <div className="mt-4">
              {[1, 2, 3, 4, 5, 6].map((level) => (
                <label key={level} className="flex items-center space-x-2 mb-2">
                  <input
                    type="radio"
                    name="bloomLevel"
                    value={level}
                    checked={selectedBloomLevel === level}
                    onChange={() => setSelectedBloomLevel(level as 1 | 2 | 3 | 4 | 5 | 6)} // Explicitly cast to the correct type
                    className="form-radio text-blue-600"
                  />
                  <span>Bloom Level {level}</span>
                </label>
              ))}
            </div>
            <div className="mt-4 flex justify-end space-x-2">
              <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Modal;
