/***********************************************************************************************
 * @file VersionHistoryContext.tsx
 * @description
 *   The VersionHistoryContext file centralizes all version-history functionality within the
 *   Bloom-Maps application. It manages the open/close state of the history panel, retrieves
 *   and caches metadata for all saved snapshots of a given document, downloads and applies
 *   snapshot data into a transient Y.Doc for read-only preview, and exposes selectors for
 *   reading nodes, subtree layout information, and resource cards from the loaded snapshot.
 *   Additionally, it provides robust restore operations that bypass read-only restrictions
 *   by writing directly to the live Y.Doc, enabling users to bring individual historical
 *   nodes and resources back into the live document without affecting the loaded snapshot
 *   state. The file logs each significant step—including API fetches, snapshot loading,
 *   panel toggles, and restore actions—with unique four-digit codes for improved observability
 *   and debugging. Key behaviors include fallback handling for missing parent nodes or resources,
 *   graceful UI state resets, and separation of live versus snapshot document contexts.
 *
 * Responsibilities:
 *   • Control visibility and state management for the version-history panel UI.
 *   • Fetch snapshot metadata list via backend APIs and manage loading states.
 *   • Download and apply selected snapshots into a transient Y.Doc for read-only rendering.
 *   • Provide read-only selectors to extract nodes, subtree layouts, and resources from the snapshot.
 *   • Implement restoreNode and restoreResource functions that bypass read-only restrictions
 *     by transacting directly on the live Y.Doc and handling missing parents with fallback to root.
 *   • Emit structured console logs with unique codes at every major operation for traceability.
 ***********************************************************************************************/

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
  useRef,
} from 'react';
import * as Y from 'yjs';
import { useYDoc } from '@/app/Library/Context/YDocContext';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { useResourceContext } from '@/app/Library/Context/ResourceContext';
import { useLessonModule } from '@/app/Library/Context/LessonModuleContext';
import type { ConceptNode, ResourceCard } from '@/app/Library/Definitions/Definitions';
import { compositeLayout } from '@/app/workspace/(studygraph)/components/hooks/layoutUtils';
import { useSubTreeContext }  from '@/app/Library/Context/SubTreeProvider';
import { getMapTitle } from '@/app/workspace/(studygraph)/components/versionHistory/versionHistory';


export interface SnapshotMeta {
  mapId?: any;
  snapshotId: string;
  ts: string;
  author: string;
  size: number;
  path: string;
  title:string;
}

interface VersionHistoryContextType {
  /** Whether the history panel is currently visible. */
  isHistoryOpen: boolean;
  /** True while fetching the snapshot list. */
  isListLoading: boolean;
  /** List of fetched snapshot metadata, **including** the synthetic “Current Version” entry. */
  snapshots: SnapshotMeta[];
  /** True while downloading/applying a snapshot. */
  isSnapshotLoading: boolean;
  /** ID of the currently selected snapshot; null if none. */
  selectedSnapshotId: string | null;

  /** Open the history panel and fetch the snapshot list. */
  openHistory: () => void;
  /** Close the history panel and revert to the live document. */
  closeHistory: () => void;
  /** Select a snapshot by ID (or “__live__”) to preview. */
  selectSnapshot: (id: string) => void;
  /**
   * Restore a single ResourceCard from the snapshot into the live document.
   * Falls back to root if node is missing.
   */
  restoreResource: (resource: ResourceCard, targetNodeId?: string) => void;
  statusMessage: string | null;
  clearStatus: () => void;
fetchDeletedSnapshots: () => Promise<void>;
 restoreMap: (snapshot: SnapshotMeta) => Promise<void>;
}

const VersionHistoryContext = createContext<VersionHistoryContextType | undefined>(undefined);

export const useVersionHistory = (): VersionHistoryContextType => {
  const ctx = useContext(VersionHistoryContext);
  if (!ctx) {
    throw new Error('useVersionHistory must be used within VersionHistoryProvider');
  }
  return ctx;
};

