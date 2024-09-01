// bloom-maps/app/ui/DocumentCreationModal.tsx

'use client';

import React, { useState } from 'react';
import { useDocumentContext } from './context/DocumentProvider'; // Use DocumentProvider context

interface DocumentCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (selectedDepth: 1 | 2 | 3 | 4 | 5 | 6) => void; // Modify to accept bloom level
}

export default function DocumentCreationModal({ isOpen, onClose, onCreate }: DocumentCreationModalProps) {
  const { setBloomDepth } = useDocumentContext();
  const [selectedDepth, setSelectedDepth] = useState<1 | 2 | 3 | 4 | 5 | 6>(4); // Default depth is 4

  const handleDepthChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDepth(parseInt(event.target.value, 10) as 1 | 2 | 3 | 4 | 5 | 6);
  };

  const handleCreate = () => {
    setBloomDepth(selectedDepth); // Set the selected depth
    onCreate(selectedDepth); // Pass the selected depth back to the parent handler
    onClose(); // Close the modal
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded shadow-lg w-1/3">
        <h2 className="text-xl font-bold mb-4">Create New Cue Card</h2>
        <p>Select a Bloom Level for this Cue Card:</p>
        {/* Bloom Level Checkboxes */}
        <div className="mt-4">
          {[1, 2, 3, 4, 5, 6].map((depth) => (
            <label key={depth} className="flex items-center space-x-2 mb-2">
              <input
                type="radio"
                name="bloomDepth"
                value={depth}
                checked={selectedDepth === depth}
                onChange={handleDepthChange}
                className="form-radio text-blue-600"
              />
              <span>Bloom Level {depth}</span>
            </label>
          ))}
        </div>
        <div className="mt-4 flex justify-end space-x-2">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
            Cancel
          </button>
          <button onClick={handleCreate} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
