// bloom-maps/app/(client-ui)/layout.tsx

'use client';

import React, { useState, useCallback, useEffect, useRef, memo, useContext} from 'react';
import CueCardDisplay, { CueCardDisplayRef } from '@/app/Library/components/CardDisplay/CueCardDisplay';
import ConceptMap from '@/app/Library/components/map/ConceptMap';
import { NodeSelectionProvider, useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import ModernModal from '@/app/Library/components/Modals/ModernModal';
import { TreeDimensionsProvider, useTreeDimensions } from '@/app/Library/Context/TreeDimensionsProvider';
import { useSubTreeContext, SubTreeProvider } from '@/app/Library/Context/SubTreeProvider';
import { v4 as uuidv4 } from 'uuid';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { saveResource } from '@/app/Library/utils/ResourceSave/saveResource';
import { IQuizQuestion, ResourceType } from '@/app/Library/Definitions/Definitions';
import DocumentHeader from '@/app/Library/components/DocumentFile/DocumentHeader';
import './ClientLayout.css';
import './ToolBar.css';
import './panelSize.css';
import { Descendant } from 'slate';
import { AuthContext, AuthProvider } from '@/app/src/context/AuthContext';
import AuthPromptModal from '@/app/Library/components/Modals/auth/AuthPromptModal';
// Import new context providers and hooks
import { NodesProvider, useNodesContext } from '@/app/Library/Context/NodesProvider';
import { ZoomProvider, useZoomContext } from '@/app/Library/Context/ZoomProvider';
import { LayoutProvider, useLayoutContext } from '@/app/Library/Context/LayoutProvider';
import { ColorThemeProvider, useColorThemeContext } from '@/app/Library/Context/ColorThemeProvider';
import { FileProvider, useFileContext } from '@/app/Library/Context/FileProvider';
import { ResourceProvider, useResourceContext } from '@/app/Library/Context/ResourceContext';

// Import action creators
import { createNewNode, updateNodeTitle } from '@/app/Library/Context/nodesActions';
import { setGetLayout } from '@/app/Library/Context/LayoutActions';

import { initializeNewDocument } from '@/app/Library/utils/documentUtils'; 

// Dynamic Tool Panes
import ToolPane from '@/app/Library/dynamic_tool_panes/ToolPane';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { LoadingProvider } from '@/app/Library/Context/LoadingContext';
import { useLoading } from '@/app/Library/Context/LoadingContext'; // Import the loading hook
import GlobalLoadingScreen from '@/app/Library/components/loading-screen/GlobalLoadingScreen';

const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
const apiServerUrl = process.env.NEXT_PUBLIC_API_SERVER_URL || 'http://localhost:5000';

/**
 * ClientLayoutContent Component
 *
 * Main layout component handling the overall structure,
 * including CueCardDisplay, ConceptMap, and ToolPane.
 */
const ClientLayoutContent = memo(function ClientLayoutContent() {
  const { isAuthenticated, isGuest, skipAuth, signIn } = useContext(AuthContext);  
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(true);
  const centerPaneRef = useRef<HTMLDivElement>(null);
  const toolPaneRef = useRef<HTMLDivElement>(null); // Reference to the Tool Pane
  const cueCardDisplayRef = useRef<CueCardDisplayRef>(null); // Ref for CueCardDisplay
  const { isLoading, setLoading } = useLoading();
  const [windowWidth, setWindowWidth] = useState<number>(0);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  // Use new context hooks
  const { nodes, dispatch: nodesDispatch } = useNodesContext();
  const { dispatch: layoutDispatch } = useLayoutContext();
  const { dispatch: fileDispatch, fileName } = useFileContext();
  const { dispatch: colorThemeDispatch } = useColorThemeContext();
  const { resetTreeDimensions } = useTreeDimensions();
  const { resetSubtrees } = useSubTreeContext();


  // Use new centralized ResourceContext hook
  const { addResource, resetResources } = useResourceContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalResourceType, setModalResourceType] = useState<'cueCard' | 'picture' | 'practiceSheet' | undefined>(undefined);
  const [modalNodeId, setModalNodeId] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<'addChild' | 'addResource'>('addResource');
  const [activeOperation, setActiveOperation] = useState<'cut'| 'copy' | 'delete' | 'merge' |'edit'| null>(null); // Track the active tool pane
  const [toolPaneVisible, setToolPaneVisible] = useState(false); // State to manage Tool Pane visibility
  const [sourceNodeId, setSourceNodeId] = useState<string | ''>('');
  const { toggleNodeSelection, setTargetNodeId, clearSelection, selectNode } = useNodeSelection();
  const [modalKey, setModalKey] = useState<string>('');

  /**
   * Opens the modal with the specified resource type and operation mode.
   *
   * @param nodeId - The ID of the node to associate with the resource.
   * @param resourceType - The type of resource to add.
   * @param op - The operation mode ('resource' or 'node').
   */
  const openModalWithResourceType = (nodeId: string | null, resourceType: 'cueCard' | 'picture' | 'practiceSheet' | undefined, op: 'resource' | 'node') => {
    setModalNodeId(nodeId); // Set the node ID for the resource
    if (op === 'node') {
      setModalMode('addChild');
    } else {
      setModalMode('addResource');
    }
    // Specify the mode to indicate it's an "add" operation
    setModalResourceType(resourceType); // Define which resource type is being added
    setModalKey(uuidv4());
    setIsModalOpen(true); // Finally, open the modal
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
    const initializeApp = async () => {
      try {
        await initializeNewDocument(
          nodesDispatch,
          layoutDispatch,
          fileDispatch,
          colorThemeDispatch,
          resetTreeDimensions,
          resetSubtrees,
          resetResources,
          6,
          false
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSignInSuccess = async (credentialResponse: any) => {
    const token = credentialResponse.credential;
    try {
      const response = await fetch(`${apiServerUrl}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await response.json();
      if (data.status === 'success') {
        signIn(data.token);
        setIsAuthModalOpen(false);
      } else {
        alert(data.message || 'Authentication failed.');
      }
    } catch (error) {
      console.error('Login Error:', error);
      alert('An error occurred during authentication.');
    }
  };

  const handleSignInFailure = () => {
    alert('Google login failed.');
  };

  const handleSkipAuth = () => {
    skipAuth();
    setIsAuthModalOpen(false);
  };

    /**
   * Handler to open the AuthPromptModal from MenuBar.
   */
    const handleAuthButtonClick = () => {
      setIsAuthModalOpen(true);
    };

  /**
   * Determines the initial node title based on modal mode and node ID.
   */
  const initialNodeTitle =
    modalMode === 'addChild'
      ? 'New Concept'
      : modalNodeId
      ? nodes.get(modalNodeId)?.title || ''
      : '';

  /**
   * Handles saving the modal data and adding resources or nodes accordingly.
   *
   * @param resourceType - The type of resource to add.
   * @param nodeTitle - The title of the node.
   * @param Title - Additional title information (optional).
   * @param cueCardContent - Content for cue cards (optional).
   * @param bloomLevel - Bloom's taxonomy level (optional).
   * @param image - Image file for picture cards (optional).
   * @param source - Source information (optional).
   * @param pictureDescription - Description for picture cards (optional).
   * @param practiceSheetContent - Content for practice sheets (optional).
   */
  const handleModalSave = useCallback((
    resourceType: ResourceType,
    nodeTitle: string,
    Title?: string,
    cueCardContent?: Descendant[],
    bloomLevel?: 1 | 2 | 3 | 4 | 5 | 6,
    image?: File | null,
    source?: string,
    pictureDescription?: Descendant[],
    practiceSheetContent?: {
      quizType: 'matching' | 'multipleChoice' | 'wordProblem';
      quizContent: IQuizQuestion[];
    }
  ) => {
    console.log('handleModalSave called');
    if (modalNodeId) {
      if (modalMode === 'addChild') {
        const newNodeId = uuidv4();
        nodesDispatch(createNewNode(nodeTitle || 'New Concept', modalNodeId, newNodeId));
        layoutDispatch(setGetLayout(true));

        if (Title || cueCardContent || image || practiceSheetContent) {
          saveResource({
            resourceType,
            nodeId: newNodeId,
            addResource,
            Title,
            cueCardContent,
            image,
            pictureDescription,
            practiceSheetContent,
            source,
          });
        }
      } else if (modalMode === 'addResource') {
        nodesDispatch(updateNodeTitle(modalNodeId, nodeTitle));

        if (Title || cueCardContent || image || practiceSheetContent) {
          saveResource({
            resourceType,
            nodeId: modalNodeId,
            addResource,
            Title,
            cueCardContent,
            image,
            pictureDescription,
            practiceSheetContent,
            source,
          });
        }
      }
    }
    setIsModalOpen(false); // Close the modal after saving
  }, [modalNodeId, modalMode, nodesDispatch, layoutDispatch, addResource]);

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

  
  return (
    <>
          {/* Overlay the loading screen */}
          {isLoading && <GlobalLoadingScreen />}
    
          {/* Authentication Modal */}
          <AuthPromptModal
        isOpen={isAuthModalOpen}
        onSignInSuccess={handleSignInSuccess}
        onSignInFailure={handleSignInFailure}
        onSkip={handleSkipAuth}
      />
      {/* Modern Modal for Adding Resources or Nodes */}
      <ModernModal
        key={modalKey}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleModalSave}
        initialNodeTitle={initialNodeTitle}
        mode={modalMode}
        selectedResourceType={modalResourceType}
      />

      {/* Document Header with Actions */}
      <DocumentHeader
        handleOpenToolPane={handleOpenToolPane}
        openModalWithResourceType={openModalWithResourceType}
        closeAllModals={handleCloseAllModals}
        centerScroll={centerScroll}
        onAuthButtonClick={handleAuthButtonClick}
      />
      
      {/* Toolbar Padding */}
      <div className="toolbar-padding-bottom"></div>

      {/* Main Layout: Three Column Flex Container */}
      <div className="flex h-[calc(100vh-50px)] gap-4">
        {/* CueCardDisplay: Fixed Width */}
        <div className="fixed-width-pane flex flex-col space-y-2 bg-[#F9FBFD] rounded-lg overflow-y-auto">
          {isCenterPaneMounted && (
            <div className="flex flex-col space-y-2 pb-40">
              <CueCardDisplay
                ref={cueCardDisplayRef} // Attach ref to CueCardDisplay
                centerPaneRef={centerPaneRef}
                toolPaneVisible={toolPaneVisible}
              />
            </div>
          )}
        </div>
        
        {/* ConceptMap: Flexible */}
        <div
          ref={centerPaneRef}
          className="flex-1 bg-[#FBFBFB] p-4 rounded-lg overflow-auto center-pane"
          style={{
            position: 'relative',
            overflowX: 'auto',
            overflowY: 'auto',
            scrollbarWidth: 'none',
          }}
        >
          <ConceptMap
            centerPaneRef={centerPaneRef}
            openModalWithResourceType={openModalWithResourceType}
            onNodeClick={handleNodeClick} 
          />
        </div>
        
        {/* ToolPane: Conditional Rendering with Ref */}
        <div ref={toolPaneRef}> 
          <ToolPane
            activeOperation={activeOperation}
            visible={toolPaneVisible}
            onClose={handleCloseToolPane}
            sourceNodeId={sourceNodeId}
          />
        </div>
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
    <AuthProvider>
    <DndProvider backend={HTML5Backend}>
      <TreeDimensionsProvider>
        <NodeSelectionProvider>
          <ResourceProvider> {/* Wrap with centralized ResourceProvider */}
            <NodesProvider>
              <ZoomProvider>
                <LayoutProvider>
                  <ColorThemeProvider>
                    <FileProvider>
                      <SubTreeProvider>
                        <ClientLayoutContent />               
                      </SubTreeProvider>
                    </FileProvider>
                  </ColorThemeProvider>
                </LayoutProvider>
              </ZoomProvider>
            </NodesProvider>
          </ResourceProvider>
        </NodeSelectionProvider>
      </TreeDimensionsProvider>
    </DndProvider>
    </AuthProvider>
    </GoogleOAuthProvider>
    </LoadingProvider>
  );
}
