//bloom-maps\app\Library\components\AI\layoutUtils.ts
/**
 * This layout algorithm determines the positioon of a newly created node. It
 * can only process 1 new node at a time. The parent node postion must be defined 
 * before its child node.
 * 
 */
import { ConceptNode } from '@/app/Library/Definitions/Definitions';
import { applyHVLayout } from '@/app/Library/utils/hvLayout';
import { applyIndentedLayout } from '@/app/Library/utils/indentedLayout';
import { SubtreeData } from '@/app/Library/Context/SubTreeProvider';

interface CompositeLayoutParams {
  nodes: Map<string, ConceptNode>;
  localSubtrees: Map<string, SubtreeData>;
  setSubtrees: (subtrees: Map<string, SubtreeData>) => void;
  setNodes: (nodes: Map<string, ConceptNode>) => void;
}

export function compositeLayout({
  nodes,
  localSubtrees,
  setSubtrees,
  setNodes,
}: CompositeLayoutParams): void {
  console.log('------------------ Initial state ------------------');
  console.log('Nodes:', Array.from(nodes.entries()));
  console.log('Subtrees:', Array.from(localSubtrees.entries()));
  //const updatedNodes = new Map(nodes);

  const setSubtreePosition = (
    subtrees: Map<string, SubtreeData>,
    nodeId: string,
    position: { x: number; y: number }
  ): void => {
    const subtree = subtrees.get(nodeId);
    if (subtree) {
      subtrees.set(nodeId, { ...subtree, position });
    }
  };

  
  

  // Find the root node
  const rootNode = Array.from(nodes.values()).find((node) => node.isRoot);
  if (!rootNode) {
    console.error('Root node not found.');
    return;
  }

  // Get the current depth 1 node IDs (children of the root node)
  const currentDepthOneNodeIds = new Set(rootNode.childrenNodeIds || []);

  // Remove any entries in localSubtrees that are not in currentDepthOneNodeIds
  for (const subtreeId of Array.from(localSubtrees.keys())) {
    // Safe-guard to skip the sentinel node
    if (subtreeId === 'sentinel-node') {
      continue;
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
      const node = nodes.get(nodeId);
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
      nodes.set(id, node);
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

  // Update the subtrees context with the modified localSubtrees
  //setSubtrees(localSubtrees);

  // Apply HV layout to position subtrees
  const subtreePositions = applyHVLayout(localSubtrees);
  
  subtreePositions.forEach((position, nodeId) => {
    // Update subtree context
    setSubtreePosition(localSubtrees, nodeId, position);


    // Update the position of the depth one node in nodes
    const node = nodes.get(nodeId);
    if (node) {
      node.x = 0;
      node.y = 0;
      nodes.set(nodeId, node);
    }
  });

  console.log('------------------ Final state ------------------');
  console.log('Updated Nodes:', Array.from(nodes.entries()));
  console.log('Updated Subtrees:', Array.from(localSubtrees.entries()));

  
}