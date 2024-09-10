// bloom-maps/app/Library/Component/utils/compositeLayout.tsx

import { ConceptNode } from '@/app/Library/Definitions/Definitions';
import { applyHVLayout } from './blendedhvLayout';
import { applyIndentedLayout } from './indentedLayout';
import { useDocumentContext } from '@/app/Library/Context/DocumentProvider';

// Custom hook to integrate both HV and indented layouts
export function useCompositeLayout(nodes: Map<string, ConceptNode>): Map<string, ConceptNode> {
    const { getLayout, setGetLayout } = useDocumentContext(); // Use the context functions

    // Reset positions before starting the layout calculation
    if (!getLayout) {
        return nodes; // Return early if no layout computation is needed
    }

    // Apply HV layout for depth 1 nodes
    let updatedNodes = applyHVLayout(nodes);

    // Apply indented layout for nodes beyond depth 1
    updatedNodes = applyIndentedLayout(updatedNodes);

    setGetLayout(false); // Reset layout flag after computation
    return updatedNodes;
}
