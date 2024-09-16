// bloom-maps/app/Library/utils/indentedLayout.tsx

import { ConceptNode } from '@/app/Library/Definitions/Definitions';
import { useTreeDimensions } from '@/app/Library/Context/TreeDimensionsProvider';

export function applyIndentedLayout(nodes: Map<string, ConceptNode>): Map<string, ConceptNode> {
    const updatedNodes = new Map(nodes);

    const indentationWidth = 60; // Indentation width between levels
    const verticalSpacing = 175; // Vertical spacing between sibling nodes

    // Initialize min/max values for x and y coordinates
    let minX = Number.MAX_SAFE_INTEGER;
    let maxX = Number.MIN_SAFE_INTEGER;
    let maxY = Number.MIN_SAFE_INTEGER;

    const positionNodeAndChildren = (node: ConceptNode, currentY: number): number => {
        if (node.depth > 1) {
            const parentNode = node.parentNodeId ? nodes.get(node.parentNodeId) : undefined;

            if (parentNode) {
                node.x = parentNode.x !== undefined ? parentNode.x + indentationWidth : 0; // strict test for undefined x value, 0 is a valid number

                node.y = currentY;
                updatedNodes.set(node.id, node);

                // Update the min/max x-coordinates
                if (node.x !== undefined) {
                    minX = Math.min(minX, node.x);
                    maxX = Math.max(maxX, node.x);
                }

                // Update the max y-coordinate
                maxY = Math.max(maxY, node.y ?? 0);

                let nextY = currentY + verticalSpacing;

                const children = node.childrenNodeIds?.map(id => nodes.get(id)).filter(Boolean) as ConceptNode[];
                children.forEach((child) => {
                    nextY = positionNodeAndChildren(child, nextY);
                });

                return nextY;
            }
        }
        return currentY + verticalSpacing;
    };

    const depthOneNodes = Array.from(nodes.values()).filter((node) => node.depth === 1);
    depthOneNodes.forEach((depthOneNode) => {
        let currentY = depthOneNode.y !== undefined  ? depthOneNode.y + verticalSpacing : 0;  // strict test for undefined x value, 0 is a valid number
        const depthTwoNodes = depthOneNode.childrenNodeIds?.map(id => nodes.get(id)).filter(Boolean) as ConceptNode[];
        depthTwoNodes.forEach((depthTwoNode) => {
            currentY = positionNodeAndChildren(depthTwoNode, currentY);
        });
    });

    // Access the TreeDimensionsContext to update min/max values
    const { minX: oldMinX, maxX: oldMaxX, maxY: oldMaxY, setMinX, setMaxX, setMaxY } = useTreeDimensions();

    // Update the context if new min/max values are found
    if (minX < oldMinX) setMinX(minX);
    if (maxX > oldMaxX) setMaxX(maxX);
    if (maxY > oldMaxY) setMaxY(maxY);

    return updatedNodes;
}
