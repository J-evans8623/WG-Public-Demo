// bloom-maps/app/ui/DocumentCreationModal.tsx

'use client';

import React, { useState } from 'react';
import { useDocumentContext } from '../Component/context/DocumentProvider'; // Use the updated DocumentProvider

interface DocumentCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (depth: 1 | 2 | 3 | 4 | 5 | 6) => void; // Pass the selected bloom depth to the onCreate function
}

export default function DocumentCreationModal({ isOpen, onClose, onCreate }: DocumentCreationModalProps) {
  const { setBloomDepth } = useDocumentContext(); // Access the DocumentContext to set the bloom depth
  const [selectedDepth, setSelectedDepth] = useState<1 | 2 | 3 | 4 | 5 | 6>(4); // Default bloom depth to 4

  const handleDepthChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedDepth(parseInt(event.target.value, 10) as 1 | 2 | 3 | 4 | 5 | 6); // Ensure the selected depth is one of the allowed values
  };

  const handleCreate = () => {
    setBloomDepth(selectedDepth); // Set the selected bloom depth in the context
    onCreate(selectedDepth); // Call the onCreate callback with the selected depth
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
