import { SubtreeData } from '@/app/Library/Context/SubTreeProvider';
import { layoutConfig } from '../Definitions/Definitions';

// Main function to apply the HV layout algorithm
// File scope variables to track left and right subtree lengths
let leftSubtreeLength = 0;
let rightSubtreeLength = 0;
let nextNodeExist = false;
let newNodeWidth = layoutConfig.nodewidth;

// Main function to apply the HV layout algorithm
export function applyHVLayout(
  subtrees: Map<string, SubtreeData>
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();

  const verticalOffset = layoutConfig.HVvertspacing; // Vertical offset for each subtree
  const padding = layoutConfig.padding; // Padding between subtrees

  // Helper function 1: Find the sentinel subtree directly by its hardcoded ID
  const sentinelSubtree = findSentinelSubtree(subtrees);

  if (!sentinelSubtree) {
    throw new Error("Sentinel subtree not found. The layout cannot proceed without it.");
  }

  // Helper function 2: Separate left, right, and center subtrees (excluding sentinel and undefined position)
  const { leftSubtrees, rightSubtrees, centerSubtrees, undefinedPositionSubtree } = separateLeftRightSubtrees(subtrees, sentinelSubtree);

  // Store the lengths of left and right subtrees for later use in placeUndefinedPositionSubtree
  leftSubtreeLength = leftSubtrees.length;
  rightSubtreeLength = rightSubtrees.length;
  nextNodeExist = undefinedPositionSubtree ? true:false;

  // Helper function 3: Initialize cumulative widths
  const { cumulativeLeftWidths, cumulativeRightWidths, cumulativeCenterWidths } = initializeCumulativeWidths(leftSubtrees, rightSubtrees, centerSubtrees, sentinelSubtree, padding);
  

  // Place the sentinel subtree at x = 0
  positions.set(sentinelSubtree.nodeId, { x: 0, y: verticalOffset });

  // Helper function 4: Place center subtrees if any exist
  placeCenterSubtrees(centerSubtrees, sentinelSubtree, positions, cumulativeCenterWidths, verticalOffset);

  // Helper function 5: Place subtrees alternately using cumulative widths
  placeSubtreesAlternating(leftSubtrees, rightSubtrees, positions, cumulativeLeftWidths, cumulativeRightWidths, verticalOffset);

  // Helper function 6: Handle undefined position subtree, if it exists
  placeUndefinedPositionSubtree(
    undefinedPositionSubtree,
    positions,
    cumulativeLeftWidths.get('_next')!,
    cumulativeRightWidths.get('_next')!,
    cumulativeCenterWidths,
    verticalOffset,
    subtrees,
    padding,
    centerSubtrees,
  );

  return positions;
}

// Helper function to find the sentinel subtree directly by hardcoded ID
function findSentinelSubtree(subtrees: Map<string, SubtreeData>): { nodeId: string; subtree: SubtreeData } | null {
  const sentinelNodeId = 'sentinel-node'; // Hardcoded sentinel node ID
  const sentinelSubtree = subtrees.get(sentinelNodeId); // Directly retrieve the sentinel subtree

  if (sentinelSubtree) {
    return { nodeId: sentinelNodeId, subtree: sentinelSubtree };
  }

  return null; // Return null if the sentinel subtree is not found
}

