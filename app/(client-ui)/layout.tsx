// bloom-maps/app/(client-ui)/layout.tsx

'use client';

import React, { useState, useCallback } from 'react';
import Split from 'react-split';
import CueCardDisplay from '../Component/CueCardDisplay';
import ConceptMap from '../Component/ConceptMap';
import DocumentCreationModal from '../Component/DocumentCreationModal';
import Modal from '../Component/Modal';
import { GlobalSettingsProvider, useGlobalSettings } from '../Component/context/old/GlobalSettingsContext';
import { DocumentProvider, useDocumentContext } from '../Component/context/DocumentProvider';

function ClientLayoutContent() {
  const { initializeNewDocument } = useDocumentContext();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  // Handle creating a new document
  const handleCreateNewDocument = useCallback((selectedDepth: 1 | 2 | 3 | 4 | 5 | 6) => {
    initializeNewDocument(selectedDepth);
    closeModal();
  }, [initializeNewDocument]);

  // Placeholder functions for other buttons
  const handleOpenDocument = () => {
    console.log("Open Document clicked");
    // Implement the logic to open a document here
  };

  const handleSaveDocument = () => {
    console.log("Save Document clicked");
    // Implement the logic to save the document here
  };

  const handleHelp = () => {
    console.log("Help clicked");
    // Implement the help functionality here
  };

  return (
    <>
      {/* Document Creation Modal */}
      <Modal isOpen={isModalOpen} onClose={closeModal}>
        <DocumentCreationModal
          isOpen={isModalOpen}
          onClose={closeModal}
          onCreate={() => handleCreateNewDocument(4)}
        />
      </Modal>

      {/* Main UI Layout */}
      <div className="flex items-center justify-between bg-gray-50 p-2 shadow-md">
        {/* Dynamic Menu Options */}
        <div className="flex items-center space-x-4">
          <button onClick={openModal} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
            New Doc
          </button>
          <button onClick={handleOpenDocument} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
            Open
          </button>
          <button onClick={handleSaveDocument} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
            Save
          </button>
        </div>
        <div className="flex items-center space-x-4">
          <button onClick={handleHelp} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
            Help
          </button>
        </div>
      </div>

      <Split
        className="flex h-[calc(100vh-50px)]"
        sizes={[20, 60, 20]} // Adjust sizes to be consistent
        minSize={[200, 600, 200]} // Ensure minSize does not exceed initial sizes
        maxSize={[600, Infinity, 400]} // Ensure maxSize does not conflict with sizes
        gutterSize={8}
        direction="horizontal"
        cursor="col-resize"
      >
        {/* Left Panel (Cue Card Viewer) */}
        <div className="flex flex-col space-y-2 bg-gray-200 p-4 shadow-lg rounded-lg overflow-y-auto">
          <CueCardDisplay />
        </div>

        {/* Center Pane (Map Canvas) */}
        <div className="flex-1 bg-white p-4 shadow-lg rounded-lg overflow-auto">
          <ConceptMap />
        </div>

        {/* Right Panel (Tool Interface) */}
        <div className="bg-white p-4 shadow-lg rounded-lg overflow-auto">
          {/* Other tools can be placed here */}
        </div>
      </Split>
    </>
  );
}

export default function ClientLayout() {
  return (
    <GlobalSettingsProvider>
      <DocumentProvider>
        <ClientLayoutContent />
      </DocumentProvider>
    </GlobalSettingsProvider>
  );
}
