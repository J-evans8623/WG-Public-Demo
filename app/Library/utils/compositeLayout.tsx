// bloom-maps/app/Library/utils/compositeLayout.tsx

import { useEffect } from 'react';
import { ConceptNode } from '@/app/Library/Definitions/Definitions';
import { applyHVLayout } from '@/app/Library/utils/hvLayout';
import { applyIndentedLayout } from '@/app/Library/utils/indentedLayout';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { useLayoutContext } from '@/app/Library/Context/LayoutProvider';
import { setNodes } from '@/app/Library/Context/nodesActions';
import { setGetLayout } from '@/app/Library/Context/LayoutActions';
import { useSubTreeContext, SubtreeData } from '@/app/Library/Context/SubTreeProvider';

export function useCompositeLayout(
  nodes: Map<string, ConceptNode>
): Map<string, ConceptNode> {
  const { dispatch: nodesDispatch } = useNodesContext();
  const { getLayout, dispatch: layoutDispatch } = useLayoutContext();
  const { calculateSubtreeDimensions, setSubtreePosition, subtrees, setSubtrees } = useSubTreeContext();

  useEffect(() => {
    if (!getLayout) {
      return;
    }

    const updatedNodes = new Map(nodes);

    // Create a local copy of subtrees to modify
    const localSubtrees = new Map(subtrees);

    // Find the root node
    const rootNode = Array.from(updatedNodes.values()).find((node) => node.isRoot);
    if (!rootNode) {
      console.error('Root node not found.');
      return;
    }

    // Get the current depth 1 node IDs (children of the root node)
    const currentDepthOneNodeIds = new Set(rootNode.childrenNodeIds || []);

    // Remove any entries in localSubtrees that are not in currentDepthOneNodeIds
    for (const subtreeId of Array.from(localSubtrees.keys())) {
      // **Safe-guard to skip the sentinel node**
      if (subtreeId === 'sentinel-node') {
        continue; // Ignore the sentinel node, do not delete it
      }
    
      if (!currentDepthOneNodeIds.has(subtreeId)) {
        localSubtrees.delete(subtreeId);
      }
    }

    // For each depth 1 node, apply indented layout and update subtrees
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
      const {
        updatedNodes: laidOutSubtreeNodes,
        subtreeDimension,
      } = applyIndentedLayout(subtreeNodes, childId);

      // Update the positions in the main nodes map
      laidOutSubtreeNodes.forEach((node, id) => {
        updatedNodes.set(id, node);
      });

      // Create SubtreeData to access the width, height, and position of each subtree
      const existingPosition = localSubtrees.get(childId)?.position;
      const subtreeData: SubtreeData = {
        minX: subtreeDimension.minX,
        maxX: subtreeDimension.maxX,
        minY: subtreeDimension.minY,
        maxY: subtreeDimension.maxY,
        width: subtreeDimension.width,
        height: subtreeDimension.height,
        position: existingPosition ? existingPosition : undefined,
      };

      // Update or add the subtree in localSubtrees
      localSubtrees.set(childId, subtreeData);
    });

    // **Update the subtrees context with the modified localSubtrees**
    setSubtrees(localSubtrees);

    // Apply HV layout to position subtrees
    const subtreePositions = applyHVLayout(localSubtrees);

    subtreePositions.forEach((position, nodeId) => {
      setSubtreePosition(nodeId, position);

      // Update the position of the depth one node in updatedNodes
      const node = updatedNodes.get(nodeId);
      if (node) {
        node.x = 0;
        node.y = 0;
        updatedNodes.set(nodeId, node);
      }
    });

    // Update nodes in NodesContext and reset getLayout flag
    layoutDispatch(setGetLayout(false));
    nodesDispatch(setNodes(updatedNodes));

  }, [
    nodes,
    getLayout,
    nodesDispatch,
    layoutDispatch,
    calculateSubtreeDimensions,
    setSubtreePosition,
    setSubtrees, // Include setSubtrees in dependencies
    subtrees,
  ]);

  return nodes;
}
