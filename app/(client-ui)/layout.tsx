// bloom-maps/app/(client-ui)/layout.tsx

'use client';
import React, { useState, useCallback, useEffect, useRef } from 'react'; 
import Split from 'react-split';
import CueCardDisplay from '@/app/Library/components/CardDisplay/CueCardDisplay'// Tests
import ConceptMap from '@/app/Library/components/ConceptMap';
import { DocumentProvider, useDocumentContext , initializeNewDocument, toggleResetMapSize, updateNodeTitle, createNewNode, setGetLayout, setFileName, saveDocument, loadDocument} from '@/app/Library/Context/DocumentProvider'; // Import the new provider
import { NodeSelectionProvider } from '@/app/Library/Context/NodeSelectionContext';
import { CueCardProvider } from '@/app/Library/Context/CueCardContext';
import ModernModal from  '@/app/Library/components/Modals/ModernModal';//Tests
import { useCueCardContext} from '@/app/Library/Context/CueCardContext';
import { TreeDimensionsProvider, useTreeDimensions } from '@/app/Library/Context/TreeDimensionsProvider';
import { useSubTreeContext, SubTreeProvider} from '@/app/Library/Context/SubTreeProvider'//'../Library/Context/SubTreeProvider'  
import { v4 as uuidv4 } from 'uuid';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import ToolPane from '@/app/Library/ui/ToolPane';
import { PictureProvider, usePictureContext} from '@/app/Library/Context/PictureContext'; // Import PictureProvider
import { PracticeSheetProvider,usePracticeSheetContext } from '@/app/Library/Context/PracticeSheetContext'; // Import PracticeSheetProvider
import { saveResource, ResourceType } from '@/app/Library/utils/ResourceSave/saveResource'; // Import helper function
import MenuBar from './MenuBar'; // Import the new MenuBar
import ToolBar from './ToolBar'; // Import the new ToolBar
import './ClientLayout.css';


function ClientLayoutContent() {
 
  
  const centerPaneRef = useRef<HTMLDivElement>(null); // Ref to center pane
  const [windowWidth, setWindowWidth] = useState<number>(0);
  const [windowHeight, setWindowHeight] = useState<number>(0);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const {state, dispatch, zoomIn, zoomOut} = useDocumentContext();
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



const handleTitleChange = (newTitle: string) => {
  dispatch(setFileName(newTitle));  // Update the file name in the context
};

const handleSaveDocument = async () => {
  await saveDocument(
    state,
    cueCards,
    subtrees,
    pictures,
    practiceSheets,
    state.fileName  // Pass the current file name from the state
  );
};

const handleOpenDocument = () => {
  console.log("handleOpenDocument called");
  console.log("fileInputRef.current:", fileInputRef.current);
  fileInputRef.current?.click();
};

const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (file) {
    await loadDocument(file, dispatch, setCueCards, setSubtrees, setPictures, setPracticeSheets);
  }
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
        source?: string,
        pictureDescription?: string,
        practiceSheetContent?: {
          quizType: 'matching' | 'multipleChoice' | 'wordProblem';
          quizContent: string;
        }
      ) => {
        if (modalNodeId) {
          if (modalMode === 'addChild') {
            const newNodeId = uuidv4();
            dispatch(createNewNode(nodeTitle || 'New Concept', modalNodeId, newNodeId));
            dispatch(setGetLayout(true));
    
            if (cueCardTitle || cueCardContent || image || practiceSheetContent) {
              saveResource({
                resourceType,
                nodeId: newNodeId,
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
            dispatch(updateNodeTitle(modalNodeId, nodeTitle));
    
            if (cueCardTitle || cueCardContent || image || practiceSheetContent) {
              saveResource({
                resourceType,
                nodeId: modalNodeId,
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
        setIsModalOpen(false);
      };
      
      const [isCenterPaneMounted, setIsCenterPaneMounted] = useState<boolean>(false);
        // Set the state when the center pane is mounted
  useEffect(() => {
    if (centerPaneRef) {
      setIsCenterPaneMounted(true); // Mark the center pane as mounted
    }
  }, [centerPaneRef]);

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
  onTitleChange={handleTitleChange}  // Pass the function to update the document title
  onNewDocument={handleCreateNewDocument}
  onOpenDocument={handleOpenDocument}
  onSaveDocument={handleSaveDocument}
  onHelp={() => console.log('Help clicked')}
/>

<ToolBar
  onSearch={() => console.log('Search clicked')}
  onZoomIn={() => console.log('Zoom In clicked')}
  onZoomOut={() => console.log('Zoom Out clicked')}
  onSetZoomLevel={(value) => console.log(`Zoom Level set to ${value}%`)}
  zoomLevel={Math.ceil((zoomLevel / baseZoomLevel) * 100)}
  onUndo={() => console.log('Undo clicked')}
  onRedo={() => console.log('Redo clicked')}
  onDeselectAll={() => console.log('Deselect All clicked')}
  onAddConcept={() => console.log('Add Concept clicked')}
  onAddCueCard={() => console.log('Add Cue Card clicked')}
  onAddPicture={() => console.log('Add Picture clicked')}
  onAddQuiz={() => console.log('Add Quiz clicked')}
  onEdit={() => console.log('Edit clicked')}
  onCut={() => console.log('Cut clicked')}
  onCopy={() => console.log('Copy clicked')}
  onPaste={() => console.log('Paste clicked')}
  onMerge={() => console.log('Merge clicked')}
  onDelete={() => console.log('Delete clicked')}
  onSetPrimaryColor={() => console.log('Primary Color clicked')}
  onSetSecondaryColor={() => console.log('Secondary Color clicked')}
  onSetTheme={() => console.log('Theme clicked')}
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
  <div className="flex flex-col space-y-2 bg-[#F9FBFD] p-4 shadow-lg rounded-lg overflow-y-auto">
    {/* Only render the CueCardDisplay after the center pane is mounted */}
    {isCenterPaneMounted && (
      <div className="flex flex-col space-y-2 pb-40">
        {/* Insert CueCardDisplay here */}
        <CueCardDisplay centerPaneRef={centerPaneRef} paneSizes={paneSizes} />
      </div>
    )}
  </div>

  {/* Center Pane (Map Canvas) */}
  <div
    ref={centerPaneRef}
    className="center-pane flex-1 bg-[#F9FBFD] p-4 shadow-lg rounded-lg overflow-auto"
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
      onOpenAddChildModal={handleOpenAddChildModal}
    />
  </div>

  {/* Right Panel (Tool Interface) */}
  <div className="relative bg-[#F9FBFD] p-4 shadow-lg rounded-lg overflow-auto">
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
