// bloom-maps/app/Library/Component/utils/drawTreeLines.tsx

import React from 'react';
import { ConceptNode } from '@/app/Library/Definitions/Definitions';

// Function to draw lines between nodes
export function drawTreeLines(nodes: Map<string, ConceptNode>): JSX.Element[] {
    const lines: JSX.Element[] = [];

    nodes.forEach((node) => {
        if (!node.childrenNodeIds || node.childrenNodeIds.length === 0) return;

        // Calculate Parent Bottom Center (PBC) coordinates
        const PBC_X = node.x + 100; // Center X, assuming each node is 200px wide
        const PBC_Y = node.y + 150; // Bottom center Y, assuming each node is 150px high

        node.childrenNodeIds.forEach((childId) => {
            const childNode = nodes.get(childId);
            if (!childNode) return;

            // Calculate Child Top Center (CTC) coordinates
            const CTC_X = childNode.x + 100; // Center X of the child
            const CTC_Y = childNode.y; // Top center Y of the child

            // Different line styles for different depths
            const lineStyle = node.depth === 1 ? 'solid' : 'dotted'; // Example: solid for depth 1, dotted for others

            // Draw line from parent to child
            lines.push(
                <line
                    key={`line-${node.id}-${childId}`}
                    x1={PBC_X}
                    y1={PBC_Y}
                    x2={CTC_X}
                    y2={CTC_Y}
                    stroke="black"
                    strokeWidth={2}
                    strokeDasharray={lineStyle === 'dotted' ? '5,5' : '0'}
                />
            );
        });
    });

    return lines;
}
