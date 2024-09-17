// bloom-maps/app/Library/utils/blendedhvLayout.tsx

import { ConceptNode } from '@/app/Library/Definitions/Definitions';
import { useTreeDimensions } from '@/app/Library/Context/TreeDimensionsProvider';

export function applyHVLayout(nodes: Map<string, ConceptNode>): Map<string, ConceptNode> {
    const updatedNodes = new Map(nodes);

    // Define spacing values
    const verticalOffset = 225; // Vertical space between depth levels
    let indentedWidth = 60; // Local variable for indentation width
    let nodeWidth = 325 * 1.5; // Width of a node times off set multiplier

    // Access the TreeDimensionsContext to get current values and setter functions
    const {
        treeMaxDepth,
        currentHorizontalSpacing,
        setCurrentHorizontalSpacing,
        minX: oldMinX,
        maxX: oldMaxX,
        setMinX,
        setMaxX,
    } = useTreeDimensions();

    // Calculate if resizing is needed
    const needWidthResize = (treeMaxDepth - 1) >= Math.floor((currentHorizontalSpacing - nodeWidth) / indentedWidth);

    if (needWidthResize) {
        // If resizing is needed, update the horizontal spacing
        setCurrentHorizontalSpacing(currentHorizontalSpacing + 240); // Sufficient space for four more indents
    }

    // Initialize min/max values for x-coordinates
    let minX = Number.MAX_SAFE_INTEGER;
    let maxX = Number.MIN_SAFE_INTEGER;

    // Iterate through all nodes and apply HV layout only for depth 1 nodes
    nodes.forEach((node) => {
        if (node.depth === 1 && needWidthResize) {
            // Apply HV layout for all depth 1 nodes with new spacing
            const parentNode = node.parentNodeId ? nodes.get(node.parentNodeId) : undefined;

            if (parentNode) {
                const parentY = parentNode.y ?? 0;
                const parentX = parentNode.x ?? 0;

                const siblings = Array.from(nodes.values()).filter(n => n.depth === 1 && n.parentNodeId === node.parentNodeId);
                const nodeIndex = siblings.findIndex(n => n.id === node.id);

                if (nodeIndex === 0) {
                    node.x = parentX;
                    node.y = parentY + verticalOffset;
                } else {
                    const direction = nodeIndex % 2 === 0 ? 1 : -1;
                    const distance = Math.ceil(nodeIndex / 2) * currentHorizontalSpacing;

                    node.x = parentX + direction * distance;
                    node.y = parentY + verticalOffset;

                    const previousSibling = siblings[nodeIndex - 1];
                    const previousSiblingX = previousSibling.x ?? 0;

                    if (Math.abs(node.x - previousSiblingX) < currentHorizontalSpacing) {
                        node.x = direction > 0 
                            ? previousSiblingX + currentHorizontalSpacing 
                            : previousSiblingX - currentHorizontalSpacing;
                    }
                }

                // Update min/max x-coordinates
                if (node.x !== undefined) {
                    minX = Math.min(minX, node.x);
                    maxX = Math.max(maxX, node.x);
                }

                updatedNodes.set(node.id, node);
            }
        } else if (node.depth === 1 && (node.x === undefined || node.y === undefined)) {
            // Existing logic for applying layout to undefined positions
            const parentNode = node.parentNodeId ? nodes.get(node.parentNodeId) : undefined;

            if (parentNode) {
                const parentY = parentNode.y ?? 0;
                const parentX = parentNode.x ?? 0;

                const siblings = Array.from(nodes.values()).filter(n => n.depth === 1 && n.parentNodeId === node.parentNodeId);
                const nodeIndex = siblings.findIndex(n => n.id === node.id);

                if (nodeIndex === 0) {
                    node.x = parentX;
                    node.y = parentY + verticalOffset;
                } else {
                    const direction = nodeIndex % 2 === 0 ? 1 : -1;
                    const distance = Math.ceil(nodeIndex / 2) * currentHorizontalSpacing;

                    node.x = parentX + direction * distance;
                    node.y = parentY + verticalOffset;

                    const previousSibling = siblings[nodeIndex - 1];
                    const previousSiblingX = previousSibling.x ?? 0;

                    if (Math.abs(node.x - previousSiblingX) < currentHorizontalSpacing) {
                        node.x = direction > 0 
                            ? previousSiblingX + currentHorizontalSpacing 
                            : previousSiblingX - currentHorizontalSpacing;
                    }
                }

                // Update min/max x-coordinates
                if (node.x !== undefined) {
                    minX = Math.min(minX, node.x);
                    maxX = Math.max(maxX, node.x);
                }

                updatedNodes.set(node.id, node);
            }
        }
    });

    // Update context values if new min/max values are found
    if (minX < oldMinX) setMinX(minX);
    if (maxX > oldMaxX) setMaxX(maxX);

    return updatedNodes;
}
