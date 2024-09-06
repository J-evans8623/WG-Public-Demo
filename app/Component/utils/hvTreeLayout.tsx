'use client';

import { ConceptNode } from '@/app/Definitions/Definitions';
import { usePositionTracking } from '@/app/Component/context/PositionTrackingContext'; // Import the context
import { useDocumentContext } from '@/app/Component/context/DocumentProvider'
// Custom hook to calculate HV Tree Layout
export function useHVTreeLayout(nodes: ConceptNode[], rootId: string): ConceptNode[] {
  const { updatePosition, getPositionsAtDepth, resetPositions } = usePositionTracking(); // Use the context functions
  const { getLayout, setGetLayout } = useDocumentContext();

  // Reset positions before starting the layout calculation
  //resetPositions(); // Reset immediately at the beginning of the hook execution
  if (!getLayout) {
    return nodes; // Return early if no layout computation is needed
  }

  resetPositions();
  // Find the root node
  const rootNode = nodes.find((node) => node.id === rootId);
  if (!rootNode) return nodes;
  if (nodes.length <= 1) return nodes; // Only one node in the tree

  // Set initial positions for the root node
  const initialRootX = rootNode.x;
  const initialRootY = rootNode.y;

  // Define constants for the layout
  const LEVEL_HEIGHT = 250; // Vertical distance between levels
  const NODE_WIDTH = 200; // Node width
  const MIN_HORIZONTAL_SPACING = 350; // Minimum horizontal spacing between nodes

  // Initialize a local variable to accumulate all updates
  const localOccupiedPositions: { [key: number]: number[] } = {};

  // Start positioning from the root node
  positionNodesHV(
    rootNode,
    0,
    nodes,
    NODE_WIDTH,
    MIN_HORIZONTAL_SPACING,
    LEVEL_HEIGHT,
    localOccupiedPositions // Use local variable to accumulate positions
  );

  // Apply all updates to the context state at once after processing
  Object.entries(localOccupiedPositions).forEach(([depth, positions]) => {
    positions.forEach((xCoordinate) => {
      updatePosition(parseInt(depth, 10), xCoordinate);
    });
  });

  // Adjust positions to maintain initial root node position
  const offsetX = initialRootX - rootNode.x;
  const offsetY = initialRootY - rootNode.y;

  nodes.forEach((node) => {
    node.x += offsetX;
    node.y += offsetY;
  });
 
  setGetLayout(false); 
  return nodes;
}

// Function to position nodes recursively
function positionNodesHV(
  node: ConceptNode,
  depth: number,
  nodes: ConceptNode[],
  nodeWidth: number,
  minSpacing: number,
  levelHeight: number,
  localOccupiedPositions: { [key: number]: number[] } // Use local variable for positions
) {
  // Set the y position for the current node based on its depth
  node.y = depth * levelHeight; // Explicitly set y-coordinate for each depth level

  // Get the children nodes
  const children = node.childrenNodeIds
    ?.map((id) => nodes.find((n) => n.id === id))
    .filter(Boolean) as ConceptNode[];

  if (!children.length) {
    // If no children, this is a leaf node
    node.x = getNextAvailablePosition(depth, nodeWidth, localOccupiedPositions);
    // Store position locally
    if (!localOccupiedPositions[depth]) {
      localOccupiedPositions[depth] = [];
    }
    localOccupiedPositions[depth].push(node.x);
    return;
  }

  // Recursively position all children nodes
  children.forEach((child) => {
    positionNodesHV(
      child,
      depth + 1,
      nodes,
      nodeWidth,
      minSpacing,
      levelHeight,
      localOccupiedPositions
    );
  });

  // Calculate the x position for the parent node based on its children
  const leftmostChild = children[0];
  const rightmostChild = children[children.length - 1];
  const midpoint = (leftmostChild.x + rightmostChild.x) / 2;
  node.x = midpoint;

  // Ensure minimum horizontal spacing between sibling nodes
  for (let i = 1; i < children.length; i++) {
    const prevChild = children[i - 1];
    const currChild = children[i];
    const requiredSpacing = minSpacing;
    const actualSpacing = currChild.x - prevChild.x;

    if (actualSpacing < requiredSpacing) {
      const shift = requiredSpacing - actualSpacing;
      currChild.x += shift; // Move current child to the right
      // Store position locally
      if (!localOccupiedPositions[depth + 1]) {
        localOccupiedPositions[depth + 1] = [];
      }
      localOccupiedPositions[depth + 1].push(currChild.x);
    }
  }

  // Update x position of parent node based on children's positions
  const actualMidPoint = (leftmostChild.x + rightmostChild.x) / 2;
  node.x = actualMidPoint;
  // Store position locally
  if (!localOccupiedPositions[depth]) {
    localOccupiedPositions[depth] = [];
  }
  localOccupiedPositions[depth].push(node.x);
}

// Helper function to get the next available position for a node at a specific depth
function getNextAvailablePosition(
  depth: number,
  nodeWidth: number,
  localOccupiedPositions: { [key: number]: number[] }
): number {
  const occupiedPositions = localOccupiedPositions[depth] || [];
  let x = nodeWidth / 2; // Start position

  // Find the first available position
  while (occupiedPositions.includes(x)) {
    x += nodeWidth + 50; // Increment by node width + padding
  }

  return x;
}
