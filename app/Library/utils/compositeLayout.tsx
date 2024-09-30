import { useEffect } from 'react';
import { ConceptNode } from '@/app/Library/Definitions/Definitions';
import { applyHVLayout } from '../utils/hvLayout';
import { applyIndentedLayout } from './indentedLayout';
import { useDocumentContext, setGetLayout, setNodes } from '@/app/Library/Context/DocumentProvider';
import { useSubTreeContext, SubtreeData } from '@/app/Library/Context/SubTreeProvider';

export function useCompositeLayout(
  nodes: Map<string, ConceptNode>
): Map<string, ConceptNode> {
  const { state, dispatch } = useDocumentContext();
  const { getLayout } = state;
  const { calculateSubtreeDimensions, setSubtreePosition } = useSubTreeContext();

  useEffect(() => {
    if (!getLayout) {
      return;
    }

    const updatedNodes = new Map(nodes);
    const localSubtrees = new Map<string, SubtreeData>();

    const rootNode = Array.from(updatedNodes.values()).find((node) => node.isRoot);
    if (!rootNode) {
      console.error('Root node not found.');
      return;
    }

    rootNode.childrenNodeIds?.forEach((childId) => {
      // Extract nodes belonging to the subtree
      const subtreeNodes = new Map<string, ConceptNode>();
      const extractSubtree = (nodeId: string) => {
        const node = updatedNodes.get(nodeId);
        if (node) {
          subtreeNodes.set(nodeId, node);
          node.childrenNodeIds?.forEach((childId) => extractSubtree(childId));
        }
      };
      extractSubtree(childId);

      // Apply indented layout
      const { updatedNodes: laidOutSubtreeNodes, subtreeDimension } = applyIndentedLayout(
        subtreeNodes,
        childId
      );

      // Update the positions in the main nodes map
      laidOutSubtreeNodes.forEach((node, id) => {
        updatedNodes.set(id, node);
      });

      // Create SubtreeData
      const subtreeData: SubtreeData = {
        minX: subtreeDimension.minX,
        maxX: subtreeDimension.maxX,
        minY: subtreeDimension.minY,
        maxY: subtreeDimension.maxY,
        width: subtreeDimension.width,
        height: subtreeDimension.height,
        position: { x: 0, y: 0 }, // Will be updated
      };

      localSubtrees.set(childId, subtreeData);

      // Update subtree dimensions in SubTreeProvider
      calculateSubtreeDimensions(childId, subtreeData);
    });

    // Step 2: Apply HV layout to position subtrees
    const subtreePositions = applyHVLayout(localSubtrees);

    subtreePositions.forEach((position, nodeId) => {
      setSubtreePosition(nodeId, position);

      // Update the position of the depth one node in updatedNodes
      const node = updatedNodes.get(nodeId);
      if (node) {
        node.x = 0;//position.x;
        node.y = 0; //position.y;
        updatedNodes.set(nodeId, node);
      }
    });

    // Update nodes in DocumentContext
    dispatch(setNodes(updatedNodes));
    dispatch(setGetLayout(false));

  }, [nodes, getLayout, dispatch, calculateSubtreeDimensions, setSubtreePosition]);

  return nodes;
}
/**
 * Original
 * 
 */