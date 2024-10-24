// bloom-maps\app\Library\Context\NodeSelectionContext.tsx
// NodeSelectionContext.tsx
import React, { createContext, useContext, useMemo, useState } from 'react';

type NodeSelectionContextType = {
  toggleNodeSelection: (nodeId: string) => void;
  isSelected: (nodeId: string) => boolean;
  clearSelection: () => void;
  getSelectedNodeIds: () => string[];
  deselectNode: (nodeId: string) => void;
  selectNode: (nodeId: string) => void;
  targetNodeId: string | null;
  setTargetNodeId: (nodeId: string) => void;
  getTargetNodeId: () => string | null;
};

const NodeSelectionContext = createContext<NodeSelectionContextType | undefined>(undefined);

export const NodeSelectionProvider = ({ children }: { children: React.ReactNode }) => {
  const [selectedIDs, setSelectedIDs] = useState<string[]>([]);
  const [targetNodeId, setTargetNodeIdState] = useState<string | null>(null);

  const toggleNodeSelection = (nodeId: string) => {
    setSelectedIDs((prevSelected) =>
      prevSelected.includes(nodeId) ? prevSelected.filter((id) => id !== nodeId) : [...prevSelected, nodeId]
    );
  };

  const isSelected = (nodeId: string) => selectedIDs.includes(nodeId);

  const clearSelection = () => setSelectedIDs([]);

  const getSelectedNodeIds = () => selectedIDs;

  const deselectNode = (nodeId: string) => {
    setSelectedIDs((prevSelected) => prevSelected.filter((id) => id !== nodeId));
  };

  const selectNode = (nodeId: string) => {
    setSelectedIDs((prevSelected) => (prevSelected.includes(nodeId) ? prevSelected : [...prevSelected, nodeId]));
  };

  const setTargetNodeId = (nodeId: string) => {
    setTargetNodeIdState(nodeId);
  };

  const getTargetNodeId = () => targetNodeId;

  const contextValue = useMemo(
    () => ({
      toggleNodeSelection,
      isSelected,
      clearSelection,
      getSelectedNodeIds,
      deselectNode,
      selectNode,
      setTargetNodeId,
      getTargetNodeId,
      targetNodeId,
    }),
    [selectedIDs, targetNodeId]
  );

  return <NodeSelectionContext.Provider value={contextValue}>{children}</NodeSelectionContext.Provider>;
};

export const useNodeSelection = () => {
  const context = useContext(NodeSelectionContext);
  if (context === undefined) {
    throw new Error('useNodeSelection must be used within a NodeSelectionProvider');
  }
  return context;
};
