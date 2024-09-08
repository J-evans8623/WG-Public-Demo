// bloom-maps/app/(client-ui)/layout.tsx

'use client';
/**
 * Refactored
 * 
 */
import React, { useState, useCallback, useEffect, useRef } from 'react'; 
import Split from 'react-split';
import CueCardDisplay from '@/app/Refactor/Component/CueCardDisplay'//'../Component/CueCardDisplay';
import ConceptMap from '@/app/Refactor/Component/ConceptMap';
import DocumentCreationModal from '@/app/Refactor/Component/DocumentCreationModal';
import Modal from '@/app/Refactor/Component/Modal';
import DocumentProvider, { useDocumentContext } from '@/app/Refactor/Context/DocumentProvider';
//import { TreeSizeProvider } from //'../Component/context/TreeSizeContext';
import { PositionProvider } from '@/app/Refactor/Context/PositionTrackingContext'//'../Component/context/PositionTrackingContext'; // Import PositionProvider
import { ColorTheme } from '@/app/Refactor/Definitions/Definitions';
import { RiZoomInLine, RiZoomOutLine } from 'react-icons/ri';

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
  const { initializeNewDocument, setColorTheme, zoomIn, zoomOut, zoomLevel } = useDocumentContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  //const [groundWidth, setGroundWidth] = useState<number>(0); // Initialize to 0
  const centerPaneRef = useRef<HTMLDivElement>(null); // Ref to center pane
  const [windowWidth, setWindowWidth] = useState<number>(0);
  const [windowHeight, setWindowHeight] = useState<number>(0);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

    // Update ground width once component is mounted on the client side
  // Update window dimensions on resize
  useEffect(() => {
    const updateWindowSize = () => {
      setWindowWidth(window.innerWidth);
      setWindowHeight(window.innerHeight);
    };

    updateWindowSize();

    window.addEventListener('resize', updateWindowSize);
    return () => window.removeEventListener('resize', updateWindowSize);
  }, []);

    // Initialize document on first page load
    useEffect(() => {
      if (!isInitialized) {
        initializeNewDocument(6, windowWidth, true); // Set isInitialLoad to true
        setIsInitialized(true); // Ensure this only runs once
      }
    }, [isInitialized, initializeNewDocument, windowWidth]);


  const handleCreateNewDocument = useCallback(
    (selectedDepth: 1 | 2 | 3 | 4 | 5 | 6) => {
      initializeNewDocument(selectedDepth, windowWidth, false); // Reset and create a new document
      closeModal();
    },
    [initializeNewDocument, windowWidth]
  );

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
  <div
    ref={centerPaneRef}
    className="flex-1 bg-gray-200 p-4 shadow-lg rounded-lg overflow-auto flex justify-center items-center scrollbar-thin"
    style={{
      position: 'relative',
      overflowX: 'auto', // Enables horizontal scrolling
      overflowY: 'auto', // Enables vertical scrolling
      display: 'flex',
      justifyContent: 'center', // Center horizontally
      alignItems: 'center', // Center vertically
    }}
  >
    <ConceptMap groundWidth={windowWidth} centerPaneRef={centerPaneRef} />
  </div>

  {/* Right Panel (Tool Interface) */}
  <div className="relative bg-gray-200 p-4 shadow-lg rounded-lg overflow-auto">
    {/* Zoom Buttons */}
    <div className="absolute top-2 left-2 flex space-x-2 bg-gray-300 p-2 rounded shadow">
      <button
        title={`Zoom In (${Math.ceil((zoomLevel / 0.7) * 100)}%)`} // Normalizing zoom to 100% at baseline
        onClick={zoomIn}
        className="p-1 rounded hover:bg-gray-400"
      >
        <RiZoomInLine />
      </button>
      <button
        title={`Zoom Out (${Math.ceil((zoomLevel / 0.7) * 100)}%)`} // Normalizing zoom to 100% at baseline
        onClick={zoomOut}
        className="p-1 rounded hover:bg-gray-400"
      >
        <RiZoomOutLine />
      </button>
    </div>
    {/* Add other tools here */}
  </div>
</Split>
    </>
  );
}

export default function ClientLayout() {
  return (
    <DocumentProvider>
      {/**<TreeSizeProvider>*/ }{/* Wrap within TreeSizeProvider */}
      <PositionProvider>
        <ClientLayoutContent />
        </PositionProvider> 
      {/** </TreeSizeProvider>*/}
    </DocumentProvider>
  );
}
