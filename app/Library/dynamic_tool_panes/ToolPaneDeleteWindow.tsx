// bloom-maps/app/Library/dynamic_tool_panes/ToolPaneDeleteWindow.tsx

import React, { useState } from 'react';
import { useResourceContext } from '@/app/Library/Context/ResourceContext';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { setGetLayout } from '../Context/LayoutActions';
import { useLayoutContext } from '../Context/LayoutProvider';
import './ToolPane.css';
import './ToolPaneDeleteWindow.css'; // Import the new CSS file
import CardEntry from '@/app/Library/dynamic_tool_panes/CardEntry';

interface ToolPaneDeleteWindowProps {
  sourceNodeId: string;
  onClose: () => void; // New prop for closing the pane
}

const ToolPaneDeleteWindow: React.FC<ToolPaneDeleteWindowProps> = ({ sourceNodeId, onClose }) => {
  const { selectResources, removeResource } = useResourceContext();
  const { deleteNode, nodes } = useNodesContext();
  const { dispatch: layoutDispatch } = useLayoutContext();
  const command = 'delete';
  const sourceNode = nodes.get(sourceNodeId);

  // Fetch the current node to determine if it's a root node
  const currentNode = nodes.get(sourceNodeId);
  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([]);

  const getResources = (nodeId: string) => {
    const resources = selectResources(nodeId);
    return resources.map(resource => ({
      ...resource,
      resourceType: resource.type,
    }));
  };

  const resources = selectResources(sourceNodeId);
  const sourceResources = sourceNodeId ? getResources(sourceNodeId) : [];

  /**
   * Handles the deletion of a single resource.
   *
   * @param resourceId - The ID of the resource to delete.
   */
  const handleDeleteResource = (resourceId: string) => {
    removeResource(sourceNodeId, resourceId);
    // Optionally, update the selectedResourceIds if the deleted resource was selected
    setSelectedResourceIds(prev => prev.filter(id => id !== resourceId));
  };

  /**
   * Handles the deletion of selected resources.
   */
  const handleDeleteSelectedResources = () => {
    if (selectedResourceIds.length === 0) {
      alert('Please select at least one resource to delete.');
      return;
    }

    // Confirm Deletion
    const confirmDelete = window.confirm('Are you sure you want to delete the selected resource(s)? This action cannot be undone.');
    if (!confirmDelete) {
      return;
    }

    // Delete each selected resource
    selectedResourceIds.forEach(resourceId => {
      handleDeleteResource(resourceId);
    });

    // Clear the selection after deletion
    setSelectedResourceIds([]);
    alert('Selected resource(s) have been deleted successfully.');

    // Automatically close the pane after deletion
    onClose();
  };

  /**
   * Handles the deletion of the entire node.
   */
  const handleDeleteNode = () => {
    if (!currentNode) {
      console.error(`Delete failed: Node with ID ${sourceNodeId} not found.`);
      return;
    }

    // **Safeguard: Prevent deletion of the root node**
    if (currentNode.isRoot) {
      alert('The root node cannot be deleted.');
      return;
    }

    // **Check if the node is a leaf**
    const isLeaf = !currentNode.childrenNodeIds || currentNode.childrenNodeIds.length === 0;

    if (!isLeaf) {
      alert('Only leaf nodes can be deleted. Please remove all child nodes before deleting this node.');
      return;
    }

    // **Confirm Deletion**
    const confirmDelete = window.confirm(`Are you sure you want to delete the node "${currentNode.title}"? This will also delete all associated data.`);
    if (!confirmDelete) {
      return;
    }

    // **Delete Associated Resources**
    resources.forEach((resource) => {
      handleDeleteResource(resource.id);
    });

    // **Dispatch Delete Node Action**
    deleteNode(sourceNodeId);
    layoutDispatch(setGetLayout(true));

    alert(`Node "${currentNode.title}" has been deleted successfully.`);

    // Automatically close the pane after node deletion
    onClose();
  };

  return (
    <div className="tool-pane-window">
      {/* Delete Options Header */}
      {sourceNode ? (
        <div>
          {/* Source Node Title */}
          <div className="multiline section-header">Concept : {sourceNode.title}</div>

          {/* Delete Entire Node Section */}
          <div className="delete-node-section">
            <div className="delete-node-header">Delete Concept</div>
            <CardEntry
              resource={{
                id: sourceNode.id,
                title: sourceNode.title,
              }}
              resourceType="conceptNode"
              isSelected={false} // Entire node deletion; no selection
              isCut={false}
              onSelect={() => { /* No selection needed for entire node */ }}
              command="delete"
              onDelete={handleDeleteNode} // Pass the node deletion handler
            />
            {currentNode?.isRoot && (
              <p className="delete-node-error">Cannot delete the root node.</p>
            )}
          </div>

          {/* Divider */}
          <div className="section-divider"></div>

          {/* Delete Resources Section */}
          <div className="tool-pane-section">
            {/* Delete Resources Header */}
            <div className="section-header">Delete Resources</div>
            {sourceResources.length === 0 ? (
              <p>No resources associated with this node.</p>
            ) : (
              <ul style={{ listStyleType: 'none', padding: 0 }}>
                {sourceResources.map(resource => (
                  <CardEntry
                    key={resource.id}
                    resource={resource}
                    resourceType={resource.resourceType}
                    isSelected={selectedResourceIds.includes(resource.id)}
                    isCut={selectedResourceIds.includes(resource.id)}
                    onSelect={() => {
                      // Toggle selection
                      setSelectedResourceIds(prev => {
                        if (prev.includes(resource.id)) {
                          return prev.filter(id => id !== resource.id);
                        } else {
                          return [...prev, resource.id];
                        }
                      });
                    }}
                    command="delete"
                    onDelete={() => handleDeleteResource(resource.id)}
                  />
                ))}
              </ul>
            )}
          </div>

         {/* Button Container */}
      <div className="button-container">
        {/* Cancel Button */}
        <button
          className="cancel-button"
          onClick={onClose}
        >
          Cancel
        </button>

        {/* Delete Button */}
        <button
          className="tool-pane-button global-delete-button"
          onClick={handleDeleteSelectedResources}
          disabled={selectedResourceIds.length === 0}
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
