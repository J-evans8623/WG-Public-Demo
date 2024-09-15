// bloom-maps/app/Library/Component/utils/hvTreeLayout.tsx

import { ConceptNode } from '@/app/Library/Definitions/Definitions';

// Function to apply HV layout logic for nodes at depth 1 while preserving user adjustments
export function applyHVLayout(nodes: Map<string, ConceptNode>): Map<string, ConceptNode> {
    const updatedNodes = new Map(nodes);

    // Define spacing values
    const verticalOffset = 225; // Vertical space between depth levels
    const minHorizontalSpacing = 600; // Minimum horizontal space between child nodes

    // Iterate through all nodes and apply HV layout only for depth 1 nodes with undefined positions
    nodes.forEach((node) => {
        if (node.depth === 1 && (node.x === undefined || node.y === undefined)) {
            // Get parent node
            const parentNode = node.parentNodeId ? nodes.get(node.parentNodeId) : undefined;

            // Use a type guard to ensure parentNode is defined
            if (parentNode) {
                const parentY = parentNode.y ?? 0;
                const parentX = parentNode.x ?? 0;

                // Determine siblings of the current node
                const siblings = Array.from(nodes.values()).filter(n => n.depth === 1 && n.parentNodeId === node.parentNodeId);
                const nodeIndex = siblings.findIndex(n => n.id === node.id);

                // Position the first child directly below the parent
                if (nodeIndex === 0) {
                    node.x = parentX; // Directly below the parent node's x
                    node.y = parentY + verticalOffset; // Vertical offset from the parent
                } else {
                    // Calculate the position for subsequent children moving outward alternately
                    const direction = nodeIndex % 2 === 0 ? 1 : -1; // Alternate left/right
                    const distance = Math.ceil(nodeIndex / 2) * minHorizontalSpacing; // Incremental distance

                    // Determine the new x position based on direction and distance from the parent
                    node.x = parentX + direction * distance;
                    node.y = parentY + verticalOffset; // Keep y consistent for all depth 1 nodes

                    // Ensure that the node does not overlap its sibling
                    const previousSibling = siblings[nodeIndex - 1];
                    const previousSiblingX = previousSibling.x ?? 0; // Use default value if x is undefined

                    if (Math.abs(node.x - previousSiblingX) < minHorizontalSpacing) {
                        node.x = direction > 0 
                            ? previousSiblingX + minHorizontalSpacing 
                            : previousSiblingX - minHorizontalSpacing;
                    }
                }

                updatedNodes.set(node.id, node); // Update node position
            }
        }
    });

    return updatedNodes;
}
