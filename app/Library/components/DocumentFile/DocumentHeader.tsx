//bloom-maps\app\Library\components\DocumentFile\DocumentHeader.tsx

import React, { useRef, useCallback } from 'react';
import MenuBar from '@/app/(client-ui)/MenuBar';
import ToolBar from '@/app/(client-ui)/ToolBar';
import { useFileContext } from '@/app/Library/Context/FileProvider';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { useColorThemeContext } from '@/app/Library/Context/ColorThemeProvider';
import { useResourceContext } from '@/app/Library/Context/ResourceContext';
import { useSubTreeContext } from '@/app/Library/Context/SubTreeProvider';
import { useLayoutContext } from '@/app/Library/Context/LayoutProvider';
import { setGetLayout, toggleResetMapSize } from '@/app/Library/Context/LayoutActions';
import { useZoomContext } from '@/app/Library/Context/ZoomProvider';
import { useTreeDimensions } from '@/app/Library/Context/TreeDimensionsProvider';
import { saveDocument, loadDocument, initializeNewDocument } from '@/app/Library/utils/documentUtils';
import { setFileName } from '@/app/Library/Context/fileActions';
import { ColorTheme, ResourceType } from '@/app/Library/Definitions/Definitions';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';


interface DocumentHeaderProps {
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
  closeAllModals: () => void;
  centerScroll: () => void;
}

const DocumentHeader: React.FC<DocumentHeaderProps> = ({
  handleOpenToolPane,
  openModalWithResourceType,
  closeAllModals,
  centerScroll,
}) => {
  // Access necessary contexts
  const { fileName, dispatch: fileDispatch } = useFileContext();
  const { nodes, dispatch: nodesDispatch } = useNodesContext();
  const {clearSelection} = useNodeSelection();
  const { colorTheme, primaryColor, backgroundColor, dispatch: colorThemeDispatch } = useColorThemeContext();
  const { resources, addResource, getResourcesByType , setResourcesByMap} = useResourceContext();
  const { subtrees, setSubtrees, resetSubtrees } = useSubTreeContext();
  const { dispatch: layoutDispatch} = useLayoutContext();
  const { resetTreeDimensions } = useTreeDimensions();
  const { zoomLevel, baseZoomLevel, dispatch: zoomDispatch } = useZoomContext();
  const { resetResources } = useResourceContext();

  // Ref for the hidden file input
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Handler for creating a new document.
   * Initializes the document state using existing utility functions.
   */
  const handleCreateNewDocument = useCallback(() => {
    clearSelection();
    closeAllModals();
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
  ]);

  /**
   * Handler for changing the document title.
   * Updates the file name in the FileContext.
   */
  const handleTitleChange = useCallback((newTitle: string) => {
    fileDispatch(setFileName(newTitle));
  }, [fileDispatch]);

  /**
   * Handler for saving the document.
   * Utilizes the existing saveDocument utility function.
   */
  const handleSaveDocument = useCallback(async () => {
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
   * Handler for opening a document.
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
      closeAllModals();
      clearSelection();
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
    resetResources
  ]);

  /**
   * Handler for help action.
   * Placeholder for implementing help functionality or navigation.
   */
  const handleHelp = useCallback(() => {
    // Implement help functionality or navigation
    console.log('Help clicked');
  }, []);


  return (
    <div>
      {/* Hidden file input for opening documents */}
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
        onOpenDocument={handleOpenDocument}
        onSaveDocument={handleSaveDocument}
        onHelp={handleHelp}
        onOpenToolPane={handleOpenToolPane}
        openModalWithResourceType={openModalWithResourceType}
      />
      
      {/* ToolBar handles additional operations like zoom, undo/redo, and resource management */}
      <ToolBar
        onOpenToolPane={handleOpenToolPane}
        openModalWithResourceType={openModalWithResourceType}
      />
    </div>
  );
};

export default DocumentHeader;
