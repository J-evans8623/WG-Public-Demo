// bloom-maps/app/ui/hooks/useNodeManager.ts

import { useState } from 'react';
import { ConceptNode, CueCard } from '@/app/Definitions/Definitions';

const useNodeManager = () => {
  // Initial state for a root concept node
  const initialNode: ConceptNode = {
    id: 'node-1',
    title: 'Root Concept',
    cueCards: [],
    parentNodeId: undefined,
    childrenNodeIds: [],
  };

  const [nodes, setNodes] = useState<ConceptNode[]>([initialNode]); // State to manage nodes

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

  // New function to initialize a new document with a single root node
  const initializeNewDocument = (bloomDepth: 1 | 2 | 3 | 4 | 5 | 6) => {
    const newRootNode: ConceptNode = {
      id: 'node-1',
      title: 'Root Concept',
      cueCards: [],
      parentNodeId: undefined,
      childrenNodeIds: [],
    };
    
    // Reset nodes to initial state with the new root node
    setNodes([newRootNode]);

    // Additional logic to handle Bloom Depth if necessary
    // For now, this function just resets to a single root node
  };

  return {
    nodes,
    createNewNode,
    addCueCardToNode,
    updateNodeTitle,
    initializeNewDocument, // Expose the new function to initialize a new document
  };
};

export default useNodeManager;
