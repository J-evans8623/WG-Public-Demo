// bloom-maps/app/Library/utils/indentedLayout.tsx

import { ConceptNode } from '@/app/Library/Definitions/Definitions';
import { useTreeDimensions } from '@/app/Library/Tests/TreeDimensionsProvider';

export function applyIndentedLayout(nodes: Map<string, ConceptNode>): Map<string, ConceptNode> {
    const updatedNodes = new Map(nodes);

    const indentationWidth = 60; // Indentation width between levels
    const verticalSpacing = 175; // Vertical spacing between sibling nodes

    // Initialize max Y value
    let maxY = Number.MIN_SAFE_INTEGER;

    const positionNodeAndChildren = (node: ConceptNode, currentY: number): number => {
        if (node.depth > 1) {
            const parentNode = node.parentNodeId ? nodes.get(node.parentNodeId) : undefined;

            if (parentNode) {
                node.x = parentNode.x ? parentNode.x + indentationWidth : 0;
                node.y = currentY;
                updatedNodes.set(node.id, node);

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
        let currentY = depthOneNode.y ? depthOneNode.y + verticalSpacing : 0;
        const depthTwoNodes = depthOneNode.childrenNodeIds?.map(id => nodes.get(id)).filter(Boolean) as ConceptNode[];
        depthTwoNodes.forEach((depthTwoNode) => {
            currentY = positionNodeAndChildren(depthTwoNode, currentY);
        });
    });

    // Access the TreeDimensionsContext to update maxY value
    const { maxY: oldMaxY, setMaxY } = useTreeDimensions();

    // Update the context if new maxY is found
    if (maxY > oldMaxY) setMaxY(maxY);

    return updatedNodes;
}
