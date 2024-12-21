// bloom-maps/app/Library/dynamic_tool_panes/ToolPaneEditWindow.tsx

import React, { useState, useEffect, KeyboardEvent } from 'react';
import { useResourceContext } from '@/app/Library/Context/ResourceContext';
import { ResourceCard, PictureResource, PracticeSheetResource, CueCardResource } from '@/app/Library/Definitions/Definitions';
import { useNodesContext } from '@/app/Library/Context/NodesProvider'; 
import ModernModal from '@/app/Library/components/Modals/ModernModal';
import './ToolPane.css';
import './proposal.css'
import CardEntry from '@/app/Library/dynamic_tool_panes/CardEntry';
import { toggleResourceSelection } from '@/app/Library/utils/copycutpaste/CutCopyPasteUtils';
import EditIcon from '@mui/icons-material/Edit'; // Importing EditIcon
import { updateNodeTitle } from '@/app/Library/Context/nodesActions'; // Importing the action creator
import { Descendant } from 'slate';

interface ToolPaneEditWindowProps {
  sourceNodeId: string;
  onClose: () => void; // New prop for closing the pane
}

const ToolPaneEditWindow: React.FC<ToolPaneEditWindowProps> = ({ sourceNodeId, onClose }) => {
  // Import contexts for nodes and resources
  const { nodes, dispatch } = useNodesContext(); // Destructure dispatch from context
  const { selectCueCards, selectPictures, selectPracticeSheets, editResource, selectResources } = useResourceContext();
  
  const command = 'edit';

  // Retrieve the source node
  const sourceNode = nodes.get(sourceNodeId); 
  const nodeTitle = sourceNode ? sourceNode.title : '';

  // State for selected resources
  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([]);

  // State for inline title editing
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>(nodeTitle);

  // Effect to update newTitle when nodeTitle changes
  useEffect(() => {
    setNewTitle(nodeTitle);
  }, [nodeTitle]);

  // Fetch resources for the selected node
  const cueCards = selectCueCards(sourceNodeId);
  const pictures = selectPictures(sourceNodeId);
  const practiceSheets = selectPracticeSheets(sourceNodeId);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [resourceType, setResourceType] = useState<'cueCard' | 'picture' | 'practiceSheet'>('cueCard');
  const [initialData, setInitialData] = useState<any>(null);

  // Helper function to get all resources for a given node
  const getResources = (nodeId: string) => {
    const resources = selectResources(nodeId);
    return resources.map(resource => ({
      ...resource,
      resourceType: resource.type,
    }));
  };

  const sourceResources = sourceNodeId ? getResources(sourceNodeId) : [];

  /**
   * Handles the selection of a resource.
   * Toggles the selection state of the resource.
   *
   * @param resourceId - The ID of the resource to select or deselect.
   */
  const handleResourceSelect = (resourceId: string) => {
    const updatedSelection = toggleResourceSelection(resourceId, selectedResourceIds);
    setSelectedResourceIds(updatedSelection);
  };

  /**
   * Opens the modal for editing a specific resource type.
   *
   * @param type - The type of resource to edit ('cueCard', 'picture', 'practiceSheet').
   * @param data - The data of the resource being edited.
   */
  const openEditModal = (type: 'cueCard' | 'picture' | 'practiceSheet', data: ResourceCard) => {
    setResourceType(type);
  
    if (type === 'cueCard') {
      const cue = data as CueCardResource;
      setInitialData({
        id: cue.id,
        title: cue.title,
        content: cue.content ,
        source: cue.source,
      });
    } else if (type === 'picture') {
      const pic = data as PictureResource;
      setInitialData({
        id: pic.id,
        initialPictureTitle: pic.title,
        initialPictureDescription: pic.description || [{ type: 'paragraph', children: [{ text: '' }] }],
        uploadedPicture: pic.image || null,
      });
    } else if (type === 'practiceSheet') {
      const ps = data as PracticeSheetResource;
      setInitialData({
        id: ps.id,
        initialPracticeSheetTitle: ps.title,
        initialPracticeSheetContent: ps.content,
      });
    }
  
    setIsModalOpen(true);
  };

  /**
   * Handles the save action from the modal.
   * Updates the resource with the edited data.
   *
   * @param resourceType - The type of resource being edited.
   * @param nodeTitle - The title of the node containing the resource.
   * @param ...otherParams - Additional parameters based on the resource type.
   */
  const handleSave = (
    resourceType: 'cueCard' | 'picture' | 'practiceSheet',
    nodeTitle: string,
    cueCardTitle?: string,
    cueCardContent?: Descendant[],
    bloomLevel?: 1 | 2 | 3 | 4 | 5 | 6,
    image?: File | null,
    source?: string,
    pictureDescription?: Descendant[],
    practiceSheetContent?: { quizType: 'matching' | 'multipleChoice' | 'wordProblem'; quizContent: string }
  ) => {
    if (initialData) {
      let updatedResource: ResourceCard;

      if (resourceType === 'cueCard') {
        updatedResource = {
          id: initialData.id,
          nodeId: sourceNodeId,
          type: 'cueCard',
          title: cueCardTitle || initialData.title,
          content: cueCardContent,
          source,
        } as CueCardResource;
      } else if (resourceType === 'picture') {
        updatedResource = {
          id: initialData.id,
          nodeId: sourceNodeId,
          type: 'picture',
          title: cueCardTitle || initialData.title,
          image : image || initialData.uploadedPicture,
          description: pictureDescription,
        } as PictureResource;
      } else if (resourceType === 'practiceSheet') {
        updatedResource = {
          id: initialData.id,
          nodeId: sourceNodeId,
          type: 'practiceSheet',
          title: cueCardTitle || initialData.title,
          content: practiceSheetContent,
        } as PracticeSheetResource;
      } else {
        console.error("Unknown resource type");
        return;
      }

      // Update the resource in context
      editResource(updatedResource);
      
      // Close the modal after saving
      setIsModalOpen(false);

      // Automatically close the pane after saving edits
      onClose();
    }
  };

  /**
   * Handles the initiation of title editing.
   */
  const handleEditTitle = () => {
    setIsEditingTitle(true);
  };

  /**
   * Handles the change in the title input field.
   *
   * @param event - The input change event.
   */
  const handleTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setNewTitle(event.target.value);
  };

  /**
   * Handles the submission of the new title.
   */
  const handleTitleSubmit = () => {
    const trimmedTitle = newTitle.trim();
    if (trimmedTitle && trimmedTitle !== nodeTitle) {
      dispatch(updateNodeTitle(sourceNodeId, trimmedTitle));
    }
    setIsEditingTitle(false);
  };

  /**
   * Handles key presses in the title input field.
   *
   * @param event - The keyboard event.
   */
  const handleTitleKeyPress = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleTitleSubmit();
    } else if (event.key === 'Escape') {
      setNewTitle(nodeTitle);
      setIsEditingTitle(false);
    }
  };

  return (
    <div className="tool-pane-window">
      <h3>Edit Options</h3>

      {/* Source Section */}
      <div className="tool-pane-section">
        {/* Inline Editable Title */}
        <div className="multiline section-header proposal-scheme1-title-container">
   
  {isEditingTitle ? (
    <input
      type="text"
      value={newTitle}
      onChange={handleTitleChange}
      onBlur={handleTitleSubmit}
      onKeyDown={handleTitleKeyPress}
      autoFocus
      className="title-input proposal-scheme1-title-input"
      aria-label="Edit node title"
    />
  ) : (
    <>
      <span className="node-title-text">{nodeTitle || 'N/A'}</span>
      <EditIcon 
        className="edit-icon proposal-scheme1-edit-icon" 
        onClick={handleEditTitle} 
        titleAccess="Edit Title"
        aria-label="Edit Title"
      />
    </>
  )}
      </div>


        
        {/* Resource List */}
        <div className="resource-list">
          {sourceResources.length > 0 ? (
            sourceResources.map((resource) => (
              <CardEntry
                key={resource.id}
                resource={resource}
                resourceType={resource.resourceType}
                isSelected={selectedResourceIds.includes(resource.id)}
                isCut={selectedResourceIds.includes(resource.id)}
                onSelect={() => openEditModal(resource.resourceType, resource )}
                command={command}
              />
            ))
          ) : (
            <p>No resources associated with this node.</p>
          )}
        </div>
      </div>

      {/* Button Container */}
      <div className="button-container">
        {/* Cancel Button */}
        <button
          className="cancel-button"
          onClick={onClose}
        >
          Done
        </button>
      </div>

      {/* ModernModal component to edit selected resource */}
      <ModernModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        initialNodeTitle={nodeTitle}
        mode='edit'
        initialCueCardTitle={resourceType === 'cueCard' ? initialData?.title : undefined}
        initialCueCardContent={resourceType === 'cueCard' ? initialData?.content : undefined}
        initialBloomLevel={resourceType === 'cueCard' ? initialData?.bloomLevel : undefined}
        initialSource={resourceType === 'cueCard' ? initialData?.source : undefined}
        initialPictureTitle={resourceType === 'picture' ? initialData?.initialPictureTitle : undefined}
        initialPictureDescription={resourceType === 'picture' ? initialData?.initialPictureDescription : undefined}
        initialPracticeSheetTitle={resourceType === 'practiceSheet' ? initialData?.initialPracticeSheetTitle : undefined}
        initialPracticeSheetContent={resourceType === 'practiceSheet' ? initialData?.initialPracticeSheetContent : undefined}
        selectedResourceType={resourceType}
        initialUploadedPicture={resourceType === 'picture' ? initialData?.uploadedPicture : undefined}
      />
    </div>
  );
};

export default ToolPaneEditWindow;
