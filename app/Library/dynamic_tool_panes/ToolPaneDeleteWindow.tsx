// bloom-maps/app/Library/dynamic_tool_panes/ToolPaneDeleteWindow.tsx

import React, { useState, useEffect } from 'react';
import { useResourceContext } from '@/app/Library/Context/ResourceContext';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { setGetLayout } from '../Context/LayoutActions';
import { useLayoutContext } from '../Context/LayoutProvider';
import { ResourceCard } from '@/app/Library/Definitions/Definitions';
import './ToolPane.css';
import './ToolPaneDeleteWindow.css';
import CardEntry from '@/app/Library/dynamic_tool_panes/CardEntry';

interface ToolPaneDeleteWindowProps {
  sourceNodeId: string;
  onClose: () => void;
}

const ToolPaneDeleteWindow: React.FC<ToolPaneDeleteWindowProps> = ({ sourceNodeId, onClose }) => {
  const { selectResources, removeResource } = useResourceContext();
  const { deleteNode, nodes } = useNodesContext();
  const { dispatch: layoutDispatch } = useLayoutContext();
  const command = 'delete';
  const sourceNode = nodes.get(sourceNodeId);
  const currentNode = nodes.get(sourceNodeId);

  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([]);
  const [sourceResources, setSourceResources] = useState<ResourceCard[]>([]);
  const [loadingResources, setLoadingResources] = useState<Set<string>>(new Set());
  const [resourceErrors, setResourceErrors] = useState<Set<string>>(new Set());

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

  const handleDeleteResource = async (resourceId: string) => {
    // Prevent deletion of loading resources
    if (loadingResources.has(resourceId)) {
      alert('Please wait for the resource to finish loading before deleting.');
      return;
    }

    removeResource(sourceNodeId, resourceId);
    setSelectedResourceIds(prev => prev.filter(id => id !== resourceId));
  };

  const handleDeleteSelectedResources = async () => {
    if (selectedResourceIds.length === 0) {
      alert('Please select at least one resource to delete.');
      return;
    }

    // Check for loading resources
    const hasLoadingResources = selectedResourceIds.some(id => loadingResources.has(id));
    if (hasLoadingResources) {
      alert('Please wait for all resources to finish loading before deleting.');
      return;
    }

    const confirmDelete = window.confirm('Are you sure you want to delete the selected resource(s)? This action cannot be undone.');
    if (!confirmDelete) {
      return;
    }

    for (const resourceId of selectedResourceIds) {
      await handleDeleteResource(resourceId);
    }

    setSelectedResourceIds([]);
    alert('Selected resource(s) have been deleted successfully.');
    onClose();
  };

  const handleDeleteNode = async () => {
    if (!currentNode) {
      console.error(`Delete failed: Node with ID ${sourceNodeId} not found.`);
      return;
    }

    if (currentNode.isRoot) {
      alert('The root node cannot be deleted.');
      return;
    }

    const isLeaf = !currentNode.childrenNodeIds || currentNode.childrenNodeIds.length === 0;
    if (!isLeaf) {
      alert('Only leaf nodes can be deleted. Please remove all child nodes before deleting this node.');
      return;
    }

    // Check for loading resources
    const hasLoadingResources = Array.from(loadingResources).length > 0;
    if (hasLoadingResources) {
      alert('Please wait for all resources to finish loading before deleting the node.');
      return;
    }

    const confirmDelete = window.confirm(`Are you sure you want to delete the node "${currentNode.title}"? This will also delete all associated data.`);
    if (!confirmDelete) {
      return;
    }

    for (const resource of sourceResources) {
      await handleDeleteResource(resource.id);
    }

    deleteNode(sourceNodeId);
    layoutDispatch(setGetLayout(true));
    alert(`Node "${currentNode.title}" has been deleted successfully.`);
    onClose();
  };

  return (
    <div className="tool-pane-window">
      {sourceNode ? (
        <div>
          <div className="multiline section-header">Concept : {sourceNode.title}</div>

          <div className="delete-node-section">
            <div className="delete-node-header">Delete Concept</div>
            <CardEntry
              resource={{
                id: sourceNode.id,
                title: sourceNode.title,
              }}
              resourceType="conceptNode"
              isSelected={false}
              isCut={false}
              disabled={Array.from(loadingResources).length > 0}
              onSelect={() => {}}
              command="delete"
              onDelete={handleDeleteNode}
            />
            {currentNode?.isRoot && (
              <p className="delete-node-error">Cannot delete the root node.</p>
            )}
          </div>

          <div className="section-divider"></div>

          <div className="tool-pane-section">
            <div className="section-header">Delete Resources</div>
            {sourceResources.length === 0 ? (
              <p>No resources associated with this node.</p>
            ) : (
              <ul style={{ listStyleType: 'none', padding: 0 }}>
                {sourceResources.map(resource => (
                  <CardEntry
                    key={resource.id}
                    resource={resource}
                    resourceType={resource.type}
                    isSelected={selectedResourceIds.includes(resource.id)}
                    isCut={selectedResourceIds.includes(resource.id)}
                    isLoading={loadingResources.has(resource.id)}
                    hasError={resourceErrors.has(resource.id)}
                    disabled={loadingResources.has(resource.id)}
                    onSelect={() => {
                      if (!loadingResources.has(resource.id)) {
                        setSelectedResourceIds(prev => {
                          if (prev.includes(resource.id)) {
                            return prev.filter(id => id !== resource.id);
                          } else {
                            return [...prev, resource.id];
                          }
                        });
                      }
                    }}
                    command="delete"
                    onDelete={() => handleDeleteResource(resource.id)}
                  />
                ))}
              </ul>
            )}
          </div>

          <div className="button-container">
            <button
              className="cancel-button"
              onClick={onClose}
            >
              Cancel
            </button>

            <button
              className="tool-pane-button global-delete-button"
              onClick={handleDeleteSelectedResources}
              disabled={selectedResourceIds.length === 0 || Array.from(loadingResources).length > 0}
            >
              Delete
            </button>
          </div>
        </div>
      ) : (
        <p>No source node selected.</p>
      )}
    </div>
  );
};

export default ToolPaneDeleteWindow;