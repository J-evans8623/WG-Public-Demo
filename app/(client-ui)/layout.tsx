'use client';

import React, { useState, useCallback, useEffect, useRef, memo } from 'react';
import Split from 'react-split';
import CueCardDisplay from '@/app/Library/components/CardDisplay/CueCardDisplay';
import ConceptMap from '@/app/Library/components/ConceptMap';
import { NodeSelectionProvider, useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import { CueCardProvider, useCueCardContext } from '@/app/Library/Context/CueCardContext';
import ModernModal from '@/app/Library/components/Modals/ModernModal';
import { TreeDimensionsProvider, useTreeDimensions } from '@/app/Library/Context/TreeDimensionsProvider';
import { useSubTreeContext, SubTreeProvider } from '@/app/Library/Context/SubTreeProvider';
import { v4 as uuidv4 } from 'uuid';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { PictureProvider, usePictureContext } from '@/app/Library/Context/PictureContext';
import { PracticeSheetProvider, usePracticeSheetContext } from '@/app/Library/Context/PracticeSheetContext';
import { saveResource, ResourceType } from '@/app/Library/utils/ResourceSave/saveResource';
import MenuBar from '@/app/(client-ui)/MenuBar';
import ToolBar from '@/app/(client-ui)/ToolBar';
import '@/app/(client-ui)/ClientLayout.css';

// Import new context providers and hooks
import { NodesProvider, useNodesContext } from '@/app/Library/Context/NodesProvider';
import { ZoomProvider, useZoomContext } from '@/app/Library/Context/ZoomProvider';
import { LayoutProvider, useLayoutContext } from '@/app/Library/Context/LayoutProvider';
import { ColorThemeProvider, useColorThemeContext } from '@/app/Library/Context/ColorThemeProvider';
import { FileProvider, useFileContext } from '@/app/Library/Context/FileProvider';

// Import action creators
import { createNewNode, updateNodeTitle } from '@/app/Library/Context/nodesActions';
import { setGetLayout, toggleResetMapSize } from '@/app/Library/Context/LayoutActions';
import { setFileName } from '@/app/Library/Context/fileActions';
import { saveDocument, loadDocument, initializeNewDocument } from '@/app/Library/utils/documentUtils'; 

// Dynamic Tool Panes
import ToolPane from '@/app/Library/dynamic_tool_panes/ToolPane';

const ClientLayoutContent = memo(function ClientLayoutContent() {
  const centerPaneRef = useRef<HTMLDivElement>(null);
  const [windowWidth, setWindowWidth] = useState<number>(0);
  const [windowHeight, setWindowHeight] = useState<number>(0);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  // Use new context hooks
  const { nodes, dispatch: nodesDispatch } = useNodesContext();
  const { zoomLevel, baseZoomLevel, dispatch: zoomDispatch } = useZoomContext();
  const { dispatch: layoutDispatch } = useLayoutContext();
  const { dispatch: fileDispatch, fileName } = useFileContext();
  const { colorTheme, primaryColor, backgroundColor, dispatch: colorThemeDispatch } = useColorThemeContext();
  const { resetTreeDimensions } = useTreeDimensions();
  const { resetSubtrees, setSubtrees, subtrees } = useSubTreeContext();
  const { addCueCard, resetCueCards, setCueCards, cueCards } = useCueCardContext();
  const { addPicture, pictures, setPictures, resetPictures } = usePictureContext();
  const { addPracticeSheet, practiceSheets, setPracticeSheets, resetPracticeSheets } = usePracticeSheetContext();

  const [paneSizes, setPaneSizes] = useState<number[]>([20, 60, 20]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalResourceType, setModalResourceType] = useState<'cueCard' | 'picture' | 'practiceSheet' | undefined>(undefined);
  const [modalNodeId, setModalNodeId] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<'addChild' | 'addResource'>('addResource');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeOperation, setActiveOperation] = useState<'cut-copy' | 'delete' | 'merge' |'edit'| null>(null); // Track the active tool pane
  const [toolPaneVisible, setToolPaneVisible] = useState(false);
  const [sourceNodeId, setSourceNodeId] = useState<string | ''>('');
 const { toggleNodeSelection, setTargetNodeId,  clearSelection, selectNode } = useNodeSelection();

 const openModalWithResourceType = (nodeId: string, resourceType: 'cueCard' | 'picture' | 'practiceSheet') => {
  setModalNodeId(nodeId); // Set the node ID for the resource
  if (!resourceType){
    setModalMode('addChild')
  } else {
    setModalMode('addResource');
  }
   // Specify the mode to indicate it's an "add" operation
  setModalResourceType(resourceType); // Define which resource type is being added
  setIsModalOpen(true); // Finally, open the modal
};
const handleOpenToolPane = useCallback(
  (operation: 'cut-copy' | 'delete' | 'merge' | 'edit' | null, sourceNode: string) => {
    setSourceNodeId(sourceNode);
    setActiveOperation(operation);
    setToolPaneVisible(true);
    clearSelection(); // Clear previous selections
    selectNode(sourceNode); // Select the source node
  },
  [clearSelection, selectNode]
);

  const handleCloseToolPane = () => {
    setToolPaneVisible(false);
    setSourceNodeId(''); // empty string
    setActiveOperation(null);
    setTargetNodeId(''); // Reset targetNodeId
    clearSelection();
  };
  

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
        nodesDispatch,
        layoutDispatch,
        fileDispatch,
        colorThemeDispatch,
        resetCueCards,
        resetTreeDimensions,
        resetSubtrees,
        resetPictures,
        resetPracticeSheets,
        6,
        windowWidth,
        false
      );
      setIsInitialized(true);
    }
  }, [
    isInitialized,
    nodesDispatch,
    layoutDispatch,
    fileDispatch,
    colorThemeDispatch,
    windowWidth,
    resetCueCards,
    resetTreeDimensions,
    resetSubtrees,
    resetPictures,
    resetPracticeSheets,
  ]);

  const handleCreateNewDocument = useCallback(() => {
    initializeNewDocument(
      nodesDispatch,
      layoutDispatch,
      fileDispatch,
      colorThemeDispatch,
      resetCueCards,
      resetTreeDimensions,
      resetSubtrees,
      resetPictures,
      resetPracticeSheets,
      6,
      windowWidth,
      false
    );
    layoutDispatch(toggleResetMapSize());
  }, [
    nodesDispatch,
    layoutDispatch,
    fileDispatch,
    colorThemeDispatch,
    windowWidth,
    resetCueCards,
    resetTreeDimensions,
    resetSubtrees,
    resetPictures,
    resetPracticeSheets,
  ]);

  const handleTitleChange = useCallback((newTitle: string) => {
    fileDispatch(setFileName(newTitle)); // Update the file name in the context
  }, [fileDispatch]);

  const handleSaveDocument = useCallback(async () => {
    await saveDocument(
      nodes,
      colorTheme,
      primaryColor,
      backgroundColor,
      fileName,
      cueCards,
      subtrees,
      pictures,
      practiceSheets
    );
  }, [nodes, colorTheme, primaryColor, backgroundColor, fileName, cueCards, subtrees, pictures, practiceSheets]);

  const handleOpenDocument = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await loadDocument(
        file,
        nodesDispatch,
        setCueCards,
        setSubtrees,
        setPictures,
        setPracticeSheets,
        fileDispatch,
        colorThemeDispatch
      );
      layoutDispatch(setGetLayout(true)); // Trigger layout recalculation if necessary
    }
  }, [
    nodesDispatch,
    setCueCards,
    setSubtrees,
    setPictures,
    setPracticeSheets,
    fileDispatch,
    colorThemeDispatch,
    layoutDispatch
  ]);

  const handleOpenCueCardModal = useCallback((nodeId: string) => {
    setModalNodeId(nodeId);
    setModalMode('addResource');
    setIsModalOpen(true);
  }, []);

  const handleOpenAddChildModal = useCallback((parentNodeId: string) => {
    setModalNodeId(parentNodeId);
    setModalMode('addChild');
    setIsModalOpen(true);
  }, []);

  const initialNodeTitle =
    modalMode === 'addChild'
      ? 'New Concept'
      : modalNodeId
      ? nodes.get(modalNodeId)?.title || ''
      : '';

  const handleModalSave = useCallback((
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
    console.log('handleModalSave called');
    if (modalNodeId) {
      if (modalMode === 'addChild') {
        const newNodeId = uuidv4();
        nodesDispatch(createNewNode(nodeTitle || 'New Concept', modalNodeId, newNodeId));
        layoutDispatch(setGetLayout(true));

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
        nodesDispatch(updateNodeTitle(modalNodeId, nodeTitle));

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
  }, [modalNodeId, modalMode, addCueCard, addPicture, addPracticeSheet]);

  const [isCenterPaneMounted, setIsCenterPaneMounted] = useState<boolean>(false);
  useEffect(() => {
    if (centerPaneRef.current) {
      setIsCenterPaneMounted(true);
    }
  }, [centerPaneRef]);

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      if (toolPaneVisible && (activeOperation === 'cut-copy' || activeOperation === 'merge')) {
        setTargetNodeId(nodeId);
      } else {
        // Normal node selection
        toggleNodeSelection(nodeId);
      }
    },
    [toolPaneVisible, activeOperation, setTargetNodeId, toggleNodeSelection]
  );

  // Temporary stub methods for onSearch, onUndo, and onRedo
