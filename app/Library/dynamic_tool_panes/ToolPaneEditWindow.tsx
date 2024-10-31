import React, { useState } from 'react';
import { useResourceContext } from '@/app/Library/Context/ResourceContext';
import { ResourceCard, PictureResource,PracticeSheetResource, CueCardResource } from '@/app/Library/Definitions/Definitions';
import { useNodesContext } from '@/app/Library/Context/NodesProvider'; 
import ModernModal from '@/app/Library/components/Modals/ModernModal';

interface ToolPaneEditWindowProps {
  nodeId: string;
}

const ToolPaneEditWindow: React.FC<ToolPaneEditWindowProps> = ({ nodeId }) => {
  // Import contexts for each resource
  const { nodes } = useNodesContext();
  const { selectCueCards, selectPictures, selectPracticeSheets, editResource } = useResourceContext();
  

  const node = nodes.get(nodeId); 
  const nodeTitle = node ? node.title : '';

  // Fetch resources for the selected node
  const cueCards = selectCueCards(nodeId);
  const pictures = selectPictures(nodeId);
  const practiceSheets = selectPracticeSheets(nodeId);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [resourceType, setResourceType] = useState<'cueCard' | 'picture' | 'practiceSheet'>('cueCard');
  const [initialData, setInitialData] = useState<any>(null);

  // Function to open the modal for editing based on the resource type
// ToolPaneEditWindow.tsx

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
          nodeId,
          type: 'cueCard',
          title: cueCardTitle || initialData.title,
          content: cueCardContent,
          bloomLevel,
          source,
        } as CueCardResource;
      } else if (resourceType === 'picture') {
        updatedResource = {
          id: initialData.id,
          nodeId,
          type: 'picture',
          title: cueCardTitle || initialData.title,
          image,
          description: pictureDescription,
        } as PictureResource;
      } else if (resourceType === 'practiceSheet') {
        updatedResource = {
          id: initialData.id,
          nodeId,
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
    <div>
      <h3>Edit Options</h3>
      <h4>Cue Cards</h4>
      <ul>
        {cueCards.map((card) => (
          <li key={card.id}>
            {card.title} 
            <button onClick={() => openEditModal('cueCard', card)}>Edit</button>
          </li>
        ))}
      </ul>
      
      <h4>Pictures</h4>
      <ul>
        {pictures.map((picture) => (
          <li key={picture.id}>
            {picture.title} 
            <button onClick={() => openEditModal('picture', picture)}>Edit</button>
          </li>
        ))}
      </ul>
      
      <h4>Practice Sheets</h4>
      <ul>
        {practiceSheets.map((sheet) => (
          <li key={sheet.id}>
            {sheet.title} 
            <button onClick={() => openEditModal('practiceSheet', sheet)}>Edit</button>
          </li>
        ))}
      </ul>

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
