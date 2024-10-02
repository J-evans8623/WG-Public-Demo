// bloom-maps\app\Library\utils\hvLayout.tsx
import { SubtreeData } from '@/app/Library/Context/SubTreeProvider';

export function applyHVLayout(
  subtrees: Map<string, SubtreeData>
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();

  const verticalOffset = 225;
  const minHorizontalGap = 50;
  const padding = 50;

  //let cumulativeLeftWidth = 0;
  //let cumulativeRightWidth = 0;

  // Helper function 1: Find the center subtree
  const centerSubtree = findCenterSubtree(subtrees);

  // Helper function 2: Separate left and right subtrees (excluding the center and undefined position)
  const { leftSubtrees, rightSubtrees, undefinedPositionSubtree } = separateLeftRightSubtrees(subtrees, centerSubtree);

  // Helper function 3: Initialize cumulative widths, taking into account center subtree offset
  const { cumulativeLeftWidths, cumulativeRightWidths } = initializeCumulativeWidths(leftSubtrees, rightSubtrees, centerSubtree, padding);

  // Place the center subtree at x = 0
  if (centerSubtree) {
    positions.set(centerSubtree.nodeId, { x: 0, y: verticalOffset });
  }

  // Helper function 4: Place subtrees alternately using cumulative widths
  placeSubtreesAlternating(leftSubtrees, rightSubtrees, positions, cumulativeLeftWidths, cumulativeRightWidths, verticalOffset);

  // Helper function 5: Handle undefined position subtree, if it exists
  //placeUndefinedPositionSubtree(undefinedPositionSubtree, positions, cumulativeLeftWidth, cumulativeRightWidth, verticalOffset, subtrees, padding);
  placeUndefinedPositionSubtree(
    undefinedPositionSubtree,
    positions,
    cumulativeLeftWidths.get('_next')!,  // Get the next left position
    cumulativeRightWidths.get('_next')!,  // Get the next right position
    verticalOffset,
    subtrees,
    padding
  );
  
  return positions;
}

// Helper function to find the center subtree
function findCenterSubtree(subtrees: Map<string, SubtreeData>): { nodeId: string; subtree: SubtreeData } | null {
  let centerSubtree: { nodeId: string; subtree: SubtreeData } | null = null;
  subtrees.forEach((subtree, nodeId) => {
    if (subtree.position && subtree.position.x === 0) {
      centerSubtree = { nodeId, subtree };
    }
  });
  return centerSubtree;
}

// Helper function to separate left and right subtrees
function separateLeftRightSubtrees(subtrees: Map<string, SubtreeData>, centerSubtree: { nodeId: string; subtree: SubtreeData } | null) {
  const leftSubtrees: Array<{ nodeId: string; subtree: SubtreeData }> = [];
  const rightSubtrees: Array<{ nodeId: string; subtree: SubtreeData }> = [];
  let undefinedPositionSubtree: { nodeId: string; subtree: SubtreeData } | null = null;

  subtrees.forEach((subtree, nodeId) => {
    if (centerSubtree && subtree === centerSubtree.subtree) return;
    if (!subtree.position) {
      undefinedPositionSubtree = { nodeId, subtree };
    } else if (subtree.position.x < 0) {
      leftSubtrees.push({ nodeId, subtree });
    } else {
      rightSubtrees.push({ nodeId, subtree });
    }
  });

  // Sort left and right subtrees by their x-coordinates
  leftSubtrees.sort((a, b) => (b.subtree.position!.x - a.subtree.position!.x));
  rightSubtrees.sort((a, b) => (a.subtree.position!.x - b.subtree.position!.x));

  return { leftSubtrees, rightSubtrees, undefinedPositionSubtree };
}

