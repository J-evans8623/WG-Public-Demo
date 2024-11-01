// bloom-maps/app/Library/dynamic_tool_panes/ToolPaneCutCopyWindow.tsx

import React, { useState } from 'react';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { useResourceContext } from '@/app/Library/Context/ResourceContext';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import CardEntry from '@/app/Library/ui/CardEntry';
import {
  toggleResourceSelection,
  markForTransfer,
  handlePaste
} from '@/app/Library/utils/copycutpaste/CutCopyPasteUtils';

interface ToolPaneCutCopyWindowProps {
  sourceNodeId: string;
  command: 'cut' | 'copy';
}

const ToolPaneCutCopyWindow: React.FC<ToolPaneCutCopyWindowProps> = ({ sourceNodeId, command }) => {
  const { nodes } = useNodesContext();
  const { selectResources, transferResource, removeResource } = useResourceContext();
  const { targetNodeId } = useNodeSelection();

  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([]);

  const sourceNode = nodes.get(sourceNodeId);
  const targetNode = targetNodeId ? nodes.get(targetNodeId) : null;

  // Helper function to get resources for a given node
  const getResources = (nodeId: string) => {
    const resources = selectResources(nodeId);
    return resources.map(resource => ({
      ...resource,
      resourceType: resource.type,
    }));
  };

  const sourceResources = sourceNodeId ? getResources(sourceNodeId) : [];
  const targetResources = targetNodeId ? getResources(targetNodeId) : [];

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
   * Marks resources for transfer (cut or copy).
   * This replaces the current selection with the specified resources.
   *
   * @param resourceIds - An array of resource IDs to mark for transfer.
   */
  const handleMarkForTransfer = (resourceIds: string[]) => {
    const updatedSelection = markForTransfer(resourceIds);
    setSelectedResourceIds(updatedSelection);
  };

  /**
   * Executes the paste operation.
   * Utilizes the handlePaste utility function to perform the transfer.
   */
  const handlePasteResources = () => {
    if (targetNodeId && selectedResourceIds.length > 0) {
      const updatedSelection = handlePaste(
        sourceNodeId,
        targetNodeId,
        selectedResourceIds,
        command,
        transferResource,
      );
      setSelectedResourceIds(updatedSelection);
    }
  };

  /**
   * Handles the 'Cut' or 'Copy' action triggered by the user.
   * Marks the selected resources for transfer based on the command.
   *
   * @param selectedIds - An array of selected resource IDs.
   */
  const handleAction = (selectedIds: string[]) => {
    if (selectedIds.length > 0) {
      handleMarkForTransfer(selectedIds);
    }
  };

  return (
    <div className="tool-pane-window">
      <h3>{command === 'copy' ? 'Copy' : 'Cut'}</h3>
      {sourceNode ? (
        <div>
          <h4>Source Node: {sourceNode.title}</h4>
          {sourceResources.length > 0 ? (
            sourceResources.map((resource) => (
              <CardEntry
                key={resource.id}
                resource={resource}
                resourceType={resource.resourceType}
                isSelected={selectedResourceIds.includes(resource.id)}
                isCut={command === 'cut' && selectedResourceIds.includes(resource.id)}
                onSelect={() => handleResourceSelect(resource.id)}
                onCut={() => handleAction([resource.id])}
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

      {targetNode ? (
        <div>
          <h4>Target Node: {targetNode.title}</h4>
          {targetResources.length > 0 ? (
            targetResources.map((resource) => (
              <CardEntry
                key={resource.id}
                resource={resource}
                resourceType={resource.resourceType}
                isSelected={selectedResourceIds.includes(resource.id)}
                isCut={command === 'cut' && selectedResourceIds.includes(resource.id)}
                onSelect={() => handleResourceSelect(resource.id)}
                onCut={() => handleAction([resource.id])}
                command={command}
              />
            ))
          ) : (
            <p>No resources associated with this node.</p>
          )}
        </div>
      ) : (
        <p>No target node selected.</p>
      )}

      <button
        onClick={handlePasteResources}
        disabled={!targetNodeId || selectedResourceIds.length === 0}
      >
        Paste
      </button>
    </div>
  );
};

export default ToolPaneCutCopyWindow;
