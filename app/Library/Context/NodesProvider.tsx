// NodesProvider.tsx

/**
 * @file NodesProvider.tsx
 * @description
 *   Manages ConceptNodes in a Y.Doc, filtering out system-origin updates,
 *   and instruments each create/update/delete/transfer as a global undo/redo Delta.
 */

import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  ReactNode,
  useCallback,
  useMemo,
} from 'react';
import * as Y from 'yjs';
import { ConceptNode, SystemActionType  } from '@/app/Library/Definitions/Definitions';
import { useYDoc } from '@/app/Library/Context/YDocContext';
import { useLessonModule } from '@/app/Library/Context/LessonModuleContext';
import { record } from '@/app/studygraph/(studygraph)/components/utils/deltaEngine';
import { Delta } from '@/app/Library/Definitions/deltaTypes';
import { useUndoRedo } from '@/app/studygraph/(studygraph)/components/Context/UndoRedoContext';



const DEFAULT_ROOT = 'Root Concept';
const DEFAULT_FILE = 'Untitled Document';
const DEFAULT_LESSON = 'Untitled Lesson';


interface NodesContextValue {
  nodes: Map<string, ConceptNode>;
  setNodes(
    nodes: Map<string, ConceptNode>,
    options?: { origin?: { type: 'system'; action: SystemActionType } },
    mapId?: string,
    restore?:boolean,
  ): void;
  createNewNode(title: string, parentNodeId: string, newNodeId: string): void;
  restoreNode: (node: ConceptNode, parentId: string) => void;
  updateNodeTitle(nodeId: string, newTitle: string, mapId?: string): void;
  deleteNode(nodeId: string): void;
  transferNode(sourceNodeId: string, targetNodeId: string): void;
  resetNodes(): void;
  initNewDocument(): void;
  getNodeTitle(nodeId: string): string | null;
  getRootNode(): string;
  getReviewNode(): { id: string; exist: boolean };
  saveEditwithNewNode(nodeTitle: string): string;
  getNodes(mode:"History"|"Live") : Map<string, ConceptNode> | null;
  getGlobalNode: (mapId: string, nodeId: string) => ConceptNode | undefined;
}

const NodesContext = createContext<NodesContextValue | undefined>(undefined);

export const useNodesContext = (): NodesContextValue => {
  const ctx = useContext(NodesContext);
  if (!ctx) throw new Error('useNodesContext must be used within a NodesProvider');
  return ctx;
};

