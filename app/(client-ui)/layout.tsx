// bloom-maps/app/(client-ui)/layout.tsx

'use client';
/**
 * Refactored
 * 
 */
import React, { useState, useCallback, useEffect, useRef } from 'react'; 
import Split from 'react-split';
import CueCardDisplay from '@/app/Library/Tests/CueCardDisplay'// Tests
import ConceptMap from '@/app/Library/components/ConceptMap';
import { DocumentProvider, serializeDocument , useDocumentContext, setColorTheme as setNewColorTheme , initializeNewDocument, setPrimaryColor, setBackgroundColor, toggleResetMapSize, updateNodeTitle, createNewNode, setGetLayout, setNodes} from '@/app/Library/Context/DocumentProvider'; // Import the new provider
import { ColorTheme, CueCard, ConceptNode, SerializedDocument} from '@/app/Library/Definitions/Definitions';
import { RiZoomInLine, RiZoomOutLine } from 'react-icons/ri';
import { NodeSelectionProvider } from '@/app/Library/Context/NodeSelectionContext';
import { CueCardProvider } from '@/app/Library/Context/CueCardContext';
import ModernModal from '@/app/Library/Tests/ModernModal';
import { useCueCardContext, serializeCueCards } from '@/app/Library/Context/CueCardContext';
import { TreeDimensionsProvider, useTreeDimensions } from '@/app/Library/Context/TreeDimensionsProvider';
import { useSubTreeContext, SubTreeProvider, serializeSubtrees, SubtreeData} from '../Library/Context/SubTreeProvider'  
import { v4 as uuidv4 } from 'uuid';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import ToolPane from '@/app/Library/ui/ToolPane';
import { PictureProvider } from '@/app/Library/Context/PictureContext'; // Import PictureProvider
import { PracticeSheetProvider } from '@/app/Library/Context/PracticeSheetContext'; // Import PracticeSheetProvider

function ClientLayoutContent() {
 
  
  const centerPaneRef = useRef<HTMLDivElement>(null); // Ref to center pane
  const [windowWidth, setWindowWidth] = useState<number>(0);
  const [windowHeight, setWindowHeight] = useState<number>(0);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const {state, dispatch, zoomIn, zoomOut, setColorTheme } = useDocumentContext();
  const { resetTreeDimensions} = useTreeDimensions();
  const { resetSubtrees, setSubtrees } = useSubTreeContext();
  const { addCueCard, resetCueCards, setCueCards } = useCueCardContext();
  const [paneSizes, setPaneSizes] = useState<number[]>([20, 60, 20]);
  const {zoomLevel, baseZoomLevel} = state;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalNodeId, setModalNodeId] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<'addChild' | 'addCueCard'>('addCueCard');
  const { nodes } = state;
  const { cueCards } = useCueCardContext();
  const { subtrees } = useSubTreeContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

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

// Inside ClientLayoutContent component
const handleSaveDocument = async () => {
  const zip = new JSZip();

  // Serialize document data
  const serializedDocument = serializeDocument(state);
  const documentJson = JSON.stringify(serializedDocument);

// Serialize cue cards
const serializedCueCards = serializeCueCards(cueCards);
const cueCardsJson = JSON.stringify(serializedCueCards);
zip.file('document/cuecards.json', cueCardsJson);

// Serialize subtrees
const serializedSubtrees = serializeSubtrees(subtrees); 
const subtreesJson = JSON.stringify(serializedSubtrees);
zip.file('document/subtrees.json', subtreesJson);

// Serialize styles
const styles = {
  primaryColor: state.primaryColor,
  backgroundColor: state.backgroundColor,
  colorTheme: state.colorTheme,
};
const stylesJson = JSON.stringify(styles);
zip.file('document/styles.json', stylesJson);

  // Add document.json to the zip
  zip.file('document/document.json', documentJson);

  // Generate ZIP and trigger download
  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, 'my_document.bloomdocx');
};

const handleOpenDocument = () => {
  console.log("handleOpenDocument called");
  console.log("fileInputRef.current:", fileInputRef.current);
  fileInputRef.current?.click();
};

