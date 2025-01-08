// bloom-maps\app\Library\components\MenuBar\MenuBar.tsx

import React, { useState,useContext, useEffect } from 'react';
import { Menu, Dropdown, Input, Button } from 'antd';
import { useFileContext } from '@/app/Library/Context/FileProvider';
import AppIcon from '@/app/icons-custom/AppIcon.svg';
import '@/app/(client-ui)/MenuBar.css';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import { useResourceContext } from '@/app/Library/Context/ResourceContext'; // Import ResourceContext
import { AuthContext } from '@/app/src/context/AuthContext'; // Import AuthContext
import  SubMenu  from 'antd/lib/menu';
import { loadFromGoogleDrive, saveToGoogleDrive } from '@/app/Library/utils/documentUtils';
import  DriveFileSelector  from '@/app/Library/components/gDrive/DriveFileSelector';
import DriveShareDialog  from '@/app/Library/components/gDrive/DriveShareDialog';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { useColorThemeContext } from '@/app/Library/Context/ColorThemeProvider';
import { useSubTreeContext } from '@/app/Library/Context/SubTreeProvider';


interface MenuBarProps {
  onTitleChange: (newTitle: string) => void;
  onNewDocument: () => void;
  onOpenFromDevice: () => void;
  onSaveToDevice: () => void;
  onHelp: () => void;
  onOpenToolPane: (
    operation: 'cut' | 'copy' | 'delete' | 'merge' | 'edit' | null,
    sourceNodeId: string
  ) => void; // Updated to accept null
  openModalWithResourceType: (
    nodeId: string | null,
    resourceType: 'cueCard' | 'picture' | 'practiceSheet' | undefined,
    op: 'resource' | 'node'
  ) => void;
  onAuthButtonClick: () => void;
}

