import React, { useState } from 'react';
import { useCueCardContext } from '@/app/Library/Context/CueCardContext';
import { usePictureContext } from '@/app/Library/Context/PictureContext';
import { usePracticeSheetContext } from '@/app/Library/Context/PracticeSheetContext';
import { useNodesContext } from '@/app/Library/Context/NodesProvider'; 
import ModernModal from '@/app/Library/components/Modals/ModernModal';

interface ToolPaneEditWindowProps {
  nodeId: string;
}

const ToolPaneEditWindow: React.FC<ToolPaneEditWindowProps> = ({ nodeId }) => {
  // Import contexts for each resource
  const { nodes } = useNodesContext(); 
  const { selectCueCards, editCueCard } = useCueCardContext();
  const { selectPictures, editPicture } = usePictureContext();
  const { selectPracticeSheets, editPracticeSheet } = usePracticeSheetContext();

  const node = nodes.get(nodeId); 
  const nodeTitle = node ? node.title : '';

  // Fetch resources for the selected node
  const cueCards = selectCueCards(nodeId);
  const pictures = selectPictures(nodeId);
  const practiceSheets = selectPracticeSheets(nodeId);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [resourceType, setResourceType] = useState<'cueCard' | 'picture' | 'practiceSheet' | undefined>(undefined);
  const [initialData, setInitialData] = useState<any>(null);

  // Function to open the modal for editing based on the resource type
// ToolPaneEditWindow.tsx


const openEditModal = (type: 'cueCard' | 'picture' | 'practiceSheet', data: any) => {
    setResourceType(type);
  
    if (type === 'cueCard') {
      setInitialData({
        title: data.title,
        content: data.content,
        bloomLevel: data.bloomLevel,
        source: data.source,
      });
    } else if (type === 'picture') {
      setInitialData({
        initialPictureTitle: data.title,
        initialPictureDescription: data.description || '',
        uploadedPicture: data.image || null,
      });
    } else if (type === 'practiceSheet') {
      setInitialData({
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
    if (resourceType === 'cueCard' && initialData) {
      editCueCard(nodeId, { ...initialData, title: cueCardTitle, content: cueCardContent, bloomLevel });
    } else if (resourceType === 'picture' && initialData) {
      editPicture(nodeId, { ...initialData, title: cueCardTitle, image });
    } else if (resourceType === 'practiceSheet' && initialData) {
      editPracticeSheet(nodeId, { ...initialData, title: cueCardTitle, content: practiceSheetContent });
    }
    setIsModalOpen(false); // Close modal on save
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
        mode={resourceType === 'cueCard' ? 'editCueCard' : 'addResource'}
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
