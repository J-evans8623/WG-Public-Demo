import React, { useRef, useCallback, useState } from 'react';
import MenuBar from '@/app/(client-ui)/MenuBar';
import ToolBar from './Toolbar-test';
import { useFileContext } from '@/app/Library/Context/FileProvider';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { useColorThemeContext } from '@/app/Library/Context/ColorThemeProvider';
import { useResourceContext } from '@/app/Library/Context/ResourceContext';
import { useSubTreeContext } from '@/app/Library/Context/SubTreeProvider';
import { useLayoutContext } from '@/app/Library/Context/LayoutProvider';
import { setGetLayout, toggleResetMapSize } from '@/app/Library/Context/LayoutActions';
import { useZoomContext } from '@/app/Library/Context/ZoomProvider';
import { useTreeDimensions } from '@/app/Library/Context/TreeDimensionsProvider';
import { saveDocument, loadDocument, initializeNewDocument, prepareBloomDocx, loadDocumentFromDrive } from '@/app/Library/utils/documentUtils';
import { setFileName } from '@/app/Library/Context/fileActions';
import { ColorTheme, ResourceType } from '@/app/Library/Definitions/Definitions';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import { ApiContext } from '@/app/src/context/ApiContext';
import  FileSelectorModal from '@/app/Library/components/FileSelectorModal/FileSelectorModal';
import { toast } from 'react-toastify';

interface TopBarProps {
  /**
   * Handler to open the tool pane with a specific operation and source node ID.
   */
  handleOpenToolPane: (
    operation: 'cut' | 'copy' | 'delete' | 'merge' | 'edit' | null,
    sourceNodeId: string
  ) => void;

  /**
   * Handler to open a modal with a specific resource type and operation.
   */
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
  const { fileName, dispatch: fileDispatch } = useFileContext();
  const { nodes, dispatch: nodesDispatch } = useNodesContext();
  const { clearSelection } = useNodeSelection();
  const { colorTheme, primaryColor, backgroundColor, dispatch: colorThemeDispatch } = useColorThemeContext();
  const { resources, addResource, getResourcesByType, setResourcesByMap } = useResourceContext();
  const { subtrees, setSubtrees, resetSubtrees } = useSubTreeContext();
  const { dispatch: layoutDispatch } = useLayoutContext();
  const { resetTreeDimensions } = useTreeDimensions();
  const { zoomLevel, baseZoomLevel, dispatch: zoomDispatch } = useZoomContext();
  const { resetResources } = useResourceContext();
  const { isAuthenticated, saveToDrive, loadFromDrive } = React.useContext(ApiContext);

  // State for Google Drive File Selector Modal
  const [isFileSelectorOpen, setIsFileSelectorOpen] = useState(false);
  const [selectedDriveFileId, setSelectedDriveFileId] = useState<string | null>(null);

  // Ref for the hidden file input (if needed for device operations)
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Handler for creating a new document.
   * Initializes the document state using existing utility functions.
   */
  const handleCreateNewDocument = useCallback(() => {
    clearSelection();
    handleCloseAllModals();
    initializeNewDocument(
      nodesDispatch,
      layoutDispatch,
      fileDispatch,
      colorThemeDispatch,
      resetTreeDimensions,
      resetSubtrees,
      resetResources,
      6, // bloomDepth
      false // isInitialLoad
    );
    centerScroll();
    layoutDispatch(toggleResetMapSize());
  }, [
    nodesDispatch,
    layoutDispatch,
    fileDispatch,
    colorThemeDispatch,
    resetTreeDimensions,
    resetSubtrees,
    resetResources,
    clearSelection,
    handleCloseAllModals,
    centerScroll,
  ]);

  /**
   * Handler for changing the document title.
   * Updates the file name in the FileContext.
   */
  const handleTitleChange = useCallback((newTitle: string) => {
    if (!newTitle.trim()) {
      fileDispatch(setFileName('Untitled Document'));
    } else {
      fileDispatch(setFileName(newTitle));
    }
  }, [fileDispatch]);

  /**
   * Handler for saving the document.
   * Utilizes the existing saveDocument utility function.
   */
  const handleSaveDocument = useCallback(async () => {
    try {
      await saveDocument(
        nodes,
        colorTheme as ColorTheme, // Ensure proper type casting
        primaryColor,
        backgroundColor,
        fileName,
        getResourcesByType('cueCard'),
        subtrees,
        getResourcesByType('picture'),
        getResourcesByType('practiceSheet'),
      );
      toast.success('Document saved successfully!');
    } catch (error) {
      console.error('Error saving document:', error);
      toast.error('Failed to save the document.');
    }
  }, [
    nodes,
    colorTheme,
    primaryColor,
    backgroundColor,
    fileName,
    getResourcesByType,
    subtrees,
  ]);

