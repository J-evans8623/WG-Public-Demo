// bloom-maps/app/(client-ui)/layout.tsx

'use client';
import React, { useState, useCallback, useEffect, useRef } from 'react'; 
import Split from 'react-split';
import CueCardDisplay from '@/app/Library/components/CueCardDisplay'// Tests
import ConceptMap from '@/app/Library/components/ConceptMap';
import { DocumentProvider, serializeDocument , useDocumentContext, setColorTheme as setNewColorTheme , initializeNewDocument, setPrimaryColor, setBackgroundColor, toggleResetMapSize, updateNodeTitle, createNewNode, setGetLayout, setNodes} from '@/app/Library/Context/DocumentProvider'; // Import the new provider
import { CueCard, ConceptNode, SerializedDocument, Picture,PracticeSheet} from '@/app/Library/Definitions/Definitions';
import { NodeSelectionProvider } from '@/app/Library/Context/NodeSelectionContext';
import { CueCardProvider } from '@/app/Library/Context/CueCardContext';
import ModernModal from '@/app/Library/components/ModernModal';//Tests
import { useCueCardContext, serializeCueCards } from '@/app/Library/Context/CueCardContext';
import { TreeDimensionsProvider, useTreeDimensions } from '@/app/Library/Context/TreeDimensionsProvider';
import { useSubTreeContext, SubTreeProvider, serializeSubtrees, SubtreeData} from '@/app/Library/Context/SubTreeProvider'//'../Library/Context/SubTreeProvider'  
import { v4 as uuidv4 } from 'uuid';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import ToolPane from '@/app/Library/ui/ToolPane';
import { PictureProvider, usePictureContext, serializePictures } from '@/app/Library/Context/PictureContext'; // Import PictureProvider
import { PracticeSheetProvider,usePracticeSheetContext, serializePracticeSheets } from '@/app/Library/Context/PracticeSheetContext'; // Import PracticeSheetProvider
import { saveResource, ResourceType } from '@/app/Library/utils/ResourceSave/saveResource'; // Import helper function
import MenuBar from './MenuBar'; // Import the new MenuBar
import ToolBar from './ToolBar'; // Import the new ToolBar
import './ClientLayout.css';


function ClientLayoutContent() {
 
  
  const centerPaneRef = useRef<HTMLDivElement>(null); // Ref to center pane
  const [windowWidth, setWindowWidth] = useState<number>(0);
  const [windowHeight, setWindowHeight] = useState<number>(0);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const {state, dispatch, zoomIn, zoomOut, setColorTheme } = useDocumentContext();
  const { resetTreeDimensions} = useTreeDimensions();
  const { resetSubtrees, setSubtrees,subtrees  } = useSubTreeContext();
  const { addCueCard, resetCueCards, setCueCards,cueCards  } = useCueCardContext();
  const { addPicture, pictures, setPictures, resetPictures } = usePictureContext();
  const { addPracticeSheet, practiceSheets, setPracticeSheets, resetPracticeSheets } = usePracticeSheetContext();
  const [paneSizes, setPaneSizes] = useState<number[]>([20, 60, 20]);
  const {zoomLevel, baseZoomLevel} = state;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalNodeId, setModalNodeId] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<'addChild' | 'addResource'>('addResource');
  const { nodes } = state;
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
    initializeNewDocument(
      dispatch,
      resetCueCards,
      resetTreeDimensions,
      resetSubtrees,
      resetPictures, // Pass resetPictures
      resetPracticeSheets, // Pass resetPracticeSheets
      6, 
      windowWidth, 
      false
    ); // Set isInitialLoad to true
    setIsInitialized(true); // Ensure this only runs once
  }
}, [isInitialized, dispatch, windowWidth]);


const handleCreateNewDocument = useCallback(() => {
  initializeNewDocument(
    dispatch,
    resetCueCards,
    resetTreeDimensions,
    resetSubtrees,
    resetPictures, // Pass resetPictures
    resetPracticeSheets, // Pass resetPracticeSheets
    6, 
    windowWidth, 
    false
  );
  dispatch(toggleResetMapSize());
}, [dispatch, windowWidth, resetCueCards, resetTreeDimensions, resetSubtrees, resetPictures, resetPracticeSheets]);



