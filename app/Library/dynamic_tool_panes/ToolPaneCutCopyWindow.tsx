// bloom-maps/app/Library/dynamic_tool_panes/ToolPaneCutCopyWindow.tsx

import React, { useState } from 'react';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { useResourceContext } from '@/app/Library/Context/ResourceContext';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import CardEntry from '@/app/Library/dynamic_tool_panes/CardEntry';
import {
  toggleResourceSelection,
  markForTransfer,
  handlePaste
} from '@/app/Library/utils/copycutpaste/CutCopyPasteUtils';
import './ToolPane.css';

interface ToolPaneCutCopyWindowProps {
  sourceNodeId: string;
  command: 'cut' | 'copy';
  onClose: () => void; // New prop for closing the pane
}

const ToolPaneCutCopyWindow: React.FC<ToolPaneCutCopyWindowProps> = ({ sourceNodeId, command, onClose }) => {
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
  // Removed targetResources as per user instruction

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
      onClose(); // Automatically close the pane after paste
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
      {/* Source Section */}
      <div className="tool-pane-section">
        <div className="multiline section-header">Source Concept: {sourceNode?.title || 'N/A'}</div>
        <div className="resource-list">
          {sourceResources.length > 0 ? (
            sourceResources.map((resource) => (
              <CardEntry
                key={resource.id}
                resource={resource}
                resourceType={resource.resourceType}
                isSelected={selectedResourceIds.includes(resource.id)}
                isCut={selectedResourceIds.includes(resource.id)}
                onSelect={() => handleResourceSelect(resource.id)}
                command={command}
              />
            ))
          ) : (
            <p>No resources associated with this node.</p>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="section-divider"></div>

      {/* Target Section - Retaining Original Section Name */}
      <div className="tool-pane-section">
        <div className="multiline section-header">Target Concept: {targetNode?.title || 'N/A'}</div>
        <div className="resource-list">
          {targetNodeId && selectedResourceIds.length > 0 ? (
            selectedResourceIds.map((resourceId) => {
              const resource = sourceResources.find(res => res.id === resourceId);
              if (!resource) return null;
              return (
                <CardEntry
                  key={resource.id}
                  resource={resource}
                  resourceType={resource.resourceType}
                  isSelected={true} // Always selected in target
                  isCut={command === 'cut'}
                  onSelect={() => handleResourceSelect(resource.id)}
                />
              );
            })
          ) : (
            <p>No resources selected for pasting.</p>
          )}
        </div>
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

        {/* Paste Button */}
        <button
          className="tool-pane-button"
          onClick={handlePasteResources}
          disabled={!targetNodeId || selectedResourceIds.length === 0}
        >
          Paste
        </button>
      </div>
    </div>
  );
};

export default ToolPaneCutCopyWindow;