// Helper function to separate left and right subtrees, excluding the sentinel
// Helper function to separate left, right, and center subtrees, excluding the sentinel
function separateLeftRightSubtrees(
  subtrees: Map<string, SubtreeData>,
  sentinelSubtree: { nodeId: string; subtree: SubtreeData } | null
) {
  const leftSubtrees: Array<{ nodeId: string; subtree: SubtreeData }> = [];
  const rightSubtrees: Array<{ nodeId: string; subtree: SubtreeData }> = [];
  let undefinedPositionSubtree: { nodeId: string; subtree: SubtreeData } | null = null;
  let centerSubtrees: Array<{ nodeId: string; subtree: SubtreeData }> = []; // For center node(s)

  // Filter all subtrees except the sentinel
  const allSubtrees: Array<{ nodeId: string; subtree: SubtreeData }> = Array.from(subtrees.entries())
    .filter(([nodeId, subtree]) => sentinelSubtree?.nodeId !== nodeId)
    .map(([nodeId, subtree]) => ({ nodeId, subtree }));

  // Identify and store the undefined position subtree
  allSubtrees.forEach(({ nodeId, subtree }) => {
    if (!subtree.position) {
      undefinedPositionSubtree = { nodeId, subtree };
    }
  });

  // Filter out the undefined position subtree for further sorting and categorization
  const definedPositionSubtrees = allSubtrees
  .filter(({ subtree }) => subtree.position)
  .sort((a, b) => a.subtree.position!.x - b.subtree.position!.x);

  // Determine center subtrees based on adjusted length
  if (definedPositionSubtrees.length % 2 === 1 && definedPositionSubtrees.length > 0) {
    // Odd number of subtrees: Assign the middle subtree as center
    const middleIndex = Math.floor(definedPositionSubtrees.length / 2);
    centerSubtrees.push(definedPositionSubtrees[middleIndex]);
    definedPositionSubtrees.splice(middleIndex, 1); // Remove the center subtree from further consideration
  } else if (definedPositionSubtrees.length % 2 === 0 && definedPositionSubtrees.length > 0) {
    // Even number of subtrees: Assign the two middle subtrees as centers
    const middleLeftIndex = Math.floor(definedPositionSubtrees.length / 2) - 1;
    const middleRightIndex = middleLeftIndex + 1;

    centerSubtrees.push(definedPositionSubtrees[middleLeftIndex], definedPositionSubtrees[middleRightIndex]);
    definedPositionSubtrees.splice(middleRightIndex, 1); // Remove middle subtrees from the list
    definedPositionSubtrees.splice(middleLeftIndex, 1);
  }

  // Now categorize the remaining subtrees as left or right
  definedPositionSubtrees.forEach(({ nodeId, subtree }) => {
    if (subtree.position!.x < sentinelSubtree!.subtree.position!.x) {
      leftSubtrees.push({ nodeId, subtree });
    } else {
      rightSubtrees.push({ nodeId, subtree });
    }
  });
  
  // Sort leftSubtrees in descending order of position.x (farthest to closest to the sentinel)
  leftSubtrees.sort((a, b) => b.subtree.position!.x - a.subtree.position!.x);
  
  // Sort rightSubtrees in ascending order of position.x (closest to farthest from the sentinel)
  rightSubtrees.sort((a, b) => a.subtree.position!.x - b.subtree.position!.x);
  

  return { leftSubtrees, rightSubtrees, centerSubtrees, undefinedPositionSubtree };
}

