import React, { useState, useEffect } from 'react';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { useCueCardContext } from '@/app/Library/Context/CueCardContext';
import { usePictureContext } from '@/app/Library/Context/PictureContext';
import { usePracticeSheetContext } from '@/app/Library/Context/PracticeSheetContext';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import CardEntry from '@/app/Library/ui/CardEntry';

interface ToolPaneCutCopyWindowProps {
  sourceNodeId: string;
  command: 'cut' | 'copy';
}

const ToolPaneCutCopyWindow: React.FC<ToolPaneCutCopyWindowProps> = ({ sourceNodeId, command }) => {
  const { nodes } = useNodesContext();
  const cueCardContext = useCueCardContext();
  const pictureContext = usePictureContext();
  const practiceSheetContext = usePracticeSheetContext();
  const { targetNodeId } = useNodeSelection();

  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([]);
  const [cutResourceIds, setCutResourceIds] = useState<string[]>([]);

  const sourceNode = nodes.get(sourceNodeId);
  const targetNode = targetNodeId ? nodes.get(targetNodeId) : null;

  // Helper function to get resources for a given node
  const getResources = (nodeId: string) => [
    {
      type: 'cueCard',
      data: cueCardContext.selectResources(nodeId),
    },
    {
      type: 'picture',
      data: pictureContext.selectResources(nodeId),
    },
    {
      type: 'practiceSheet',
      data: practiceSheetContext.selectResources(nodeId),
    },
  ];

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
    [...sourceResources].forEach(({ data, type }) => {
      resourceIds.forEach((resourceId) => {
        if (data.some((res) => res.id === resourceId)) {
          const transfer = type === 'cueCard' ? cueCardContext.transferResource
            : type === 'picture' ? pictureContext.transferResource
            : practiceSheetContext.transferResource;
          
          transfer(sourceNodeId, targetNodeId!, resourceId);
          if (command === 'cut') {
            const remove = type === 'cueCard' ? cueCardContext.removeResource
              : type === 'picture' ? pictureContext.removeResource
              : practiceSheetContext.removeResource;
            remove(sourceNodeId, resourceId);
          }
        }
      });
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
          {sourceResources.map(({ type, data }) =>
            data.length > 0 ? (
              <div key={`source-${type}`}>
                <h4>{type.charAt(0).toUpperCase() + type.slice(1) + 's'}</h4>
                {data.map((resource) => (
                  <CardEntry
                    key={resource.id}
                    resource={resource}
                    resourceType={type as 'cueCard' | 'picture' | 'practiceSheet'}
                    isSelected={selectedResourceIds.includes(resource.id)}
                    isCut={cutResourceIds.includes(resource.id)}
                    onSelect={handleResourceSelect}
                    onCut={handleMarkForCut}
                    command={command}
                  />
                ))}
              </div>
            ) : (
              <p key={`source-${type}`}>No {type}s associated with this node.</p>
            )
          )}
        </div>
      ) : (
        <p>No source node selected.</p>
      )}

      {targetNode ? (
        <div>
          <h4>Target Node: {targetNode.title}</h4>
          {targetResources.map(({ type, data }) =>
            data.length > 0 ? (
              <div key={`target-${type}`}>
                <h4>{type.charAt(0).toUpperCase() + type.slice(1) + 's'}</h4>
                {data.map((resource) => (
                  <CardEntry
                    key={resource.id}
                    resource={resource}
                    resourceType={type as 'cueCard' | 'picture' | 'practiceSheet'}
                    isSelected={selectedResourceIds.includes(resource.id)}
                    isCut={cutResourceIds.includes(resource.id)}
                    onSelect={handleResourceSelect}
                    onCut={handleMarkForCut}
                  />
                ))}
              </div>
            ) : (
              <p key={`target-${type}`}>No {type}s associated with this node.</p>
            )
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
