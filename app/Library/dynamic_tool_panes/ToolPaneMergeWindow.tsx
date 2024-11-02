import React from 'react';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import { transferNode } from '@/app/Library/Context/nodesActions';
import { useLayoutContext } from '../Context/LayoutProvider';
import { setGetLayout } from '../Context/LayoutActions';
import './ToolPane.css';

interface ToolPaneMergeWindowProps {
  sourceNodeId: string;
}

const ToolPaneMergeWindow = ({ sourceNodeId }: { sourceNodeId: string }) => {
    const { nodes, dispatch } = useNodesContext();
    const { targetNodeId } = useNodeSelection();
    const { dispatch: layoutDispatch } = useLayoutContext();  
    const sourceNode = nodes.get(sourceNodeId);
    const targetNode = targetNodeId ? nodes.get(targetNodeId) : null;
  
    const handleMergeNodes = () => {
      if (targetNodeId) {
        dispatch(transferNode(sourceNodeId, targetNodeId));
        layoutDispatch(setGetLayout(true));
        //
        // Optionally, close the tool pane after merging
      }
    };
  
    return (
      <div className="tool-pane-window">
        <h3>Merge Options</h3>
        {sourceNode && (
          <div>
            <h4>Source Node: {sourceNode.title}</h4>
          </div>
        )}
        {targetNode ? (
          <div>
            <h4>Target Node: {targetNode.title}</h4>
          </div>
        ) : (
          <p>No target node selected.</p>
        )}
        <button onClick={handleMergeNodes} disabled={!targetNodeId}>
          Merge
        </button>
      </div>
    );
  };
  
  export default ToolPaneMergeWindow;
  