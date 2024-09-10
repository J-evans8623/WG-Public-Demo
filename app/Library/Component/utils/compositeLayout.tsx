// bloom-maps/app/Library/Component/utils/compositeLayout.tsx

import { ConceptNode } from '@/app/Library/Definitions/Definitions';
import { applyHVLayout } from './blendedhvLayout';
import { applyIndentedLayout } from './indentedLayout';

// Function to integrate both HV and indented layouts
export function applyCompositeLayout(nodes: Map<string, ConceptNode>): Map<string, ConceptNode> {
    // Apply HV layout for depth 1 nodes
    let updatedNodes = applyHVLayout(nodes);

    // Apply indented layout for nodes beyond depth 1
    updatedNodes = applyIndentedLayout(updatedNodes);

    return updatedNodes;
}
