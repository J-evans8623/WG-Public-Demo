// bloom-maps/app/Library/utils/blendedhvLayout.tsx

import { ConceptNode } from '@/app/Library/Definitions/Definitions';
import { useTreeDimensions } from '@/app/Library/Context/TreeDimensionsProvider';

export function applyHVLayout(nodes: Map<string, ConceptNode>): Map<string, ConceptNode> {
    const updatedNodes = new Map(nodes);

    // Define spacing values
    const verticalOffset = 225; // Vertical space between depth levels
    const minHorizontalSpacing = 600; // Minimum horizontal space between child nodes

    // Initialize min/max values for x-coordinates
    let minX = Number.MAX_SAFE_INTEGER;
    let maxX = Number.MIN_SAFE_INTEGER;

    // Iterate through all nodes and apply HV layout only for depth 1 nodes with undefined positions
    nodes.forEach((node) => {
        if (node.depth === 1 && (node.x === undefined || node.y === undefined)) {
            // Get parent node
            const parentNode = node.parentNodeId ? nodes.get(node.parentNodeId) : undefined;

            if (parentNode) {
                const parentY = parentNode.y ?? 0;
                const parentX = parentNode.x ?? 0;

                // Determine siblings of the current node
                const siblings = Array.from(nodes.values()).filter(n => n.depth === 1 && n.parentNodeId === node.parentNodeId);
                const nodeIndex = siblings.findIndex(n => n.id === node.id);

                if (nodeIndex === 0) {
                    node.x = parentX;
                    node.y = parentY + verticalOffset;
                } else {
                    const direction = nodeIndex % 2 === 0 ? 1 : -1;
                    const distance = Math.ceil(nodeIndex / 2) * minHorizontalSpacing;

                    node.x = parentX + direction * distance;
                    node.y = parentY + verticalOffset;

                    const previousSibling = siblings[nodeIndex - 1];
                    const previousSiblingX = previousSibling.x ?? 0;

                    if (Math.abs(node.x - previousSiblingX) < minHorizontalSpacing) {
                        node.x = direction > 0 
                            ? previousSiblingX + minHorizontalSpacing 
                            : previousSiblingX - minHorizontalSpacing;
                    }
                }

                // Update the min/max x-coordinates
                if (node.x !== undefined) {
                    minX = Math.min(minX, node.x);
                    maxX = Math.max(maxX, node.x);
                }

                updatedNodes.set(node.id, node);
            }
        }
    });

    // Access the TreeDimensionsContext to update min and max values
    const { minX: oldMinX, maxX: oldMaxX, setMinX, setMaxX } = useTreeDimensions();

    // Update the context if new min/max values are found
    if (minX < oldMinX) setMinX(minX);
    if (maxX > oldMaxX) setMaxX(maxX);

    return updatedNodes;
}
