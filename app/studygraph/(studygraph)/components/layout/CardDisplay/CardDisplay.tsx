import React, { useState } from 'react';
import { ResizeHandle } from '../shared/ResizeHandle';
import  { ResourceType as CardResourceType } from './buttons/AddResourceDropdown';
import ResourceDisplay from './ResourceDisplay';
import ResponsiveHeader from './buttons/ResponsiveHeader';
import { useResourceSync } from '@/app/studygraph/(studygraph)/components/hooks/useResourceSync';
import useCardCrudOperations from '@/app/studygraph/(studygraph)/components/hooks/useCardCrudOperations';
import { ResourceCard } from '@/app/Library/Definitions/Definitions';



interface PendingResource {
  nodeId: string;
  type: CardResourceType;
  title: string;
  content: string;
  description?: string;
  image?: File;
}

const getResourceContent = (resource: ResourceCard) => {
  switch (resource.type) {
    case 'cueCard':
    case 'note':
      return resource.content;
    case 'practiceSheet':
      return resource.content;
    case 'picture':
      return resource.description || '';
    default:
      return '';
  }
};

const updateResourceContent = (resource: ResourceCard, newContent: string) => {
  switch (resource.type) {
    case 'cueCard':
    case 'note':
    case 'practiceSheet':
      return { content: newContent };
    case 'picture':
      return { description: newContent };
    default:
      return {};
  }
};

function mapResourceTypeForDisplay(
  resourceType: 'cueCard' | 'note' | 'picture' | 'practiceSheet'
): CardResourceType {
  switch (resourceType) {
    case 'cueCard': return 'cuecard';
    case 'note': return 'note';
    case 'picture': return 'image';
    case 'practiceSheet': return 'quiz';
    default: return 'cuecard';
  }
}

export interface CardDisplayProps {
  width: number;
  isEditMode: boolean;
  currentTopicTitle: string;
  onEditToggle: () => void;
  onResize: (width: number) => void;
}

