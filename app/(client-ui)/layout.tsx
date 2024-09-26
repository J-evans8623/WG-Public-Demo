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
import { DocumentProvider, useDocumentContext, setColorTheme as setNewColorTheme , initializeNewDocument, setPrimaryColor, setBackgroundColor, toggleResetMapSize, updateNodeTitle, createNewNode, setGetLayout} from '@/app/Library/Context/DocumentProvider'; // Import the new provider
import { ColorTheme, CueCard} from '@/app/Library/Definitions/Definitions';
import { RiZoomInLine, RiZoomOutLine } from 'react-icons/ri';
import { NodeSelectionProvider } from '@/app/Library/Context/NodeSelectionContext';
import { CueCardProvider } from '@/app/Library/Context/CueCardContext';
import ModernModal from '@/app/Library/components/ModernModal';
import { useCueCardContext } from '@/app/Library/Context/CueCardContext';
import { TreeDimensionsProvider, useTreeDimensions } from '@/app/Library/Context/TreeDimensionsProvider';
import { useSubTreeContext, SubTreeProvider} from '../Library/Context/SubTreeProvider'  
import { v4 as uuidv4 } from 'uuid';


function ClientLayoutContent() {
 
  
  const centerPaneRef = useRef<HTMLDivElement>(null); // Ref to center pane
  const [windowWidth, setWindowWidth] = useState<number>(0);
  const [windowHeight, setWindowHeight] = useState<number>(0);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const {state, dispatch, zoomIn, zoomOut, setColorTheme } = useDocumentContext();
  const { resetTreeDimensions} = useTreeDimensions();
  const { resetSubtrees } = useSubTreeContext();
  const { addCueCard, resetCueCards } = useCueCardContext();
  const {zoomLevel, baseZoomLevel} = state;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalNodeId, setModalNodeId] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<'addChild' | 'addCueCard'>('addCueCard');
  const { nodes } = state;
  



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
    initializeNewDocument(dispatch, resetCueCards,resetTreeDimensions,resetSubtrees, 6, windowWidth, true); // Set isInitialLoad to true
    setIsInitialized(true); // Ensure this only runs once
  }
}, [isInitialized, dispatch, windowWidth]);
/**
 * NOTICE Page size is not resetted back to default when a new document is created. 
 * TreeContext Needs to be Resetted as well
 * 
 */

const handleCreateNewDocument = useCallback(() => {
  initializeNewDocument(dispatch, resetCueCards, resetTreeDimensions, resetSubtrees, 6, windowWidth, false); // Always use depth 6
  dispatch(toggleResetMapSize());
}, [dispatch, windowWidth, resetCueCards, resetTreeDimensions, resetSubtrees]);

  const handleOpenDocument = () => {
    console.log("Open Document clicked");
  };

  const handleSaveDocument = () => {
    console.log("Save Document clicked");
  };

  const handleHelp = () => {
    console.log("Help clicked");
  };

 // Handler for opening the modal
  // Handler to open modal for adding a cue card
  const handleOpenCueCardModal = useCallback((nodeId: string) => {
    setModalNodeId(nodeId);
    setModalMode('addCueCard');
    setIsModalOpen(true);
  }, []);


  // Handler to open modal for adding a child node or editing node
  const handleOpenAddChildModal = useCallback((parentNodeId: string) => {
    setModalNodeId(parentNodeId);
    setModalMode('addChild');
    setIsModalOpen(true);
  }, []);
  // Handler for saving data from the modal
  const initialNodeTitle =
    modalMode === 'addChild'
      ? 'New Concept'
      : modalNodeId
      ? nodes.get(modalNodeId)?.title || ''
      : '';

  // Handler for saving data from the modal
  const handleModalSave = (
    nodeTitle: string,
    cueCardTitle: string,
    cueCardContent: string,
    bloomLevel: 1 | 2 | 3 | 4 | 5 | 6,
    image?: File | null
  ) => {
    if (modalNodeId) {
      if (modalMode === 'addChild') {
        // Generate newNodeId
        const newNodeId = uuidv4();
        // Create new child node
        dispatch(createNewNode(nodeTitle || 'New Concept', modalNodeId, newNodeId));
        dispatch(setGetLayout(true));

        // Add cue card if applicable
        if (cueCardTitle.trim() !== '' && cueCardContent.trim() !== '') {
          const newCueCard: CueCard = {
            id: Date.now().toString(),
            title: cueCardTitle,
            content: cueCardContent,
            bloomLevel,
          };
          addCueCard(newNodeId, newCueCard);
        }
      } else if (modalMode === 'addCueCard') {
        // Update node title if it was edited
        dispatch(updateNodeTitle(modalNodeId, nodeTitle));

        // Add cue card to existing node
        if (cueCardTitle.trim() !== '' && cueCardContent.trim() !== '') {
          const newCueCard: CueCard = {
            id: Date.now().toString(),
            title: cueCardTitle,
            content: cueCardContent,
            bloomLevel,
          };
          addCueCard(modalNodeId, newCueCard);
        }
      }
    }
    setIsModalOpen(false);
  };
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
      {/* ModernModal */}
      <ModernModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleModalSave}
        initialNodeTitle={initialNodeTitle}
        mode={modalMode}
      />

      {/* Main UI Layout */}
      <div className="flex items-center justify-between bg-gray-50 p-2 shadow-md">
        {/* Dynamic Menu Options */}
        <div className="flex items-center space-x-4">
          <button onClick={handleCreateNewDocument} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
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
    <ConceptMap 
    groundWidth={windowWidth} 
    centerPaneRef={centerPaneRef} 
    onOpenCueCardModal={handleOpenCueCardModal} 
    onOpenAddChildModal={handleOpenAddChildModal}/>
  </div>

  {/* Right Panel (Tool Interface) */}
  <div className="relative bg-gray-200 p-4 shadow-lg rounded-lg overflow-auto">
    {/* Zoom Buttons */}
    <div className="absolute top-2 left-2 flex space-x-2 bg-gray-300 p-2 rounded shadow">
      <button
        title={`Zoom In (${Math.ceil((zoomLevel / baseZoomLevel) * 100)}%)`} // Normalizing zoom to 100% at baseline
        onClick={zoomIn}
        className="p-1 rounded hover:bg-gray-400"
      >
        <RiZoomInLine />
      </button>
      <button
        title={`Zoom Out (${Math.ceil((zoomLevel / baseZoomLevel) * 100)}%)`} // Normalizing zoom to 100% at baseline
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
          <SubTreeProvider>
            <ClientLayoutContent />
            </SubTreeProvider>
          </DocumentProvider>
        </CueCardProvider>
      </NodeSelectionProvider>
    </TreeDimensionsProvider>
  );
}