const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
  console.log("handleFileChange called");
  const file = event.target.files?.[0];
  if (file) {
    await handleLoadDocument(file);
  }
};
const handleLoadDocument = async (file: File) => {
  console.log("handleLoadDocument called with file:", file.name);
  const zip = new JSZip();
  const content = await zip.loadAsync(file);

  // Load document.json
  const documentFile = content.file('document/document.json');
  if (documentFile) {
    const documentJson = await documentFile.async('string');
    const parsedDocument = JSON.parse(documentJson) as SerializedDocument;

    // Reconstruct nodes Map
    const nodes = new Map<string, ConceptNode>(parsedDocument.nodes);

    // Update DocumentProvider state
    dispatch(setNodes(nodes));
    //dispatch(setColorTheme(parsedDocument.colorTheme));
    //dispatch(setZoomLevel(parsedDocument.zoomLevel));
    dispatch(setPrimaryColor(parsedDocument.primaryColor));
    dispatch(setBackgroundColor(parsedDocument.backgroundColor));
  }

  // Load cuecards.json
  const cueCardsFile = content.file('document/cuecards.json');
  if (cueCardsFile) {
    const cueCardsJson = await cueCardsFile.async('string');
    const parsedCueCards = JSON.parse(cueCardsJson) as [string, CueCard[]][];
    const cueCardsMap = new Map<string, CueCard[]>(parsedCueCards);
    setCueCards(cueCardsMap);
  }

  // Load subtrees.json
  const subtreesFile = content.file('document/subtrees.json');
  if (subtreesFile) {
    const subtreesJson = await subtreesFile.async('string');
    const parsedSubtrees = JSON.parse(subtreesJson) as [string, SubtreeData][];
    const subtreesMap = new Map<string, SubtreeData>(parsedSubtrees);
    setSubtrees(subtreesMap);
  }

  // Load styles.json
  const stylesFile = content.file('document/styles.json');
  if (stylesFile) {
    const stylesJson = await stylesFile.async('string');
    const styles = JSON.parse(stylesJson);
    dispatch(setPrimaryColor(styles.primaryColor));
    dispatch(setBackgroundColor(styles.backgroundColor));
    //dispatch(setColorTheme(styles.colorTheme));
  }

  // Load settings.json
/**  const settingsFile = content.file('document/settings.json');
  if (settingsFile) {
    const settingsJson = await settingsFile.async('string');
    const settings = JSON.parse(settingsJson);
    //dispatch(setZoomLevel(settings.zoomLevel));
  } */

  // Trigger layout computation if necessary
  dispatch(setGetLayout(true));
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

      const handleModalSave = (
        nodeTitle: string,
        cueCardTitle: string,
        cueCardContent: string,
        bloomLevel: 1 | 2 | 3 | 4 | 5 | 6,
        image?: File | null,
        source?: string
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
                id: Date.now().toString(),// Needs to be updated
                title: cueCardTitle,
                content: cueCardContent,
                bloomLevel,
                source, // Include source here
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
                source, // Include source here
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
        {/* Hidden File Input for "Open" */}
        <input
      type="file"
      accept=".bloomdocx"
      ref={fileInputRef}
      style={{ display: 'none' }}
      onChange={handleFileChange}
    />
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
    sizes={paneSizes}
    minSize={[200, 400, 200]}
    maxSize={[500, Infinity, 400]}
    gutterSize={8}
    direction="horizontal"
    cursor="col-resize"
    onDragEnd={(sizes) => {
      setPaneSizes(sizes);
    }}
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
  <ToolPane />
  </div>
</Split>
    </>
  );
}

export default function ClientLayout() {
  return (
    <DndProvider backend={HTML5Backend}>
      <TreeDimensionsProvider> {/* Add TreeDimensionsProvider here */}
        <NodeSelectionProvider>
          <CueCardProvider> {/* Wrap in CueCardProvider */}
            <DocumentProvider>
            <SubTreeProvider>
            <PictureProvider> {/* Wrap ClientLayoutContent in PictureProvider */}
                  <PracticeSheetProvider> {/* Wrap ClientLayoutContent in PracticeSheetProvider */}
                    <ClientLayoutContent />
                  </PracticeSheetProvider>
                </PictureProvider>
              </SubTreeProvider>
            </DocumentProvider>
          </CueCardProvider>
        </NodeSelectionProvider>
      </TreeDimensionsProvider>
    </DndProvider>
  );
}