function initializeCumulativeWidths(
  leftSubtrees: Array<{ nodeId: string; subtree: SubtreeData }>,
  rightSubtrees: Array<{ nodeId: string; subtree: SubtreeData }>,
  centerSubtrees: Array<{ nodeId: string; subtree: SubtreeData }>, // Center subtrees now included
  sentinelSubtree: { nodeId: string; subtree: SubtreeData } | null,
  padding: number
) {
  // Default values initialization for left, right, and center subtrees

  const cumulativeLeftWidths: Map<string, number> = new Map();
  const cumulativeRightWidths: Map<string, number> = new Map();
  const cumulativeCenterWidths: Map<string, number> = new Map(); // Added for center subtree(s)

  // **Case A: No left, right, or center subtrees** -> Initialize all widths to sentinel position
  if (centerSubtrees.length === 0) {
    const sentinelX = sentinelSubtree?.subtree.position?.x ?? 0;
    cumulativeLeftWidths.set('_next', sentinelX);
    cumulativeRightWidths.set('_next', sentinelX);
    cumulativeCenterWidths.set('_nextLeft', sentinelX);
    cumulativeCenterWidths.set('_nextRight', sentinelX);
    return { cumulativeLeftWidths, cumulativeRightWidths, cumulativeCenterWidths };
  }
  
 
    // **Case A: Single center subtree exists (C -> CC transition)**
    if (centerSubtrees.length === 1) {
      
      const singleCenter = centerSubtrees[0];
      const sentinelX = sentinelSubtree?.subtree.position?.x ?? 0;
      if (nextNodeExist) {

  
      // Check if the center subtree exists
      if (singleCenter?.nodeId) {
        const spacing = layoutConfig.padding /2; // Symmetrical spacing for a future second center subtree
        const newNodeWidth = layoutConfig.nodewidth; // Fixed width for a new node
  
        // Offset the single center subtree from the sentinel, preparing for the second one
        const centerX = sentinelX - ((singleCenter.subtree.width/2) + spacing);
        cumulativeCenterWidths.set(singleCenter.nodeId, centerX); // Assign calculated position for center subtree
  
        // Set the next available right-side position for the new node to be placed at the sentinel position
        cumulativeCenterWidths.set('_nextRight', sentinelX + (newNodeWidth /2)  + spacing);
  
        let leftCumulativeX = cumulativeCenterWidths.get(singleCenter.nodeId)! - padding;
        leftSubtrees.forEach(({ nodeId, subtree }) => {
          cumulativeLeftWidths.set(nodeId, leftCumulativeX - subtree.width );
          leftCumulativeX =  cumulativeLeftWidths.get(nodeId)! - padding; // Update cumulative x for the next left subtree
        });   
  
        // Handle right subtrees: Start from the next available right position and move outward
        let rightCumulativeX = cumulativeCenterWidths.get('_nextRight')! + padding + newNodeWidth;
        rightSubtrees.forEach(({ nodeId, subtree }) => {
          cumulativeRightWidths.set(nodeId, rightCumulativeX );
          rightCumulativeX = cumulativeRightWidths.get(nodeId)! + padding + + subtree.width; // Update cumulative x for the next right subtree
        });
      }
    } else {
      // Case 2: No new node added, maintain the current position of the single center subtree
      if (singleCenter?.nodeId) {
        // Set the center subtree's position to the sentinel's x position
        cumulativeCenterWidths.set(singleCenter.nodeId, sentinelX);
        let leftCumulativeX = sentinelX - padding ;
  
          
           leftSubtrees.forEach(({ nodeId, subtree }) => {
          let distance = leftCumulativeX - subtree.width//  computeDepthDifference
          cumulativeLeftWidths.set(nodeId, distance );
          leftCumulativeX = cumulativeLeftWidths.get(nodeId)! - padding; // Update cumulative x for the next left subtree
        });
  
        // Handle right subtrees: Start from the position of the single center node and move outward
        let rightCumulativeX = sentinelX + singleCenter.subtree.width  + padding;
        rightSubtrees.forEach(({ nodeId, subtree }) => {
          cumulativeRightWidths.set(nodeId, rightCumulativeX );
          rightCumulativeX = cumulativeRightWidths.get(nodeId)! + padding + subtree.width;  // Update cumulative x for the next right subtree
        });
      }
    }
      // No need to set default values for cumulativeLeftWidths and cumulativeRightWidths here
      // as the loop will handle them based on the center position.
    } else if (centerSubtrees.length === 2){

  // (leftSubtrees.length === 0 && rightSubtrees.length === 0 && centerSubtrees.length === 2)
  // **Case C: No left or right subtrees, but two center subtrees**

  const leftCenter = centerSubtrees[0];
  const rightCenter = centerSubtrees[1];
  const sentinelX = sentinelSubtree?.subtree.position?.x ?? 0;
  
  // Check if a new node exists or not
  if (nextNodeExist) {
    // Case 2: A new node will be added, shift the current center nodes outward
    if (leftCenter?.nodeId && rightCenter?.nodeId) {
      const requiredShift = newNodeWidth / 2 + padding; // Shift required to avoid overlap

      // Shift left and right center nodes to make space for the new node at the sentinel position
      cumulativeCenterWidths.set(leftCenter.nodeId, sentinelX - requiredShift - leftCenter.subtree.width / 2);
      cumulativeCenterWidths.set(rightCenter.nodeId, sentinelX + requiredShift + rightCenter.subtree.width / 2);// excessive spacing

  } 
      }

      else {
    
        // Case 2: No new node, just balance the existing center subtrees
        if (leftCenter?.nodeId && rightCenter?.nodeId) {
          const spacing = layoutConfig.padding/2; // Spacing between the two center nodes
          cumulativeCenterWidths.set(leftCenter.nodeId, -(leftCenter.subtree.width / 2 + spacing));
          cumulativeCenterWidths.set(rightCenter.nodeId, rightCenter.subtree.width / 2 + spacing); //excessive spacing
        }
      }
            // Handle left subtrees: Start from the position of the left center node and move outward
            let leftCumulativeX = cumulativeCenterWidths.get(leftCenter.nodeId)! - padding;
            leftSubtrees.forEach(({ nodeId, subtree }) => {
              cumulativeLeftWidths.set(nodeId, leftCumulativeX - subtree.width);
              leftCumulativeX = cumulativeLeftWidths.get(nodeId)! - padding; // Update cumulative x for the next left subtree
            });
      
            // Handle right subtrees: Start from the position of the right center node and move outward
            let rightCumulativeX = cumulativeCenterWidths.get(rightCenter.nodeId)! + rightCenter.subtree.width + padding;
            rightSubtrees.forEach(({ nodeId, subtree }) => {
              cumulativeRightWidths.set(nodeId, rightCumulativeX );
              rightCumulativeX = cumulativeRightWidths.get(nodeId)! + padding + subtree.width; // Update cumulative x for the next right subtree
            });
}
  return { cumulativeLeftWidths, cumulativeRightWidths, cumulativeCenterWidths };
}


