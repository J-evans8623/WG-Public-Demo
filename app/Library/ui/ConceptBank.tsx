// bloom-maps/app/ui/ConceptBank.tsx
import React from 'react';
import { useDocumentContext } from '@/app/Library/Context/DocumentProvider';
import ConceptNodeDisplay from './ConceptNodeDisplay';

const ConceptBank: React.FC = () => {
  const { state } = useDocumentContext(); // Fetch concept nodes from state
  const { nodes } = state; // Assuming nodes are stored in the state as a Map

  // Filter top-level nodes (nodes without a parent)
  const topLevelNodes = Array.from(nodes.values()).filter((node) => !node.parentNodeId);

  return (
    <div style={{ width: '100%', padding: '10px' }}>
      {topLevelNodes.map((node) => (
        <ConceptNodeDisplay key={node.id} node={node} />
      ))}
    </div>
  );
};

export default ConceptBank;
