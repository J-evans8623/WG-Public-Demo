// bloom-maps/app/Library/components/ToolPaneDeleteWindow.tsx

import React from 'react';
import { useResourceContext } from '@/app/Library/Context/ResourceContext';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { deleteNode } from '@/app/Library/Context/nodesActions';
import { setGetLayout } from '../Context/LayoutActions';
import { useLayoutContext } from '../Context/LayoutProvider';
import './ToolPane.css';
import CardEntry from '@/app/Library/dynamic_tool_panes/CardEntry';
import { useState } from 'react';

const ToolPaneDeleteWindow = ({ sourceNodeId }: { sourceNodeId: string }) => {
  const { selectResources, removeResource } = useResourceContext();
  const { dispatch: nodesDispatch, nodes } = useNodesContext();
  const { dispatch: layoutDispatch } = useLayoutContext();
  const command = 'delete';
  //const { untrackNode } = useUndoRedoContext();

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

  const handleDeleteResource = (resourceId: string) => {
    removeResource(sourceNodeId, resourceId);
  };

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
    nodesDispatch(deleteNode(sourceNodeId));
    layoutDispatch(setGetLayout(true));

    alert(`Node "${currentNode.title}" has been deleted successfully.`);
    //untrackNode(sourceNodeId);
  };

  return (
    <div className="tool-pane-window">
      <h3>Delete Options</h3>

      {/* Delete Entire Node */}
      <div style={{ marginBottom: '20px' }}>
        <h4>Delete Entire Node</h4>
        <button onClick={handleDeleteNode} disabled={currentNode?.isRoot}>
          Delete Node
        </button>
        {currentNode?.isRoot && (
          <p style={{ color: 'red' }}>Cannot delete the root node.</p>
        )}
      </div>

      {/* Existing Delete Options */}
      <div>
        <h4>Resources</h4>
        {sourceResources.length === 0 ? (
          <p>No resources associated with this node.</p>
        ) : (
          <ul>
            {sourceResources.map(resource => (
              <CardEntry
              key={resource.id}
              resource={resource}
              resourceType={resource.resourceType}
              isSelected={selectedResourceIds.includes(resource.id)}
              isCut={selectedResourceIds.includes(resource.id)}
              onSelect={() => handleDeleteResource(resource.id)}
              command={command}
            />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ToolPaneDeleteWindow;