export const VersionHistoryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Live-doc context
  const { docFileID, ydoc: liveYDoc, setSnapshotYDoc: setGlobalSnapshot, snapshotYDoc } = useYDoc();
  const { activeConceptMapId, getExistingLessonModules } = useLessonModule();
  const nodesContext = useNodesContext();
  const {setNodes} = useNodesContext();
  const resourceContext = useResourceContext();
  const { getSubtrees, setSubtrees } = useSubTreeContext();

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isListLoading, setIsListLoading] = useState(false);
  const [rawSnapshots, setRawSnapshots] = useState<SnapshotMeta[]>([]);
  const [isSnapshotLoading, setIsSnapshotLoading] = useState(false);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const snapshotCache = useRef<Map<string, Y.Doc>>(new Map());
  const [statusMessage, setStatusMessage] = useState<string | null>(null);


  
  // Fetch the real snapshot list
  const fetchSnapshotList = useCallback(async () => {
    if (!docFileID) return;
    console.log('VersionHistoryContext.tsx 7003 › Fetching snapshot list for', docFileID);
    setIsListLoading(true);
    try {
      const res = await fetch(`/api/history/list?docId=${encodeURIComponent(docFileID)}&mapId=${activeConceptMapId}`);
      const data = await res.json();
      const snaps = Array.isArray(data.snapshots) ? data.snapshots : [];
      setRawSnapshots(snaps);
      snaps.forEach((snap: { snapshotId: any; title: any; }) =>
      console.log(
        `VersionHistoryContext.tsx 7004 › Snapshot fetched: id=${snap.snapshotId}, title="${snap.title}"`
      )
    );
    } catch (err) {
      console.error('VersionHistoryContext.tsx 7005 › Error fetching snapshot list', err);
    } finally {
      setIsListLoading(false);
    }
  }, [activeConceptMapId, docFileID]);

  /**
   * @function fetchDeletedSnapshots
   * @description
   *   Fetches all snapshots, groups by mapId, picks the most recent per map,
   *   excludes any currently live mapIds (derived from Y.Doc), sorts descending,
   *   and updates `rawSnapshots`.  Logs key steps (7006–7010).
   */
const fetchDeletedSnapshots = useCallback(async () => {
  if (!docFileID) return;
  console.log('VersionHistoryContext.tsx 7006 › fetchDeletedSnapshots start');
  setIsListLoading(true);
  try {
    const liveIds = getExistingLessonModules();
    const query = new URLSearchParams({
      docId: docFileID,
      mode: 'deleted',
      liveMapIds: liveIds.join(','),
    });

    const url = `/api/history/list?${query.toString()}`;
    console.log('VersionHistoryContext.tsx 7007 › URL=', url);

    const res = await fetch(url);
    const data = await res.json();
    const snaps: SnapshotMeta[] = Array.isArray(data.snapshots) ? data.snapshots : [];
    setRawSnapshots(snaps|| []);
    
     snaps.forEach(snap =>
      console.log(
        `VersionHistoryContext.tsx 7008 › Deleted snapshot: id=${snap.snapshotId}, title="${snap.title}"`
      )
    );
  } catch (err) {
    console.error('VersionHistoryContext.tsx 7009 › Error fetching deleted snapshots', err);
  } finally {
    setIsListLoading(false);
  }
}, [docFileID, getExistingLessonModules]);


  // Download & apply a real snapshot
  const loadSnapshot = useCallback(async (snapshotId: string, path: string) => {
    if (!docFileID) return;
    console.log('VersionHistoryContext.tsx 6007 › Downloading snapshot', snapshotId, 'path=', path);
    setIsSnapshotLoading(true);
    try {
      let previewDoc = snapshotCache.current.get(snapshotId);

      if (!previewDoc){
      const guardRes = await fetch(
        `/api/history/download?docId=${encodeURIComponent(docFileID)}&snapshotId=${encodeURIComponent(snapshotId)}`
      );
      const { downloadUrl } = await guardRes.json();
      console.log('VersionHistoryContext.tsx 6007 › Received downloadUrl');
      const resp = await fetch(downloadUrl);
      const buffer = await resp.arrayBuffer();
      previewDoc = new Y.Doc();
      console.log('VersionHistoryContext.tsx 6007 › Snapshot bytes received, length=', buffer.byteLength);
      Y.applyUpdate(previewDoc,new Uint8Array(buffer));
      console.log('VersionHistoryContext.tsx 6007 › Applied snapshot to Y.Doc');
       snapshotCache.current.set(snapshotId, previewDoc);
      }
      setGlobalSnapshot(previewDoc)
    } catch (err) {
      console.error('VersionHistoryContext.tsx 6007› Error loading snapshot', err);
    } finally {
      setIsSnapshotLoading(false);
    }
  }, [docFileID, setGlobalSnapshot]);

  // Open / close handlers
  const openHistory = useCallback(() => {
    console.log('VersionHistoryContext.tsx 7011 › openHistory()');
    setIsHistoryOpen(true);
    fetchSnapshotList();
  }, [fetchSnapshotList]);

  const closeHistory = useCallback(() => {
    console.log('VersionHistoryContext.tsx 7012 › closeHistory()');
    setIsHistoryOpen(false);
    setSelectedSnapshotId(null);
    setGlobalSnapshot(null);
  }, [setGlobalSnapshot]);

  // Selection (handles synthetic “__live__”)
  const selectSnapshot = useCallback((id: string) => {
    console.log('VersionHistoryContext.tsx 7013 › selectSnapshot()', id);
    if (id === '__live__') {
      setSelectedSnapshotId(null);
      setGlobalSnapshot(null)
      return;
    }
    setSelectedSnapshotId(id);
    const meta = rawSnapshots.find(s => s.snapshotId === id);
    if (meta) loadSnapshot(id, meta.path);
  }, [rawSnapshots, loadSnapshot, setGlobalSnapshot]);

  // Reset snapshot on panel close
  useEffect(() => {
    if (!isHistoryOpen) {
      setGlobalSnapshot(null);
    }
  }, [isHistoryOpen, setGlobalSnapshot]);

  // Compute augmented list with synthetic “Current Version” at top
