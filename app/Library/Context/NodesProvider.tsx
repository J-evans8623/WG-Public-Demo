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
import { ConceptNode } from '@/app/Library/Definitions/Definitions';
import { useYDoc } from '@/app/Library/Context/YDocContext';
import { useLessonModule } from '@/app/Library/Context/LessonModuleContext';
import { SystemActionType } from '@/app/Library/Tests/Synchro/Centralize/SystemOriginTypes';
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
    mapId?: string
  ): void;
  createNewNode(title: string, parentNodeId: string, newNodeId: string): void;
  updateNodeTitle(nodeId: string, newTitle: string, mapId?: string): void;
  deleteNode(nodeId: string): void;
  transferNode(sourceNodeId: string, targetNodeId: string): void;
  resetNodes(): void;
  initNewDocument(): void;
  getNodeTitle(nodeId: string): string | null;
  getRootNode(): string;
  getReviewNode(): { id: string; exist: boolean };
  saveEditwithNewNode(nodeTitle: string): string;
}

const NodesContext = createContext<NodesContextValue | undefined>(undefined);

export const useNodesContext = (): NodesContextValue => {
  const ctx = useContext(NodesContext);
  if (!ctx) throw new Error('useNodesContext must be used within a NodesProvider');
  return ctx;
};

export const NodesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { ydoc, updateFileName, getFileName }  = useYDoc();
  const { activeConceptMapId ,  getLessonModule, updateConceptMapTitle} = useLessonModule();
  const mapKey = `nodes:${activeConceptMapId}`;
  const yNodesMap = ydoc.getMap<ConceptNode>(mapKey);

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
      mapID?: string
    ) => {
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
    [ydoc, activeConceptMapId]
  );

  // 2) initNewDocument
  const initNewDocument = useCallback(() => {
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
  }, [ydoc, yNodesMap]);


// 3) createNewNode (no undo/redo tracking)
const createNewNode = useCallback(
  (title: string, parentId: string, newId: string) => {
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
  [ydoc, yNodesMap]
);



  

  // 4) updateNodeTitle
  const updateNodeTitle = useCallback(
    (nodeId: string, newTitle: string, mapID?: string) => {
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
    [ydoc, yNodesMap, mapKey, getFileName, updateFileName, getLessonModule, updateConceptMapTitle]
  );

  // 5) deleteNode
  const deleteNode = useCallback(
    (nodeId: string) => {
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
            });
          },
          () => {
            yNodesMap.set(nodeId, node);
            yNodesMap.set(parentId, parent);
          }
        );
      });
    },
    [ydoc, yNodesMap]
  );

  const transferNode = useCallback(
    (sourceId: string, targetId: string) => {
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
    [ydoc, yNodesMap]
  );

  // 7) resetNodes
  const resetNodes = useCallback(() => {
    ydoc.transact(() => {
      yNodesMap.clear();
      setNodesState(new Map());
    });
  }, [ydoc, yNodesMap]);


  // NodesProvider.tsx - Add the implementation of saveEditwithNewNode
const saveEditwithNewNode = useCallback(
  (nodeTitle: string) => {
    const rootNodeId = getRootNode();
    const newNodeId = `node-${Date.now()}`;
    
    // Create the new node with root as parent
    createNewNode(nodeTitle, rootNodeId, newNodeId);
    
    return newNodeId; // Return the ID for saving the card
  },
  [createNewNode, getRootNode]
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
      saveEditwithNewNode
    }),
    [
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
      saveEditwithNewNode
    ]
  );

  return <NodesContext.Provider value={contextValue}>{children}</NodesContext.Provider>;
};
