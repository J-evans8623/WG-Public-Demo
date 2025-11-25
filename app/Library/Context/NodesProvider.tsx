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
import { ConceptNode, SystemActionType, LOCAL_ORIGIN  } from '@/app/Library/Definitions/Definitions';
import { useYDoc } from '@/app/Library/Context/YDocContext';
import { useLessonModule } from '@/app/Library/Context/LessonModuleContext';
import { record } from '@/app/workspace/(studygraph)/components/utils/deltaEngine';
import { Delta } from '@/app/Library/Definitions/deltaTypes';




const DEFAULT_ROOT = 'Root Concept';
const DEFAULT_FILE = 'Untitled Document';
const DEFAULT_LESSON = 'Untitled Lesson';


/**
 * @function normalizeIncomingMap
 * @description
 *  Normalizes an incoming nodes Map before bulk commit:
 *  - Ensures every primary node (depth === 1) has a string lessonOrder.
 *  - Uses the order of root.childrenNodeIds in the incoming map to assign
 *    lessonOrder if missing (1..N as strings).
 */
function normalizeIncomingMap(src: Map<string, ConceptNode>): Map<string, ConceptNode> {
  // 1) Create a shallow clone so we never mutate the caller's Map
  const out = new Map<string, ConceptNode>(src);

  // 2) Find the root node in the incoming map (prefer isRoot, fallback to 'node-1')
  let rootEntry: [string, ConceptNode] | undefined =
    Array.from(out.entries()).find(([, n]) => n.isRoot) ??
    (out.has('node-1') ? (['node-1', out.get('node-1')!] as [string, ConceptNode]) : undefined);

  if (!rootEntry) return out; // No root → nothing to normalize safely

  const [rootId, rootNode] = rootEntry;
  const children = rootNode.childrenNodeIds ?? [];

  // 3) Walk root's children in order; assign lessonOrder if missing
  let order = 1;
  for (const childId of children) {
    const child = out.get(childId);
    if (!child) continue;

    const isPrimary = (child.depth ?? 0) === 1 && child.parentNodeId === rootId;
    const missingOrder = child.lessonOrder == null || child.lessonOrder === '';

    if (isPrimary && missingOrder) {
      out.set(childId, { ...child, lessonOrder: String(order) });
    }
    order += 1;
  }

  return out;
}

/**
 * @function computeNextPrimaryOrder
 * @description
 *  Computes the next lessonOrder string for a new/moved primary by using the
 *  current length of the root's children list in the live Y.Map.
 */
function computeNextPrimaryOrder(yMap: Y.Map<ConceptNode>, rootId: string): string {
  const root = yMap.get(rootId);
  const count = (root?.childrenNodeIds ?? []).length;
  return String(count + 1);
}



interface NodesContextValue {
  nodes: Map<string, ConceptNode>;
  setNodes(
    nodes: Map<string, ConceptNode>,
    options?: { origin?: { type: 'system'; action: SystemActionType } },
    mapId?: string,
    restore?:boolean,
  ): void;
  setGeneratedNodes(
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
  mapId:string,
}

const NodesContext = createContext<NodesContextValue | undefined>(undefined);

export const useNodesContext = (): NodesContextValue => {
  const ctx = useContext(NodesContext);
  if (!ctx) throw new Error('useNodesContext must be used within a NodesProvider');
  return ctx;
};

export const NodesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { ydoc, updateFileName, getFileName, isReadOnly, snapshotYDoc, incrementVersion  }  = useYDoc();
  const { activeConceptMapId ,  getLessonModule, updateConceptMapTitle} = useLessonModule();
  const mapKey = `nodes:${activeConceptMapId}`;
   const activeDoc = snapshotYDoc ?? ydoc;
  const yNodesMap = activeDoc.getMap<ConceptNode>(mapKey);