const handleSaveDocument = async () => {
  const zip = new JSZip();

  // Serialize document data
  const serializedDocument = serializeDocument(state);
  const documentJson = JSON.stringify(serializedDocument);
  zip.file('document/document.json', documentJson);

  // Serialize cue cards
  const serializedCueCards = serializeCueCards(cueCards);
  const cueCardsJson = JSON.stringify(serializedCueCards);
  zip.file('document/cuecards.json', cueCardsJson);

  // Serialize subtrees
  const serializedSubtrees = serializeSubtrees(subtrees); 
  const subtreesJson = JSON.stringify(serializedSubtrees);
  zip.file('document/subtrees.json', subtreesJson);

  // Serialize pictures metadata
  const serializedPictures = serializePictures(pictures);
  const picturesJson = JSON.stringify(serializedPictures);
  zip.file('document/pictures.json', picturesJson);

  // Serialize practice sheets
  const serializedPracticeSheets = serializePracticeSheets(practiceSheets);
  const practiceSheetsJson = JSON.stringify(serializedPracticeSheets);
  zip.file('document/practiceSheets.json', practiceSheetsJson);

  // Serialize styles
  const styles = {
    primaryColor: state.primaryColor,
    backgroundColor: state.backgroundColor,
    colorTheme: state.colorTheme,
  };
  const stylesJson = JSON.stringify(styles);
  zip.file('document/styles.json', stylesJson);

  // Add images to the ZIP under 'document/images/'
  for (const [nodeId, pictureArray] of pictures.entries()) {
    for (const picture of pictureArray) {
      if (picture.image) {
        try {
          const imageData = await picture.image.arrayBuffer();
          zip.file(`document/images/${picture.id}_${picture.image.name}`, imageData);
        } catch (error) {
          console.error(`Error saving image ${picture.id}:`, error);
        }
      }
    }
  }

  // Generate ZIP and trigger download
  try {
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, 'my_document.bloomdocx');
  } catch (error) {
    console.error('Error generating ZIP:', error);
  }
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
    dispatch(setNodes(nodes));
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

  // Load pictures.json and images
  const picturesFile = content.file('document/pictures.json');
  if (picturesFile) {
    const picturesJson = await picturesFile.async('string');
    const parsedPictures = JSON.parse(picturesJson) as [string, { id: string; title: string; imagePath: string }[]][];
    const picturesMap = new Map<string, Picture[]>();

    for (const [nodeId, pictureArray] of parsedPictures) {
      const reconstructedPictures: Picture[] = [];
      for (const pic of pictureArray) {
        const imageFile = content.file(pic.imagePath);
        if (imageFile) {
          try {
            const imageBlob = await imageFile.async('blob');
            const imageURL = URL.createObjectURL(imageBlob);
            const imageFileObject = new File([imageBlob], pic.imagePath.split('/').pop() || 'image', { type: imageBlob.type });
            reconstructedPictures.push({
              id: pic.id,
              title: pic.title,
              image: imageFileObject,
            });
          } catch (error) {
            console.error(`Error loading image ${pic.id}:`, error);
          }
        } else {
          console.warn(`Image file not found: ${pic.imagePath}`);
        }
      }
      picturesMap.set(nodeId, reconstructedPictures);
    }
    setPictures(picturesMap);
  }

  // Load practiceSheets.json
  const practiceSheetsFile = content.file('document/practiceSheets.json');
  if (practiceSheetsFile) {
    const practiceSheetsJson = await practiceSheetsFile.async('string');
    const parsedPracticeSheets = JSON.parse(practiceSheetsJson) as [string, PracticeSheet[]][];
    const practiceSheetsMap = new Map<string, PracticeSheet[]>(parsedPracticeSheets);
    setPracticeSheets(practiceSheetsMap);
  }

  // Load styles.json
  const stylesFile = content.file('document/styles.json');
  if (stylesFile) {
    const stylesJson = await stylesFile.async('string');
    const styles = JSON.parse(stylesJson);
    dispatch(setPrimaryColor(styles.primaryColor));
    dispatch(setBackgroundColor(styles.backgroundColor));
  }

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
    setModalMode('addResource');
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
        resourceType: ResourceType,
        nodeTitle: string,
        cueCardTitle?: string,
        cueCardContent?: string,
        bloomLevel?: 1 | 2 | 3 | 4 | 5 | 6,
        image?: File | null,
        pictureDescription?: string,
        practiceSheetContent?: string
      ) => {
        if (modalNodeId) {
          // Logic for adding a child node or updating an existing node
          if (modalMode === 'addChild') {
            const newNodeId = uuidv4(); // Generate a unique ID for the new child node
            dispatch(createNewNode(nodeTitle || 'New Concept', modalNodeId, newNodeId));
            dispatch(setGetLayout(true));
    
            // Save resource (cue card, picture, or practice sheet) to the new child node
            if (cueCardTitle || cueCardContent || image || practiceSheetContent) {
              saveResource({
                resourceType,
                nodeId: newNodeId, // Use the new node ID
                addCueCard,
                addPicture,
                addPracticeSheet,
                cueCardTitle,
                cueCardContent,
                bloomLevel,
                image,
                practiceSheetContent,
              });
            }
          } else if (modalMode === 'addResource') {
            // Update node title if it was changed
            dispatch(updateNodeTitle(modalNodeId, nodeTitle));
    
            // Save resource (cue card, picture, or practice sheet) to the existing node
            if (cueCardTitle || cueCardContent || image || practiceSheetContent) {
              saveResource({
                resourceType,
                nodeId: modalNodeId, // Use the existing node ID
                addCueCard,
                addPicture,
                addPracticeSheet,
                cueCardTitle,
                cueCardContent,
                bloomLevel,
                image,
                practiceSheetContent,
              });
            }
          }
        }
        setIsModalOpen(false); // Close the modal after saving
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
            {/* Add MenuBar and ToolBar */}
            <MenuBar
        documentTitle="Untitled Document"
        onTitleChange={() => console.log('Title Changed')}
        onNewDocument={handleCreateNewDocument}
        onOpenDocument={handleOpenDocument}
        onSaveDocument={handleSaveDocument}
        onHelp={() => console.log('Help clicked')}
      />

<ToolBar
        onAddStudyResource={() => console.log('Add Study Resource clicked')}
        onAddConcept={() => console.log('Add Concept clicked')}
        onCut={() => console.log('Cut clicked')}
        onPaste={() => console.log('Paste clicked')}
        onDelete={() => console.log('Delete clicked')}
        onEdit={() => console.log('Edit clicked')}
        onUndo={() => console.log('Undo clicked')}
        onRedo={() => console.log('Redo clicked')}
        onZoomIn={() => zoomIn()}
        onZoomOut={() => zoomOut()}
        zoomLevel={zoomLevel}
      />

          {/* Add Padding Section Below Toolbar */}
    <div className="toolbar-padding-bottom"></div>

      {/* Main UI Layout */}


      <Split
    className="flex h-[calc(100vh-50px)]"
    sizes={paneSizes}
    minSize={[200, 400, 200]}
    maxSize={[500, Infinity, 400]}
    gutterSize={6}
    direction="horizontal"
    cursor="col-resize"
    onDragEnd={(sizes) => {
      setPaneSizes(sizes);
    }}
  >
  {/* Left Panel (Cue Card Viewer) */}
  <div className="flex flex-col space-y-2 bg-[#f5f5f5] p-4 shadow-lg rounded-lg overflow-y-auto">
    <CueCardDisplay />
  </div>

  {/* Center Pane (Map Canvas) */}
  <div
    ref={centerPaneRef}
    className="center-pane flex-1 bg-[#f5f5f5] p-4 shadow-lg rounded-lg overflow-auto"
    style={{
      position: 'relative',
      overflowX: 'auto', // Enables horizontal scrolling
      overflowY: 'auto', // Enables vertical scrolling
      scrollbarWidth: 'none', 
    }}
  >
    <ConceptMap 
    groundWidth={windowWidth} 
    centerPaneRef={centerPaneRef} 
    onOpenCueCardModal={handleOpenCueCardModal} 
    onOpenAddChildModal={handleOpenAddChildModal}/>
  </div>

  {/* Right Panel (Tool Interface) */}
  <div className="relative bg-[#f5f5f5] p-4 shadow-lg rounded-lg overflow-auto">
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
