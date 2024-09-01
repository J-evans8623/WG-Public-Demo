// bloom-maps/app/ui/DocumentCreationModal.tsx

'use client';

import React, { useState } from 'react';
import { useGlobalSettings } from './context/old/GlobalSettingsContext';

interface DocumentCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: () => void;
}

export default function DocumentCreationModal({ isOpen, onClose, onCreate }: DocumentCreationModalProps) {
  const { setBloomDepth } = useGlobalSettings();
  const [selectedDepth, setSelectedDepth] = useState<number>(4); // Default depth is 4

  const handleDepthChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedDepth(parseInt(event.target.value, 10));
  };

  const handleCreate = () => {
    setBloomDepth(selectedDepth as 1 | 2 | 3 | 4 | 5 | 6); // Set the selected depth
    onCreate(); // Call the onCreate callback to initialize the new document
    onClose(); // Close the modal
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded shadow-lg w-1/3">
        <h2 className="text-xl font-bold mb-4">Create New Document</h2>
        <label htmlFor="depth" className="block text-sm font-medium text-gray-700">
          Select Bloom Depth:
        </label>
        <select
          id="depth"
          value={selectedDepth}
          onChange={handleDepthChange}
          className="mt-1 block w-full p-2 border border-gray-300 rounded"
        >
          {[1, 2, 3, 4, 5, 6].map((depth) => (
            <option key={depth} value={depth}>
              {depth}
            </option>
          ))}
        </select>
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
