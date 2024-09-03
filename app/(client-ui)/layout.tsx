// bloom-maps/app/(client-ui)/layout.tsx

'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react'; 
import Split from 'react-split';
import CueCardDisplay from '../Component/CueCardDisplay';
import ConceptMap from '../Component/ConceptMap';
import DocumentCreationModal from '../Component/DocumentCreationModal';
import Modal from '../Component/Modal';
import DocumentProvider, { useDocumentContext } from '../Component/context/DocumentProvider';
import { ColorTheme } from '@/app/Definitions/Definitions';

// Updated component to handle theme selection
const ThemeDropdown = ({ setColorTheme }: { setColorTheme: (theme: ColorTheme) => void }) => {
const [isOpen, setIsOpen] = useState(false);


  return (
    <div className="relative inline-block">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
      >
        Customize
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-20">
          <div className="py-1">
            <div className="px-4 py-2 text-sm text-gray-700">Color Theme</div>
            <button
              onClick={() => { setColorTheme('cool-spring'); setIsOpen(false); }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Cool Spring
            </button>
            <button
              onClick={() => { setColorTheme('warm-summer'); setIsOpen(false); }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Warm Summer
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

function ClientLayoutContent() {
  const { initializeNewDocument, setColorTheme } = useDocumentContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [groundWidth, setGroundWidth] = useState<number>(0); // Initialize to 0
  const centerPaneRef = useRef<HTMLDivElement>(null); // Ref to center pane

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

    // Update ground width once component is mounted on the client side
    useEffect(() => {
      const updateGroundWidth = () => {
        if (centerPaneRef.current) {
          setGroundWidth(centerPaneRef.current.offsetWidth); // Use the width of the center pane
        }
      };
  
      updateGroundWidth(); // Initial update on mount
  
      window.addEventListener('resize', updateGroundWidth); // Update on window resize
      return () => window.removeEventListener('resize', updateGroundWidth);
    }, []); // Only run on mount and unmount


  const handleCreateNewDocument = useCallback((selectedDepth: 1 | 2 | 3 | 4 | 5 | 6) => {
    initializeNewDocument(selectedDepth, groundWidth); // Pass ground width to initializeNewDocument
    closeModal();
  }, [initializeNewDocument, groundWidth]);

  const handleOpenDocument = () => {
    console.log("Open Document clicked");
  };

  const handleSaveDocument = () => {
    console.log("Save Document clicked");
  };

  const handleHelp = () => {
    console.log("Help clicked");
  };

  return (
    <>
      {/* Document Creation Modal */}
      <Modal isOpen={isModalOpen} onClose={closeModal}>
        <DocumentCreationModal
          isOpen={isModalOpen}
          onClose={closeModal}
          onCreate={handleCreateNewDocument} // Pass the function directly
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
          <ThemeDropdown setColorTheme={setColorTheme} />
        </div>
        <div className="flex items-center space-x-4">
          <button onClick={handleHelp} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
            Help
          </button>
        </div>
      </div>

      <Split
        className="flex h-[calc(100vh-50px)]"
        sizes={[20, 60, 20]} 
        minSize={[200, 600, 200]} 
        maxSize={[600, Infinity, 400]} 
        gutterSize={8}
        direction="horizontal"
        cursor="col-resize"
      >
        {/* Left Panel (Cue Card Viewer) */}
        <div className="flex flex-col space-y-2 bg-gray-200 p-4 shadow-lg rounded-lg overflow-y-auto">
          <CueCardDisplay />
        </div>

        {/* Center Pane (Map Canvas) */}
        <div ref={centerPaneRef} className="flex-1 bg-white p-4 shadow-lg rounded-lg overflow-auto">
           <ConceptMap groundWidth={groundWidth} /> {/* Pass groundWidth as a prop */}
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
      <DocumentProvider>
        <ClientLayoutContent />
      </DocumentProvider>
  );
}