const handleSearch = () => {
  console.log('Search action triggered');
};

const handleUndo = () => {
  console.log('Undo action triggered');
};

const handleRedo = () => {
  console.log('Redo action triggered');
};

  return (
    <>
      <input
        type="file"
        accept=".bloomdocx"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <ModernModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleModalSave}
        initialNodeTitle={initialNodeTitle}
        mode={modalMode}
        selectedResourceType={modalResourceType}
      />
      <MenuBar
        onTitleChange={handleTitleChange}
        onNewDocument={handleCreateNewDocument}
        onOpenDocument={handleOpenDocument}
        onSaveDocument={handleSaveDocument}
        onHelp={() => console.log('Help clicked')}
      />
<ToolBar
  onSearch={handleSearch}
  onUndo={handleUndo}
  onRedo={handleRedo}
  onOpenToolPane={handleOpenToolPane}
  openModalWithResourceType={openModalWithResourceType}
/>
      <div className="toolbar-padding-bottom"></div>
      <Split
        className="flex h-[calc(100vh-50px)]"
        sizes={paneSizes}
        minSize={[200, 400, 200]}
        maxSize={[500, Infinity, 400]}
        gutterSize={6}
        direction="horizontal"
        cursor="col-resize"
        onDragEnd={(sizes) => setPaneSizes(sizes)}
      >
        <div className="flex flex-col space-y-2 bg-[#F9FBFD] p-4 shadow-lg rounded-lg overflow-y-auto">
          {isCenterPaneMounted && (
            <div className="flex flex-col space-y-2 pb-40">
              <CueCardDisplay centerPaneRef={centerPaneRef} paneSizes={paneSizes} />
            </div>
          )}
        </div>
        <div
          ref={centerPaneRef}
          className="center-pane flex-1 bg-[#F9FBFD] p-4 shadow-lg rounded-lg overflow-auto"
          style={{
            position: 'relative',
            overflowX: 'auto',
            overflowY: 'auto',
            scrollbarWidth: 'none',
          }}
        >
          <ConceptMap
            groundWidth={windowWidth}
            centerPaneRef={centerPaneRef}
            onOpenCueCardModal={handleOpenCueCardModal}
            onOpenAddChildModal={handleOpenAddChildModal}
            onNodeClick={handleNodeClick} 
          />
        </div>
        <div className="relative bg-[#F9FBFD] p-4 shadow-lg rounded-lg overflow-auto">
        <ToolPane
  activeOperation={activeOperation}
  visible={toolPaneVisible}
  onClose={handleCloseToolPane}
  sourceNodeId={sourceNodeId} // Add this prop to provide the selected source node
/>
        </div>
      </Split>
    </>
  );
});

ClientLayoutContent.displayName = 'ClientLayoutContent';

export default function ClientLayout() {
  return (
    <DndProvider backend={HTML5Backend}>
      <TreeDimensionsProvider>
        <NodeSelectionProvider>
          <CueCardProvider>
            <NodesProvider>
              <ZoomProvider>
                <LayoutProvider>
                  <ColorThemeProvider>
                    <FileProvider>
                      <SubTreeProvider>
                        <PictureProvider>
                          <PracticeSheetProvider>
                            <ClientLayoutContent />
                          </PracticeSheetProvider>
                        </PictureProvider>
                      </SubTreeProvider>
                    </FileProvider>
                  </ColorThemeProvider>
                </LayoutProvider>
              </ZoomProvider>
            </NodesProvider>
          </CueCardProvider>
        </NodeSelectionProvider>
      </TreeDimensionsProvider>
    </DndProvider>
  );
}
