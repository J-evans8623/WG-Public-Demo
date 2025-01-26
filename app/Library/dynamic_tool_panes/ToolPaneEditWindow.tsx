// bloom-maps/app/Library/dynamic_tool_panes/ToolPaneEditWindow.tsx

import React, { useState, useEffect, KeyboardEvent } from 'react';
import { useResourceContext } from '@/app/Library/Context/ResourceContext';
import { ResourceCard, PictureResource, PracticeSheetResource, CueCardResource, IQuizQuestion, QuizType } from '@/app/Library/Definitions/Definitions';
import { useNodesContext } from '@/app/Library/Context/NodesProvider'; 
import ModernModal from '@/app/Library/components/Modals/ModernModal';
import './ToolPane.css';
import './proposal.css'
import CardEntry from '@/app/Library/dynamic_tool_panes/CardEntry';
import { toggleResourceSelection } from '@/app/Library/utils/copycutpaste/CutCopyPasteUtils';
import EditIcon from '@mui/icons-material/Edit';
import { Descendant } from 'slate';
import { v4 as uuidv4 } from 'uuid';

interface ToolPaneEditWindowProps {
  sourceNodeId: string;
  onClose: () => void;
}

const ToolPaneEditWindow: React.FC<ToolPaneEditWindowProps> = ({ sourceNodeId, onClose }) => {
  const { nodes, updateNodeTitle } = useNodesContext();
  const { selectResources, editResource } = useResourceContext();
  const command = 'edit';

  const sourceNode = nodes.get(sourceNodeId); 
  const nodeTitle = sourceNode ? sourceNode.title : '';

  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([]);
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>(nodeTitle);
  const [sourceResources, setSourceResources] = useState<ResourceCard[]>([]);
  const [loadingResources, setLoadingResources] = useState<Set<string>>(new Set());
  const [resourceErrors, setResourceErrors] = useState<Set<string>>(new Set());

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [resourceType, setResourceType] = useState<'cueCard' | 'picture' | 'practiceSheet'>('cueCard');
  const [initialData, setInitialData] = useState<any>(null);
  const [modalKey, setModalKey] = useState<string>('');

  // Effect to update newTitle when nodeTitle changes
  useEffect(() => {
    setNewTitle(nodeTitle);
  }, [nodeTitle]);

  // Fetch resources asynchronously when sourceNodeId changes
  useEffect(() => {
    const fetchResources = async () => {
      if (sourceNodeId) {
        try {
          const resources = await selectResources(sourceNodeId);
          setSourceResources(resources);
          
          // Update loading states for picture resources
          const newLoadingResources = new Set<string>();
          const newResourceErrors = new Set<string>();
          
          resources.forEach(resource => {
            if (resource.type === 'picture') {
              if ('status' in resource && resource.status === 'pending') {
                newLoadingResources.add(resource.id);
              } else if ('status' in resource && resource.status === 'error') {
                newResourceErrors.add(resource.id);
              }
            }
          });
          
          setLoadingResources(newLoadingResources);
          setResourceErrors(newResourceErrors);
        } catch (error) {
          console.error('Error fetching resources:', error);
        }
      }
    };

    fetchResources();
  }, [sourceNodeId, selectResources]);

  const handleResourceSelect = (resourceId: string) => {
    // Prevent selection of loading resources
    if (loadingResources.has(resourceId)) {
      return;
    }
    
    const updatedSelection = toggleResourceSelection(resourceId, selectedResourceIds);
    setSelectedResourceIds(updatedSelection);
  };

  const openEditModal = async (type: 'cueCard' | 'picture' | 'practiceSheet', data: ResourceCard) => {
    // Prevent editing of loading resources
    if (loadingResources.has(data.id)) {
      alert('Please wait for the resource to finish loading before editing.');
      return;
    }

    setResourceType(type);
  
    if (type === 'cueCard') {
      const cue = data as CueCardResource;
      setInitialData({
        id: cue.id,
        title: cue.title,
        content: cue.content,
        source: cue.source,
      });
    } else if (type === 'picture') {
      const pic = data as PictureResource;
      setInitialData({
        id: pic.id,
        initialPictureTitle: pic.title,
        initialPictureDescription: pic.description || [{ type: 'paragraph', children: [{ text: '' }] }],
        uploadedPicture: pic.image || null,
        source: pic.source,
      });
    } else if (type === 'practiceSheet') {
      const ps = data as PracticeSheetResource;
      setInitialData({
        id: ps.id,
        initialPracticeSheetTitle: ps.title,
        initialPracticeSheetContent: {
          quizType: ps.content.quizType,
          quizContent: ps.content.quizContent || [],
        },
      });
    }
    setModalKey(uuidv4());
    setIsModalOpen(true);
  };

  const handleSave = async (
    resourceType: 'cueCard' | 'picture' | 'practiceSheet',
    nodeTitle: string,
    cueCardTitle?: string,
    cueCardContent?: Descendant[],
    bloomLevel?: 1 | 2 | 3 | 4 | 5 | 6,
    image?: File | null,
    source?: string,
    pictureDescription?: Descendant[],
    practiceSheetContent?: { quizType: QuizType; quizContent: IQuizQuestion[] }
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
          image: image || initialData.uploadedPicture,
          description: pictureDescription,
          source,
        } as PictureResource;
      } else if (resourceType === 'practiceSheet') {
        updatedResource = {
          id: initialData.id,
          nodeId: sourceNodeId,
          type: 'practiceSheet',
          title: cueCardTitle || initialData.title,
          content: {
            quizType: practiceSheetContent?.quizType || initialData.initialPracticeSheetContent.quizType,
            quizContent: practiceSheetContent?.quizContent || initialData.initialPracticeSheetContent.quizContent,
          },
        } as PracticeSheetResource;
      } else {
        console.error("Unknown resource type");
        return;
      }

      await editResource(updatedResource);
      setIsModalOpen(false);
      onClose();
    }
  };

  const handleEditTitle = () => {
    setIsEditingTitle(true);
  };

  const handleTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setNewTitle(event.target.value);
  };

  const handleTitleSubmit = () => {
    const trimmedTitle = newTitle.trim();
    if (trimmedTitle && trimmedTitle !== nodeTitle) {
      updateNodeTitle(sourceNodeId, trimmedTitle);
    }
    setIsEditingTitle(false);
  };

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

      <div className="tool-pane-section">
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

        <div className="resource-list">
          {sourceResources.length > 0 ? (
            sourceResources.map((resource) => (
              <CardEntry
                key={resource.id}
                resource={resource}
                resourceType={resource.type}
                isSelected={selectedResourceIds.includes(resource.id)}
                isCut={selectedResourceIds.includes(resource.id)}
                isLoading={loadingResources.has(resource.id)}
                hasError={resourceErrors.has(resource.id)}
                disabled={loadingResources.has(resource.id)}
                onSelect={() => openEditModal(resource.type, resource)}
                command={command}
              />
            ))
          ) : (
            <p>No resources associated with this node.</p>
          )}
        </div>
      </div>

      <div className="button-container">
        <button
          className="cancel-button"
          onClick={onClose}
        >
          Done
        </button>
      </div>

      <ModernModal
        key={modalKey}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        initialNodeTitle={nodeTitle}
        mode='edit'
        initialCueCardTitle={resourceType === 'cueCard' ? initialData?.title : undefined}
        initialCueCardContent={resourceType === 'cueCard' ? initialData?.content : undefined}
        initialBloomLevel={resourceType === 'cueCard' ? initialData?.bloomLevel : undefined}
        initialSource={resourceType === 'cueCard' || resourceType === 'picture' ? initialData?.source : undefined}
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