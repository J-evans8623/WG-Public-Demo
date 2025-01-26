// TopBar.tsx (Updated)
import React, { useRef, useCallback, useState, useEffect, useContext } from 'react';
import MenuBar from '@/app/(client-ui)/MenuBar';
import ToolBar from '@/app/(client-ui)/commandPanelLayout/Toolbar-test';
import { useColorThemeContext } from '@/app/Library/Context/ColorThemeProvider';
import { useResourceContext } from '@/app/Library/Context/ResourceContext';
import { useLayoutContext } from '@/app/Library/Context/LayoutProvider';
import { setGetLayout, toggleResetMapSize } from '@/app/Library/Context/LayoutActions';
import {
  saveDocument,
  prepareBloomDocx,
} from '@/app/Library/utils/documentUtils';
import {initializeNewDocument, loadDocument, loadDocumentFromDrive} from '@/app/Library/utils/LoadDocumentUtils'
import { ColorTheme} from '@/app/Library/Definitions/Definitions';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import { ApiContext } from '@/app/src/context/ApiContext';
import FileSelectorModal from '@/app/Library/components/FileSelectorModal/FileSelectorModal';
import { toast } from 'react-toastify';
import { useYDoc } from '@/app/Library/Context/YDocContext';
import { useWebSocketManager } from '@/app/Library/Context/WebSocketManager'; // Hook for WebSocketManager
import { AutoSaveManager } from '@/app/Library/utils/AutoSaveManager';

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

  
  const { clearSelection } = useNodeSelection();
  const { colorTheme, primaryColor, backgroundColor, dispatch: colorThemeDispatch } =
    useColorThemeContext();
  const {  loadImages, saveImages } = useResourceContext();

  const { dispatch: layoutDispatch } = useLayoutContext();

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



  // State to track autosave status for visual feedback
  const [isAutosaving, setIsAutosaving] = useState<boolean>(false);


  const autoSaveManager = useRef<AutoSaveManager | null>(null);

  
  useEffect(() => {
    
    autoSaveManager.current = new AutoSaveManager(
      ydoc,
      async () => {
        setIsAutosaving(true);
        try {
          const bloomDocx = await prepareBloomDocx(
            ydoc,
            colorTheme as ColorTheme,
            primaryColor,
            backgroundColor,
            fileName,
            saveImages,
            driveFileId
          );
          console.log('Entering Autosave layer using autosaveManager instace : ', autoSaveManager.current)

          const bloomDocxArrayBuffer = await bloomDocx.arrayBuffer();
          const fileId = await autosaveDocument(bloomDocxArrayBuffer, fileName, driveFileId);
          updateDriveId(fileId);
          
          toast.success('Autosave completed successfully!');
          console.log('*******************Exiting Autosave layer*****************')
        } catch (error) {
          console.error('Autosave error:', error);
          toast.error('Autosave failed.');
          throw error; // Propagate error to AutoSaveManager
        } finally {
          setIsAutosaving(false);
        }
      }
    );

    return () => {
      autoSaveManager.current?.destroy();
    };
  }, [ydoc, colorTheme, primaryColor, backgroundColor, fileName, driveFileId, saveImages, autosaveDocument, updateDriveId]);


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
  }, [ydoc, colorTheme, primaryColor, backgroundColor, fileName, saveImages, driveFileId, autosaveDocument, updateDriveId, connect]);


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
