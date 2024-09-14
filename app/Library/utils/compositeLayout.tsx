// bloom-maps/app/Library/Component/utils/compositeLayout.tsx

import { useMemo } from 'react'; // Import useMemo from React
import { ConceptNode } from '@/app/Library/Definitions/Definitions';
import { applyHVLayout } from './blendedhvLayout';
import { applyIndentedLayout } from './indentedLayout';
import { useDocumentContext, setGetLayout } from '@/app/Library/Context/DocumentProvider';

// Custom hook to integrate both HV and indented layouts with memoization
export function useCompositeLayout(nodes: Map<string, ConceptNode>): Map<string, ConceptNode> {
    // Use the new document context
    const { state, dispatch } = useDocumentContext();
    
    // Extract 'getLayout' from the state managed by the DocumentProvider
    const { getLayout } = state;

    // Memoize the layout computation
    const updatedNodes = useMemo(() => {
        if (!getLayout) {
            return nodes; // Return early if no layout computation is needed
        }

        // Apply HV layout for depth 1 nodes
        let layoutNodes = applyHVLayout(nodes);

        // Apply indented layout for nodes beyond depth 1
        layoutNodes = applyIndentedLayout(layoutNodes);

        // Reset layout flag after computation
        dispatch(setGetLayout(false));

        return layoutNodes;
    }, [nodes, getLayout, dispatch]); // Recompute only if nodes, getLayout, or dispatch change

    return updatedNodes;
}
