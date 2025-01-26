// bloom-maps/app/Library/dynamic_tool_panes/ToolPaneCutCopyWindow.tsx

import React, { useState, useEffect } from 'react';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { useResourceContext } from '@/app/Library/Context/ResourceContext';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import CardEntry from '@/app/Library/dynamic_tool_panes/CardEntry';
import {
  toggleResourceSelection,
  markForTransfer,
  handlePaste
} from '@/app/Library/utils/copycutpaste/CutCopyPasteUtils';
import { ResourceCard } from '@/app/Library/Definitions/Definitions';
import './ToolPane.css';

interface ToolPaneCutCopyWindowProps {
  sourceNodeId: string;
  command: 'cut' | 'copy';
  onClose: () => void;
}

const ToolPaneCutCopyWindow: React.FC<ToolPaneCutCopyWindowProps> = ({ sourceNodeId, command, onClose }) => {
  const { nodes } = useNodesContext();
  const { selectResources, transferResource } = useResourceContext();
  const { targetNodeId } = useNodeSelection();

  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([]);
  const [sourceResources, setSourceResources] = useState<ResourceCard[]>([]);
  const [loadingResources, setLoadingResources] = useState<Set<string>>(new Set());
  const [resourceErrors, setResourceErrors] = useState<Set<string>>(new Set());

  const sourceNode = nodes.get(sourceNodeId);
  const targetNode = targetNodeId ? nodes.get(targetNodeId) : null;

  // Load resources asynchronously when sourceNodeId changes
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
    // Prevent selection of loading or error resources
    if (loadingResources.has(resourceId) || resourceErrors.has(resourceId)) {
      return;
    }
    
    const updatedSelection = toggleResourceSelection(resourceId, selectedResourceIds);
    setSelectedResourceIds(updatedSelection);
  };

  const handleMarkForTransfer = (resourceIds: string[]) => {
    // Filter out any loading or error resources
    const validResourceIds = resourceIds.filter(
      id => !loadingResources.has(id) && !resourceErrors.has(id)
    );
    const updatedSelection = markForTransfer(validResourceIds);
    setSelectedResourceIds(updatedSelection);
  };

  const handlePasteResources = async () => {
    if (targetNodeId && selectedResourceIds.length > 0) {
      // Verify no selected resources are still loading
      const hasLoadingResources = selectedResourceIds.some(id => loadingResources.has(id));
      if (hasLoadingResources) {
        alert('Please wait for all resources to finish loading before pasting.');
        return;
      }

      const updatedSelection = handlePaste(
        sourceNodeId,
        targetNodeId,
        selectedResourceIds,
        command,
        transferResource,
      );
      setSelectedResourceIds(updatedSelection);
      onClose();
    }
  };

  return (
    <div className="tool-pane-window">
      <div className="tool-pane-section">
        <div className="multiline section-header">Source Concept: {sourceNode?.title || 'N/A'}</div>
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
                disabled={loadingResources.has(resource.id) || resourceErrors.has(resource.id)}
                onSelect={() => handleResourceSelect(resource.id)}
                command={command}
              />
            ))
          ) : (
            <p>No resources associated with this node.</p>
          )}
        </div>
      </div>

      <div className="section-divider"></div>

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
                  resourceType={resource.type}
                  isSelected={true}
                  isCut={command === 'cut'}
                  isLoading={loadingResources.has(resource.id)}
                  hasError={resourceErrors.has(resource.id)}
                  disabled={loadingResources.has(resource.id) || resourceErrors.has(resource.id)}
                  onSelect={() => handleResourceSelect(resource.id)}
                />
              );
            })
          ) : (
            <p>No resources selected for pasting.</p>
          )}
        </div>
      </div>

      <div className="button-container">
        <button
          className="cancel-button"
          onClick={onClose}
        >
          Cancel
        </button>

        <button
          className="tool-pane-button"
          onClick={handlePasteResources}
          disabled={
            !targetNodeId || 
            selectedResourceIds.length === 0 ||
            selectedResourceIds.some(id => loadingResources.has(id) || resourceErrors.has(id))
          }
        >
          Paste
        </button>
      </div>
    </div>
  );
};

export default ToolPaneCutCopyWindow;