const snapshots = useMemo<SnapshotMeta[]>(() => {
  const liveEntry: SnapshotMeta = {
    snapshotId: '__live__',
    title: getMapTitle(liveYDoc, activeConceptMapId),
    ts: new Date().toISOString(),
    author: 'You (current)',
    size: 0,
    path: ''
  };
  // Ensure rawSnapshots is an array
  const list = Array.isArray(rawSnapshots) ? rawSnapshots : [];
  return [ liveEntry, ...list ];
}, [activeConceptMapId, liveYDoc, rawSnapshots]);


 const restoreNodeWithLayout = useCallback(
    (snapNode: ConceptNode, targetParentId: string) => {
      // 1) Pull down the live node‐map and subtree‐map in JS
      const liveNodes = nodesContext.getNodes('Live')!; 
      const liveSubtrees = getSubtrees('Live');     // Map<string,ConceptNode>
      const localSubtrees = new Map(liveSubtrees);           // copy

      // 2) Insert the snapshot node (x/y undefined) into the live map
      const parent = liveNodes.get(targetParentId);
      const childDepth = parent!.depth + 1;
      liveNodes.set(snapNode.id, {
        ...snapNode,
        depth: childDepth,
        parentNodeId: targetParentId,
        x: undefined, y: undefined,
      });
      // 3) Ensure the parent’s children list includes it
      
      if (parent) parent.childrenNodeIds = [...(parent.childrenNodeIds||[]), snapNode.id];

      // 4) Run the pure layout on that in‐memory state
      compositeLayout({
        nodes:        liveNodes,
        localSubtrees,
        setSubtrees,
        setNodes: (updated) => {
          // merge back into liveNodes
          updated.forEach((n, id) => liveNodes.set(id, n));
        },
      });

      // 5) Wrap the final writes in one Y.Doc transaction for undo/redo
      liveYDoc.transact(() => {
        // write all nodes back
        setNodes(liveNodes, /* options */ undefined, /* mapID */ undefined,  true);

        // write all subtrees back
        setSubtrees(localSubtrees, /* options */ undefined, /* mapID */ undefined, true);
      }, { type: 'system', action: 'restoreNodeWithLayout' });
    },
    [getSubtrees, liveYDoc, nodesContext, setNodes, setSubtrees],
  );