  /**
   * Handler for opening a document from the device.
   * Triggers the hidden file input click.
   */
  const handleOpenDocument = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /**
   * Handler for file input change (loading a document).
   * Utilizes the existing loadDocument utility function.
   */
  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleCloseAllModals();
      clearSelection();
      try {
        await loadDocument(
          file,
          nodesDispatch,
          setResourcesByMap,
          setSubtrees,
          fileDispatch,
          colorThemeDispatch,
          resetTreeDimensions,
          resetSubtrees,
          resetResources
        );
        layoutDispatch(setGetLayout(true)); // Trigger layout recalculation if necessary
        centerScroll();
        toast.success('Document loaded successfully!');
      } catch (error) {
        console.error('Error loading document:', error);
        toast.error('Failed to load the document.');
      } finally {
        // Clear the input value to allow the same file to be loaded again
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    }
  }, [
    nodesDispatch,
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
    centerScroll
  ]);

  /**
   * Handles saving the document to Google Drive.
   * Utilizes `prepareBloomDocx` to create the file and `saveToDrive` from ApiContext to upload.
   */
  const handleSaveToGoogleDrive = async () => {
    try {
      toast.info('Saving to Google Drive...');
      const bloomDocx = await prepareBloomDocx(
        nodes,
        colorTheme as ColorTheme,
        primaryColor,
        backgroundColor,
        fileName,
        getResourcesByType('cueCard'),
        subtrees,
        getResourcesByType('picture'),
        getResourcesByType('practiceSheet'),
      );
      const bloomDocxArrayBuffer = await bloomDocx.arrayBuffer(); 
      const fileId = await saveToDrive(bloomDocxArrayBuffer, fileName);
      setSelectedDriveFileId(fileId);
      toast.success('File saved to Google Drive successfully!');
    } catch (error) {
      console.error('Error saving to Google Drive:', error);
      toast.error('Failed to save to Google Drive.');
    }
  };

  /**
   * Handles loading a document from Google Drive.
   * Utilizes `loadFromDrive` from ApiContext and `loadDocumentFromDrive` utility function.
   * 
   * @param fileId - The ID of the Google Drive file to load.
   */
  const handleLoadFromGoogleDrive = async (fileId: string) => {
    try {
      toast.info('Loading from Google Drive...');
      const arrayBuffer = await loadFromDrive(fileId);
      
      // Create a File object with a name
      const loadedFileName = `${fileId}.bloomdocx`;
      const file = new File([arrayBuffer], loadedFileName, { type: 'application/octet-stream' });
      
      await loadDocumentFromDrive(
        file,
        nodesDispatch,
        setResourcesByMap,
        setSubtrees,
        fileDispatch,
        colorThemeDispatch,
        resetTreeDimensions,
        resetSubtrees,
        resetResources,
      );
      
      toast.success('File loaded from Google Drive successfully!');
      layoutDispatch(setGetLayout(true));
      setSelectedDriveFileId(fileId);
      centerScroll();
    } catch (error) {
      console.error('Error loading from Google Drive:', error);
      toast.error('Failed to load from Google Drive.');
    }
  };

  /**
   * Opens the File Selector Modal for Google Drive operations.
   */
  const handleOpenFromGoogleDrive = () => {
    setIsFileSelectorOpen(true);
  };

  /**
   * Closes the File Selector Modal.
   */
  const handleCloseFileSelector = () => {
    setIsFileSelectorOpen(false);
  };

  /**
   * Handles the selection of a file from the File Selector Modal.
   * @param fileId - The ID of the selected Google Drive file.
   */
  const handleFileSelect = (fileId: string) => {
    handleLoadFromGoogleDrive(fileId);
    handleCloseFileSelector();
  };

  /**
   * Handler for help action.
   * Placeholder for implementing help functionality or navigation.
   */
  const handleHelp = useCallback(() => {
    // Implement help functionality or navigation
    console.log('Help clicked');
  }, []);

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

      {/* MenuBar handles document title and basic file operations */}
      <MenuBar
        onTitleChange={handleTitleChange}
        onNewDocument={handleCreateNewDocument}
        onOpenFromDevice={handleOpenDocument}
        onSaveToDevice={handleSaveDocument}
        onHelp={handleHelp}
        onOpenToolPane={handleOpenToolPane}
        openModalWithResourceType={openModalWithResourceType}
        onAuthButtonClick={handleAuthButtonClick}
        onSaveToDrive={handleSaveToGoogleDrive}    // Passed down to MenuBar
        onOpenFromDrive={handleOpenFromGoogleDrive} // Passed down to MenuBar
      />

      {/* ToolBar handles additional operations like zoom, undo/redo, and resource management */}
      <ToolBar
        onOpenToolPane={handleOpenToolPane}
        openModalWithResourceType={openModalWithResourceType}
      />

      {/* File Selector Modal for Google Drive Operations */}
      <FileSelectorModal
        isOpen={isFileSelectorOpen}
        onClose={handleCloseFileSelector}
        onSelect={handleFileSelect}
      />
    </div>
  );
};

export default TopBar;
