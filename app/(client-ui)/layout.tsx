// bloom-maps/app/(client-ui)/layout.tsx

'use client';

import React, { useState } from 'react';
import Split from 'react-split';
import CueCardDisplay from '../Component/CueCardDisplay';
import ConceptMap from '../Component/ConceptMap';
import DocumentCreationModal from '../Component/DocumentCreationModal';
import { CueCard } from '@/app/Definitions/Definitions';
import { GlobalSettingsProvider, useGlobalSettings } from '../Component/context/old/GlobalSettingsContext';
import { DocumentProvider } from '@/app/Component/context/DocumentProvider'; // Import the DocumentProvider

function ClientLayoutContent() {
  const [selectedCueCards, setSelectedCueCards] = useState<CueCard[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { createNewDocument } = useGlobalSettings();

  const openModal = () => {
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleCreateNewDocument = (selectedDepth: 1 | 2 | 3 | 4 | 5 | 6) => {
    createNewDocument(selectedDepth);
    closeModal();
  };

  return (
    <>
      <DocumentCreationModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onCreate={() => handleCreateNewDocument(4)} 
      />

      <Split
        className="flex h-[calc(100vh-50px)]"
        sizes={[25, 55, 20]}
        minSize={[200, 300, 150]}
        maxSize={[400, Infinity, 300]}
        gutterSize={8}
        direction="horizontal"
        cursor="col-resize"
      >
        <div className="bg-gray-200 p-4 shadow-lg rounded-lg overflow-y-auto min-w-[200px] flex flex-col space-y-2">
          <CueCardDisplay cueCards={selectedCueCards} />
        </div>

        <div className="flex-1 bg-white p-4 shadow-lg rounded-lg overflow-auto">
          <ConceptMap setSelectedCueCards={setSelectedCueCards} />
        </div>

        <div className="bg-white p-4 shadow-lg rounded-lg overflow-auto">
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
      <DocumentProvider> {/* Wrap the entire layout with DocumentProvider */}
        <ClientLayoutContent />
      </DocumentProvider>
    </GlobalSettingsProvider>
  );
}