/**
   * Restore a single ResourceCard from the snapshot into the live document.
   * Bypasses read-only mode, re-creates any missing parent nodes, and reinserts
   * the card in one undoable transaction. Logs each step with unique codes.
   *
   * @param resource - The ResourceCard snapshot to restore.
   * @param targetNodeId - Optional override of which live node to insert under.
   */
  const restoreResource = useCallback(
    (resource: ResourceCard, targetNodeId?: string) => {
      console.log('VersionHistoryContext.tsx 7023 › restoreResource start', resource.id);

      const mapId = activeConceptMapId;
      // Snapshot Y.Doc loaded for preview
      if (!snapshotYDoc) {
        console.error('VersionHistoryContext.tsx 7025 › no snapshot loaded');
        return;
      }

      // Grab the ConceptNode definition from the snapshot
      const snapNodes = snapshotYDoc.getMap<ConceptNode>(`nodes:${mapId}`);
      const snapNode = snapNodes.get(resource.nodeId);
      if (!snapNode) {
        console.error('VersionHistoryContext.tsx 7025 › no snapshot node for', resource.nodeId);
        return;
      }

      const liveNodes = nodesContext.getNodes("Live") !;
      const rootId   = nodesContext.getRootNode();
      const origParentId = snapNode.parentNodeId ?? rootId;
      const parentExists = liveNodes.has(origParentId);
      const nodeExists   = liveNodes.has(snapNode.id);

      // Perform node + resource restore in one transaction for undo/redo
      liveYDoc.transact(() => {
        // 1) Node restore (if needed)
        if (!nodeExists) {
          console.log(
            !parentExists
              ? 'VersionHistoryContext.tsx 7024 › parent missing – restoring node under root'
              : 'VersionHistoryContext.tsx 7026 › parent present – restoring node under original parent'
          );
          restoreNodeWithLayout(snapNode,  parentExists ? origParentId : rootId)
        } else {
          console.log('VersionHistoryContext.tsx 7027 › node exists – skipping node restore');
        }

        // 2) Resource restore
        resourceContext.restoreResource({
          ...resource,
          nodeId: targetNodeId ?? resource.nodeId
        });
        console.log('VersionHistoryContext.tsx 7028 › restored resource card', resource.id);
         setStatusMessage(`✔️ Restored card back into the map`);
      });
    },
    [activeConceptMapId, liveYDoc, nodesContext, resourceContext, restoreNodeWithLayout, snapshotYDoc]
  );


   const clearStatus = () => setStatusMessage(null);


/**
   * @function restoreMap
   * @description
   *   Downloads a full-map snapshot and merges its Yjs content back into the live Y.Doc
   *   by re-inserting the conceptMaps entry and copying over namespaced maps.
   */
  const restoreMap = useCallback(async (snapshot: SnapshotMeta) => {
    if (!docFileID) {
      console.error('VersionHistoryContext.tsx 7050 › no docFileID');
      return;
    }

    try {
      // 1) Download the snapshot into a temporary Y.Doc
      const resp0 = await fetch(
        `/api/history/download?docId=${encodeURIComponent(docFileID)}&snapshotId=${encodeURIComponent(snapshot.snapshotId)}`
      );
      const { downloadUrl } = await resp0.json();
      console.log('VersionHistoryContext.tsx 7052 › got downloadUrl');

      const resp1 = await fetch(downloadUrl);
      const buffer = await resp1.arrayBuffer();
      console.log('VersionHistoryContext.tsx 7053 › bytes=', buffer.byteLength);

      const tempDoc = new Y.Doc();
      Y.applyUpdate(tempDoc, new Uint8Array(buffer));
      console.log('VersionHistoryContext.tsx 7054 › tempDoc initialized');

      // 2) Inverse-extract into the live document
      liveYDoc.transact(() => {
        // a) Re-insert the map entry into lessonModule.conceptMaps
        const liveLesson = liveYDoc.getMap('lessonModule');
        const liveArr = liveLesson.get('conceptMaps') as Y.Array<any>;
        const subArr = tempDoc.getMap('lessonModule').get('conceptMaps') as Y.Array<any>;
        const entry = subArr.get(0);
        if (entry) {
          liveArr.push([entry]);
          console.log('VersionHistoryContext.tsx › conceptMaps entry restored:', snapshot.mapId);
        }

        // b) Copy namespaced maps: nodes, resources, subtrees
        ['nodes', 'resources', 'subtrees'].forEach(ns => {
          const key = `${ns}:${snapshot.mapId}`;
          const srcMap = tempDoc.getMap<any>(key);
          const dstMap = liveYDoc.getMap<any>(key);
          srcMap.forEach((val, k) => {
            dstMap.set(k, val);
          });
          console.log(`VersionHistoryContext.tsx › restored ${ns} map:`, key);
        });

        console.log('VersionHistoryContext.tsx 7055 › restoreMap transaction complete');
      }, { type: 'system', action: 'restoreMap' });

      setStatusMessage(`✔️ Map restored`);
    } catch (err) {
      console.error('VersionHistoryContext.tsx 7056 › restoreMap error', err);
      setStatusMessage(`❌ Failed to restore map`);
    }
  }, [docFileID, liveYDoc]);


  // Provide context
  return (
    <VersionHistoryContext.Provider
      value={{
        isHistoryOpen,
        isListLoading,
        snapshots,
        isSnapshotLoading,
        selectedSnapshotId,
        openHistory,
        closeHistory,
        selectSnapshot,
        restoreResource,
        statusMessage,
        clearStatus,
        restoreMap,
        fetchDeletedSnapshots,
        
      }}
    >
      {children}
    </VersionHistoryContext.Provider>
  );
};

export default VersionHistoryProvider;
