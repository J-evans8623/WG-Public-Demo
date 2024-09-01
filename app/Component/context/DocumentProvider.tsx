// DocumentContext.tsx

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { CueCard, ConceptNode, DocumentContextType, ColorTheme } from '@/app/Definitions/Definitions';

// Create the context with an undefined initial value
const DocumentContext = createContext<DocumentContextType | undefined>(undefined);

// Provider component to wrap around the parts of the app that need access to the document context
const DocumentProvider = ({ children }: { children: ReactNode }) => {
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

  // State to manage bloom depth
  const [bloomDepth, setBloomDepth] = useState<1 | 2 | 3 | 4 | 5 | 6>(4); // Default bloom depth

  // State to manage color theme
  const [colorTheme, setColorTheme] = useState<ColorTheme>('cool-spring'); // Default color theme

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
    setNodes([]); // Clear all nodes
    setSelectedCueCards([]); // Clear selected cue cards
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

    setNodes([newRootNode]); // Reset nodes to the new root node
    setSelectedCueCards([]); // Clear selected cue cards
    setBloomDepth(bloomDepth); // Set the new bloom depth
  };

  // Function to select cue cards
  const selectCueCards = (cueCards: CueCard[]) => {
    setSelectedCueCards(cueCards);
  };

  return (
    <DocumentContext.Provider
      value={{
        nodes,
        selectedCueCards,
        createNewNode,
        resetDocument,
        initializeNewDocument,
        bloomDepth,
        setBloomDepth,
        colorTheme,
        setColorTheme,
        addNode,
        removeNode,
        updateNode,
        selectCueCards,
        addCueCardToNode,
        updateNodeTitle,
        // Other context functions...
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

// Export DocumentProvider as the default export
export default DocumentProvider;
