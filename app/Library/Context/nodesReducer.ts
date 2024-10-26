//bloom-maps\app\Library\Tests\context\nodesReducer.ts
import { ConceptNode, NodesAction, NodesActionType } from '@/app/Library/Definitions/Definitions';

export const initialNodesState: Map<string, ConceptNode> = new Map();

export const nodesReducer = (
  state: Map<string, ConceptNode>,
  action: NodesAction
): Map<string, ConceptNode> => {
  switch (action.type) {
    case NodesActionType.SET_NODES:
      if (state === action.payload) {
        return state;
      }
      return action.payload;


      case NodesActionType.INIT_NEW_DOCUMENT: {
        const newRootNode: ConceptNode = {
          id: 'node-1',
          title: 'Root Concept',
          parentNodeId: undefined,
          childrenNodeIds: [],
          x: 0,
          y: 0,
          isRoot: true,
          depth: 0,
        };
      
        const newNodes = new Map<string, ConceptNode>();
        newNodes.set(newRootNode.id, newRootNode);
      
        return newNodes;
      }
    case NodesActionType.CREATE_NEW_NODE: {
      const { newNodeId, title, parentNodeId } = action.payload;
      const parentNode = state.get(parentNodeId);
      if (!parentNode) {
        console.error(`Parent node with ID ${parentNodeId} not found.`);
        return state;
      }

      const newDepth = (parentNode.depth || 0) + 1;

      const newNode: ConceptNode = {
        id: newNodeId,
        title: title || `Untitled Concept ${state.size + 1}`,
        parentNodeId: parentNodeId,
        childrenNodeIds: [],
        x: undefined,
        y: undefined,
        isRoot: false,
        depth: newDepth,
      };

      const updatedParentNode = {
        ...parentNode,
        childrenNodeIds: [...(parentNode.childrenNodeIds || []), newNodeId],
      };

      const updatedNodes = new Map(state);
      updatedNodes.set(parentNodeId, updatedParentNode);
      updatedNodes.set(newNodeId, newNode);

      return updatedNodes;
    }

    case NodesActionType.UPDATE_NODE_TITLE: {
      const { nodeId, newTitle } = action.payload;
      const node = state.get(nodeId);
      if (node && node.title !== newTitle) {
        const updatedNode = { ...node, title: newTitle };
        const updatedNodes = new Map(state);
        updatedNodes.set(nodeId, updatedNode);
        return updatedNodes;
      }
      return state;
    }

    case NodesActionType.RESET_NODES:
      return initialNodesState;

    case NodesActionType.TRANSFER_NODE: {
        const { sourceNodeId, targetNodeId } = action.payload;
  
        // Ensure that the source node exists and is not the root node
        const sourceNode = state.get(sourceNodeId);
        const targetNode = state.get(targetNodeId);

  
        if (!sourceNode || !targetNode || sourceNode.isRoot) {
          console.error(`Transfer failed: Invalid source or target node, or attempting to transfer the root node.`);
          return state;
        }
          // Prevent merging a node into itself
  if (sourceNodeId === targetNodeId) {
    console.error(`Transfer failed: Cannot merge a node into itself.`);
    return state;
  }

  // Prevent merging a parent into its descendant
  const isDescendant = (nodeId: string, potentialDescendantId: string): boolean => {
    const node = state.get(nodeId);
    if (!node) return false;
    if (node.childrenNodeIds?.includes(potentialDescendantId)) {
      return true;
    }
    return node.childrenNodeIds?.some((childId) => isDescendant(childId, potentialDescendantId)) || false;
  };

  if (isDescendant(sourceNodeId, targetNodeId)) {
    console.error(`Transfer failed: Cannot merge a parent node into one of its descendants.`);
    return state;
  }

      // Prevent merging a node into its current parent**
      if (sourceNode.parentNodeId === targetNodeId) {
        console.error(
          `Transfer failed: Cannot merge a node into its current parent.`
        );
        return state;
      }
  
        const sourceParentId = sourceNode.parentNodeId;
        if (!sourceParentId) {
          console.error(`Transfer failed: Source node ${sourceNodeId} does not have a valid parent.`);
          return state;
        }
  
        const updatedState = new Map(state);
  
        // Remove the source node from its current parent's children list
        const sourceParent = updatedState.get(sourceParentId);
        if (sourceParent) {
          const updatedSourceParent = {
            ...sourceParent,
            childrenNodeIds: sourceParent.childrenNodeIds?.filter((id) => id !== sourceNodeId),
          };
          updatedState.set(sourceParentId, updatedSourceParent);
        }
        const newDepth = (targetNode?.depth || 0) + 1;
        // Update the source node's parent to the new target node
        const updatedSourceNode = {
          ...sourceNode,
          parentNodeId: targetNodeId,
          depth: newDepth,
        };
  
        // Update the target node's children list to include the source node
        const updatedTargetNode = {
          ...targetNode,
          childrenNodeIds: [...(targetNode.childrenNodeIds || []), sourceNodeId],
        };
  
        // Save the changes to the updated state
        updatedState.set(sourceNodeId, updatedSourceNode);
        updatedState.set(targetNodeId, updatedTargetNode);
  
        return updatedState;
    }

    case NodesActionType.DELETE_NODE: {
      const { nodeId } = action.payload;

      const nodeToDelete = state.get(nodeId);

      if (!nodeToDelete) {
        console.error(`Delete failed: Node with ID ${nodeId} does not exist.`);
        return state;
      }

      // **Safeguard: Prevent deletion of the root node**
      if (nodeToDelete.isRoot) {
        console.error(`Delete failed: The root node cannot be deleted.`);
        return state;
      }

      // **Check if the node is a leaf**
      const isLeaf = !nodeToDelete.childrenNodeIds || nodeToDelete.childrenNodeIds.length === 0;

      if (!isLeaf) {
        console.error(`Delete failed: Node with ID ${nodeId} is not a leaf node.`);
        return state;
      }

      const parentNodeId = nodeToDelete.parentNodeId;

      if (!parentNodeId) {
        console.error(`Delete failed: Node with ID ${nodeId} does not have a valid parent.`);
        return state;
      }

      // Create a new Map to avoid mutating the original state
      const updatedState = new Map(state);

      // Remove the node from the nodes map
      updatedState.delete(nodeId);

      // Remove the node's ID from its parent's childrenNodeIds
      const parentNode = updatedState.get(parentNodeId);
      if (parentNode) {
        const updatedParentNode = {
          ...parentNode,
          childrenNodeIds: parentNode.childrenNodeIds?.filter((id) => id !== nodeId),
        };
        updatedState.set(parentNodeId, updatedParentNode);
      }

      return updatedState;
    }

    default:
      return state;
  }
  
};
