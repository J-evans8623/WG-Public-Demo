// NodeSelectionContext.tsx

import React, { createContext, useContext, useMemo, useState } from 'react';

// Define the context type
type NodeSelectionContextType = {
  toggleNodeSelection: (nodeId: string) => void;  // Function to toggle the selection of a node
  isSelected: (nodeId: string) => boolean;  // Function to check if a node is selected
  clearSelection: () => void;  // Function to clear all selections
  getSelectedNodeIds: () => string[];  // Function to retrieve all selected node IDs
};

const NodeSelectionContext = createContext<NodeSelectionContextType | undefined>(undefined);

export const NodeSelectionProvider = ({ children }: { children: React.ReactNode }) => {
  const [selectedIDs, setSelectedIDs] = useState<string[]>([]);

  // Toggle the selection status of a node
  const toggleNodeSelection = (nodeId: string) => {
    setSelectedIDs((prevSelected) =>
      prevSelected.includes(nodeId)
        ? prevSelected.filter((id) => id !== nodeId)  // Remove node if already selected
        : [...prevSelected, nodeId]  // Add node if not selected
    );
  };

  // Check if a specific node is selected
  const isSelected = (nodeId: string) => selectedIDs.includes(nodeId);

  // Clear all selected nodes
  const clearSelection = () => setSelectedIDs([]);

  // Retrieve all selected node IDs
  const getSelectedNodeIds = () => selectedIDs;

  // Memoize the context value to avoid unnecessary re-renders
  const contextValue = useMemo(
    () => ({
      toggleNodeSelection,
      isSelected,
      clearSelection,
      getSelectedNodeIds,
    }),
    [selectedIDs]  // Dependencies for memoization
  );

  return (
    <NodeSelectionContext.Provider value={contextValue}>
      {children}
    </NodeSelectionContext.Provider>
  );
};

export const useNodeSelection = () => {
  const context = useContext(NodeSelectionContext);
  if (context === undefined) {
    throw new Error('useNodeSelection must be used within a NodeSelectionProvider');
  }
  return context;
};
