// TopBar.tsx

import React, { useRef, useCallback, useState, useEffect, useContext } from 'react';
import MenuBar from '@/app/(client-ui)/MenuBar';
import ToolBar from './Toolbar-test';
import { useFileContext } from '@/app/Library/Context/FileProvider';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { useColorThemeContext } from '@/app/Library/Context/ColorThemeProvider';
import { useResourceContext } from '@/app/Library/Tests/Synchro/ResourceContext';
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
} from '@/app/Library/utils/documentUtils'; // Updated import path
import {
  setFileName,
  setDriveFileId,
  resetDriveFileId,
} from '@/app/Library/Context/fileActions';
import { ColorTheme, CueCardResource, ResourceType } from '@/app/Library/Definitions/Definitions';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import { ApiContext } from '@/app/src/context/ApiContext';
import FileSelectorModal from '@/app/Library/components/FileSelectorModal/FileSelectorModal';
import { toast } from 'react-toastify';
import { useYDoc } from '@/app/Library/Context/YDocContext'; // Use YDocContext instead of WebSocketContext

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
  const { fileName, driveFileId, dispatch: fileDispatch } = useFileContext();
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

  // Access Y.Doc from YDocContext
  const { ydoc, provider, status, resetWebSocketAndYDoc } = useYDoc();

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
        fileDispatch(setDriveFileId(fileId));
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
   * Effect to handle autosave when WebSocket sync occurs
   * Depending on your implementation, you might need to handle Yjs updates here
   * or within the YDocContext.
   * If the YDocContext handles this internally, you might not need this.
   */
  useEffect(() => {
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
  }, [provider, ydoc]);

  /**
   * Handler for creating a new document.
   */
  const handleCreateNewDocument = useCallback(() => {
    console.log('handleCreateNewDocument called.');
    clearSelection();
    handleCloseAllModals();
    
    console.log('Initializing new document with default setup...');
    initializeNewDocument(
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
    fileDispatch(resetDriveFileId());
    centerScroll();
    layoutDispatch(toggleResetMapSize());

    setHasUntrackedChanges(false);
    setIsAutosaving(false);
    console.log('New document setup complete. hasUntrackedChanges reset to false.');
  }, [clearSelection, handleCloseAllModals, resetNodes, handleInitNodes, layoutDispatch, fileDispatch, colorThemeDispatch, resetTreeDimensions, resetSubtrees, resetResources, centerScroll]);

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
   * Handler for file input change (loading a `.bloomdocx` document from the local device).
   */
  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        console.log('File selected. Loading document from device:', file.name);
        handleCloseAllModals();
        clearSelection();
        fileDispatch(resetDriveFileId());
        try {
          await loadDocument(
            ydoc,
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
          layoutDispatch(setGetLayout(true));
          centerScroll();
          toast.success('Document loaded successfully!');
          setHasUntrackedChanges(false);
          setIsAutosaving(false);
          console.log('Document loaded from device. hasUntrackedChanges reset to false.');
        } catch (error) {
          console.error('Error loading document:', error);
          toast.error('Failed to load the document.');
        } finally {
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
      }
    },
    [
      ydoc,
      setNodes,
      setResourcesByMap,
      setSubtrees,
      fileDispatch,
      colorThemeDispatch,
      layoutDispatch,
      resetTreeDimensions,
      resetSubtrees,
      resetResources,
      handleCloseAllModals,
      clearSelection,
      centerScroll,
    ]
  );

  /**
   * Handles saving the document to Google Drive (manual action).
   */
  const handleSaveToGoogleDrive = useCallback(async () => {
    try {
      console.log('handleSaveToGoogleDrive triggered.');
      toast.info('Saving to Google Drive...');

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

      let fileId: string;
      if (driveFileId) {
        console.log('Existing fileId found:', driveFileId, '. Updating file in Drive...');
        fileId = await autosaveDocument(bloomDocxArrayBuffer, fileName, driveFileId);
      } else {
        console.log('No existing fileId. Creating new file in Drive...');
        fileId = await autosaveDocument(bloomDocxArrayBuffer, fileName);
      }

      fileDispatch(setDriveFileId(fileId));
      toast.success('File saved to Google Drive successfully!');
      setHasUntrackedChanges(false);
      setIsAutosaving(false);
      console.log('File saved to Google Drive. fileId updated to:', fileId);
    } catch (error) {
      console.error('Error saving to Google Drive:', error);
      toast.error('Failed to save to Google Drive.');
    }
  }, [ydoc, nodes, colorTheme, primaryColor, backgroundColor, fileName, getResourcesByType, subtrees, driveFileId, fileDispatch, autosaveDocument]);

  /**
   * Handler for loading a document from Google Drive (through file selector).
   */
  const handleLoadFromGoogleDrive = useCallback(async (fileId: string) => {
    console.log('handleLoadFromGoogleDrive called. FileId:', fileId);
    try {
      toast.info('Loading from Google Drive...');
      const newYdoc = await resetWebSocketAndYDoc(fileId);
      const arrayBuffer = await loadFromDrive(fileId);

      const loadedFileName = `${fileId}.bloomdocx`;
      console.log(`Creating File object from arrayBuffer for ${loadedFileName}`);
      const file = new File([arrayBuffer], loadedFileName, { type: 'application/octet-stream' });

      await loadDocumentFromDrive(
        file,
        newYdoc,
        setNodes,
        setResourcesByMap,
        setSubtrees,
        fileDispatch,
        colorThemeDispatch,
        resetTreeDimensions,
        resetSubtrees,
        resetResources
      );

      toast.success('File loaded from Google Drive successfully!');
      layoutDispatch(setGetLayout(true));
      fileDispatch(setDriveFileId(fileId));
      centerScroll();
      setHasUntrackedChanges(false);
      setIsAutosaving(false);
      console.log('File loaded from Drive. fileId set to:', fileId);
    } catch (error) {
      console.error('Error loading from Google Drive:', error);
      toast.error('Failed to load from Google Drive.');
    }
  }, [
    ydoc,
    resetWebSocketAndYDoc,
    loadFromDrive,
    setNodes,
    setResourcesByMap,
    setSubtrees,
    fileDispatch,
    colorThemeDispatch,
    resetTreeDimensions,
    resetSubtrees,
    resetResources,
    layoutDispatch,
    centerScroll,
  ]);

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
          <span>All changes synchronized</span>
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
