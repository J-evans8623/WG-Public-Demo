// bloom-maps/app/Library/Context/nodesActions.ts
import { NodesActionType, NodesAction, ConceptNode } from '@/app/Library/Definitions/Definitions';

export const setNodes = (nodes: Map<string, ConceptNode>): NodesAction => ({
  type: NodesActionType.SET_NODES,
  payload: nodes,
});

export const createNewNode = (title: string, parentNodeId: string, newNodeId: string): NodesAction => ({
  type: NodesActionType.CREATE_NEW_NODE,
  payload: { newNodeId, title, parentNodeId },
});

export const updateNodeTitle = (nodeId: string, newTitle: string): NodesAction => ({
  type: NodesActionType.UPDATE_NODE_TITLE,
  payload: { nodeId, newTitle },
});

export const resetNodes = (): NodesAction => ({
  type: NodesActionType.RESET_NODES,
});

export const initNewDocument = (bloomDepth: number, mapWidth: number, mapHeight: number): NodesAction => ({
    type: NodesActionType.INIT_NEW_DOCUMENT,
    payload: { bloomDepth, mapWidth, mapHeight },
  });

  export const transferNode = (
    sourceNodeId: string,
    targetNodeId: string
  ): NodesAction => ({
    type: NodesActionType.TRANSFER_NODE,
    payload: { sourceNodeId, targetNodeId },
  });

  export const deleteNode = (nodeId: string): NodesAction => ({
    type: NodesActionType.DELETE_NODE,
    payload: { nodeId },
  });