// Helper function to initialize cumulative widths
// Updated initializeCumulativeWidths to return arrays
function initializeCumulativeWidths(
  leftSubtrees: Array<{ nodeId: string; subtree: SubtreeData }>,
  rightSubtrees: Array<{ nodeId: string; subtree: SubtreeData }>,
  centerSubtree: { nodeId: string; subtree: SubtreeData } | null,
  padding: number
) {
  let cumulativeLeftWidth = 0;
  let cumulativeRightWidth = centerSubtree ? centerSubtree.subtree.width + padding : 0; // Position for first right subtree

  // Using Maps to preserve nodeId as keys for the cumulative widths
  const cumulativeLeftWidths: Map<string, number> = new Map();
  const cumulativeRightWidths: Map<string, number> = new Map();

  // Calculate cumulative widths for left subtrees
  leftSubtrees.forEach(({ nodeId, subtree }) => {
    cumulativeLeftWidth -= (subtree.width + padding);
    cumulativeLeftWidths.set(nodeId, cumulativeLeftWidth);
  });

  // Add extra width for the next left subtree (L + 2)
  const lastLeftNodeId = leftSubtrees.length > 0 ? leftSubtrees[leftSubtrees.length - 1].nodeId : null;
  if (lastLeftNodeId) {
    cumulativeLeftWidth -= leftSubtrees[leftSubtrees.length - 1].subtree.width + padding;
    cumulativeLeftWidths.set("_next", cumulativeLeftWidth);
  }

  // Calculate cumulative widths for right subtrees
  rightSubtrees.forEach(({ nodeId, subtree }, index) => {
    if (index === 0) {
      // First right subtree, already calculated
      cumulativeRightWidths.set(nodeId, cumulativeRightWidth);
    } else {
      // Subsequent right subtrees
      cumulativeRightWidth += (rightSubtrees[index - 1].subtree.width + padding);
      cumulativeRightWidths.set(nodeId, cumulativeRightWidth);
    }
  });

  // Add extra width for the next right subtree (R + 2)
  const lastRightNodeId = rightSubtrees.length > 0 ? rightSubtrees[rightSubtrees.length - 1].nodeId : null;
  if (lastRightNodeId) {
    cumulativeRightWidth += rightSubtrees[rightSubtrees.length - 1].subtree.width + padding;
    cumulativeRightWidths.set("_next", cumulativeRightWidth);
  }

  return { cumulativeLeftWidths, cumulativeRightWidths };
}



// Helper function to place subtrees alternately
function placeSubtreesAlternating(
  leftSubtrees: Array<{ nodeId: string; subtree: SubtreeData }>,
  rightSubtrees: Array<{ nodeId: string; subtree: SubtreeData }>,
  positions: Map<string, { x: number; y: number }>,
  cumulativeLeftWidths: Map<string, number>,
  cumulativeRightWidths: Map<string, number>,
  verticalOffset: number
) {
  let index = 0;
  let direction = 'left';

  while (leftSubtrees.length || rightSubtrees.length) {
    if (direction === 'left' && leftSubtrees.length > 0) {
      const { nodeId, subtree } = leftSubtrees.shift()!; // Use shift to keep the order consistent
      const xPos = cumulativeLeftWidths.get(nodeId); // Get the position from the map
      if (xPos !== undefined) {
        positions.set(nodeId, { x: xPos, y: verticalOffset });
      }
    } else if (direction === 'right' && rightSubtrees.length > 0) {
      const { nodeId, subtree } = rightSubtrees.shift()!; // Use shift to keep the order consistent
      const xPos = cumulativeRightWidths.get(nodeId); // Get the position from the map
      if (xPos !== undefined) {
        positions.set(nodeId, { x: xPos, y: verticalOffset });
      }
    }

    // Alternate between left and right
    direction = direction === 'left' ? 'right' : 'left';
    index++;
  }
}


// Helper function to place the undefined position subtree
function placeUndefinedPositionSubtree(
  undefinedPositionSubtree: { nodeId: string; subtree: SubtreeData } | null,
  positions: Map<string, { x: number; y: number }>,
  cumulativeLeftWidth: number | undefined,  // Now accepting undefined
  cumulativeRightWidth: number | undefined, // Now accepting undefined
  verticalOffset: number,
  subtrees: Map<string, SubtreeData>,  // Pass the entire subtrees map for length calculation
  padding: number
) {
  if (!undefinedPositionSubtree) return;

  const totalSubtrees = subtrees.size; // Read the total number of subtrees directly from the map

  // Base case: First child (center subtree)
  if (totalSubtrees === 1) {
    // Place the first child directly below the root
    positions.set(undefinedPositionSubtree.nodeId, { x: 0, y: verticalOffset });
    return;
  }

  // Base case: No preexisting left subtree
  if (totalSubtrees % 2 === 1 && cumulativeLeftWidth === undefined) {
    cumulativeLeftWidth = -(undefinedPositionSubtree.subtree.width + padding); // Initialize to a safe left value
  }

  // Base case: No preexisting right subtree
  if (totalSubtrees % 2 === 0 && cumulativeRightWidth === undefined) {
    cumulativeRightWidth = undefinedPositionSubtree.subtree.width + padding; // Initialize to a safe right value
  }

  if (totalSubtrees % 2 === 0) {
    // Place on the right side
    positions.set(undefinedPositionSubtree.nodeId, { x: cumulativeRightWidth!, y: verticalOffset });
    cumulativeRightWidth! += (undefinedPositionSubtree.subtree.width + padding);
  } else {
    // Place on the left side
    positions.set(undefinedPositionSubtree.nodeId, { x: cumulativeLeftWidth!, y: verticalOffset });
    cumulativeLeftWidth! -= undefinedPositionSubtree.subtree.width + padding;
  }
}