const MenuBar: React.FC<MenuBarProps> = ({
  onTitleChange,
  onNewDocument,
  onOpenFromDevice,
  onSaveToDevice,
  onHelp,
  onOpenToolPane,
  openModalWithResourceType,
  onAuthButtonClick,
}) => {
  const { fileName } = useFileContext();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState(fileName);

  // Extract selection and resource states
  const { clearSelection, getSelectedNodeIds, focusOnSelectedNode } = useNodeSelection();
  const { undo, redo, undoAvailable, redoAvailable } = useResourceContext();

  // Retrieve selected node ID for enabling/disabling actions
  const selectedNodeIds = getSelectedNodeIds();
  const selectedNodeId = selectedNodeIds.length > 0 ? selectedNodeIds[selectedNodeIds.length - 1] : null;

  // Access AuthContext
  const { isAuthenticated, signOut, user } = useContext(AuthContext);
  const { nodes, dispatch: nodesDispatch } = useNodesContext();
  const { colorTheme, primaryColor, backgroundColor, dispatch: colorThemeDispatch } = useColorThemeContext();
  const { resources, addResource, getResourcesByType, setResourcesByMap } = useResourceContext();
    const { subtrees, setSubtrees, resetSubtrees } = useSubTreeContext();
  const { dispatch: fileDispatch } = useFileContext();


  // google drive state 
 // New state for Drive functionality
 const [isDriveFileSelectorOpen, setIsDriveFileSelectorOpen] = useState(false);
 const [isDriveShareDialogOpen, setIsDriveShareDialogOpen] = useState(false);
 const [selectedDriveFileId, setSelectedDriveFileId] = useState<string | null>(null);


  /**
   * Handles the click event to enable title editing.
   */
  const handleTitleClick = () => {
    setIsEditingTitle(true);
  };

  /**
   * Handles the change event for the title input.
   * @param e - Change event from the input field.
   */
  const handleTitleChangeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewTitle(e.target.value);
  };

  /**
   * Handles the blur event to disable title editing and update the title.
   */
  const handleTitleBlur = () => {
    setIsEditingTitle(false);
    onTitleChange(newTitle);
  };

  /**
   * Handler for undo action.
   */
  const handleUndo = () => {
    const focusedNodeId = focusOnSelectedNode();
    if (focusedNodeId && undoAvailable(focusedNodeId)) {
      undo(focusedNodeId);
    }
  };

  /**
   * Handler for redo action.
   */
  const handleRedo = () => {
    const focusedNodeId = focusOnSelectedNode();
    if (focusedNodeId && redoAvailable(focusedNodeId)) {
      redo(focusedNodeId);
    }
  };

  /**
   * Wrapper function to handle focusing on the last selected node and performing the operation.
   */
  const handleOperation = (
    operation: 'cut' | 'copy' | 'delete' | 'merge' | 'edit' | null
  ) => {
    const focusedNodeId = focusOnSelectedNode();
    if (!focusedNodeId) {
      return; // Exit the function if no node is selected
    }
    onOpenToolPane(operation, focusedNodeId);
  };

  /**
   * Wrapper function to handle adding resources with focused node.
   */
  const handleAddResource = (
    resourceType: 'cueCard' | 'picture' | 'practiceSheet' | undefined,
    op: 'resource' | 'node'
  ) => {
    const focusedNodeId = focusOnSelectedNode();
    openModalWithResourceType(focusedNodeId, resourceType, op);
  };

  /**
   * Determines if a node is selected.
   */
  const isNodeSelected = Boolean(selectedNodeId);

  /**
   * Determines if Undo is available.
   */
  const isUndoAvailable = selectedNodeId ? undoAvailable(selectedNodeId) : false;

  /**
   * Determines if Redo is available.
   */
  const isRedoAvailable = selectedNodeId ? redoAvailable(selectedNodeId) : false;


  const handleSaveToGoogleDrive = async () => {
    if (!isAuthenticated || !user?.googleAccessToken) {
      console.error('User must be authenticated to save to Google Drive');
      return;
    }
    try {
      const fileId = await saveToGoogleDrive(
        nodes,
        colorTheme,
        primaryColor,
        backgroundColor,
        fileName,
        getResourcesByType('cueCard'),
        subtrees,
        getResourcesByType('picture'),
        getResourcesByType('practiceSheet'),
        user.googleAccessToken
      );
      setSelectedDriveFileId(fileId);
      setIsDriveShareDialogOpen(true);
    } catch (error) {
      console.error('Error saving to Drive:', error);
    }
  };

  const handleDriveFileSelect = async (fileId: string) => {
    if (!user?.accessToken) {
      console.error('User must be authenticated to load from Google Drive');
      return;
    }
    try {
      await loadFromGoogleDrive(
        fileId,
        nodesDispatch,
        setResourcesByMap,
        setSubtrees,
        fileDispatch,
        colorThemeDispatch,
        resetTreeDimensions,
        resetSubtrees,
        resetResources,
        user.accessToken
      );
      setIsDriveFileSelectorOpen(false);
    } catch (error) {
      console.error('Error loading from Drive:', error);
    }
  };

  /**
   * Defines the menu items for the File menu.
   */
  const fileMenu = (
    <Menu>
      <SubMenu key="save" title="Save">
        <Menu.Item key="saveLocal" onClick={onSaveToDevice}>
          Save to Device
        </Menu.Item>
        <Menu.Item 
          key="saveDrive" 
          onClick={handleSaveToGoogleDrive} 
          disabled={!isAuthenticated}
        >
          Save to Google Drive
        </Menu.Item>
      </SubMenu>
      <SubMenu key="open" title="Open">
        <Menu.Item key="openLocal" onClick={onOpenFromDevice}>
          Open from Device
        </Menu.Item>
        <Menu.Item 
          key="openDrive" 
          onClick={() => setIsDriveFileSelectorOpen(true)} 
          disabled={!isAuthenticated}
        >
          Open from Google Drive
        </Menu.Item>
      </SubMenu>
      {isAuthenticated && selectedDriveFileId && (
        <Menu.Item key="share" onClick={() => setIsDriveShareDialogOpen(true)}>
          Share Current File
        </Menu.Item>
      )}
    </Menu>
  );

  /**
   * Defines the menu items for the Edit menu.
   */
  const editMenu = (
    <Menu>
      <Menu.Item key="undo" onClick={handleUndo} disabled={!isUndoAvailable}>
        Undo
      </Menu.Item>
      <Menu.Item key="redo" onClick={handleRedo} disabled={!isRedoAvailable}>
        Redo
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item key="cut" onClick={() => handleOperation('cut')} disabled={!isNodeSelected}>
        Cut
      </Menu.Item>
      <Menu.Item key="copy" onClick={() => handleOperation('copy')} disabled={!isNodeSelected}>
        Copy
      </Menu.Item>
      <Menu.Item key="edit" onClick={() => handleOperation('edit')} disabled={!isNodeSelected}>
        Edit
      </Menu.Item>
      <Menu.Item key="delete" onClick={() => handleOperation('delete')} disabled={!isNodeSelected}>
        Delete
      </Menu.Item>
    </Menu>
  );

  /**
   * Defines the menu items for the Insert menu.
   */
  const insertMenu = (
    <Menu>
      <Menu.Item key="newConcept" onClick={() => handleAddResource(undefined, 'node')} disabled={!isNodeSelected}>
        New Concept
      </Menu.Item>
      <Menu.Item key="cueCard" onClick={() => handleAddResource('cueCard', 'resource')} disabled={!isNodeSelected}>
        Cue Card
      </Menu.Item>
      <Menu.Item key="picture" onClick={() => handleAddResource('picture', 'resource')} disabled={!isNodeSelected}>
        Picture
      </Menu.Item>
      <Menu.Item key="quiz" onClick={() => handleAddResource('practiceSheet', 'resource')} disabled={!isNodeSelected}>
        Quiz
      </Menu.Item>
    </Menu>
  );

  /**
   * Defines the menu items for the Help menu.
   * Placeholder for future implementation.
   */
  const helpMenu = (
    <Menu>
      {/* Future Help Options */}
      <Menu.Item key="helpPlaceholder" disabled>
        Coming Soon
      </Menu.Item>
    </Menu>
  );


    /**
   * Handles Sign In/Sign Out button click.
   */
    const handleAuthButtonClick = () => {
      if (isAuthenticated) {
        signOut();
      } else {
        onAuthButtonClick(); // Open the AuthPromptModal
      }
    };

  return (
    <div className="menu-bar-container">
      {/* Application Icon */}
      <div className="menu-bar-icon">
        <AppIcon className="menu-bar-app-icon" />
      </div>

      {/* Content Section with Document Title and MenuBar */}
      <div className="menu-bar-content">
        {/* Document Title */}
        <div className="menu-bar-document-title">
          {isEditingTitle ? (
            <Input
              value={newTitle}
              onChange={handleTitleChangeInput}
              onBlur={handleTitleBlur}
              autoFocus
              className="menu-bar-title-input"
            />
          ) : (
            <span onClick={handleTitleClick} className="menu-bar-title-text">
              {fileName}
            </span>
          )}
        </div>

        {/* MenuBar with Dropdown Menus */}
        <div className="menu-bar-dropdowns">
          {/* File Menu */}
          <Dropdown overlay={fileMenu} trigger={['click']}>
            <Button className="menu-bar-button">
              File 
            </Button>
          </Dropdown>

          {/* Edit Menu */}
          <Dropdown overlay={editMenu} trigger={['click']}>
            <Button className="menu-bar-button">
              Edit 
            </Button>
          </Dropdown>

          {/* Insert Menu */}
          <Dropdown overlay={insertMenu} trigger={['click']}>
            <Button className="menu-bar-button">
              Insert 
            </Button>
          </Dropdown>

          {/* Help Menu */}
          <Dropdown overlay={helpMenu} trigger={['click']}>
            <Button className="menu-bar-button">
              Help 
            </Button>
          </Dropdown>

           {/* Spacer to push Auth button to the right */}
           <div className="flex-grow"></div>
                     {/* Sign In/Sign Out Button */}
          <Button
            onClick={handleAuthButtonClick}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
          >
            {isAuthenticated ? 'Sign Out' : 'Sign In'}
          </Button>
        </div>
      </div>
      {/* Drive-related modals */}
      <DriveFileSelector
        visible={isDriveFileSelectorOpen}
        onSelect={handleDriveFileSelect}
        onCancel={() => setIsDriveFileSelectorOpen(false)}
      />

      <DriveShareDialog
        visible={isDriveShareDialogOpen}
        fileId={selectedDriveFileId as string} // Find a better fix
        onClose={() => setIsDriveShareDialogOpen(false)}
      />
    </div>
  );
};

MenuBar.displayName = 'MenuBar';

export default MenuBar;
function resetTreeDimensions(): void {
  throw new Error('Function not implemented.');
}

function resetResources(): void {
  throw new Error('Function not implemented.');
}