export const CardDisplay: React.FC<CardDisplayProps> = ({
  width,
  isEditMode,
  currentTopicTitle,
  onEditToggle,
  onResize,
}) => {
  const { selectedNodeIds, cueCards, pictures, practiceSheets, notes } = useResourceSync();
  const combinedResources = [...cueCards, ...notes, ...pictures, ...practiceSheets];
  const { createResource, updateResource, deleteResource } = useCardCrudOperations();

  const [pendingResources, setPendingResources] = useState<PendingResource[]>([]);
  const [editingResourceIds, setEditingResourceIds] = useState<Set<string>>(new Set());
  const [editingContent, setEditingContent] = useState<Record<string, { title: string; content: string }>>({});


  const handleAddResource = (type: CardResourceType) => {
    if (selectedNodeIds.length === 0) {
      console.warn('No node selected. Cannot add resource.');
      return;
    }
    const newPendingResource: PendingResource = {
      nodeId: selectedNodeIds[0],
      type,
      title: '',
      content: '',
      description: type === 'image' ? '' : undefined,
    };
    setPendingResources([...pendingResources, newPendingResource]);
  };



  const handleSavePendingResource = async (index: number, data: {
    title: string;
    content: string;
    image?: File;
    description?: string;
  }) => {
    const pendingResource = pendingResources[index];
    if (!pendingResource) return;
    try {
      await createResource({
        nodeId: pendingResource.nodeId,
        type: pendingResource.type,
        title: data.title,
        content: data.content,
        image: data.image,
        description: data.description
      });
      setPendingResources(pendingResources.filter((_, i) => i !== index));
    } catch (error) {
      console.error('Error creating resource:', error);
    }
  };

  const handleCancelPendingResource = (index: number) => {
    setPendingResources(pendingResources.filter((_, i) => i !== index));
  };

  const handleToggleEdit = (id: string) => {
    setEditingResourceIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
        setEditingContent(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      } else {
        newSet.add(id);
        const resource = combinedResources.find(r => r.id === id);
        if (resource) {
          const content = getResourceContent(resource);
          setEditingContent(prev => ({
            ...prev,
            [id]: {
              title: resource.title,
              content: typeof content === 'string' ? content : JSON.stringify(content)
            }
          }));
        }
      }
      return newSet;
    });
  };

  const handleUpdateResource = async (id: string, updatedData: Partial<any>) => {
    const resource = combinedResources.find((res: any) => res.id === id);
    if (!resource) {
      console.warn('Resource not found');
      return;
    }
    try {
      await updateResource(resource, updatedData);
      setEditingResourceIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      setEditingContent(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (error) {
      console.error('Error updating resource:', error);
    }
  };

  return (
    <div className="relative h-full" style={{ width: `${width / 16}rem` }}>
      <div className="h-full bg-[#F8F9FA] border-l flex flex-col">
        {/* Header */}
        <ResponsiveHeader 
          width={width} 
          onAddResource={handleAddResource}
        />

        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {pendingResources.map((resource, index) => (
            <ResourceDisplay
              key={`pending-${index}`}
              id={`pending-${index}`}
              type={resource.type}
              topicTitle={currentTopicTitle}
              title={resource.title}
              content={resource.content}
              isEditing={true}
              typeColors={{
                cuecard: 'bg-white border-gray-200 hover:bg-gray-50',
                note: 'bg-white border-gray-200 hover:bg-gray-50',
                image: 'bg-white border-gray-200 hover:bg-gray-50',
                quiz: 'bg-white border-gray-200 hover:bg-gray-50',
              }}
              onTitleChange={(title) => {
                const updatedResources = [...pendingResources];
                updatedResources[index] = { ...resource, title };
                setPendingResources(updatedResources);
              }}
              onContentChange={(content) => {
                const updatedResources = [...pendingResources];
                updatedResources[index] = { ...resource, content };
                setPendingResources(updatedResources);
              }}
              onCancel={() => handleCancelPendingResource(index)}
              onSave={(data) =>
                handleSavePendingResource(index, {
                  title: resource.title,
                  content: resource.content,
                  description: resource.description,
                  image: data?.file,  // forward the file if available
                })
              }
              
              onEdit={() => {}}
              onDelete={() => handleCancelPendingResource(index)}
              onAskAI={() => {}}
              onImageCaption={() => {}}
            />
          ))}

{selectedNodeIds.length > 0 ? (
            combinedResources.length > 0 ? (
              combinedResources.map((resource: any) => (
                <ResourceDisplay
                  key={resource.id}
                  id={resource.id}
                  type={mapResourceTypeForDisplay(resource.type)}
                  topicTitle={resource.conceptNodeTitle || currentTopicTitle}
                  title={editingContent[resource.id]?.title ?? resource.title}
                  content={
                    editingContent[resource.id]?.content ??
                    (typeof getResourceContent(resource) === 'string'
                      ? getResourceContent(resource)
                      : JSON.stringify(getResourceContent(resource)))
                  }
                  isEditing={editingResourceIds.has(resource.id)}
                  typeColors={{
                    cuecard: 'bg-white border-gray-200 hover:bg-gray-50',
                    note: 'bg-white border-gray-200 hover:bg-gray-50',
                    image: 'bg-white border-gray-200 hover:bg-gray-50',
                    quiz: 'bg-white border-gray-200 hover:bg-gray-50',
                  }}
                  // Pass imageUrl only when the resource is a picture.
                  imageUrl={resource.type === 'picture' ? resource.imageUrl : undefined}
                  onTitleChange={(title) => {
                    setEditingContent(prev => ({
                      ...prev,
                      [resource.id]: {
                        ...prev[resource.id],
                        title
                      }
                    }));
                  }}
                  onContentChange={(content) => {
                    setEditingContent(prev => ({
                      ...prev,
                      [resource.id]: {
                        ...prev[resource.id],
                        content
                      }
                    }));
                  }}
                  onCancel={() => handleToggleEdit(resource.id)}
                  onSave={() => {
                    const edits = editingContent[resource.id];
                    if (edits) {
                      const updates = {
                        title: edits.title,
                        ...updateResourceContent(resource, edits.content)
                      };
                      handleUpdateResource(resource.id, updates);
                    }
                  }}
                  onEdit={() => handleToggleEdit(resource.id)}
                  onDelete={() => deleteResource(resource.nodeId, resource.id)}
                  onAskAI={() => {}}
                  onImageCaption={() => {}}
                />
              ))
            ) : (
              <p className="text-gray-600">
                No resources available for the selected nodes.
              </p>
            )
          ) : (
            <p className="text-gray-600">
              Select one or more nodes to view their resources.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 bg-gray-50 sticky bottom-0">
          {/* Footer content here */}
        </div>
      </div>
      <ResizeHandle placement="left" onDrag={onResize} />
    </div>
  );
};

export default CardDisplay;