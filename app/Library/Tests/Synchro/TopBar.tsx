// TopBar.tsx (Updated)
import React, { useRef, useCallback, useState, useEffect, useContext } from 'react';
import MenuBar from '@/app/(client-ui)/MenuBar';
import ToolBar from '@/app/(client-ui)/commandPanelLayout/Toolbar-test';
import { useFileContext } from './FileContext';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { useColorThemeContext } from '@/app/Library/Context/ColorThemeProvider';
import { useResourceContext } from '@/app/Library/Context/ResourceContext';
import { useSubTreeContext } from '@/app/Library/Context/SubTreeProvider';
import { useLayoutContext } from '@/app/Library/Context/LayoutProvider';
import { setGetLayout, toggleResetMapSize } from '@/app/Library/Context/LayoutActions';
import { useZoomContext } from '@/app/Library/Context/ZoomProvider';
import { useTreeDimensions } from '@/app/Library/Context/TreeDimensionsProvider';
import {
  saveDocument,
  loadDocument,
  initializeNewDocument,
  prepareBloomDocx,
  loadDocumentFromDrive,
} from './DocumentUtils';
import {
  setFileName,
  setDriveFileId,
  resetDriveFileId,
  setInitialized,
  setYDocInitialized,
} from '@/app/Library/Context/fileActions';
import { ColorTheme, CueCardResource, FileActionType, ResourceType } from '@/app/Library/Definitions/Definitions';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import { ApiContext } from '@/app/src/context/ApiContext';
import FileSelectorModal from '@/app/Library/components/FileSelectorModal/FileSelectorModal';
import { toast } from 'react-toastify';
import { useYDoc } from './YDocContext';
import { useWebSocketManager } from './WebSocketManager'; // Hook for WebSocketManager

interface TopBarProps {
  handleOpenToolPane: (
    operation: 'cut' | 'copy' | 'delete' | 'merge' | 'edit' | null,
    sourceNodeId: string
  ) => void;
  openModalWithResourceType: (
    nodeId: string | null,
    resourceType: 'cueCard' | 'picture' | 'practiceSheet' | undefined,
    op: 'resource' | 'node'
  ) => void;
  handleCloseAllModals: () => void;
  centerScroll: () => void;
  handleAuthButtonClick: () => void;
}

