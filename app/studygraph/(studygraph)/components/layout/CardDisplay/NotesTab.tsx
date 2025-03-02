// NotesTab.tsx
import React, { useState, useImperativeHandle, forwardRef } from 'react';
import { ResourceType as CardResourceType } from './buttons/AddResourceDropdown';
import ResourceDisplay from './ResourceDisplay';
import { useResourceSync } from '@/app/studygraph/(studygraph)/components/hooks/useResourceSync';
import useCardCrudOperations from '@/app/studygraph/(studygraph)/components/hooks/useCardCrudOperations';
import { ResourceCard } from '@/app/Library/Definitions/Definitions';
import '@/app/studygraph/(studygraph)/components/layout/scrollbar.css';

interface PendingResource {
  nodeId: string;
  type: CardResourceType;
  title: string;
  content: string;
  description?: string;
  image?: File;
}

interface NotesTabProps {
  currentTopicTitle: string;
  isEditMode: boolean;
  onSwitchToChat: () => void;
  width: number;
}

const getResourceContent = (resource: ResourceCard) => {
  switch (resource.type) {
    case 'cueCard':
    case 'note':
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
    case 'cueCard':
      return 'cuecard';
    case 'note':
      return 'note';
    case 'picture':
      return 'image';
    case 'practiceSheet':
      return 'quiz';
    default:
      return 'cuecard';
  }
}

const NotesTab = forwardRef<{ handleAddResource: (type: CardResourceType) => void }, NotesTabProps>(
  ({ currentTopicTitle, isEditMode, onSwitchToChat, width }, ref) => {
    // Retrieve resources for selected nodes
    const { selectedNodeIds, cueCards, pictures, practiceSheets, notes } = useResourceSync();
    const combinedResources = [...cueCards, ...notes, ...pictures, ...practiceSheets];

    // CRUD operations for resources
    const { createResource, updateResource, deleteResource } = useCardCrudOperations();

    // State for newly created resources (pending, unsaved)
    const [pendingResources, setPendingResources] = useState<PendingResource[]>([]);
    // State for editing existing resources
    const [editingResourceIds, setEditingResourceIds] = useState<Set<string>>(new Set());
    const [editingContent, setEditingContent] =
      useState<Record<string, { title: string; content: string }>>({});

    // Handle adding a new resource
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

    // Expose handleAddResource to parent via ref
    useImperativeHandle(ref, () => ({
      handleAddResource
    }));

    // Save a pending resource
    const handleSavePendingResource = async (
      index: number,
      data: {
        title: string;
        content: string;
        image?: File;
        description?: string;
      }
    ) => {
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

    // Cancel creating a pending resource
    const handleCancelPendingResource = (index: number) => {
      setPendingResources(pendingResources.filter((_, i) => i !== index));
    };

    // Toggle edit mode for an existing resource
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

    // Update an existing resource
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
      <div className="h-full flex flex-col">
        {/* Main scrollable content area */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 custom-scrollbar">
          <div className="space-y-4 py-4">
            {/* Pending Resources */}
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
                  const updated = [...pendingResources];
                  updated[index] = { ...resource, title };
                  setPendingResources(updated);
                }}
                onContentChange={(content) => {
                  const updated = [...pendingResources];
                  updated[index] = { ...resource, content };
                  setPendingResources(updated);
                }}
                onCancel={() => handleCancelPendingResource(index)}
                onSave={(data) =>
                  handleSavePendingResource(index, {
                    title: resource.title,
                    content: resource.content,
                    description: resource.description,
                    image: data?.file,
                  })
                }
                onEdit={() => {}}
                onDelete={() => handleCancelPendingResource(index)}
                onAskAI={onSwitchToChat}
                onImageCaption={() => {}}
              />
            ))}

            {/* Existing Resources */}
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
                    onAskAI={onSwitchToChat}
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
        </div>

        {/* Bottom spacer with the same height as the canvas viewer’s bottom bar */}
        <div style={{ height: "var(--bottom-bar-height)" }} />
      </div>
    );
  }
);

NotesTab.displayName = 'NotesTab';

export default NotesTab;