export const NodesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { ydoc, updateFileName, getFileName, isReadOnly, snapshotYDoc  }  = useYDoc();
  const { activeConceptMapId ,  getLessonModule, updateConceptMapTitle} = useLessonModule();
  const mapKey = `nodes:${activeConceptMapId}`;
   const activeDoc = snapshotYDoc ?? ydoc;
  const yNodesMap = activeDoc.getMap<ConceptNode>(mapKey);

  const [nodes, setNodesState] = useState<Map<string, ConceptNode>>(new Map());
  const { undo: globalUndo, redo: globalRedo } = useUndoRedo();

  // Load & subscribe
  useEffect(() => {
    const load = () => setNodesState(new Map(yNodesMap.entries()));
    load();
    const onUpdate = (_: Y.YEvent<any>[], tx: Y.Transaction) => {
      if (tx.origin?.type !== 'system') load();
    };
    yNodesMap.observeDeep(onUpdate);
    return () => yNodesMap.unobserveDeep(onUpdate);
  }, [yNodesMap]);


  const getNodes = useCallback((mode:"History"|"Live") : Map<string, ConceptNode> | null => {
    let nodedata = null;
    if (mode.toLowerCase() == "history" && snapshotYDoc){
      nodedata = snapshotYDoc.getMap<ConceptNode>(mapKey);
    }
    else {
      // Live
      nodedata = ydoc.getMap<ConceptNode>(mapKey);
    }

    return  new Map<string, ConceptNode>(Array.from(nodedata.entries()));
  }, [mapKey, snapshotYDoc, ydoc])

  // Helpers
  const getRootNode = useCallback(() => 'node-1', []);
  const getReviewNode = useCallback(() => {
    const id = 'reviewNode';
    return { id, exist: nodes.has(id) };
  }, [nodes]);
  const getNodeTitle = useCallback(
    (nodeId: string) => yNodesMap.get(nodeId)?.title ?? null,
    [yNodesMap]
  );

  

  // 1) setNodes (bulk replace)
  const setNodes = useCallback(
    (
      newMap: Map<string, ConceptNode>,
      options?: { origin?: { type: 'system'; action: SystemActionType } },
      mapID?: string,
      restore?:boolean
    ) => {

      if (isReadOnly && !restore) {
      console.warn('NodesProvider.tsx 2003 › Read-only mode: initNewDocument blocked');
      return;
      }

      const usedMap = mapID || activeConceptMapId;
      const targetKey = `nodes:${usedMap}`;
      const yMap = ydoc.getMap<ConceptNode>(targetKey);
      ydoc.transact(
        () => {
          yMap.clear();
          newMap.forEach((node, id) => yMap.set(id, node));
        },
        options?.origin
      );
    },
    [isReadOnly, activeConceptMapId, ydoc]
  );

  // 2) initNewDocument
  const initNewDocument = useCallback(() => {
        if (isReadOnly) {
      console.warn('NodesProvider.tsx 2003 › Read-only mode: initNewDocument blocked');
      return;
    }
    const root: ConceptNode = {
      id: 'node-1',
      title: 'Root Concept',
      parentNodeId: undefined,
      childrenNodeIds: [],
      x: 0,
      y: 0,
      isRoot: true,
      depth: 0,
    };
    ydoc.transact(
      () => {
        yNodesMap.clear();
        yNodesMap.set(root.id, root);
        setNodesState(new Map([[root.id, root]]));
      },
      { origin: { type: 'system', action: 'initialize' } }
    );
  }, [ydoc, yNodesMap, isReadOnly]);


// 3) createNewNode (no undo/redo tracking)
const createNewNode = useCallback(
  (title: string, parentId: string, newId: string) => {
        if (isReadOnly) {
      console.warn('NodesProvider.tsx 2003 › Read-only mode: initNewDocument blocked');
      return;
    }
    const parent = yNodesMap.get(parentId);
    if (!parent) return;

    const depth = (parent.depth || 0) + 1;
    const newNode: ConceptNode = {
      id: newId,
      title: title || `Untitled Concept ${yNodesMap.size + 1}`,
      parentNodeId: parentId,
      childrenNodeIds: [],
      x: undefined,
      y: undefined,
      isRoot: false,
      depth,
    };

    // Apply as a system-origin transaction so we don’t record it
    ydoc.transact(
      () => {
        // 1) add the new node
        yNodesMap.set(newId, newNode);

        // 2) update parent’s children list
        yNodesMap.set(parentId, {
          ...parent,
          childrenNodeIds: [...(parent.childrenNodeIds || []), newId],
        });
      },
      {
        origin: { 
          type: 'system', 
          action: 'createNewNode' as SystemActionType 
        }
      }
    );
  },
  [ydoc, yNodesMap, isReadOnly]
);