const TopBar: React.FC<TopBarProps> = ({
  handleOpenToolPane,
  openModalWithResourceType,
  handleCloseAllModals,
  centerScroll,
  handleAuthButtonClick,
}) => {
  // Access necessary contexts
  const { fileName, driveFileId, isInitialized, isYDocInitialized, dispatch: fileDispatch } = useFileContext();
  const {
    nodes,
    setNodes,
    createNewNode,
    updateNodeTitle,
    deleteNode,
    resetNodes,
    initNewDocument,
    transferNode,
  } = useNodesContext();
  
  const { clearSelection } = useNodeSelection();
  const { colorTheme, primaryColor, backgroundColor, dispatch: colorThemeDispatch } =
    useColorThemeContext();
  const { resources, addResource, getResourcesByType, setResourcesByMap } = useResourceContext();
  const { subtrees, setSubtrees, resetSubtrees } = useSubTreeContext();
  const { dispatch: layoutDispatch } = useLayoutContext();
  const { resetTreeDimensions } = useTreeDimensions();
  const { zoomLevel, baseZoomLevel, dispatch: zoomDispatch } = useZoomContext();
  const { resetResources } = useResourceContext();
  const { loadFromDrive, autosaveDocument } =
    useContext(ApiContext);

  // Access WebSocketManager
  const { disconnect, connect } = useWebSocketManager();

  // Access Y.Doc from YDocContext
  const { ydoc, resetYDoc, initializeYDoc } = useYDoc();

  // State for Google Drive File Selector Modal
  const [isFileSelectorOpen, setIsFileSelectorOpen] = useState(false);

  // Ref for the hidden file input (if needed for device operations)
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State to track if there are untracked changes for autosave
  const [hasUntrackedChanges, setHasUntrackedChanges] = useState<boolean>(false);

  // State to track autosave status for visual feedback
  const [isAutosaving, setIsAutosaving] = useState<boolean>(false);

  /**
   * Initializes nodes for a new document.
   */
  const handleInitNodes = useCallback(() => {
    console.log('Initializing new document with default nodes...');
    initNewDocument(6, 1800, 1800); // bloomDepth, map width, and height
  }, [initNewDocument]);

  /**
   * Triggers the autosave process by calling the `autosaveDocument` method from ApiContext.
   */
  const triggerAutosave = useCallback(async () => {
    console.log('Checking if autosave is needed...', { hasUntrackedChanges });
    if (!hasUntrackedChanges) {
      console.log('No untracked changes. Skipping autosave.');
      return;
    }

    console.log('Starting autosave process...');
    try {
      setIsAutosaving(true);

      // Prepare the document for saving
      console.log('Preparing `.bloomdocx` for autosave...');
      const bloomDocx = await prepareBloomDocx(
        ydoc,
        nodes,
        colorTheme as ColorTheme,
        primaryColor,
        backgroundColor,
        fileName,
        getResourcesByType('cueCard'),
        subtrees,
        getResourcesByType('picture'),
        getResourcesByType('practiceSheet'),
        driveFileId
      );

      console.log('`.bloomdocx` prepared. Converting to ArrayBuffer...');
      const bloomDocxArrayBuffer = await bloomDocx.arrayBuffer();

      console.log('Calling autosaveDocument with fileId:', driveFileId || '(none)');
      const fileId = await autosaveDocument(bloomDocxArrayBuffer, fileName, driveFileId);

      if (fileId !== driveFileId) {
        console.log('New fileId detected. Updating context state with fileId:', fileId);
        await fileDispatch(setDriveFileId(fileId));
      }

      toast.success('Autosave completed successfully!');
      setHasUntrackedChanges(false);
      console.log('Autosave successful. hasUntrackedChanges set to false.');
    } catch (error) {
      console.error('Autosave error:', error);
      toast.error('Autosave failed.');
    } finally {
      setIsAutosaving(false);
      console.log('Autosave process ended.');
    }
  }, [hasUntrackedChanges, ydoc, nodes, colorTheme, primaryColor, backgroundColor, fileName, getResourcesByType, subtrees, driveFileId, autosaveDocument, fileDispatch]);

  /**
   * ***Implement an autosave layer**
   * Effect to handle autosave when YDoc updates occur
   */
 /** useEffect(() => {
    if (provider) {
      const handleUpdate = () => {
        console.log('Received Y.Doc update. Marking as having untracked changes.');
        setHasUntrackedChanges(true);
      };

      // Listen to Yjs updates
      ydoc.on('update', handleUpdate);

      return () => {
        ydoc.off('update', handleUpdate);
      };
    }
  }, [provider, ydoc]); */

  /**
   * Handler for creating a new document.
   */
  const handleCreateNewDocument = useCallback(async () => {
    console.log('handleCreateNewDocument called.');
    
    // 1. Get WebSocket manager to disconnect first
    disconnect();
    
    // 2. Reset YDoc instance before any state changes
    await resetYDoc();
    
    // 3. Clear UI state that might trigger updates
    clearSelection();
    handleCloseAllModals();
    
    // 4. Reset document state
    fileDispatch({ type: FileActionType.SET_INITIALIZED, payload: false });
    fileDispatch({ type: FileActionType.SET_YDOC_INITIALIZED, payload: false });
    
    // 5. Initialize new document (this resets all application state)
    console.log('Initializing new document with default setup...');
    await initializeNewDocument(
      resetNodes,
      handleInitNodes,
      layoutDispatch,
      fileDispatch,
      colorThemeDispatch,
      resetTreeDimensions,
      resetSubtrees,
      resetResources,
      6, // bloomDepth
      false // isInitialLoad
    );
  
    // 6. Reset file ID and adjust UI
    fileDispatch(resetDriveFileId());
    centerScroll();
    layoutDispatch(toggleResetMapSize());
      
    // 8. Mark document as fully initialized
    fileDispatch({ type: FileActionType.SET_INITIALIZED, payload: true });
    fileDispatch({ type: FileActionType.SET_YDOC_INITIALIZED, payload: true });
    
    // 9. Reset tracking flags
    setHasUntrackedChanges(false);
    setIsAutosaving(false);
    
    console.log('New document setup complete.');
  }, [/* dependencies */]);


  /**
   * Handler for changing the document title.
   */
  const handleTitleChange = useCallback(
    (newTitle: string) => {
      console.log('Title change requested. New title:', newTitle);
      if (!newTitle.trim()) {
        fileDispatch(setFileName('Untitled Document'));
      } else {
        fileDispatch(setFileName(newTitle));
      }
    },
    [fileDispatch]
  );

  /**
   * Handler for saving the document (manual save).
   */
  const handleSaveDocument = useCallback(async () => {
    console.log('Manual save requested.');
    try {
      await saveDocument(
        ydoc,
        nodes,
        colorTheme as ColorTheme,
        primaryColor,
        backgroundColor,
        fileName,
        getResourcesByType('cueCard'),
        subtrees,
        getResourcesByType('picture'),
        getResourcesByType('practiceSheet'),
        driveFileId
      );
      toast.success('Document saved successfully!');
      setHasUntrackedChanges(false);
      setIsAutosaving(false);
      console.log('Document saved. hasUntrackedChanges reset to false.');
    } catch (error) {
      console.error('Error saving document:', error);
      toast.error('Failed to save the document.');
    }
  }, [ydoc, nodes, colorTheme, primaryColor, backgroundColor, fileName, getResourcesByType, subtrees, driveFileId]);

  /**
   * Handler for opening a document from the device.
   */
  const handleOpenDocument = useCallback(() => {
    console.log('handleOpenDocument triggered. Opening file dialog...');
    fileInputRef.current?.click();
  }, []);

  /**
   * Handler for file input change (loading a `.bloomdocx` document).
   */
  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        console.log('File selected. Loading document from device:', file.name);
        
        // 1. Disconnect WebSocket
        disconnect();
        
        // 2. Reset YDoc
        const newYdoc = await resetYDoc();
        
        // 3. Reset UI state
        handleCloseAllModals();
        clearSelection();
        fileDispatch(resetDriveFileId());
        fileDispatch({ type: FileActionType.SET_INITIALIZED, payload: false });
        fileDispatch({ type: FileActionType.SET_YDOC_INITIALIZED, payload: false });
        
        // 4. Load document
        await loadDocument(
          newYdoc,
          file,
          setNodes,
          setResourcesByMap,
          setSubtrees,
          fileDispatch,
          colorThemeDispatch,
          resetTreeDimensions,
          resetSubtrees,
          resetResources
        );
        
        // 5. Initialize new YDoc
        //await initializeYDoc();
        
        // 6. Update layout and UI
        layoutDispatch(setGetLayout(true));
        centerScroll();
        
        // 7. Mark as initialized
        fileDispatch({ type: FileActionType.SET_INITIALIZED, payload: true });
        fileDispatch({ type: FileActionType.SET_YDOC_INITIALIZED, payload: true });
        
        // 8. Reset tracking flags
        setHasUntrackedChanges(false);
        setIsAutosaving(false);
        
        toast.success('Document loaded successfully!');
      } catch (error) {
        console.error('Error loading document:', error);
        toast.error('Failed to load the document.');
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    }
  }, []);

  /**
   * Handles saving the document to Google Drive (manual action).
   */
  const handleSaveToGoogleDrive = useCallback(async () => {
    try {
      console.log('handleSaveToGoogleDrive triggered.');
      toast.info('Saving to Google Drive...');

      // Reset WebSocket connection
      disconnect();
      console.log('WebSocket connection reset for save operation.');

      // Set initialization states to prevent WebSocket from connecting during save
      await fileDispatch(setInitialized(false));
      await fileDispatch(setYDocInitialized(false));

      // Prepare the document
      console.log('Preparing `.bloomdocx` for Google Drive save...');
      const bloomDocx = await prepareBloomDocx(
        ydoc,
        nodes,
        colorTheme as ColorTheme,
        primaryColor,
        backgroundColor,
        fileName,
        getResourcesByType('cueCard'),
        subtrees,
        getResourcesByType('picture'),
        getResourcesByType('practiceSheet'),
        driveFileId
      );
      const bloomDocxArrayBuffer = await bloomDocx.arrayBuffer();

      // Autosave
      console.log('Calling autosaveDocument with fileId:', driveFileId || '(none)');
      const fileId = await autosaveDocument(bloomDocxArrayBuffer, fileName, driveFileId);

      // Update FileContext state
      await fileDispatch(setDriveFileId(fileId));
      await fileDispatch(setInitialized(true));
      await fileDispatch(setYDocInitialized(true));

      // Reconnect WebSocket
      await connect();
      console.log('WebSocket reconnected after save.');

      toast.success('File saved to Google Drive successfully!');
      setHasUntrackedChanges(false);
      setIsAutosaving(false);
      console.log('File saved to Google Drive. hasUntrackedChanges reset to false.');
    } catch (error) {
      console.error('Error saving to Google Drive:', error);
      toast.error('Failed to save to Google Drive.');
    }
  }, [
    disconnect,
    ydoc,
    nodes,
    colorTheme,
    primaryColor,
    backgroundColor,
    fileName,
    getResourcesByType,
    subtrees,
    driveFileId,
    autosaveDocument,
    fileDispatch,
    connect,
  ]);

  /**
   * Handler for loading a document from Google Drive (through file selector).
   */
  const handleLoadFromGoogleDrive = useCallback(async (fileId: string) => {
    try {
      console.log('****************************LOADING FROM GOOGLE DRIVE STARTING****************************')
      console.log('handleLoadFromGoogleDrive called. FileId:', fileId);
      toast.info('Loading from Google Drive...');
      
      // 1. Disconnect WebSocket
      disconnect();
      
        // 2. Reset initialization flags
        fileDispatch({ type: FileActionType.SET_INITIALIZED, payload: false });
        fileDispatch({ type: FileActionType.SET_YDOC_INITIALIZED, payload: false });
      
      // 3. Reset initialization state
      const newYDoc = await resetYDoc();
    

      // 4. Load file content
      const arrayBuffer = await loadFromDrive(fileId);
      const loadedFileName = `${fileId}.bloomdocx`;
      const file = new File([arrayBuffer], loadedFileName, { type: 'application/octet-stream' });
  
      // 5. Load document content
      await loadDocumentFromDrive(
        file,
        newYDoc,
        setNodes,
        setResourcesByMap,
        setSubtrees,
        fileDispatch,
        colorThemeDispatch,
        resetTreeDimensions,
        resetSubtrees,
        resetResources
      );
  
      
      // 6. Update layout and UI
      layoutDispatch(setGetLayout(true));
      fileDispatch(setDriveFileId(fileId));
      centerScroll();
      
      // 7. Mark as initialized
      fileDispatch({ type: FileActionType.SET_INITIALIZED, payload: true });
      fileDispatch({ type: FileActionType.SET_YDOC_INITIALIZED, payload: true });
      
      // 8. Reset tracking flags
      setHasUntrackedChanges(false);
      setIsAutosaving(false);
      console.log('****************************LOADING FROM GOOGLE DRIVE COMPLETE****************************')
      toast.success('File loaded from Google Drive successfully!');
    } catch (error) {
      console.error('Error loading from Google Drive:', error);
      toast.error('Failed to load from Google Drive.');
    }
  }, [/* dependencies */]);

  /**
   * Opens the File Selector Modal for Google Drive operations.
   */
  const handleOpenFromGoogleDrive = useCallback(() => {
    console.log('Opening file selector modal for Google Drive files...');
    setIsFileSelectorOpen(true);
  }, []);

  /**
   * Closes the File Selector Modal.
   */
  const handleCloseFileSelector = useCallback(() => {
    console.log('Closing file selector modal...');
    setIsFileSelectorOpen(false);
  }, []);

  /**
   * Handles the selection of a file from the File Selector Modal.
   */
  const handleFileSelect = useCallback(
    (fileId: string) => {
      console.log('File selected from Google Drive. FileId:', fileId);
      handleLoadFromGoogleDrive(fileId);
      handleCloseFileSelector();
    },
    [handleLoadFromGoogleDrive, handleCloseFileSelector]
  );

  /**
   * Handler for help action.
   */
  const handleHelp = useCallback(() => {
    console.log('Help button clicked.');
  }, []);

  /**
   * Handler for window unload event to perform immediate autosave if necessary.
   */
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (hasUntrackedChanges) {
        console.log('Before unload triggered. Attempting synchronous autosave...');
        event.preventDefault();
        event.returnValue = '';
        // Synchronous autosave if possible (not always reliable in modern browsers)
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUntrackedChanges]);

  /**
   * Defines props for the TopBar's child components
   */
  const topBarProps = {
    handleOpenToolPane,
    openModalWithResourceType,
    handleCloseAllModals,
    centerScroll,
    handleAuthButtonClick,
  };

  return (
    <div className="border-b border-gray-200 bg-white flex flex-col">
      {/* Hidden file input for opening documents from device */}
      <input
        type="file"
        accept=".bloomdocx"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <MenuBar
        onTitleChange={handleTitleChange}
        onNewDocument={handleCreateNewDocument}
        onOpenFromDevice={handleOpenDocument}
        onSaveToDevice={handleSaveDocument}
        onHelp={handleHelp}
        onOpenToolPane={handleOpenToolPane}
        openModalWithResourceType={openModalWithResourceType}
        onAuthButtonClick={handleAuthButtonClick}
        onSaveToDrive={handleSaveToGoogleDrive}
        onOpenFromDrive={handleOpenFromGoogleDrive}
      />

      <ToolBar
        onOpenToolPane={handleOpenToolPane}
        openModalWithResourceType={openModalWithResourceType}
      />

      <div className="flex items-center px-4 py-2">
        {isAutosaving ? (
          <div className="flex items-center">
            <svg
              className="animate-spin h-5 w-5 mr-2 text-blue-500"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              ></path>
            </svg>
            <span>Autosaving...</span>
          </div>
        ) : (
          <span>{isInitialized && isYDocInitialized ? 'All changes synchronized' : 'Not synchronized'}</span>
        )}
      </div>

      <FileSelectorModal
        isOpen={isFileSelectorOpen}
        onClose={handleCloseFileSelector}
        onSelect={handleFileSelect}
      />
    </div>
  );
};

export default TopBar;
