// bloom-maps/app/(client-ui)/layout.tsx

'use client';
/**
 * Refactored
 * 
 */
import React, { useState, useCallback, useEffect, useRef } from 'react'; 
import Split from 'react-split';
import CueCardDisplay from '@/app/Library/components/CueCardDisplay'//'../Component/CueCardDisplay';
import ConceptMap from '@/app/Library/components/ConceptMap';
import DocumentCreationModal from '@/app/Library/components/DocumentCreationModal';
import Modal from '@/app/Library/components/Modal';
import { DocumentProvider, useDocumentContext, setColorTheme as setNewColorTheme , initializeNewDocument, setPrimaryColor, setBackgroundColor} from '@/app/Library/Context/DocumentProvider'; // Import the new provider
import { ColorTheme, CueCard} from '@/app/Library/Definitions/Definitions';
import { RiZoomInLine, RiZoomOutLine } from 'react-icons/ri';
import { NodeSelectionProvider } from '@/app/Library/Context/NodeSelectionContext';
import { CueCardProvider } from '@/app/Library/Context/CueCardContext';
import ModernModal from '@/app/Library/components/ModernModal';
import { useCueCardContext } from '@/app/Library/Context/CueCardContext';
import { TreeDimensionsProvider } from '@/app/Library/Tests/TreeDimensionsProvider';



// Updated component to handle theme selection
const ThemeDropdown = ({ setColorTheme }: { setColorTheme: (theme: ColorTheme) => void }) => {
  const {dispatch,  } = useDocumentContext();  // Use the new context for dispatching the action
const [isOpen, setIsOpen] = useState(false);

  // Handler to update both old and new providers
  const handleSetColorTheme = (theme: ColorTheme) => {
    //setColorTheme(theme); // Old provider function call (to be removed)
    dispatch(setNewColorTheme(theme)); // New provider function call
    setIsOpen(false); // Close the dropdown menu
  };


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
              onClick={() => handleSetColorTheme('cool-spring')}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Cool Spring
            </button>
            <button
              onClick={() => handleSetColorTheme('warm-summer')}
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
 
  const [isModalOpen, setIsModalOpen] = useState(false);
  const centerPaneRef = useRef<HTMLDivElement>(null); // Ref to center pane
  const [windowWidth, setWindowWidth] = useState<number>(0);
  const [windowHeight, setWindowHeight] = useState<number>(0);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const {state, dispatch, zoomIn, zoomOut, setColorTheme  } = useDocumentContext();
  const { addCueCard, resetCueCards } = useCueCardContext();
  const zoomLevel = state.zoomLevel;

  const [isAddingCueCard, setIsAddingCueCard] = useState(false);
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);

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

useEffect(() => {
  if (!isInitialized) {
    initializeNewDocument(dispatch, resetCueCards, 6, windowWidth, true); // Set isInitialLoad to true
    setIsInitialized(true); // Ensure this only runs once
  }
}, [isInitialized, dispatch, windowWidth]);

const handleCreateNewDocument = useCallback(
  (selectedDepth: 1 | 2 | 3 | 4 | 5 | 6) => {
    initializeNewDocument(dispatch,  resetCueCards, selectedDepth, windowWidth, false); // Reset and create a new document
    closeModal();
  },
  [dispatch, windowWidth]
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

  const handleOpenCueCardModal = useCallback((nodeId: string) => {
    setCurrentNodeId(nodeId);
    setIsAddingCueCard(true);
  }, []);

  // Function to save the cue card
  const handleCueCardSave = useCallback(
    (title: string, content: string, bloomLevel: 1 | 2 | 3 | 4 | 5 | 6, image?: File | null) => {
      if (currentNodeId) {
        const newCueCard: CueCard = {
          id: Date.now().toString(),
          title,
          content,
          bloomLevel,
          // Handle image if needed
        };
        addCueCard(currentNodeId, newCueCard); // Use your context or state management to add the cue card
      }
      setIsAddingCueCard(false);
    },
    [currentNodeId, addCueCard]
  );

    //Tool Pane Layout color;
    // Predefined color sets
    const primaryColors = ['#D5E6ED', '#C4ACAA', '#F7CAAB', '#EBD3E0'];
    const backgroundColors = ['#ECE7D1', '#F7EBD1', '#EEECBC', '#F5F5F5'];

    // Function to handle primary color change
    const handleSetPrimaryColor = (color: string) => {
      dispatch(setPrimaryColor(color)); // Use action creator
    };
  
    // Function to handle background color change
    const handleSetBackgroundColor = (color: string) => {
      dispatch(setBackgroundColor(color)); // Use action creator
    };

  return (
    <>
      {/*  ModernModal  */}
          <ModernModal
        isOpen={isAddingCueCard}
        onClose={() => setIsAddingCueCard(false)}
        onCreateCueCard={handleCueCardSave}
      />
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
  sizes={[20, 60, 20]}    // sizes={[20, 60, 20]} 
  minSize={[200, 400, 200]}  // minSize={[200, 600, 200]} 
  maxSize={[500, Infinity, 400]} 
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
    className="flex-1 bg-gray-200 p-4 shadow-lg rounded-lg overflow-auto scrollbar-thin scrollbar-thumb-gray-500 scrollbar-track-gray-200"
    style={{
      position: 'relative',
      overflowX: 'auto', // Enables horizontal scrolling
      overflowY: 'auto', // Enables vertical scrolling
    }}
  >
    <ConceptMap groundWidth={windowWidth} centerPaneRef={centerPaneRef} onOpenCueCardModal={handleOpenCueCardModal}/>
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
    {/* Color Customization Options */}
    <div className="mt-16 flex flex-col space-y-4">
            {/* Primary Color Selector */}
            <div className="flex flex-col items-start">
              <label className="text-sm text-gray-700">Primary Color:</label>
              {primaryColors.map((color) => (
                <button
                  key={color}
                  onClick={() => handleSetPrimaryColor(color)}
                  className="w-6 h-6 border border-black rounded-full"
                  style={{ backgroundColor: color }}
                  title={`Set Primary Color: ${color}`}
                />
              ))}
            </div>

            {/* Background Color Selector */}
            <div className="flex flex-col items-start">
              <label className="text-sm text-gray-700">Background Color:</label>
              {backgroundColors.map((color) => (
                <button
                  key={color}
                  onClick={() => handleSetBackgroundColor(color)}
                  className="w-6 h-6 border border-black rounded-full"
                  style={{ backgroundColor: color }}
                  title={`Set Background Color: ${color}`}
                />
              ))}
            </div>
          </div>
  </div>
</Split>
    </>
  );
}

export default function ClientLayout() {
  return (
    <TreeDimensionsProvider> {/* Add TreeDimensionsProvider here */}
      <NodeSelectionProvider>
        <CueCardProvider> {/* Wrap in CueCardProvider */}
          <DocumentProvider>
            <ClientLayoutContent />
          </DocumentProvider>
        </CueCardProvider>
      </NodeSelectionProvider>
    </TreeDimensionsProvider>
  );
}