// Helper function to place subtrees alternately on left and right sides
function placeSubtreesAlternating(
  leftSubtrees: Array<{ nodeId: string; subtree: SubtreeData }>,
  rightSubtrees: Array<{ nodeId: string; subtree: SubtreeData }>,
  positions: Map<string, { x: number; y: number }>,
  cumulativeLeftWidths: Map<string, number>,
  cumulativeRightWidths: Map<string, number>,
  verticalOffset: number
) {
  let direction = 'left';

  while (leftSubtrees.length || rightSubtrees.length) {
    if (direction === 'left' && leftSubtrees.length > 0) {
      const { nodeId } = leftSubtrees.shift()!;
      const xPos = cumulativeLeftWidths.get(nodeId);
      if (xPos !== undefined) {
        positions.set(nodeId, { x: xPos, y: verticalOffset });
      }
    } else if (direction === 'right' && rightSubtrees.length > 0) {
      const { nodeId } = rightSubtrees.shift()!;
      const xPos = cumulativeRightWidths.get(nodeId);
      if (xPos !== undefined) {
        positions.set(nodeId, { x: xPos, y: verticalOffset });
      }
    }

    // Alternate between left and right placement
    direction = direction === 'left' ? 'right' : 'left';
  }
}


// Helper function to place the center subtrees (one or two) at or near the sentinel's position
// Helper function to place the center subtrees (one or two) at or near the sentinel's position
function placeCenterSubtrees(
  centerSubtrees: Array<{ nodeId: string; subtree: SubtreeData }>,
  sentinelSubtree: { nodeId: string; subtree: SubtreeData },
  positions: Map<string, { x: number; y: number }>,
  cumulativeCenterWidths: Map<string, number>, // Use cumulative center widths
  verticalOffset: number
) {
  // Check if the center subtrees array exists and has valid content
  if (centerSubtrees.length === 1) {
    const leftCenter = centerSubtrees[0];

    // Ensure the leftCenter has the necessary properties before setting position
    if (leftCenter && leftCenter.nodeId) {
      // One center subtree: place it at the precomputed cumulative center width position
      const xPos = cumulativeCenterWidths.get(leftCenter.nodeId) ?? sentinelSubtree.subtree.position!.x;
      positions.set(leftCenter.nodeId, { x: xPos, y: verticalOffset });
    }
  } else if (centerSubtrees.length === 2) {
    const leftCenter = centerSubtrees[0];
    const rightCenter = centerSubtrees[1];

    // Ensure both center subtrees have the necessary properties before setting their positions
    if (leftCenter && leftCenter.nodeId && rightCenter && rightCenter.nodeId) {
      // Use cumulative center widths to position center subtrees, ensuring proper spacing
      const leftCenterX = cumulativeCenterWidths.get(leftCenter.nodeId) ?? sentinelSubtree.subtree.position!.x - (layoutConfig.padding / 2);
      const rightCenterX = cumulativeCenterWidths.get(rightCenter.nodeId) ?? sentinelSubtree.subtree.position!.x + (layoutConfig.padding / 2);

      // Set the positions of the left and right center subtrees
      positions.set(leftCenter.nodeId, { x: leftCenterX, y: verticalOffset });
      positions.set(rightCenter.nodeId, { x: rightCenterX, y: verticalOffset });
    }
  }
}


// Helper function to place the undefined subtree (newly added node)
function placeUndefinedPositionSubtree(
  undefinedPositionSubtree: { nodeId: string; subtree: SubtreeData } | null,
  positions: Map<string, { x: number; y: number }>,
  cumulativeLeftWidth: number | undefined,
  cumulativeRightWidth: number | undefined,
  cumulativeCenterWidths: Map<string, number> | undefined, // Ensure this map is properly initialized
  verticalOffset: number,
  subtrees: Map<string, SubtreeData>,
  padding: number,
  centerSubtrees: Array<{ nodeId: string; subtree: SubtreeData }> // Handle center subtrees
) {
  if (!undefinedPositionSubtree) return;

  const totalWithUndefined = subtrees.size - 1;; // Account for the undefined subtree

  // **Base Case A**: First child, place directly at the sentinel position (x = 0)
  if (totalWithUndefined === 1) {
    positions.set(undefinedPositionSubtree.nodeId, { x: 0, y: verticalOffset });
    return;
  }

  // **Base Case B**: One center subtree and undefined position (OX)
  if (centerSubtrees.length === 1 ) { // && totalWithUndefined === 2)
    // Ensure cumulativeCenterWidths is valid and contains the center subtree's nodeId
    if (cumulativeCenterWidths && cumulativeCenterWidths.has('_nextRight')) {
      const rightCenterX = cumulativeCenterWidths.get('_nextRight') ?? 0;
      positions.set(undefinedPositionSubtree.nodeId, { x: rightCenterX, y: verticalOffset });
    } else {
      console.error("Center subtree cumulative width is not properly defined.");
      positions.set(undefinedPositionSubtree.nodeId, { x: padding, y: verticalOffset }); // Fallback if widths not defined
    }
    return;
  }
  // Generalized Case B: Two center subtrees and L/R subtrees
  if (centerSubtrees.length === 2) {
    positions.set(undefinedPositionSubtree.nodeId, { x: 0, y: verticalOffset });
    return;
  }

}

