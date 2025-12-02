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
  dismissResource: (nodeId: string, resourceId: string) => void;
  clearDismissedForNode: (nodeId: string) => void;
  isResourceDismissed: (nodeId: string, resourceId: string) => boolean;
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
    editingUiFocusOnly: boolean;          
  setEditingUiFocusOnly: (on: boolean) => void; 
  setCaretNode: (nodeId: string) => void; 
};

const NodeSelectionContext = createContext<NodeSelectionContextType | undefined>(undefined);

export const NodeSelectionProvider = ({ children }: { children: React.ReactNode }) => {
  const [selectedIDs, setSelectedIDs] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState<Record<string, Set<string>>>({});
  const [targetNodeId, setTargetNodeIdState] = useState<string | null>(null);
  const [mergeSource, setMergeSource] = useState<string | null>(null);
  const [StatusMessage, setStatusMessage] = useState('');
  const [multiSelectEnabled, setMultiSelectEnabled] = useState<boolean>(true);
  const [editingUiFocusOnly, setEditingUiFocusOnly] = useState<boolean>(false);

  const dismissResource = (nodeId: string, resourceId: string) => {
    setDismissed(prev => {
      const next = { ...prev };
      const setForNode = new Set(next[nodeId] ?? []);
      setForNode.add(resourceId);
      next[nodeId] = setForNode;
      return next;
    });
  };

  const clearDismissedForNode = (nodeId: string) => {
    setDismissed(prev => {
      if (!prev[nodeId]) return prev;
      const next = { ...prev };
      delete next[nodeId];
      return next;
    });
  };

  const isResourceDismissed = (nodeId: string, resourceId: string) =>
    Boolean(dismissed[nodeId]?.has(resourceId));



 /**
 * toggleNodeSelection
 * @purpose Toggle a node in the selection. If adding, flush its dismissed set
 *          so resources reappear; if removing, also clear for symmetry.
 * @steps
 *  1) If node currently selected → clear dismissed for it and remove.
 *  2) If node not selected       → clear dismissed for it and add.
 */
const toggleNodeSelection = (nodeId: string) => { // update - 8
  setSelectedIDs(prev =>
    prev.includes(nodeId)
      ? (() => { clearDismissedForNode(nodeId); return prev.filter(id => id !== nodeId); })() // (1)
      : (() => { clearDismissedForNode(nodeId); return [...prev, nodeId]; })()                 // (2)
  );
};

  const isSelected = (nodeId: string) => selectedIDs.includes(nodeId);
  const clearSelection = () => {
    // reset all dismissed entries in one step
    setDismissed({});
    setSelectedIDs([]);
  };
  
  const getSelectedNodeIds = () => selectedIDs;
  const deselectNode = (nodeId: string) => {
    clearDismissedForNode(nodeId);
    setSelectedIDs(prev => prev.filter(id => id !== nodeId));
  };
  /**
 * selectNode
 * @purpose Add a node to the current selection. On add, flush any dismissed
 *          resources for that node so its full resource list is visible.
 * @steps
 *  1) If already selected, no-op.
 *  2) If not selected, clearDismissedForNode(nodeId).
 *  3) Append nodeId to selection.
 */
const selectNode = (nodeId: string) => { // update - 4
  setSelectedIDs((prevSelected) => {
    if (prevSelected.includes(nodeId)) return prevSelected;         // (1)
    clearDismissedForNode(nodeId);                                  // (2)
    return [...prevSelected, nodeId];                               // (3)
  });
};

 /**
 * singleSelect
 * @purpose Select only the given nodeId. Clear dismissed for deselected nodes
 *          AND for the node we are selecting so it fully resets.
 * @steps
 *  1) Clear dismissed for any nodes being removed from selection.
 *  2) Clear dismissed for the node we are selecting.
 *  3) Replace selection with [nodeId].
 */
const singleSelect = (nodeId: string) => { // update - 5
  // (1) clear dismissed for nodes being deselected
  selectedIDs.forEach(id => { if (id !== nodeId) clearDismissedForNode(id); });
  // (2) clear dismissed for the node being selected
  clearDismissedForNode(nodeId);
  // (3) select only this node
  setSelectedIDs([nodeId]);
};

  /**
 * multiSelect
 * @purpose Toggle/add a node into the multi-selection. When adding a node,
 *          flush its dismissed set so its resources appear immediately.
 * @steps
 *  A) Multi-select enabled/forced:
 *     a. If removing: clear dismissed for that node and remove it.
 *     b. If adding:   clear dismissed for that node and add it.
 *  B) Single-select fallback: clear for deselected others + for the target,
 *     then select only the target.
 */
const multiSelect = (nodeId: string, isMulti: boolean = false) => { // update - 6
  if (isMulti || multiSelectEnabled) {
    setSelectedIDs(prev =>
      prev.includes(nodeId)
        // remove case
        ? (() => { clearDismissedForNode(nodeId); return prev.filter(id => id !== nodeId); })()
        // add case → flush dismissed then add
        : (() => { clearDismissedForNode(nodeId); return [...prev, nodeId]; })()
    );
  } else {
    // single-select fallback
    selectedIDs.forEach(id => { if (id !== nodeId) clearDismissedForNode(id); });
    clearDismissedForNode(nodeId);
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
    // console.log("Invoking initiateMerge issue12: nodeId =", nodeId);
    setMergeSource(nodeId);
    setSelectedIDs([nodeId]);
    // console.log("Leaving initiateMerge issue12: mergeSource set to", nodeId, "selectedIDs =", [nodeId]);
  };

  const completeMerge = (targetNodeId: string, transfer: (sourceId: string, targetId: string) => void) => {
    // console.log("Invoking completeMerge issue12: mergeSource =", mergeSource, "targetNodeId =", targetNodeId);
    if (mergeSource && mergeSource !== targetNodeId) {
      transfer(mergeSource, targetNodeId);
      setMergeSource(null);
      setSelectedIDs([]);
    }
    // console.log("Leaving completeMerge issue12: mergeSource =", mergeSource, "selectedIDs cleared");
  };

  // New method to toggle multi-select mode.
  const toggleMultiSelectEnabled = () => {
    setMultiSelectEnabled((prev) => !prev);
  };

 /**
 * groupSelect
 * @purpose Select a batch of nodes at once. Flush dismissed for nodes that
 *          will remain or become selected; also clear for those leaving selection.
 * @steps
 *  1) For nodes leaving selection, clear their dismissed sets (existing behavior).
 *  2) For every node being selected, clear dismissed so all resources show.
 *  3) Apply the new selection.
 */
const groupSelect = (nodeIds: string[]) => { // update - 7
  // (1) clear dismissed for any nodes removed
  selectedIDs.forEach(id => {
    if (!nodeIds.includes(id)) clearDismissedForNode(id);
  });
  // (2) clear dismissed for all nodes being selected now
  nodeIds.forEach(id => clearDismissedForNode(id));
  // (3) set selection
  setSelectedIDs([...nodeIds]);
};


/**
 * setCaretNode
 * @purpose Move or append nodeId to the end of the selection array so it becomes the caret,
 *          without clearing other selections.
 * @steps
 *  1) If already selected, filter it out first.
 *  2) Append it back so it's the last (caret).
 */
const setCaretNode = (nodeId: string) => {                                    // update - 3
  setSelectedIDs(prev => {
    const filtered = prev.filter(id => id !== nodeId);
    return [...filtered, nodeId];
  });
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
      dismissResource,
    clearDismissedForNode,
    isResourceDismissed,
      editingUiFocusOnly,                       
    setEditingUiFocusOnly,                     
    setCaretNode,
    }),
    [isSelected, getSelectedNodeIds, editingUiFocusOnly, StatusMessage, multiSelectEnabled, editingUiFocusOnly]
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