  const [nodes, setNodesState] = useState<Map<string, ConceptNode>>(new Map());

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

  

/**
 * @function setNodes
 * @responsibilities
 *  - Bulk replace the nodes map for a given concept map.
 *  - Normalize primary nodes so each has a string lessonOrder.
 *  - Perform the write in a single Yjs transaction.
 *
 * @workflow
 *  1) Guard read-only (unless restore).
 *  2) Select target Y.Map for the active or provided mapID.
 *  3) Normalize incoming Map so primaries have lessonOrder based on root order.
 *  4) Clear target Y.Map and write normalized entries.
 *  5) Use provided system origin (if any).
 */
const setNodes = useCallback(
  (
    newMap: Map<string, ConceptNode>,
    options?: { origin?: { type: 'system'; action: SystemActionType } },
    mapID?: string,
    restore?: boolean
  ) => {
    // 1) Guard read-only (unless restore)
    if (isReadOnly && !restore) {
      console.warn('NodesProvider.tsx 2003 › Read-only mode: setNodes blocked');
      return;
    }

    // 2) Select target Y.Map
    const usedMap = mapID || activeConceptMapId;
    const targetKey = `nodes:${usedMap}`;
    const yMap = ydoc.getMap<ConceptNode>(targetKey);

    // 3) Normalize incoming primary lessonOrder using root children order
    const normalized = normalizeIncomingMap(newMap);

    // 4) Apply in one transaction
    ydoc.transact(
      () => {
        yMap.clear();
        normalized.forEach((node, id) => yMap.set(id, node));
      },
      options?.origin
    );
  },
  [isReadOnly, activeConceptMapId, ydoc]
);




/**
 * @function setGeneratedNodes
 * @responsibilities
 *  - Bulk replace nodes specifically for AI-generated maps.
 *  - Normalize primary nodes so each has a string lessonOrder.
 *  - Bump version on write to reflect structural changes.
 *
 * @workflow
 *  1) Guard read-only (unless restore).
 *  2) Select target Y.Map for the active or provided mapID.
 *  3) Normalize incoming Map so primaries have lessonOrder based on root order.
 *  4) Clear target Y.Map, increment version, then write normalized entries.
 *  5) Use provided system origin (if any).
 */
const setGeneratedNodes = useCallback(
  (
    newMap: Map<string, ConceptNode>,
    options?: { origin?: { type: 'system'; action: SystemActionType } },
    mapID?: string,
    restore?: boolean
  ) => {
    // 1) Guard read-only (unless restore)
    if (isReadOnly && !restore) {
      console.warn('NodesProvider.tsx 2004 › Read-only mode: setGeneratedNodes blocked');
      return;
    }

    // 2) Select target Y.Map
    const usedMap = mapID || activeConceptMapId;
    const targetKey = `nodes:${usedMap}`;
    const yMap = ydoc.getMap<ConceptNode>(targetKey);

    // 3) Normalize incoming primary lessonOrder
    const normalized = normalizeIncomingMap(newMap);

    // 4) Apply write + version bump in one transaction
    ydoc.transact(
      () => {
        yMap.clear();
        incrementVersion();
        normalized.forEach((node, id) => yMap.set(id, node));
      },
       LOCAL_ORIGIN);
  },
  [isReadOnly, activeConceptMapId, ydoc, incrementVersion]
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


/**
 * @function createNewNode
 * @responsibilities
 *  - Create a new node under a given parent.
 *  - If the new node is primary (parent is root) and lessonOrder is missing,
 *    seed lessonOrder := (root.children.length + 1) as a string.
 *  - Update the parent’s children list atomically.
 *
 * @workflow
 *  1) Guard read-only.
 *  2) Resolve parent and compute new depth.
 *  3) Build the new node (no pos, not root).
 *  4) If depth === 1 (primary) and missing lessonOrder, assign via computeNextPrimaryOrder.
 *  5) Transact: set new node, maybe bump version, update parent children.
 */
const createNewNode = useCallback(
  (title: string, parentId: string, newId: string) => {
    // 1) Guard read-only
    if (isReadOnly) {
      console.warn('NodesProvider.tsx 2005 › Read-only mode: createNewNode blocked');
      return;
    }

    // 2) Resolve parent and compute depth
    const parent = yNodesMap.get(parentId);
    if (!parent) return;
    const depth = (parent.depth || 0) + 1;

    

    // 3) Build base node
    let newNode: ConceptNode = {
      id: newId,
      title: title || `Untitled Concept ${yNodesMap.size + 1}`,
      parentNodeId: parentId,
      childrenNodeIds: [],
      x: undefined,
      y: undefined,
      isRoot: false,
      depth,
    };

    if (depth === 1) {
      newNode.lessonOrder = String(parent.childrenNodeIds.length + 1);
    }

    // 4) If primary and missing lessonOrder, assign based on current root child count
    const rootId = getRootNode();
    const isPrimary = depth === 1 && parentId === rootId;
    if (isPrimary && (newNode.lessonOrder == null || newNode.lessonOrder === '')) {
      newNode = { ...newNode, lessonOrder: computeNextPrimaryOrder(yNodesMap, rootId) };
    }

    // 5) Transact the insert + parent update
    ydoc.transact(
      () => {
        yNodesMap.set(newId, newNode);

        if (isPrimary) {
          // primary node is being created
          incrementVersion();
        }

        yNodesMap.set(parentId, {
          ...parent,
          childrenNodeIds: [...(parent.childrenNodeIds || []), newId],
        });
      },
       LOCAL_ORIGIN
   );
  },
  [isReadOnly, yNodesMap, ydoc, incrementVersion, getRootNode]
);



/**
 * @function restoreNode
 * @responsibilities
 *  - Reattach a snapshot node under a given parent with updated depth/pos.
 *  - If restored node becomes primary and lacks lessonOrder, seed it.
 *  - Update parent’s children atomically; bump version on primary restores.
 *
 * @workflow
 *  1) Log start and resolve parent; compute new depth.
 *  2) Build restored node with new parent/depth and cleared pos.
 *  3) If depth === 1 and missing lessonOrder, assign via computeNextPrimaryOrder.
 *  4) Transact: write node, update parent children, bump version if primary.
 *  5) Log completion.
 */
const restoreNode = useCallback(
  (node: ConceptNode, parentId: string): void => {
    console.log('NodesProvider.tsx 8001 › restoreNode start', node.id, 'parent:', parentId);

    // 1) Resolve parent and compute depth
    const parent = yNodesMap.get(parentId);
    const depth = parent ? (parent.depth || 0) + 1 : 0;

    // 2) Build restored node (clear position)
    let restored: ConceptNode = { ...node, parentNodeId: parentId, depth, x: undefined, y: undefined };

    // 3) If primary and missing lessonOrder, assign now
    const rootId = getRootNode();
    const isPrimary = depth === 1 && parentId === rootId;
    if (isPrimary && (restored.lessonOrder == null || restored.lessonOrder === '')) {
      restored = { ...restored, lessonOrder: computeNextPrimaryOrder(yNodesMap, rootId) };
    }

    // 4) Transact reattachment
    ydoc.transact(
      () => {
        const liveMap = ydoc.getMap<ConceptNode>(`nodes:${activeConceptMapId}`);
        liveMap.set(restored.id, restored);
        console.log('NodesProvider.tsx 8002 › node set in map', restored.id);

        if (parent) {
          const updatedChildren = [...(parent.childrenNodeIds || []), restored.id];
          yNodesMap.set(parentId, { ...parent, childrenNodeIds: updatedChildren });
          console.log('NodesProvider.tsx 8002 › parent updated', parentId, 'children:', updatedChildren);
        }

        if (isPrimary) {
          incrementVersion();
        }
      },
      LOCAL_ORIGIN
    );

    // 5) Log completion
    console.log('NodesProvider.tsx 8003 › restoreNode complete', restored.id);
  },
  [yNodesMap, ydoc, incrementVersion, activeConceptMapId, getRootNode]
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
                   

        }
      },  LOCAL_ORIGIN);
    },
    [ydoc, isReadOnly, yNodesMap, mapKey, getFileName, updateFileName]
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

      const depth = node.depth
     
      const parentId = node.parentNodeId!;
      const parent = yNodesMap.get(parentId);
      if (!parent || (node.childrenNodeIds?.length || 0) > 0) return;

      const delta: Delta = { type: 'NODE_DELETE', nodeId, nodeData: node };

      ydoc.transact(() => {
        record(
          delta,
          () => {
            yNodesMap.delete(nodeId);

             if (depth === 1){
      // primary node is being created
      incrementVersion()
    }
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
      }, LOCAL_ORIGIN);
    },
    [isReadOnly, yNodesMap, ydoc, incrementVersion]
  );

