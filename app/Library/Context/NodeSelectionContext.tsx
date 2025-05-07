// NodeSelectionContext.tsx
import React, { createContext, useContext, useMemo, useState } from 'react';

type NodeSelectionContextType = {
  toggleNodeSelection: (nodeId: string) => void;
  singleSelect: (nodeId: string) => void; 
  multiSelect: (nodeId: string, isMulti?: boolean) => void;
  groupSelect: (nodeIds: string[]) => void;
  isSelected: (nodeId: string) => boolean;
  clearSelection: () => void;
  getSelectedNodeIds: () => string[];
  deselectNode: (nodeId: string) => void;
  selectNode: (nodeId: string) => void;
  targetNodeId: string | null;
  setTargetNodeId: (nodeId: string) => void;
  getTargetNodeId: () => string | null;
  focusOnSelectedNode: () => string | null;
  getFocusNode: () => string | null;
  mergeSource: string | null;
  initiateMerge: (nodeId: string) => void;
  completeMerge: (targetNodeId: string, transfer: (sourceId: string, targetId: string) => void) => void;
  StatusMessage: string;
  setStatusMessage: (msg: string) => void;
  multiSelectEnabled: boolean;
  toggleMultiSelectEnabled: () => void;
  
};

const NodeSelectionContext = createContext<NodeSelectionContextType | undefined>(undefined);

export const NodeSelectionProvider = ({ children }: { children: React.ReactNode }) => {
  const [selectedIDs, setSelectedIDs] = useState<string[]>([]);
  const [targetNodeId, setTargetNodeIdState] = useState<string | null>(null);
  const [mergeSource, setMergeSource] = useState<string | null>(null);
  const [StatusMessage, setStatusMessage] = useState('');
  const [multiSelectEnabled, setMultiSelectEnabled] = useState<boolean>(false);

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

  const singleSelect = (nodeId: string) => {
    // Replace selection with the single node.
    setSelectedIDs([nodeId]);
  };

  const multiSelect = (nodeId: string, isMulti: boolean = false) => {
    if (isMulti || multiSelectEnabled) {
      // Toggle node in the current selection.
      setSelectedIDs((prevSelected) => {
        if (prevSelected.includes(nodeId)) {
          return prevSelected.filter((id) => id !== nodeId);
        } else {
          return [...prevSelected, nodeId];
        }
      });
    } else {
      // Not in multi-select mode: behave like singleSelect.
      setSelectedIDs([nodeId]);
    }
  };

  const setTargetNodeId = (nodeId: string) => {
    setTargetNodeIdState(nodeId);
  };

  const getTargetNodeId = () => targetNodeId;

  const focusOnSelectedNode = (): string | null => {
    if (selectedIDs.length === 0) return null;
    const lastSelectedNode = selectedIDs[selectedIDs.length - 1];
    setSelectedIDs([lastSelectedNode]);
    return lastSelectedNode;
  };

  const getFocusNode = (): string | null => {
    if (selectedIDs.length === 0) return null;
    return selectedIDs[selectedIDs.length - 1];
  };

  // --- Merge Functions (with logging) ---
  const initiateMerge = (nodeId: string) => {
    console.log("Invoking initiateMerge issue12: nodeId =", nodeId);
    setMergeSource(nodeId);
    setSelectedIDs([nodeId]);
    console.log("Leaving initiateMerge issue12: mergeSource set to", nodeId, "selectedIDs =", [nodeId]);
  };

  const completeMerge = (targetNodeId: string, transfer: (sourceId: string, targetId: string) => void) => {
    console.log("Invoking completeMerge issue12: mergeSource =", mergeSource, "targetNodeId =", targetNodeId);
    if (mergeSource && mergeSource !== targetNodeId) {
      transfer(mergeSource, targetNodeId);
      setMergeSource(null);
      setSelectedIDs([]);
    }
    console.log("Leaving completeMerge issue12: mergeSource =", mergeSource, "selectedIDs cleared");
  };

  // New method to toggle multi-select mode.
  const toggleMultiSelectEnabled = () => {
    setMultiSelectEnabled((prev) => !prev);
  };

  /**
   * Select a whole group of nodes at once.
   * @param nodeIds 
   */
  const groupSelect = (nodeIds: string[]) => {
    setSelectedIDs([...nodeIds]);
  };

  const contextValue = useMemo(
    () => ({
      toggleNodeSelection,
      isSelected,
      singleSelect,
      multiSelect,
      groupSelect,
      clearSelection,
      getSelectedNodeIds,
      deselectNode,
      selectNode,
      setTargetNodeId,
      getTargetNodeId,
      targetNodeId,
      focusOnSelectedNode,
      getFocusNode,
      mergeSource,
      initiateMerge,
      completeMerge,
      StatusMessage,
      setStatusMessage,
      multiSelectEnabled,
      toggleMultiSelectEnabled,
    }),
    [isSelected, getSelectedNodeIds, StatusMessage, multiSelectEnabled]
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
