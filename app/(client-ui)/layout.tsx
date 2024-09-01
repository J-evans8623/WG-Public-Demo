// bloom-maps/app/(client-ui)/layout.tsx

'use client';

import React, { useState } from 'react';
import Split from 'react-split'; // Client-side only component
import CueCardDisplay from '../ui/CueCardDisplay'; // Import the CueCardDisplay component
import ConceptMap from '../ui/ConceptMap'; // Import the ConceptMap component
import DocumentCreationModal from '../ui/DocumentCreationModal'; // Import the DocumentCreationModal component
import { CueCard } from '@/app/Definitions/Definitions'; // Import CueCard type
import { GlobalSettingsProvider, useGlobalSettings } from '../ui/context/GlobalSettingsContext'; // Correctly import the GlobalSettingsProvider and hook

function ClientLayoutContent() {
  // State to manage selected cue cards for display
  const [selectedCueCards, setSelectedCueCards] = useState<CueCard[]>([]);

  // State to control the visibility of the DocumentCreationModal
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Access global settings and functions from the context
  const { createNewDocument } = useGlobalSettings();

  // Function to handle opening the modal
  const openModal = () => {
    setIsModalOpen(true);
  };

  // Function to handle closing the modal
  const closeModal = () => {
    setIsModalOpen(false);
  };

  // Function to handle the creation of a new document
  const handleCreateNewDocument = (selectedDepth: 1 | 2 | 3 | 4 | 5 | 6) => {
    createNewDocument(selectedDepth); // Call the function to create a new document with the selected depth
    closeModal(); // Close the modal after creating the document
  };

  return (
    <>
      {/* Document Creation Modal */}
      <DocumentCreationModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onCreate={() => handleCreateNewDocument(4)} // Default to bloom depth 4 if none selected
      />

      {/* Main UI Layout */}
      <Split
        className="flex h-[calc(100vh-50px)]"
        sizes={[25, 55, 20]}
        minSize={[200, 300, 150]}
        maxSize={[400, Infinity, 300]}
        gutterSize={8}
        direction="horizontal"
        cursor="col-resize"
      >
        {/* Left Panel (Cue Card Viewer) */}
        <div className="bg-gray-200 p-4 shadow-lg rounded-lg overflow-y-auto min-w-[200px] flex flex-col space-y-2">
          {/* Display selected cue cards here */}
          <CueCardDisplay cueCards={selectedCueCards} />
        </div>

        {/* Center Pane (Map Canvas) */}
        <div className="flex-1 bg-white p-4 shadow-lg rounded-lg overflow-auto">
          {/* Render ConceptMap and pass down the setSelectedCueCards function */}
          <ConceptMap setSelectedCueCards={setSelectedCueCards} />
        </div>

        {/* Right Panel (Tool Interface) */}
        <div className="bg-white p-4 shadow-lg rounded-lg overflow-auto">
          {/* Button to create a new document */}
          <button onClick={openModal} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
            New Document
          </button>
        </div>
      </Split>
    </>
  );
}

export default function ClientLayout() {
  return (
    <GlobalSettingsProvider>
      <ClientLayoutContent /> {/* Ensure that useGlobalSettings is used within the provider */}
    </GlobalSettingsProvider>
  );
}