/**
 * @function transferNode
 * @responsibilities
 *  - Move a node under a new parent; recompute depth.
 *  - If node becomes primary and lacks lessonOrder, seed it.
 *  - If node is moved out of primary, strip lessonOrder (to avoid stale values).
 *  - Update old/new parents atomically.
 *
 * @workflow
 *  1) Guard read-only and sanity-check source/target.
 *  2) Derive new depth from target; prepare updated node + parents.
 *  3) If moving to depth 1 and missing lessonOrder → assign next order.
 *  4) If moving away from depth 1 → delete lessonOrder.
 *  5) Transact: write three updates (old parent, source, target).
 */
const transferNode = useCallback(
  (sourceId: string, targetId: string) => {
    // 1) Guard & sanity checks
    if (isReadOnly) {
      console.warn('NodesProvider.tsx 2006 › Read-only mode: transferNode blocked');
      return;
    }
    const source = yNodesMap.get(sourceId);
    const target = yNodesMap.get(targetId);
    if (!source || !target || source.isRoot) return;
    if (sourceId === targetId || (source.childrenNodeIds || []).includes(targetId)) return;

    const oldParentId = source.parentNodeId!;
    const oldParent = yNodesMap.get(oldParentId)!;
    const newDepth = (target.depth || 0) + 1;

    // 2) Build updated node and parents
    let updatedSource: ConceptNode = { ...source, parentNodeId: targetId, depth: newDepth };
    const updatedOldParent: ConceptNode = {
      ...oldParent,
      childrenNodeIds: oldParent.childrenNodeIds!.filter((c) => c !== sourceId),
    };
    const updatedTarget: ConceptNode = {
      ...target,
      childrenNodeIds: [...(target.childrenNodeIds || []), sourceId],
    };

    // 3) If moving to primary without lessonOrder → seed it
    const rootId = getRootNode();
    const becomesPrimary = newDepth === 1 && targetId === rootId;
    if (becomesPrimary && (updatedSource.lessonOrder == null || updatedSource.lessonOrder === '')) {
      updatedSource = { ...updatedSource, lessonOrder: computeNextPrimaryOrder(yNodesMap, rootId) };
    }

    // 4) If leaving primary → remove lessonOrder
    const wasPrimary = (source.depth ?? 0) === 1 && oldParentId === rootId;
    if (!becomesPrimary && wasPrimary && updatedSource.lessonOrder != null) {
      const { lessonOrder, ...rest } = updatedSource as any;
      updatedSource = rest;
    }

    // 5) Apply as system-origin transaction
    ydoc.transact(
      () => {
        yNodesMap.set(oldParentId, updatedOldParent);
        yNodesMap.set(sourceId, updatedSource);
        yNodesMap.set(targetId, updatedTarget);
      },
      LOCAL_ORIGIN
    );
  },
  [ydoc, yNodesMap, isReadOnly, getRootNode]
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
      return "";
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
      setGeneratedNodes,
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
      mapId:activeConceptMapId
    }),
    [nodes, setNodes, setGeneratedNodes, createNewNode, updateNodeTitle, deleteNode, transferNode, resetNodes, initNewDocument, getNodeTitle, getRootNode, getReviewNode, restoreNode, saveEditwithNewNode, getNodes, getGlobalNode, activeConceptMapId]
  );

  return <NodesContext.Provider value={contextValue}>{children}</NodesContext.Provider>;
};
