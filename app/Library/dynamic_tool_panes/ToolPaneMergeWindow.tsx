// bloom-maps/app/Library/dynamic_tool_panes/ToolPaneMergeWindow.tsx

import React from 'react';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import { transferNode } from '@/app/Library/Context/nodesActions';
import { useLayoutContext } from '../Context/LayoutProvider';
import { setGetLayout } from '../Context/LayoutActions';
import './ToolPane.css'; // Reusing existing CSS for consistent styling
import CardEntry from '@/app/Library/dynamic_tool_panes/CardEntry';

interface ToolPaneMergeWindowProps {
  sourceNodeId: string;
  onClose: () => void; // New prop for closing the pane
}

const ToolPaneMergeWindow: React.FC<ToolPaneMergeWindowProps> = ({ sourceNodeId, onClose }) => {
  const { nodes, dispatch } = useNodesContext();
  const { targetNodeId } = useNodeSelection();
  const { dispatch: layoutDispatch } = useLayoutContext();

  const sourceNode = nodes.get(sourceNodeId);
  const targetNode = targetNodeId ? nodes.get(targetNodeId) : null;
  const targetNodeChildrenIds = targetNode?.childrenNodeIds || [];

  /**
   * Handles the merge operation by transferring the source node to the target node's subtree.
   */
  const handleMergeNodes = () => {
    if (targetNodeId && sourceNode) {
      dispatch(transferNode(sourceNodeId, targetNodeId));
      layoutDispatch(setGetLayout(true));

      // Automatically close the pane after merge
      onClose();
    }
  };

  return (
    <div className="tool-pane-window">
      {/* Merge Options Header */}
      <div className="section-header">Merge Options</div>

      {sourceNode ? (
        <div>
          {/* Source Node Section */}
          <div className="tool-pane-section">
            <div className="section-subheader">Source Node</div>
            <ul className="resource-list">
              <CardEntry
                key={sourceNode.id}
                resource={{
                  id: sourceNode.id,
                  title: sourceNode.title,
                }}
                resourceType="conceptNode"
                isSelected={false} // Source node is fixed; no selection
                isCut={false}
                onSelect={() => { /* No action needed */ }}
              />
            </ul>
          </div>

          {/* Divider */}
          <div className="section-divider"></div>

          {/* Target Node Section */}
          <div className="tool-pane-section">
          <div className="multiline section-header">Target Concept: {targetNode?.title || 'N/A'}</div>
            <div className="section-subheader">Supporting Concepts: </div>
            {targetNodeChildrenIds.length === 0 ? (
              <p>No children under this node.</p>
            ) : (
              <ul className="resource-list">
                {targetNodeChildrenIds.map(childId => {
                  const childNode = nodes.get(childId);
                  if (!childNode) return null;
                  return (
                    <CardEntry
                      key={childNode.id}
                      resource={{
                        id: childNode.id,
                        title: childNode.title,
                      }}
                      resourceType="conceptNode"
                      isSelected={false}
                      isCut={false}
                      onSelect={() => { /* No action needed */ }}
                    />
                  );
                })}
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

        {/* Merge Button */}
        <button
          className="tool-pane-button"
          onClick={handleMergeNodes}
          disabled={!targetNodeId}
        >
          Merge
        </button>
      </div>
        </div>
      ) : (
        <p>No source node selected.</p>
      )}
    </div>
  );
};

export default ToolPaneMergeWindow;