/**
   * @function restoreNode
   * @description
   *   Reinstates a ConceptNode (with its original ID, title, depth, and children) into
   *   the live Y.Doc under the specified parent. Skips any read-only check and wraps
   *   both the node insertion and parent update in one atomic transaction for undo/redo.
   *
   *   - `node`: the exact snapshot node to restore.
   *   - `parentId`: the live parent node ID under which to reattach.
   *   - Logs start (8001), mid (8002), and completion (8003) events.
   */
  const restoreNode = useCallback(
    (node: ConceptNode, parentId: string): void => {
      console.log('NodesProvider.tsx 8001 › restoreNode start', node.id, 'parent:', parentId);
      
      // Compute depth based on parent
      const parent = yNodesMap.get(parentId);
      const depth = parent ? (parent.depth || 0) + 1 : 0;
      const x = undefined;
      const y= undefined;
      const restored: ConceptNode = { ...node, parentNodeId: parentId, depth, x , y };
      console.log(`takku restoreNode ${restored}`);

      ydoc.transact(
        () => {
          // 1) Insert the node
          const liveMap = ydoc.getMap<ConceptNode>(`nodes:${activeConceptMapId}`);
          liveMap.set(restored.id, restored);
          console.log('NodesProvider.tsx 8002 › node set in map', restored.id);

          // 2) Update parent’s children array
          if (parent) {
            const updatedChildren = [...(parent.childrenNodeIds || []), restored.id];
            yNodesMap.set(parentId, { ...parent, childrenNodeIds: updatedChildren });
            console.log('NodesProvider.tsx 8002 › parent updated', parentId, 'children:', updatedChildren);
          }
        },
        { type: 'system', action: 'restoreNode' }
      );

      console.log('NodesProvider.tsx 8003 › restoreNode complete', restored.id);
    },
    [yNodesMap, ydoc, activeConceptMapId]
  );



  

  // 4) updateNodeTitle
  const updateNodeTitle = useCallback(
    (nodeId: string, newTitle: string, mapID?: string) => {
          if (isReadOnly) {
      console.warn('NodesProvider.tsx 2003 › Read-only mode: initNewDocument blocked');
      return;
    }
      const usedKey = mapID ? `nodes:${mapID}` : mapKey;
      const yMap = mapID ? ydoc.getMap<ConceptNode>(usedKey) : yNodesMap;
      const before = yMap.get(nodeId);
      if (!before) return;
      const trimmed = newTitle.trim();
      if (!trimmed) return;

      const delta: Delta = {
        type: 'NODE_TITLE',
        nodeId,
        previousTitle: before.title,
        nextTitle: trimmed,
      };

      // Single transaction for node-title + metadata + lesson title
      ydoc.transact(() => {
        // 1) Apply node title change
        record(
          delta,
          () => {
            yMap.set(nodeId, { ...before, title: trimmed });
          },
          () => {
            yMap.set(nodeId, before);
          }
        );

        // 2) If root → auto-rename file & first lesson
        if (
          before.isRoot &&
          before.title === DEFAULT_ROOT &&
          trimmed !== DEFAULT_ROOT
        ) {
          // File rename
          if (getFileName() === DEFAULT_FILE) {
            updateFileName(trimmed);
          }
          // Lesson rename
          const Lmodule = getLessonModule();
          const first = Lmodule.conceptMaps[0];
          if (first && first.title === DEFAULT_LESSON) {
            updateConceptMapTitle(first.id, `Unit 1 : ${trimmed}`);
          }
        }
      });
    },
    [ydoc,isReadOnly, yNodesMap, mapKey, getFileName, updateFileName, getLessonModule, updateConceptMapTitle]
  );

  // 5) deleteNode
  const deleteNode = useCallback(
    (nodeId: string) => {
          if (isReadOnly) {
      console.warn('NodesProvider.tsx 2003 › Read-only mode: initNewDocument blocked');
      return;
    }
      const node = yNodesMap.get(nodeId);
      if (!node || node.isRoot) return;
      const parentId = node.parentNodeId!;
      const parent = yNodesMap.get(parentId);
      if (!parent || (node.childrenNodeIds?.length || 0) > 0) return;

      const delta: Delta = { type: 'NODE_DELETE', nodeId, nodeData: node };

      ydoc.transact(() => {
        record(
          delta,
          () => {
            yNodesMap.delete(nodeId);
            yNodesMap.set(parentId, {
              ...parent,
              childrenNodeIds: parent.childrenNodeIds!.filter((c) => c !== nodeId),
            })
            console.log(` takku data after delete ${JSON.stringify(yNodesMap)}`);
          },
          () => {
            yNodesMap.set(nodeId, node);
            yNodesMap.set(parentId, parent);
          }
        );
      });
    },
    [ydoc, yNodesMap, isReadOnly]
  );

  const transferNode = useCallback(
    (sourceId: string, targetId: string) => {
          if (isReadOnly) {
      console.warn('NodesProvider.tsx 2003 › Read-only mode: initNewDocument blocked');
      return;
    }
      const source = yNodesMap.get(sourceId);
      const target = yNodesMap.get(targetId);
      if (!source || !target || source.isRoot) return;
      if (
        sourceId === targetId ||
        (source.childrenNodeIds || []).includes(targetId)
      ) {
        return;
      }

      const oldParentId = source.parentNodeId!;
      const oldParent = yNodesMap.get(oldParentId)!;
      const newDepth = (target.depth || 0) + 1;

      const updatedSource: ConceptNode = {
        ...source,
        parentNodeId: targetId,
        depth: newDepth,
      };
      const updatedOldParent: ConceptNode = {
        ...oldParent,
        childrenNodeIds: oldParent.childrenNodeIds!.filter((c) => c !== sourceId),
      };
      const updatedTarget: ConceptNode = {
        ...target,
        childrenNodeIds: [...(target.childrenNodeIds || []), sourceId],
      };

      // Apply as a system-origin transaction so undo/redo engine ignores it:
      ydoc.transact(
        () => {
          yNodesMap.set(oldParentId, updatedOldParent);
          yNodesMap.set(sourceId, updatedSource);
          yNodesMap.set(targetId, updatedTarget);
        },
        { origin: { type: 'system', action: 'transfer' as SystemActionType } }
      );
    },
    [ydoc, yNodesMap, isReadOnly]
  );

  // 7) resetNodes
  const resetNodes = useCallback(() => {
        if (isReadOnly) {
      console.warn('NodesProvider.tsx 2003 › Read-only mode: initNewDocument blocked');
      return;
    }
    ydoc.transact(() => {
      yNodesMap.clear();
      setNodesState(new Map());
    });
  }, [ydoc, yNodesMap, isReadOnly]);


  // NodesProvider.tsx - Add the implementation of saveEditwithNewNode
