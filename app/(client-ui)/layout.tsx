// bloom-maps/app/(client-ui)/layout.tsx

'use client';

import React, { useContext, useState } from 'react';
import Split from 'react-split';
import CueCardDisplay from '../Component/CueCardDisplay';
import ConceptMap from '../Component/ConceptMap';
import DocumentCreationModal from '../Component/DocumentCreationModal';
import Modal from '../Component/Modal';
import { GlobalSettingsProvider, useGlobalSettings } from '../Component/context/old/GlobalSettingsContext';
import { DocumentProvider, useDocumentContext } from '../Component/context/DocumentProvider'; // Use the correct import statement

function ClientLayoutContent() {
  // Access global settings and functions from the GlobalSettingsContext
  const { createNewDocument } = useGlobalSettings();
  
  // Access document state and functions from DocumentProvider
  const { selectedCueCards, resetDocument, initializeNewDocument, selectCueCards } = useDocumentContext();

  // State to control the visibility of the DocumentCreationModal
  const [isModalOpen, setIsModalOpen] = useState(false);

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
    createNewDocument(selectedDepth);
    initializeNewDocument(selectedDepth); // Call the function to initialize the document
    closeModal(); // Close the modal after creating the document
  };

  return (
    <>
      {/* Document Creation Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
      >
        <DocumentCreationModal
          isOpen={isModalOpen} // Pass the isOpen prop
          onClose={closeModal}
          onCreate={() => handleCreateNewDocument(4)} // Default to bloom depth 4 if none selected
        />
      </Modal>

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
          <ConceptMap setSelectedCueCards={selectCueCards} />
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
      <DocumentProvider>
        <ClientLayoutContent /> {/* Ensure that useGlobalSettings is used within the provider */}
      </DocumentProvider>
    </GlobalSettingsProvider>
  );
}
