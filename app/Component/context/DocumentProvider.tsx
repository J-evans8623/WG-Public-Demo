// DocumentProvider.tsx

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { CueCard, ConceptNode, DocumentContextType, ColorTheme } from '@/app/Definitions/Definitions';

// Create the context with an undefined initial value
const DocumentContext = createContext<DocumentContextType | undefined>(undefined);

export const DocumentProvider = ({ children }: { children: ReactNode }) => {
  // State to manage all concept nodes
  const [nodes, setNodes] = useState<ConceptNode[]>([
    {
      id: 'node-1',
      title: 'Root Concept',
      cueCards: [],
      parentNodeId: undefined,
      childrenNodeIds: [],
    }
  ]);

  // State to manage selected cue cards
  const [selectedCueCards, setSelectedCueCards] = useState<CueCard[]>([]);

  // State to manage Bloom Depth
  const [bloomDepth, setBloomDepth] = useState<1 | 2 | 3 | 4 | 5 | 6>(4); // Default bloom depth

  // State to manage Color Theme
  const [colorTheme, setColorTheme] = useState<ColorTheme>('cool-spring'); // Default to 'cool-spring' theme

  // Function to add a new node (receives a title)
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

  // Function to add a node directly (receives a full node object)
  const addNode = (node: ConceptNode) => {
    setNodes((prevNodes) => [...prevNodes, node]);
  };

  // Function to remove a node by ID
  const removeNode = (nodeId: string) => {
    setNodes((prevNodes) => prevNodes.filter((node) => node.id !== nodeId));
  };

  // Function to update a node by ID
  const updateNode = (nodeId: string, updatedNode: Partial<ConceptNode>) => {
    setNodes((prevNodes) =>
      prevNodes.map((node) =>
        node.id === nodeId ? { ...node, ...updatedNode } : node
      )
    );
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

  // Function to reset the document state
  const resetDocument = () => {
    setNodes([]);
    setSelectedCueCards([]);
  };

  // Function to select cue cards
  const selectCueCards = (cueCards: CueCard[]) => {
    setSelectedCueCards(cueCards);
  };

  // Function to initialize a new document
  const initializeNewDocument = (bloomDepth: 1 | 2 | 3 | 4 | 5 | 6) => {
    const newRootNode: ConceptNode = {
      id: 'node-1',
      title: 'Root Concept',
      cueCards: [],
      parentNodeId: undefined,
      childrenNodeIds: [],
    };

    setNodes([newRootNode]);
    setBloomDepth(bloomDepth); // Set the new bloom depth
  };

  return (
    <DocumentContext.Provider
      value={{
        nodes,
        selectedCueCards,
        bloomDepth,
        setBloomDepth,
        colorTheme, // Add color theme to the context
        setColorTheme, // Expose the function to set color theme
        addNode,
        removeNode,
        updateNode,
        selectCueCards,
        resetDocument,
        createNewNode,
        addCueCardToNode,
        updateNodeTitle,
        initializeNewDocument,
      }}
    >
      {children}
    </DocumentContext.Provider>
  );
};

// Custom hook to use the DocumentContext
export const useDocumentContext = () => {
  const context = useContext(DocumentContext);
  if (context === undefined) {
    throw new Error('useDocumentContext must be used within a DocumentProvider');
  }
  return context;
};
