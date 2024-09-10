// bloom-maps/app/Library/Component/utils/hvTreeLayout.tsx

import { ConceptNode } from '@/app/Library/Definitions/Definitions';

// Function to apply HV layout logic for nodes at depth 1
export function applyHVLayout(nodes: Map<string, ConceptNode>): Map<string, ConceptNode> {
    const updatedNodes = new Map(nodes);

    // Define spacing values
    const verticalOffset = 200; // Vertical space between depth levels
    const horizontalSpacing = 400; // Horizontal space between child nodes

    // Iterate through all nodes and apply HV layout only for depth 1 nodes
    nodes.forEach((node) => {
        if (node.depth === 1) {
            // Get parent node
            const parentNode = node.parentNodeId ? nodes.get(node.parentNodeId) : undefined;
            const parentY = parentNode ? parentNode.y : 0;
            const parentX = parentNode ? parentNode.x : 0;

            // Determine siblings of current node
            const siblings = Array.from(nodes.values()).filter(n => n.depth === 1 && n.parentNodeId === node.parentNodeId);
            const nodeIndex = siblings.findIndex(n => n.id === node.id);

            // Position the first child directly below the parent
            if (nodeIndex === 0) {
                node.x = parentX; // Directly below the parent node's x
                node.y = parentY + verticalOffset; // Vertical offset from the parent
            } else {
                // Position subsequent children with horizontal spacing outward from the first child
                const direction = nodeIndex % 2 === 0 ? 1 : -1; // Alternate left/right
                const distance = Math.ceil(nodeIndex / 2) * horizontalSpacing; // Incremental distance
                node.x = parentX + direction * distance; // Position outward from the parent's x
                node.y = parentY + verticalOffset; // Keep y consistent for all depth 1 nodes
            }

            updatedNodes.set(node.id, node); // Update node position
        }
    });

    return updatedNodes;
}
