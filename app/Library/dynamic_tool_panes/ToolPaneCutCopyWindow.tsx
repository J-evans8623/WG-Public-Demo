// bloom-maps/app/Library/components/ToolPaneCutCopyWindow.tsx

import React, { useState } from 'react';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { useResourceContext } from '@/app/Library/Context/ResourceContext';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import CardEntry from '@/app/Library/ui/CardEntry';

interface ToolPaneCutCopyWindowProps {
  sourceNodeId: string;
  command: 'cut' | 'copy';
}

const ToolPaneCutCopyWindow: React.FC<ToolPaneCutCopyWindowProps> = ({ sourceNodeId, command }) => {
  const { nodes } = useNodesContext();
  const { selectResources, transferResource, removeResource } = useResourceContext();
  const { targetNodeId } = useNodeSelection();

  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([]);
  const [cutResourceIds, setCutResourceIds] = useState<string[]>([]);

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

  const handleResourceSelect = (resourceId: string) => {
    setSelectedResourceIds((prev) =>
      prev.includes(resourceId) ? prev.filter((id) => id !== resourceId) : [...prev, resourceId]
    );
    setCutResourceIds([]); // Reset cut state on new selection
  };

  const handleMarkForCut = (resourceId: string) => {
    setCutResourceIds((prev) =>
      prev.includes(resourceId) ? prev.filter((id) => id !== resourceId) : [...prev, resourceId]
    );
    setSelectedResourceIds([resourceId]);
  };

  const executeTransfer = (resourceIds: string[]) => {
    sourceResources.forEach(({ id, resourceType }) => {
      if (resourceIds.includes(id)) {
        transferResource(sourceNodeId, targetNodeId!, id);
        if (command === 'cut') {
          removeResource(sourceNodeId, id);
        }
      }
    });
  };

  const handlePasteResources = () => {
    if (targetNodeId) {
      executeTransfer(cutResourceIds.length ? cutResourceIds : selectedResourceIds);
      setSelectedResourceIds([]);
      setCutResourceIds([]);
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
                isCut={cutResourceIds.includes(resource.id)}
                onSelect={handleResourceSelect}
                onCut={handleMarkForCut}
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
                isCut={cutResourceIds.includes(resource.id)}
                onSelect={handleResourceSelect}
                onCut={handleMarkForCut}
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
        disabled={!targetNodeId || (!cutResourceIds.length && !selectedResourceIds.length)}
      >
        Paste
      </button>
    </div>
  );
};

export default ToolPaneCutCopyWindow;
