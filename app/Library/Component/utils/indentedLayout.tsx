// bloom-maps/app/Library/Component/utils/indentedLayout.tsx

import { ConceptNode } from '@/app/Library/Definitions/Definitions';

// Function to apply indented layout logic for nodes beyond depth 1 using a refined depth-first approach
export function applyIndentedLayout(nodes: Map<string, ConceptNode>): Map<string, ConceptNode> {
    const updatedNodes = new Map(nodes);

    // Define spacing values
    const indentationWidth = 50; // Indentation width between levels
    const verticalSpacing = 225; // Vertical spacing between sibling nodes

    // Recursive function to position nodes using depth-first traversal
    const positionNodeAndChildren = (node: ConceptNode, currentY: number): number => {
        if (node.depth > 1) {
            // Get the parent node to determine indentation
            const parentNode = node.parentNodeId ? nodes.get(node.parentNodeId) : undefined;

            if (parentNode) {
                // Set the x position based on the parent's x position and indentation
                node.x = parentNode.x + indentationWidth;

                // Assign the current node's y position, ensuring it's below the parent
                node.y = currentY; 
                updatedNodes.set(node.id, node); // Update node position

                // Start positioning children from this y-coordinate
                let nextY = currentY + verticalSpacing;
                
                // Recursively position children nodes
                const children = node.childrenNodeIds?.map(id => nodes.get(id)).filter(Boolean) as ConceptNode[];
                children.forEach((child) => {
                    nextY = positionNodeAndChildren(child, nextY); // Depth-first recursion for children
                });

                // Return the y-coordinate after all children have been placed
                return nextY;
            }
        }

        // If no parent or children, just return the current y position incremented
        return currentY + verticalSpacing;
    };

    // Find all nodes at depth 2 (children of root) and apply depth-first positioning
    const depthTwoNodes = Array.from(nodes.values()).filter((node) => node.depth === 2);
    let currentY = 0; // Start y-coordinate

    depthTwoNodes.forEach((node) => {
        const parentNode = node.parentNodeId ? nodes.get(node.parentNodeId) : undefined;
        const startY = parentNode ? parentNode.y + verticalSpacing : currentY; // Start below the parent node or from current Y
        currentY = positionNodeAndChildren(node, startY); // Update the current Y after placing each depth 2 node
    });

    return updatedNodes;
}
