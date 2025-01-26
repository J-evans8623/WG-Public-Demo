// TopBar.tsx (Updated)
import React, { useRef, useCallback, useState, useEffect, useContext } from 'react';
import MenuBar from '@/app/(client-ui)/MenuBar';
import ToolBar from '@/app/(client-ui)/commandPanelLayout/Toolbar-test';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { useColorThemeContext } from '@/app/Library/Context/ColorThemeProvider';
import { useResourceContext } from '@/app/Library/Context/ResourceContext';
import { useSubTreeContext } from '@/app/Library/Context/SubTreeProvider'
import { useLayoutContext } from '@/app/Library/Context/LayoutProvider';
import { setGetLayout, toggleResetMapSize } from '@/app/Library/Context/LayoutActions';
import { useZoomContext } from '@/app/Library/Context/ZoomProvider';
import {
  saveDocument,
  prepareBloomDocx,
} from './DocumentUtils';
import {initializeNewDocument, loadDocument, loadDocumentFromDrive} from '@/app/Library/utils/LoadDocumentUtils'

import {
  setFileName,
  setDriveFileId,
  resetDriveFileId,
  setInitialized,
  setYDocInitialized,
} from '@/app/Library/Context/fileActions';
import { ColorTheme} from '@/app/Library/Definitions/Definitions';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import { ApiContext } from '@/app/src/context/ApiContext';
import FileSelectorModal from '@/app/Library/components/FileSelectorModal/FileSelectorModal';
import { toast } from 'react-toastify';
import { useYDoc } from '@/app/Library/Context/YDocContext';


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
  const {  getResourcesByType, loadImages, saveImages } = useResourceContext();
  const { subtrees } = useSubTreeContext();
  const { dispatch: layoutDispatch } = useLayoutContext();
  const { zoomLevel, baseZoomLevel, dispatch: zoomDispatch } = useZoomContext();
  const { resetResources } = useResourceContext();
  const { loadFromDrive, autosaveDocument } =
    useContext(ApiContext);

  // Access WebSocketManager
  const { disconnect, connect } = useWebSocketManager();

  // Access Y.Doc from YDocContext
  const { ydoc, loadData, createNewDocument, updateDriveId, updateFileName, fileName,driveFileId, isInitialized } = useYDoc();

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
    initNewDocument(); // bloomDepth, map width, and height
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
  }, [hasUntrackedChanges, ydoc, nodes, colorTheme, primaryColor, backgroundColor, fileName, getResourcesByType, subtrees, driveFileId, autosaveDocument]);

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
    
    // 3. Clear UI state that might trigger updates
    clearSelection();
    handleCloseAllModals();

    // 5. Initialize new document (this resets all application state)
    console.log('Initializing new document with default setup...');
    await initializeNewDocument(
      createNewDocument,
      layoutDispatch,
      colorThemeDispatch,
    );
  

    centerScroll();
    layoutDispatch(toggleResetMapSize());
      
    
    // 9. Reset tracking flags
    setHasUntrackedChanges(false);
    setIsAutosaving(false);
    
    console.log('New document setup complete.');
  }, [centerScroll, clearSelection, colorThemeDispatch, createNewDocument, disconnect, handleCloseAllModals, layoutDispatch]);


  /**
   * Handler for changing the document title.
   */
  const handleTitleChange = useCallback(
    (newTitle: string) => {
      console.log('Title change requested. New title:', newTitle);
      if (!newTitle.trim()) {
        updateFileName('Untitled Document');
      } else {
        updateFileName(newTitle);
      }
    },
    [updateFileName]
  );

  /**
   * Handler for saving the document (manual save).
   */
  const handleSaveDocument = useCallback(async () => {
    console.log('Manual save requested.');
    try {
      await saveDocument(
        ydoc,
        colorTheme as ColorTheme,
        primaryColor,
        backgroundColor,
        fileName,
        saveImages, // Helper function from ResourceContext
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
  }, [ydoc, colorTheme, primaryColor, backgroundColor, fileName, saveImages, driveFileId]);

  /**
   * Handler for opening a document from the device.
   */
  const handleOpenDocument = useCallback(() => {
    console.log('handleOpenDocument triggered. Opening file dialog...');
    fileInputRef.current?.click();
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

      // Prepare the document
      console.log('Preparing `.bloomdocx` for Google Drive save...');
      const bloomDocx = await prepareBloomDocx(
        ydoc,
        colorTheme as ColorTheme,
        primaryColor,
        backgroundColor,
        fileName,
        saveImages, // Helper function from ResourceContext
        driveFileId
      );
      const bloomDocxArrayBuffer = await bloomDocx.arrayBuffer();
  
      // Autosave
      console.log('Calling autosaveDocument with fileId:', driveFileId || '(none)');
      const fileId = await autosaveDocument(bloomDocxArrayBuffer, fileName, driveFileId);
  
      // Update FileContext state
      updateDriveId(fileId);
  
      // Reconnect WebSocket
      await connect();
      console.log('WebSocket reconnected after save.');
  
      toast.success('File saved to Google Drive successfully!');
    } catch (error) {
      console.error('Error saving to Google Drive:', error);
      toast.error('Failed to save to Google Drive.');
    }
  }, [disconnect, ydoc, colorTheme, primaryColor, backgroundColor, fileName, saveImages, driveFileId, autosaveDocument, updateDriveId, connect]);


    /**
   * Handler for file input change (loading a `.bloomdocx` document) from the local device.
   */
    const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        try {
          console.log('File selected. Loading document from device:', file.name);
          
          // 1. Disconnect WebSocket
          disconnect();
                  
          // 2. Reset UI state
          handleCloseAllModals();
          clearSelection();
          
          // 3. Load document
          await loadDocument(
            file,
            loadData,
            loadImages, // Helper function from ResourceContext
            colorThemeDispatch
          );
                  
          // 4. Update layout and UI
          layoutDispatch(setGetLayout(true));
          centerScroll();
                 
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
    }, [centerScroll, clearSelection, colorThemeDispatch, disconnect, handleCloseAllModals, layoutDispatch, loadData, loadImages]);
    
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
      
      // 2. Load file content
      const arrayBuffer = await loadFromDrive(fileId);
      const loadedFileName = `${fileId}.bloomdocx`;
      const file = new File([arrayBuffer], loadedFileName, { type: 'application/octet-stream' });
  
      // 3. Load document content
      await loadDocumentFromDrive(
        file,
        loadData,
        fileId,
        loadImages, // Helper function from ResourceContext
        colorThemeDispatch
      );
  
      // 4. Update layout and UI
      layoutDispatch(setGetLayout(true));
      centerScroll();
  
      // 5. Reset tracking flags
      setHasUntrackedChanges(false);
      setIsAutosaving(false);
      console.log('****************************LOADING FROM GOOGLE DRIVE COMPLETE****************************')
      toast.success('File loaded from Google Drive successfully!');
    } catch (error) {
      console.error('Error loading from Google Drive:', error);
      toast.error('Failed to load from Google Drive.');
    }
  }, [centerScroll, colorThemeDispatch, disconnect, layoutDispatch, loadData, loadImages, loadFromDrive]);
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
          <span>{isInitialized ? 'All changes synchronized' : 'Not synchronized'}</span>
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