const saveEditwithNewNode = useCallback(
  (nodeTitle: string) => {
        if (isReadOnly) {
      console.warn('NodesProvider.tsx 2003 › Read-only mode: initNewDocument blocked');
      return;
    }
    const rootNodeId = getRootNode();
    const newNodeId = `node-${Date.now()}`;
    
    // Create the new node with root as parent
    createNewNode(nodeTitle, rootNodeId, newNodeId);
    
    return newNodeId; // Return the ID for saving the card
  },
  [createNewNode, getRootNode, isReadOnly]
);

const getGlobalNode = useCallback(
  (mapId: string, nodeId: string): ConceptNode | undefined => {
    // look up in the live Y.Doc
    const key = `nodes:${mapId}`;
    const yMap = ydoc.getMap<ConceptNode>(key);
    return yMap.get(nodeId);
  },
  [ydoc]
);


  const contextValue = useMemo(
    () => ({
      nodes,
      setNodes,
      createNewNode,
      updateNodeTitle,
      deleteNode,
      transferNode,
      resetNodes,
      initNewDocument,
      getNodeTitle,
      getRootNode,
      getReviewNode,
      restoreNode,
      saveEditwithNewNode,
      getNodes,
      getGlobalNode,
    }),
    [nodes, setNodes, createNewNode, updateNodeTitle, deleteNode, transferNode, resetNodes, initNewDocument, getNodeTitle, getRootNode, getReviewNode, restoreNode, saveEditwithNewNode, getNodes, getGlobalNode]
  );

  return <NodesContext.Provider value={contextValue}>{children}</NodesContext.Provider>;
};
