// bloom-maps\app\(client-ui)\app.tsx

'use client';

import React, { useState, useCallback, useEffect, useRef, memo, useContext} from 'react';
import { CueCardDisplayRef } from '@/app/Library/components/CardDisplay/CueCardDisplay';
import { NodeSelectionProvider, useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import { SubTreeProvider } from '@/app/Library/Context/SubTreeProvider';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import {  ApiProvider,  } from '@/app/src/context/ApiContext';
import AuthPromptModal from '@/app/Library/components/Modals/auth/AuthPromptModal';
// Import new context providers and hooks
import { NodesProvider, useNodesContext } from '@/app/Library/Context/NodesProvider';
import { ZoomProvider,} from '@/app/Library/Context/ZoomProvider';
import { LayoutProvider, useLayoutContext } from '@/app/Library/Context/LayoutProvider';
import { ColorThemeProvider, useColorThemeContext } from '@/app/Library/Context/ColorThemeProvider';

import { ResourceProvider} from '@/app/Library/Context/ResourceContext';
import { YDocProvider, useYDoc } from '@/app/Library/Context/YDocContext';
import { initializeNewDocument } from '@/app/Library/utils/LoadDocumentUtils'; 
import { WebSocketManagerProvider } from '@/app/Library/Context/WebSocketManager';

// Dynamic Tool Panes
import { GoogleOAuthProvider } from '@react-oauth/google';
import { LoadingProvider } from '@/app/Library/Context/LoadingContext';
import { useLoading } from '@/app/Library/Context/LoadingContext'; // Import the loading hook
import GlobalLoadingScreen from '@/app/Library/components/loading-screen/GlobalLoadingScreen';
import TopBar from  './commandPanelLayout/TopBar'  //'./commandPanelLayout/TopBar';
import LeftPanel from './commandPanelLayout/LeftPanel';
import MainContent from './commandPanelLayout/MainContent';
import RightPanel from './commandPanelLayout/RightPanel';
import { FileAssetProvider } from '../Library/Context/FileAssetContext';

const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';


/**
 * ClientLayoutContent Component
 *
 * Main layout component handling the overall structure,
 * including CueCardDisplay, ConceptMap, and ToolPane.
 */
const ClientLayoutContent = memo(function ClientLayoutContent() {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(true);
  const centerPaneRef = useRef<HTMLDivElement>(null);
  const cueCardDisplayRef = useRef<CueCardDisplayRef>(null); // Ref for CueCardDisplay
  const { isLoading, setLoading } = useLoading();
  const [windowWidth, setWindowWidth] = useState<number>(0);


  // Use new context hooks
  
  const {  initNewDocument, } = useNodesContext();
  const { dispatch: layoutDispatch } = useLayoutContext();
  const { dispatch: colorThemeDispatch } = useColorThemeContext();
  const [activeOperation, setActiveOperation] = useState<'cut'| 'copy' | 'delete' | 'merge' |'edit'|'addContent'| null>(null); // Track the active tool pane
  const [toolPaneVisible, setToolPaneVisible] = useState(false); // State to manage Tool Pane visibility
  const [sourceNodeId, setSourceNodeId] = useState<string | ''>('');
  const { toggleNodeSelection, setTargetNodeId, clearSelection, selectNode } = useNodeSelection();
   const { createNewDocument } = useYDoc();

  /**
   * Opens the modal with the specified resource type and operation mode.
   *
   * @param nodeId - The ID of the node to associate with the resource.
   * @param resourceType - The type of resource to add.
   * @param op - The operation mode ('resource' or 'node').
   */
  const openModalWithResourceType = (nodeId: string | null, resourceType: 'cueCard' | 'picture' | 'practiceSheet' | undefined, op: 'resource' | 'node') => {
    handleCloseAllModals();
    setSourceNodeId(nodeId as string);
    setActiveOperation('addContent');
    setToolPaneVisible(true);
    clearSelection(); // Clear previous selections
    selectNode(nodeId as string); // Select the source node
  };

  /**
   * Handles opening the Tool Pane with the specified operation and source node.
   *
   * @param operation - The operation to perform ('cut', 'copy', etc.).
   * @param sourceNode - The ID of the source node.
   */
  const handleOpenToolPane = useCallback(
    (operation: 'cut' | 'copy' | 'delete' | 'merge' | 'edit' | null, sourceNode: string) => {
      handleCloseAllModals();
      setSourceNodeId(sourceNode);
      setActiveOperation(operation);
      setToolPaneVisible(true); // Show the Tool Pane
      clearSelection(); // Clear previous selections
      selectNode(sourceNode); // Select the source node
    },
    [clearSelection, selectNode]
  );
  /**
   *  Close overlay manager in cue card display
   */
  const handleCloseAllModals = useCallback(() => {
    if (cueCardDisplayRef.current) {
      cueCardDisplayRef.current.closeAllModals();
    }
  }, [cueCardDisplayRef]);

  const handleInitNodes = useCallback(()=>{
    initNewDocument() // bloomdepth , map width and height
  }, [initNewDocument]);

  /**
   * Handles closing the Tool Pane and resetting related states.
   */
  const handleCloseToolPane = () => {
    setToolPaneVisible(false); // Hide the Tool Pane
    setSourceNodeId(''); // Reset source node ID
    setActiveOperation(null); // Reset active operation
    setTargetNodeId(''); // Reset target node ID
    clearSelection(); // Clear any selections
  };

    // Define the centerScroll function using useCallback for stability
    const centerScroll = useCallback(() => {
      if (centerPaneRef.current) {
        const centerPane = centerPaneRef.current;
        centerPane.scrollLeft = (centerPane.scrollWidth - centerPane.clientWidth) / 2;
        centerPane.scrollTop = (centerPane.scrollHeight - centerPane.clientHeight) / 2 - 200;
      }
    }, []);
  
  /**
   * Updates window dimensions on resize to maintain responsive layout.
   */
  useEffect(() => {
    const updateWindowSize = () => {
      setWindowWidth(window.innerWidth);
    };

    updateWindowSize();
    window.addEventListener('resize', updateWindowSize);
    return () => window.removeEventListener('resize', updateWindowSize);
  }, []);

  /**
   * Initializes a new document on first render.
   */
  useEffect(() => {
    console.log('*****************Initializing application in app.tsx*********************');
    const initializeApp = async () => {
      try {
    await initializeNewDocument(
      createNewDocument,
      layoutDispatch,
      colorThemeDispatch,
    );
        centerScroll();
      } catch (error) {
        console.error('Initialization Error:', error);
        // Optionally, handle initialization errors here
      } finally {
        setLoading(false); // Mark initialization as complete
      }
    };

    initializeApp();
    console.log('*************App.tsx Initialization Completed**************')
  }, []);

 
    /**
   * Handler to open the AuthPromptModal from MenuBar.
   */
    const handleAuthButtonClick = () => {
      setIsAuthModalOpen(true);
    };

 
  /**
   * Tracks if the center pane has been mounted to ensure refs are available.
   */
  const [isCenterPaneMounted, setIsCenterPaneMounted] = useState<boolean>(false);
  
  useEffect(() => {
    if (centerPaneRef.current) {
      setIsCenterPaneMounted(true);
    }
  }, [centerPaneRef]);

  /**
   * Handles node click events, managing tool pane interactions.
   *
   * @param nodeId - The ID of the clicked node.
   */
  const handleNodeClick = useCallback(
    (nodeId: string) => {
      if (toolPaneVisible && (activeOperation === 'cut' || activeOperation === 'copy' || activeOperation === 'merge')) {
        setTargetNodeId(nodeId);
      } else {
        // Normal node selection
        toggleNodeSelection(nodeId);
      }
    },
    [toolPaneVisible, activeOperation, setTargetNodeId, toggleNodeSelection]
  );
  const topBarProps = {
    handleOpenToolPane,
    openModalWithResourceType,
    handleCloseAllModals,
    centerScroll,
    handleAuthButtonClick,
  };
  
  return (
    <>
        <div className="h-screen flex flex-col">
      {/* Loading Screen */}
      {isLoading && <GlobalLoadingScreen />}

      {/* Authentication Modal */}
      <AuthPromptModal
  isOpen={isAuthModalOpen}
  onClose={() => setIsAuthModalOpen(false)}
/>

      {/* TopBar */}
      <TopBar {...topBarProps} />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        <LeftPanel centerPaneRef={centerPaneRef} toolPaneVisible={toolPaneVisible} />
        <MainContent
          centerPaneRef={centerPaneRef}
          openModalWithResourceType={openModalWithResourceType}
          onNodeClick={handleNodeClick}
        />
        <RightPanel
          visible={toolPaneVisible}
          onClose={handleCloseToolPane}
          activeOperation={activeOperation}
          sourceNodeId={sourceNodeId}
        />
      </div>

      {/* StatusBar */}

    </div>
    </>
  );
});

ClientLayoutContent.displayName = 'ClientLayoutContent';

/**
 * ClientLayout Component
 *
 * Wraps the main layout with necessary providers.
 */
export default function ClientLayout() {
  return (
    <LoadingProvider>
    <GoogleOAuthProvider clientId={clientId}>
    <ApiProvider>
    <DndProvider backend={HTML5Backend}>
    <YDocProvider>
      <FileAssetProvider>
        <NodeSelectionProvider>
          <ResourceProvider> {/* Wrap with centralized ResourceProvider */}
          <WebSocketManagerProvider>
            <NodesProvider>
              <ZoomProvider>
                <LayoutProvider>
                  <ColorThemeProvider>
                         <SubTreeProvider>                         
                        <ClientLayoutContent />              
                      </SubTreeProvider>                 
                  </ColorThemeProvider>
                </LayoutProvider>
              </ZoomProvider>
            </NodesProvider>
            </WebSocketManagerProvider>
          </ResourceProvider>
        </NodeSelectionProvider>
        </FileAssetProvider>
      </YDocProvider>
    </DndProvider>
    </ApiProvider>
    </GoogleOAuthProvider>
    </LoadingProvider>
  );
}
