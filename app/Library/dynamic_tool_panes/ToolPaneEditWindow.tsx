import React, { useState } from 'react';
import { useResourceContext } from '@/app/Library/Context/ResourceContext';
import { ResourceCard, PictureResource,PracticeSheetResource, CueCardResource } from '@/app/Library/Definitions/Definitions';
import { useNodesContext } from '@/app/Library/Context/NodesProvider'; 
import ModernModal from '@/app/Library/components/Modals/ModernModal';
import './ToolPane.css';
import CardEntry from '@/app/Library/dynamic_tool_panes/CardEntry';
import { toggleResourceSelection, } from '@/app/Library/utils/copycutpaste/CutCopyPasteUtils';

interface ToolPaneEditWindowProps {
  sourceNodeId: string;
}

const ToolPaneEditWindow: React.FC<ToolPaneEditWindowProps> = ({ sourceNodeId }) => {
  // Import contexts for each resource
  const { nodes } = useNodesContext();
  const { selectCueCards, selectPictures, selectPracticeSheets, editResource, selectResources } = useResourceContext();
  const command = 'edit';

  const sourceNode = nodes.get(sourceNodeId); 
  const nodeTitle = sourceNode ? sourceNode.title : '';
  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([]);

  // Fetch resources for the selected node
  const cueCards = selectCueCards(sourceNodeId);
  const pictures = selectPictures(sourceNodeId);
  const practiceSheets = selectPracticeSheets(sourceNodeId);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [resourceType, setResourceType] = useState<'cueCard' | 'picture' | 'practiceSheet'>('cueCard');
  const [initialData, setInitialData] = useState<any>(null);

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

  // Function to open the modal for editing based on the resource type


const openEditModal = (type: 'cueCard' | 'picture' | 'practiceSheet', data: any) => {
    setResourceType(type);
  
    if (type === 'cueCard') {
      setInitialData({
        id: data.id,
        title: data.title,
        content: data.content,
        bloomLevel: data.bloomLevel,
        source: data.source,
      });
    } else if (type === 'picture') {
      setInitialData({
        id: data.id,
        initialPictureTitle: data.title,
        initialPictureDescription: data.description || '',
        uploadedPicture: data.image || null,
      });
    } else if (type === 'practiceSheet') {
      setInitialData({
        id: data.id,
        initialPracticeSheetTitle: data.title,
        initialPracticeSheetContent: data.content,
      });
    }
  
    setIsModalOpen(true);
  };
  
  
  

  // Modal save handler for each resource type
  const handleSave = (
    resourceType: 'cueCard' | 'picture' | 'practiceSheet',
    nodeTitle: string,
    cueCardTitle?: string,
    cueCardContent?: string,
    bloomLevel?: 1 | 2 | 3 | 4 | 5 | 6,
    image?: File | null,
    source?: string,
    pictureDescription?: string,
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
          bloomLevel,
          source,
        } as CueCardResource;
      } else if (resourceType === 'picture') {
        updatedResource = {
          id: initialData.id,
          nodeId: sourceNodeId,
          type: 'picture',
          title: cueCardTitle || initialData.title,
          image,
          description: pictureDescription,
        } as PictureResource;
      } else if (resourceType === 'practiceSheet') {
        updatedResource = {
          id: initialData.id,
          nodeId:sourceNodeId,
          type: 'practiceSheet',
          title: cueCardTitle || initialData.title,
          content: practiceSheetContent,
        } as PracticeSheetResource;
      } else {
        console.error("Unknown resource type");
        return;
      }
  
      editResource(updatedResource);
      setIsModalOpen(false); // Close modal on save
    }
  };
  
  

  return (
    <div className="tool-pane-window">
      {sourceNode ? (
        <div>
          <h2 className='multiline'>Source: {sourceNode.title}</h2>
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
      ) : (
        <p>No source node selected.</p>
      )}

      {/* ModernModal component to edit selected resource */}
      <ModernModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        initialNodeTitle={nodeTitle}
        mode= 'edit'
        initialCueCardTitle={resourceType === 'cueCard' ? initialData?.title : undefined}
        initialCueCardContent={resourceType === 'cueCard' ? initialData?.content : undefined}
        initialBloomLevel={resourceType === 'cueCard' ? initialData?.bloomLevel : undefined}
        initialSource={resourceType === 'cueCard' ? initialData?.source : undefined}
        initialPictureTitle={resourceType === 'picture' ? initialData?.initialPictureTitle : undefined}
        initialPictureDescription={resourceType === 'picture' ? initialData?.initialPictureDescription : undefined}
        initialPracticeSheetTitle={resourceType === 'practiceSheet' ? initialData?.initialPracticeSheetTitle : undefined}
        initialPracticeSheetContent={resourceType === 'practiceSheet' ? initialData?.initialPracticeSheetContent : undefined}
        selectedResourceType={resourceType}
      />
    </div>
  );
};

export default ToolPaneEditWindow;
