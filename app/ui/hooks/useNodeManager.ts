// bloom-maps/ui/hooks/useNodeManager.ts

import { useState } from 'react';
import { ConceptNode, CueCard } from '@/app/Definitions/Definitions';

const useNodeManager = () => {
  const initialNode: ConceptNode = {
    id: 'node-1',
    title: 'Root Concept',
    cueCards: [],
    parentNodeId: undefined,
    childrenNodeIds: [],
  };

  const [nodes, setNodes] = useState<ConceptNode[]>([initialNode]);

  // Function to create a new node
  const createNewNode = (title: string) => {
    const newNode: ConceptNode = {
      id: `node-${nodes.length + 1}`,
      title: title || `Untitled Concept ${nodes.length + 1}`,
      cueCards: [],
      parentNodeId: undefined,
      childrenNodeIds: [],
    };
    setNodes((prevNodes) => [...prevNodes, newNode]);
  };

  // Function to add a cue card to a specific node
  const addCueCardToNode = (nodeId: string, cueCard: CueCard) => {
    setNodes((prevNodes) =>
      prevNodes.map((node) =>
        node.id === nodeId
          ? { ...node, cueCards: [...node.cueCards, cueCard] }
          : node
      )
    );
  };

  // Function to update the title of a specific node
  const updateNodeTitle = (nodeId: string, newTitle: string) => {
    setNodes((prevNodes) =>
      prevNodes.map((node) =>
        node.id === nodeId ? { ...node, title: newTitle } : node
      )
    );
  };

  return { nodes, createNewNode, addCueCardToNode, updateNodeTitle };
};

export default useNodeManager;
