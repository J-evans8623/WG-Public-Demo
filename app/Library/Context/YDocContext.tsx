
/***********************************************************************************************
 * @file YDocContextv2.tsx
 * @description
 *   This provider owns the lifecycle of the collaborative Y.Doc used across the app and exposes
 *   a minimal, production-ready API for creating/selecting documents, reading/writing metadata,
 *   saving/loading to Firebase Storage, and emitting readiness signals for UI orchestration.
 *   It implements a robust, race-free state machine that normalizes transitions through an
 *   explicit close pass and splits the *select* path into a **three-state** sequence to achieve
 *   fast, cached first paint and then authoritative reconciliation:
 *      1) Close (if a document is open) → normalize to IDLE
 *      2) CacheCheck: attempt to hydrate from local cache and emit `renderReady=true` on hit
 *      3) AuthoritativeLoad: download from storage, hydrate, then set `saveReady=true`
 *   The *create* path remains **two-state** and non-blocking from the UI’s perspective:
 *   Close → Create. We emit `renderReady=true` immediately after creation and `saveReady=true`
 *   once the authoritative identifiers are seeded. The provider never requires callers to close
 *   a document directly: callers express intent via `requestSelectDocument(id)` or
 *   `requestCreateDocument()`, while the machine handles teardown, cache, and network work.
 *   Purposeful console logs (with file+4-digit codes) mark major transitions and data plumbing.
 *   All operations are O(1) or O(N) in the size of Yjs updates; there are no quadratic scans.
 *
 *   Public surface (selected):
 *     - requestSelectDocument(docId) / requestCreateDocument()
 *     - bootPhase, renderReady, saveReady flags (UI gates)
 *     - saveToFirebase(): PURE save op that returns identifiers without mutating provider state
 *     - loadFromFirebase(): Authoritative loader used by the state machine
 *
 *   NOTE: This version finalizes Phase 1 of the proposal by adding an explicit **CACHE_CHECK**
 *   pass for the select flow and emitting `renderReady` immediately on cache hits. The app layer
 *   (Phase 2) will then rely only on these readiness signals and intent APIs.
 ***********************************************************************************************/
import React, {
  createContext,
  useContext,
  useCallback,
  useState,
  useMemo,
  ReactNode,
  useEffect,
  useRef,
  SetStateAction,
  Dispatch
} from 'react';
import * as Y from 'yjs';
import { toast } from 'react-toastify';
import { ConceptNode, LOCAL_ORIGIN } from '@/app/Library/Definitions/Definitions';
import { v4 as uuidv4 } from 'uuid';
import { getUploadUrl, getDownloadUrl, initialUpload } from '@/app/studygraph/(studygraph)/components/utils/storageUrls';
import { takeMapSnapshot as _takeMapSnapshot } from '@/app/studygraph/(studygraph)/components/versionHistory/versionHistory';
import { useAccessLayer } from '@/app/Library/Context/AccessLayerContext';
import { createLessonUnitsMeta } from '../utils/calendar/lessoUnitExtractor';
import { getRandomColor } from '../utils/colorSet';
import { saveDocBytes, loadDocBytes } from '@/app/studygraph/(studygraph)/services/localCacheStore'; // keep existing saver
import { useApiContext } from '@/app/src/context/ApiContext';

// Pure ops: perform I/O + computation only; driver commits outputs.
import { opHydrateFromBytes, opLoadAuth, opCreateLocal, opBootstrapNewDoc } from './ops/pureOps';
import { supersedingCall } from '@/app/src/net/SupersedingCaller';


interface ChatMessage {
  id: number;
  type: 'assistant' | 'user' | 'system' | 'attachment';
  content: string;
}

/**
 * update - 102
 * @file-header (state machine preface)
 * @responsibility
 *   Definitions for the YDocContext boot/switch state machine. The machine:
 *   (1) always closes current doc first; (2) stabilizes at IDLE in pass A;
 *   (3) executes create/select in pass B; (4) never flips active doc twice in one pass.
 */
type BootState =
  | { type: 'IDLE' }
  | { type: 'REQUEST_CREATE' }
  | { type: 'REQUEST_SELECT'; docId: string }
  | { type: 'CLOSING'; prevId: string }
  | { type: 'READY_FOR_CREATE' }   // pass B entry for create
  | { type: 'READY_FOR_SELECT'; docId: string } // pass B entry for select
  // update - 122
  | { type: 'CACHE_CHECK'; docId: string } // new explicit cache pass for fast-paint on select
  | { type: 'CREATING_LOCAL' }           // NEW: local-only materialization
  | { type: 'BOOTSTRAP_NEW'; docId: string }
  | { type: 'LOADING_AUTH'; docId: string }
  
  | { type: 'ACTIVE'; docId: string }
  | { type: 'ERROR'; message: string };

export type ChatReadyPayload = {
  /** Persistent document id (same as metadata.docFileID) */
  docId: string;
  /** Chat array for the doc (empty array if fresh) */
  messages: ChatMessage[];
  /** True when chat.json was missing (404) and we created an empty one */
  fresh: boolean;
};
type ChatReadyListener = (payload: ChatReadyPayload) => void;

// update - 103
/**
 * Result contract for the **pure** save op. This mirrors your agreed spec without creating a
 * separate `opSave`. `saveToFirebase` now returns this shape and performs **no** state mutation.
 */
export interface SaveOpResult {
  persistIds: { storageGeneration: string | null; versionNumber: number | null };
  accessEnvelope?: {
    docId: string;
    role: 'Owner' | 'Editor' | 'Viewer' | 'None';
    signal: 'GRANT_EDIT' | 'EDIT_REVOKED' | null;
    source: 'save' | 'upload' | 'download' | 'yjs' | 'bootstrap';
    at: string;
    publicView?: boolean;
    publicEdit?: boolean;
  } | null;
  fileStoragePath: string;
}

export interface YDocContextType {
  ydoc: Y.Doc;
  snapshotYDoc: Y.Doc | null;
  /** Setter to load or unload a snapshot document from version history. */
  setSnapshotYDoc: (doc: Y.Doc | null) => void;
  /** True if a snapshot is currently active (read-only mode). */
  isReadOnly: boolean;
  fileName: string;
  docFileID: string | null;
  isInitialized: boolean;

  // Document lifecycle
  createNewDocument: () => Promise<{ docId: string; ydoc: Y.Doc }>;
  loadData: (
    fileName: string,
    driveFileId: string | undefined,
    docState: Uint8Array
  ) => Promise<void>;

  // Yjs helpers
  applyUpdate: (update: Uint8Array) => void;
  getState: () => Uint8Array;
  updateFileName: (name: string) => void;
  persistDoc: () => Uint8Array;

  // App helpers
  getLessonModuleJSON: () => string;
  getFileName: () => string;

  // IMPORTANT: save op is now **pure** and returns `SaveOpResult`.                           // update - 104
  saveToFirebase: (chatData?: ChatMessage[]) => Promise<SaveOpResult>;                       // update - 104
  loadFromFirebase: (fileStorageId: string) => Promise<void>;
  getVisibility: () => 'private' | 'public';
  updateVisibility: (v: 'private' | 'public') => void;
  takeMapSnapshot: (mapId: string) => Promise<string>;
  getPersistableBytes: () => Promise<Uint8Array> | Uint8Array;
  isSnapshotActive: () => boolean;
  incrementVersion: () => void;
  version: number;

  // Chat readiness
  addChatReadyListener: (cb: ChatReadyListener) => void;
  removeChatReadyListener: (cb: ChatReadyListener) => void;

  // request helpers for the machine (callers should use these, never close directly)
  requestCreateDocument: () => void;
  requestSelectDocument: (docId: string) => void;

  // optional visibility of machine status (read-only for UI/telemetry)
  bootPhase: 'IDLE' | 'CLOSING' | 'SELECTING' | 'AUTH_LOADING' | 'ACTIVE' | 'ERROR';
  renderReady: boolean;
  saveReady: boolean;
  triggerViewSwitch:boolean;
  setTriggerViewSwitch: Dispatch<SetStateAction<boolean>>;
}

const YDocContext = createContext<YDocContextType | undefined>(undefined);

export const useYDoc = (): YDocContextType => {
  const context = useContext(YDocContext);
  if (!context) {
    throw new Error('useYDoc must be used within YDocProvider');
  }
  return context;
};

interface YDocProviderProps {
  children: ReactNode;
}

export const YDocProvider: React.FC<YDocProviderProps> = ({ children }) => {
  // Initialize state for Y.Doc, snapshot, and supporting services.
  const [ydoc, setYDoc] = useState<Y.Doc>(() => new Y.Doc());
  const [snapshotYDoc, setSnapshotYDoc] = useState<Y.Doc | null>(null);
  const { addFileMeta, updateFileMeta, refreshList } = useApiContext();

  /** Flag to indicate read-only mode. */
  const isReadOnly = snapshotYDoc !== null;

  const [fileName, setFileName] = useState<string>('Untitled Document');
  const [docFileID, setDocFileID] = useState<string | null>(null);
  const [version, setVersion] = useState<number>(0);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [triggerViewSwitch , setTriggerViewSwitch] = useState<boolean>(false);

  // update - 105
  const [visibility, setVisibility] = useState<'private' | 'public'>(() => {
    const v = ydoc.getMap('metadata').get('visibility');
    return v === 'public' ? 'public' : 'private';
  });

  // update - 106
  const [bootPhase, setBootPhase] = useState<'IDLE' | 'CLOSING' | 'SELECTING' | 'AUTH_LOADING' | 'ACTIVE' | 'ERROR'>('IDLE');
  const [renderReady, setRenderReady] = useState<boolean>(false);
  const [saveReady, setSaveReady] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /**
 * 
 * @ref createLocalRef
 * @purpose
 *   Stash local create outputs (docId + bytes) between CREATING_LOCAL → BOOTSTRAP_NEW.
 */
const createLocalRef = useRef<{ docId: string; bytes: Uint8Array } | null>(null);

  const access = useAccessLayer();
  const chatReadyListenersRef = useRef<Set<ChatReadyListener>>(new Set());

  // in-memory identifiers for conflict safety (no UI exposure).
  const lastKnownStorageGenerationRef = useRef<string | null>(null);
  const lastKnownVersionNumberRef = useRef<number | null>(null);

  // update - 107
  const [machine, setMachine] = useState<BootState>({ type: 'IDLE' });

  // update - 108
  const epochRef = useRef<number>(0);
  const inFlightAbort = useRef<AbortController | null>(null);

  // update - 109
  const lastIntentRef = useRef<{ kind: 'create' } | { kind: 'select'; docId: string } | null>(null);

  // update - 110
  /**
   * @function selectDoc
   * @description
   *   Expresses intent to open an existing document by id. The state machine guarantees a safe,
   *   two-pass close→idle phase before performing select, and then drives a three-state
   *   select flow (Close → CacheCheck → AuthoritativeLoad). This call is O(1) and returns
   *   immediately; asynchronous work and readiness signals happen inside the machine.
   */
  const selectDoc = useCallback((docId: string) => {
    lastIntentRef.current = { kind: 'select', docId };
    setMachine({ type: 'REQUEST_SELECT', docId });
    // console.log('YDocContextv2.tsx 4001 › [update - 110] request select', { docId });
  }, []);

  // update - 111
  /**
   * @function createDocReq
   * @description
   *   Expresses intent to create a new document. The machine performs a close→idle pass if needed
   *   and then transitions to create. The create path remains two-state (Close → Create) and emits
   *   `renderReady` immediately after doc materialization. This call is O(1) and returns instantly.
   */
  const createDocReq = useCallback(() => {
    lastIntentRef.current = { kind: 'create' };
    setMachine({ type: 'REQUEST_CREATE' });
    // console.log('YDocContextv2.tsx 4002 › [update - 111] request create');
  }, []);

  // update - 112
  /**
   * @function teardownPreviousDoc
   * @description
   *   Asynchronous cleanup hook for the previously open document. Designed for future side-channel
   *   cleanup (e.g., collab sockets) without mutating the live Y.Doc. Complexity O(1).
   */
  const teardownPreviousDoc = useCallback(async (prevId: string) => {
    // console.log('YDocContextv2.tsx 5001 › [update - 112] teardownPreviousDoc begin', { prevId });
    await Promise.resolve();
    // console.log('YDocContextv2.tsx 5002 › [update - 112] teardownPreviousDoc end', { prevId });
  }, []);

  /**
   * getPersistMap
   * Returns (and creates if missing) the nested `metadata.persist` Y.Map that stores the latest
   * persistence identifiers. This function is O(1) and safe to call frequently.
   */
  const getPersistMap = useCallback((): Y.Map<any> => {
    const meta = ydoc.getMap('metadata');
    let persist = meta.get('persist') as Y.Map<any> | undefined;
    if (!(persist instanceof Y.Map)) {
      persist = new Y.Map();
      meta.set('persist', persist);
      // console.log('YDocContextv2.tsx 3501 › [update-2] persist map created');
    }
    return persist;
  }, [ydoc]);

  /**
   * readPersistFromDoc
   * Reads identifiers from the replicated `metadata.persist` Y.Map. If keys are missing,
   * returns nulls. This is used to build upload preconditions.
   */
  const readPersistFromDoc = useCallback((): {
    storageGeneration: string | null;
    versionNumber: number | null;
  } => {
    const p = getPersistMap();
    const sg = p.get('storageGeneration');
    const vn = p.get('versionNumber');
    const out = {
      storageGeneration: typeof sg === 'string' && sg.trim() ? sg : null,
      versionNumber: typeof vn === 'number' && Number.isFinite(vn) ? vn : null,
    };
    // console.log('YDocContextv2.tsx 3502 › readPersistFromDoc', out);
    return out;
  }, [getPersistMap]);

  /**
   * writePersistToDoc
   * Writes identifiers into the replicated `metadata.persist` map after a successful authoritative
   * operation (server load or confirmed save). This immediately fan-outs to collaborators via Yjs.
   */
  const writePersistToDoc = useCallback((ids: {
    storageGeneration: string | null | undefined;
    versionNumber: number | null | undefined;
    updatedBy?: string;
    source: 'bootstrap' | 'save' | 'retry' | 'conflict' | 'initial';
  }) => {
    const p = getPersistMap();
    ydoc.transact(() => {
      if (ids.storageGeneration != null) p.set('storageGeneration', String(ids.storageGeneration));
      if (ids.versionNumber != null) p.set('versionNumber', Number(ids.versionNumber));
      p.set('updatedAt', Date.now());
      p.set('updatedBy', ids.updatedBy ?? ids.source);
    }, { type: 'system', action: 'persist-ids' });
    // console.log('YDocContextv2.tsx 3503 › writePersistToDoc', ids);
  }, [getPersistMap, ydoc]);

  /**
   * @function emitChatReady
   * @description
   *   Emits a `CHAT_READY` payload to listeners. Complexity O(L) with small L; guarded try/catch
   *   ensures single listener failure does not impact others.
   */
  const emitChatReady = useCallback((payload: ChatReadyPayload) => {
    // console.log('YDocContextv2.tsx 1110 › emitChatReady firing', { docId: payload.docId, count: payload.messages?.length ?? 0, fresh: payload.fresh });
    chatReadyListenersRef.current.forEach((cb) => {
      try {
        cb(payload);
      } catch (err) {
        console.error('YDocContextv2.tsx 1111 › CHAT_READY listener threw', err);
      }
    });
  }, []);

  /**
   * @function addChatReadyListener
   * @description
   *   Registers a callback for `CHAT_READY`. Idempotent given Set semantics.
   */
  const addChatReadyListener = useCallback((cb: ChatReadyListener) => {
    chatReadyListenersRef.current.add(cb);
    // console.log('YDocContextv2.tsx 1112 › addChatReadyListener (pool size)', chatReadyListenersRef.current.size);
  }, []);

  /**
   * @function removeChatReadyListener
   * @description
   *   Unregisters a previously added callback. O(1).
   */
  const removeChatReadyListener = useCallback((cb: ChatReadyListener) => {
    chatReadyListenersRef.current.delete(cb);
    // console.log('YDocContextv2.tsx 1113 › removeChatReadyListener (pool size)', chatReadyListenersRef.current.size);
  }, []);

  /**
   * Applies a given Yjs update to the current Y.Doc.
   * @param update - The Yjs update as a Uint8Array.
   */
  const applyUpdate = useCallback((update: Uint8Array): void => {
    try {
      Y.applyUpdate(ydoc, update);
    } catch (error) {
      console.error('Error applying update:', error);
      toast.error('Failed to apply document update');
    }
  }, [ydoc]);

  /* --- helper: robust version reader (inline to avoid changing module surface) --- */
  const readVersionFromMetadata = (ydocInstance: Y.Doc): number => {
    const raw = ydocInstance.getMap('metadata').get('version');
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    if (typeof raw === 'string' && raw.trim() !== '' && !Number.isNaN(Number(raw))) return Number(raw);
    return 1;
  };

  useEffect(() => {
    if (!snapshotYDoc) return;

    // console.log('YDocContextv2.tsx 7000 › Loaded snapshotYDoc — inspecting contents');

    // 1) Concept maps
    const lessonModule = snapshotYDoc.getMap('lessonModule');
    const cmArray = lessonModule.get('conceptMaps') as Y.Array<any> | undefined;
    const maps = cmArray ? cmArray.toArray() : [];
    // console.log('YDocContextv2.tsx 7001 › snapshot conceptMaps:', maps);

    // 2) For each map, log nodes & resources
    maps.forEach((cm: any) => {
      const mapId = cm.id;
      const nodesKey = `nodes:${mapId}`;
      const resourcesKey = `resources:${mapId}`;

      const nodesMap = snapshotYDoc.getMap<ConceptNode>(nodesKey);
      // console.log('YDocContextv2.tsx 7002 › snapshot nodes entries:', nodesKey, 'count=', nodesMap.size, Array.from(nodesMap.entries()));

      const resMap = snapshotYDoc.getMap<any>(resourcesKey);
      // console.log('YDocContextv2.tsx 7003 › snapshot resources entries:', resourcesKey, 'count=', resMap.size, Array.from(resMap.entries()));
    });
  }, [snapshotYDoc]);

  /**
   * Encodes the current Y.Doc state as a Uint8Array.
   * @returns The encoded Y.Doc state.
   */
  const getState = useCallback((): Uint8Array => {
    return Y.encodeStateAsUpdate(ydoc);
  }, [ydoc]);

  /**
   * IncrementVersion
   * updates version of notebook (robust type coercion + persists into Y.Doc)
   */
  const incrementVersion = useCallback(() => {
    const metadata = ydoc.getMap<any>('metadata');

    const raw = metadata.get('version');
    let publicVersion = 1;
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      publicVersion = raw;
    } else if (typeof raw === 'string' && raw.trim() !== '' && !Number.isNaN(Number(raw))) {
      publicVersion = Number(raw);
    }

    const newVal = publicVersion + 1;
    metadata.set('version', newVal);
    setVersion(newVal);
  }, [ydoc]);

  /**
   * update - 113
   * @function assertDocIdentityOrThrow
   * @description
   *   Validates that the live Y.Doc’s replicated identity matches the intended document id
   *   we are about to save to. Ensures we never save bytes from one Y.Doc into another
   *   document’s storage path due to stale state or navigation races. O(1).
   */
  const assertDocIdentityOrThrow = useCallback((intendedDocId: string): void => {
    const meta = ydoc.getMap('metadata');
    const embeddedDocId =
      (meta.get('docFileID') as string | undefined) ??
      (meta.get('fileId') as string | undefined) ??
      null;

    // console.log('YDocContextv2.tsx 5401 › [update - 113] assertDocIdentityOrThrow', {
    //  intendedDocId,
      //embeddedDocId
    //});

    if (!embeddedDocId || embeddedDocId !== intendedDocId) {
      const err: any = new Error('DOC_ID_MISMATCH');
      err.code = 'DOC_ID_MISMATCH';
      throw err;
    }
  }, [ydoc]);

  /**
   * Persists the current document state by encoding it to a Uint8Array.
   * @returns The encoded Y.Doc state.
   */
  const persistDoc = useCallback((): Uint8Array => {
    return Y.encodeStateAsUpdate(ydoc);
  }, [ydoc]);

  // update - 114
  const getVisibility = useCallback((): 'private' | 'public' => {
    const v = visibility;
    const out = v === 'public' ? 'public' : 'private';
    // console.log('YDocContextv2.tsx 6002 › getVisibility=', out);
    return out;
  }, [visibility]);

  // update - 115
  const updateVisibility = useCallback((v: 'private' | 'public') => {
    ydoc.getMap('metadata').set('visibility', v);
    setVisibility(v);
  }, [ydoc]);

  /**
   * Creates a new document with default settings.
   * Initializes shared maps, arrays, and sets metadata (internal docFileID and fileName).
   */
  const createNewDocument = useCallback(async (): Promise<{ docId: string; ydoc: Y.Doc }> => {
    try {
      setIsInitialized(false);
      const newYDoc = new Y.Doc();
      const newDocId = uuidv4();
      const version = 1.0;
      const defaultConceptMapId = 'map-1';
      const colorCode = getRandomColor();

      // Step 1: Initialize shared maps and arrays.
      newYDoc.transact(() => {
        // Set up metadata with internal docFileID and fileName.
        const metadata = newYDoc.getMap('metadata');
        metadata.clear();
        metadata.set('docFileID', newDocId);
        metadata.set('fileName', 'Untitled Document');
        metadata.set('visibility', 'private');
        metadata.set('version', version);
        if (!(metadata.get('persist') instanceof Y.Map)) {
          metadata.set('persist', new Y.Map());
        }

        setVisibility('private')

        newYDoc.getMap('resources').clear();
        newYDoc.getMap('subtrees').clear();
        // ─── Initialize empty comments map ─────────────────────────
        const postsMap = newYDoc.getMap<Y.Map<any>>('posts');
        postsMap.clear();

        const lessonModule = newYDoc.getMap('lessonModule');
        lessonModule.clear();
        lessonModule.set('title', 'Default Lesson Module');

        const conceptMaps = new Y.Array<any>();
        const defaultConceptMap = {
          id: defaultConceptMapId,
          title: 'Untitled Lesson',
          createdAt: new Date().toISOString()
        };
        conceptMaps.push([defaultConceptMap]);
        lessonModule.set('conceptMaps', conceptMaps);

        const nodesKey = `nodes:${defaultConceptMapId}`;
        const nodesMap = newYDoc.getMap<ConceptNode>(nodesKey);
        nodesMap.clear();
        const rootNode: ConceptNode = {
          id: 'node-1',
          title: 'Root Concept',
          parentNodeId: undefined,
          childrenNodeIds: [],
          x: 0,
          y: 0,
          isRoot: true,
          depth: 0
        };
        nodesMap.set(rootNode.id, rootNode);

        newYDoc.getMap('subtrees').set('sentinel-node', {
          minX: 0,
          maxX: 0,
          minY: 0,
          maxY: 0,
          width: 0,
          height: 0,
          position: { x: 0, y: 0 }
        });
      }, { type: 'system', action: 'reset' });

      // Step 2: Update local state with new metadata.
      setFileName('Untitled Document');
      setDocFileID(newDocId);
      setVersion(version);
      setYDoc(newYDoc);
      setSnapshotYDoc(null);


      // ── [2] Encode bytes & request initiale
      // upload URLs (doc + chat) ─────────────────
    const stateBytes = Y.encodeStateAsUpdate(newYDoc);
    const fileSize = stateBytes.byteLength;

    // console.log('[YDocContextv2.tsx][9703] requesting initialUpload URLs', { docId: newDocId, fileSize });
    const { doc, chat, access: accessEnv } = await initialUpload(newDocId);

    if (accessEnv) {
      // Reconcile with server-provided envelope (source: 'upload')
      access.applySignal(accessEnv);
      // console.log('[YDocContextv2.tsx][9704] applied access envelope from initialUpload', accessEnv);
    }

    // ── [3] PUT document & initialized chat to Storage ──────────────────────────────
    // 3a) document bytes
    const putDoc = await fetch(doc.uploadUrl, {
      method: 'PUT',
      body: new Uint8Array(stateBytes), //
      headers: { 'Content-Type': 'application/octet-stream' },
    });
    if (!putDoc.ok) {
      console.error('[YDocContextv2.tsx][9791] doc PUT failed', { status: putDoc.status, statusText: putDoc.statusText });
      throw new Error(`Doc upload failed: ${putDoc.status} ${putDoc.statusText}`);
    }
    await saveDocBytes(newDocId, stateBytes)    
    // console.log('[YDocContextv2.tsx][9705] doc PUT complete', { path: doc.fileStoragePath });

    // 3b) initialized chat (empty array for new docs)
    const putChat = await fetch(chat.uploadUrl, {
      method: 'PUT',
      body: JSON.stringify([]),
      headers: { 'Content-Type': 'application/json' },
    });
    if (!putChat.ok) {
      console.error('[YDocContextv2.tsx][9792] chat PUT failed', { status: putChat.status, statusText: putChat.statusText });
      throw new Error(`Chat upload failed: ${putChat.status} ${putChat.statusText}`);
    }
    // console.log('[YDocContextv2.tsx][9706] chat PUT complete', { path: chat.fileStoragePath });

    // ── [4] Sync Firestore metadata via /api/document/save ──────────────────────────
    const saveResp = await fetch('/api/document/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        fileName: 'Untitled Document',
        docFileID: newDocId,
        fileStoragePath: doc.fileStoragePath,
        chatPath: chat.fileStoragePath,
        fileSize,
        colorCode,
        version
      }),
    });
    if (!saveResp.ok) {
      console.error('[YDocContextv2.tsx][9793] metadata sync failed', { status: saveResp.status, statusText: saveResp.statusText });
      throw new Error(`Metadata sync failed: ${saveResp.status} ${saveResp.statusText}`);
    }
    // console.log('[YDocContextv2.tsx][9707] metadata sync complete via save.ts', { docId: newDocId });

    // Seed identifiers from save.ts so we avoid any extra identifiers call.
      const saveSeed = await saveResp.json(); 
      const seedStorageGen = saveSeed?.storageGeneration ?? null; 
      const seedVersionNum = typeof saveSeed?.versionNumber === 'number' ? saveSeed.versionNumber : version; 
      writePersistToDoc({ storageGeneration: seedStorageGen, versionNumber: seedVersionNum, updatedBy: 'initial', source: 'initial' }); 
      lastKnownStorageGenerationRef.current = seedStorageGen; 
      lastKnownVersionNumberRef.current = seedVersionNum; 
      // console.log('YDocContextv2.tsx 3524 › [update - 2] seeded persist identifiers from save.ts', { sg: seedStorageGen, vn: seedVersionNum }); 

      setIsInitialized(true);
      toast.success('New document created');
      access.selectDoc(newDocId, { assumeOwner: true });
     // console.log('[YDocContextv2.tsx][9601] selectDoc (assumeOwner) seeded', { docId: newDocId });
      
    emitChatReady({ docId: newDocId, messages: [], fresh: true });
    // console.log('YDocContextv2.tsx 1114 › CHAT_READY emitted for new doc', { docId: newDocId });

    lastKnownStorageGenerationRef.current = null;
    lastKnownVersionNumberRef.current = version;

    refreshList()
      return { docId: newDocId, ydoc: newYDoc };
    } catch (error) {
      console.error('Error creating new document:', error);
      toast.error('Failed to create new document');
      throw error;
    }
    
  }, [writePersistToDoc, access, emitChatReady, refreshList]);

  /**
   * Loads a Y.Doc state (provided as a Uint8Array) into a new Y.Doc instance.
   * Updates local state with persisted metadata from the document.
   *
   * @param fileNameParam     - Default file name if metadata is missing.
   * @param driveFileIdParam  - The *document id* we opened (authoritative for this load).
   * @param docState          - The encoded Y.Doc state (or ZIP archive containing it).
   */
const loadData = useCallback(async (
  fileNameParam: string,
  driveFileIdParam: string | undefined,
  docState: Uint8Array
): Promise<void> => {
  try {
    // console.log('Starting loadData operation...');
    setIsInitialized(false);

    // Fresh Y.Doc each load to avoid carrying over metadata from previous file.
    const newYDoc = new Y.Doc();

    // 1) Apply update (or legacy ZIP extraction → apply)
 try {
      Y.applyUpdate(newYDoc, docState);
    } catch (error) {
      console.error('Y.applyUpdate failed: invalid/unsupported bytes', error);
      throw new Error('Invalid Y.Doc bytes: expected modern Yjs update format.');
    }

    // 2) Normalize metadata (visibility, fileName, doc id)
    const metadataMap = newYDoc.getMap('metadata');

    // Visibility default
    if (!metadataMap.has('visibility')) {
      metadataMap.set('visibility', 'private');
    }
    const visibilityVal: 'private' | 'public' = metadataMap.get('visibility') as any;
    setVisibility(visibilityVal);

    // Compute canonical doc id for THIS load:
    //   Priority: driveFileIdParam (authoritative for the opened doc)
    //             → existing docFileID in the loaded bytes
    //             → legacy 'fileId' (then migrate into 'docFileID')
    let canonicalDocId: string | null = null;
    const loadedDocId = (metadataMap.get('docFileID') as string | undefined) || null;


    canonicalDocId = driveFileIdParam ?? loadedDocId ??  null;

    // CRITICAL: Stamp the canonical doc id into the new Y.Doc so we never carry stale ids.
    newYDoc.transact(() => {
      if (canonicalDocId) {
        metadataMap.set('docFileID', canonicalDocId);
        // If this was a legacy file, migrate once:
      }
      // File name defaulting: prefer embedded, else use param, else generic.
      const embeddedName = metadataMap.get('fileName') as string | undefined;
      const finalName = embeddedName && embeddedName.trim()
        ? embeddedName
        : (fileNameParam && fileNameParam.trim() ? fileNameParam : 'Untitled Document');
      metadataMap.set('fileName', finalName);
    }, { type: 'system', action: 'open-doc-stamp' });

    // Reflect into React state
    const finalFileName = metadataMap.get('fileName') as string;
    setFileName(finalFileName);
    setDocFileID(canonicalDocId);

    /** console.log('loadData › finalized identity', {
      visibility: visibilityVal,
      fileName: finalFileName,
      docFileID: canonicalDocId
    }); **/

    // 3) Reset/seed persistence identifiers to avoid cross-file reuse.
    try {
      const persistMap = (() => {
        let p = metadataMap.get('persist') as Y.Map<any> | undefined;
        if (!(p instanceof Y.Map)) {
          p = new Y.Map();
          metadataMap.set('persist', p);
        }
        return p;
      })();

      newYDoc.transact(() => {
        persistMap.set('storageGeneration', null);
        persistMap.set('versionNumber', null);
        persistMap.set('updatedAt', Date.now());
        persistMap.set('updatedBy', 'initial');
      }, { type: 'system', action: 'persist-reset' });

      if (lastKnownStorageGenerationRef) lastKnownStorageGenerationRef.current = null;
      if (lastKnownVersionNumberRef)     lastKnownVersionNumberRef.current = null;

      // console.log('loadData › persist identifiers cleared');
    } catch (e) {
      console.warn('loadData › could not reset persist identifiers (non-fatal)', e);
    }

    // 4) Initialize local React "version" from Y.Doc metadata (authoritative).
    const loadedVersion = readVersionFromMetadata(newYDoc);
    setVersion(loadedVersion);
    // console.log(`Initialized local version state from Y.Doc metadata: ${loadedVersion}`);

    // 5) Commit document into provider and mark initialized.
    setYDoc(newYDoc);
    setSnapshotYDoc(null);
    setIsInitialized(true);
    // console.log('loadData completed successfully');
  } catch (error) {
    console.error('Error in loadData:', error);
    toast.error('Failed to load document data');
    throw error;
  }
}, []);

  /**
   * update - 116
   * @function getFileName
   * @description
   *   Returns the current file name by reading the authoritative value from the Y.Doc metadata
   *   map. Falls back to React state if metadata is unavailable. Complexity: O(1).
   */
  const getFileName = useCallback((): string => {
    try {
      const meta = ydoc.getMap('metadata');
      const fromDoc = meta.get('fileName');
      const resolved =
        typeof fromDoc === 'string' && fromDoc.trim().length > 0 ? fromDoc : fileName;

      /**  console.log('YDocContextv2.tsx 7401 › getFileName resolved', {
        fromDoc,
        fallback: fileName,
        result: resolved,
      });*/

      return resolved;
    } catch (err) {
      console.error('YDocContextv2.tsx 7491 › getFileName error; falling back to local state', err);
      return fileName;
    }
  }, [ydoc, fileName]);

  /**
   * Updates the current file name both in local state and in the Y.Doc metadata.
   * @param name - The new file name.
   */
  const updateFileName = useCallback((name: string): void => {
    const updatedName = name || fileName;
    setFileName(updatedName);
    ydoc.transact(() => {
      const metadataMap = ydoc.getMap('metadata');
      metadataMap.set('fileName', updatedName);
    }, LOCAL_ORIGIN);
  }, [fileName, ydoc]);

  /**
   * Retrieves the lesson module portion of the Y.Doc as a JSON string.
   * @returns The lesson module JSON string.
   */
  const getLessonModuleJSON = useCallback((): string => {
    const lessonModule = ydoc.getMap('lessonModule');
    return JSON.stringify(lessonModule.toJSON());
  }, [ydoc]);

  // YDocContextv2.tsx — updated function (PURE SAVE)
  /**
   * update - 117
   * @function saveToFirebase
   * @description
   *   PURE SAVE OP: Uploads the current document (and optional chat) using conditional
   *   preconditions derived from `metadata.persist`, then calls `/api/document/save`
   *   to sync metadata. **No Provider/AccessLayer/Y.Doc mutation occurs here.**
   *   Returns `SaveOpResult` so the caller can decide how to commit identifiers/UI.
   *   Performs a single retry on precondition conflict.
   *
   *   Complexity: O(N) dominated by encoding/PUT body; control logic is O(1).
   */
  const saveToFirebase = useCallback(
    async (chatData?: ChatMessage[]): Promise<SaveOpResult> => {                // update - 117
      if (!docFileID) throw new Error('No docFileID');

      // 1) Robust current version read for payload; NO state mutation here.
      const currentVersion = readVersionFromMetadata(ydoc);                      // update - 117
      setVersion(currentVersion);

      // 2) Optional meta creation (not persisted here) — safe to compute.
      let lessonUnitsMeta: any | undefined;
      try {
        assertDocIdentityOrThrow(docFileID);
        lessonUnitsMeta = createLessonUnitsMeta(ydoc);
         /** // console.log('YDocContextv2.tsx 9801 › lessonUnitsMeta prepared', {
          units: lessonUnitsMeta?.totalUnits ?? 0,
        }); **/
      } catch (err) {
        console.warn('YDocContextv2.tsx 9802 › lessonUnitsMeta generation failed (non-fatal)', err);
      }

      const { storageGeneration: expectSG, versionNumber: expectVN } = readPersistFromDoc();

      const bytes = Y.encodeStateAsUpdate(ydoc);                                 // update - 117 (no setState)
      const fileSize = bytes.byteLength;

      let docUrl: string;
      let docPath: string;

      // 3) Upload URL (with preconditions) + retry on conflict
      try {
        const pre = {
          expectStorageGeneration: expectSG,
          expectVersionNumber: expectVN,
        };
        const docTicket = await getUploadUrl(docFileID, 'doc', pre);
        docUrl = docTicket.uploadUrl;
        docPath = docTicket.fileStoragePath;
        
      } catch (e: any) {
        if (e?.code === 409 && e?.body?.conflict) {
          const c = e.body.conflict as { path: string; storageGeneration: string | null; versionNumber: number | null; };
          console.warn('YDocContextv2.tsx 9804 › precondition conflict; reconciling & retrying (pure)', c); // update - 117
          const retryPre = {
            expectStorageGeneration: c.storageGeneration,
            expectVersionNumber: c.versionNumber,
          };
          const docTicket = await getUploadUrl(docFileID, 'doc', retryPre);
          docUrl = docTicket.uploadUrl;
          docPath = docTicket.fileStoragePath;

        } else {
          console.error('YDocContextv2.tsx 9890 › upload-url error (doc)', e);
          throw e;
        }
      }

      // 4) PUT document bytes (pure I/O)
      const putDoc = await fetch(docUrl!, {
        method: 'PUT',
        body: new Uint8Array(bytes),
        headers: { 'Content-Type': 'application/octet-stream' },
      });
      if (!putDoc.ok) {
        console.error('YDocContextv2.tsx 9891 › doc PUT failed', {
          status: putDoc.status,
          text: putDoc.statusText,
        });
        throw new Error(`Doc upload failed: ${putDoc.status} ${putDoc.statusText}`);
      }
      // optional local cache write is OK (no Provider mutation)
      await saveDocBytes(docFileID, bytes);                                      // update - 117
      // console.log('YDocContextv2.tsx 9806 › doc PUT complete (pure)', { path: docPath }); // update - 117

      // 5) Optional chat upload (pure I/O)
      let chatPath: string | undefined;
      if (chatData) {
        const chatTicket = await getUploadUrl(docFileID, 'chat');
        const putChat = await fetch(chatTicket.uploadUrl, {
          method: 'PUT',
          body: JSON.stringify(chatData),
          headers: { 'Content-Type': 'application/json' },
        });
        if (!putChat.ok) {
          console.error('YDocContextv2.tsx 9892 › chat PUT failed', {
            status: putChat.status,
            text: putChat.statusText,
          });
          throw new Error(`Chat upload failed: ${putChat.status} ${putChat.statusText}`);
        }
        chatPath = chatTicket.fileStoragePath;
        // console.log('YDocContextv2.tsx 9807 › chat PUT complete (pure)', { path: chatPath }); // update - 117
      }

      // 6) Sync metadata (authoritative) — still pure (no Provider mutation)
      
      const savePayload: any = {
        fileName,
        docFileID,
        fileStoragePath: docPath!,
        chatPath,
        fileSize,
        version: currentVersion,
      };
      if (lessonUnitsMeta) savePayload.lessonUnitsMeta = lessonUnitsMeta;


      const key = `docSave:${docFileID}`;                                        // update - 118
    const makeRequest = (signal: AbortSignal, payload: unknown) =>             // update - 118
      fetch('/api/document/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal,
        body: JSON.stringify(payload),
      });

      const resp = await supersedingCall(key, savePayload, makeRequest);
      if (!resp) {
      // We’re inside a Retry-After window; a single timer is scheduled. Return a safe, optimistic result.
                                                                       // update - 118
      return {
        persistIds: {
          storageGeneration: null,          // will be reconciled by the scheduled retry
          versionNumber: currentVersion,    // optimistic: we just uploaded these bytes
        },
        accessEnvelope: null,
        fileStoragePath: docPath!,
      };
    }
    
      if (!resp.ok) {
        console.error('YDocContextv2.tsx 9893 › save.ts rejected (pure)', {
          status: resp.status,
          text: resp.statusText,
        });
        throw new Error(`Meta sync failed: ${resp.status} ${resp.statusText}`);
      }

      const saveResult = await resp.json();

      // 7) Build **pure** result — caller decides whether/how to commit markers/UI
      const sg = saveResult?.storageGeneration ?? null;
      const vn =
        typeof saveResult?.versionNumber === 'number'
          ? saveResult.versionNumber
          : currentVersion;

      // console.log('YDocContextv2.tsx 9810 › pure save result ready', { sg, vn, path: docPath }); // update - 117

      const accessEnvelope = saveResult?.access ?? null;

      const result: SaveOpResult = {
        persistIds: { storageGeneration: sg, versionNumber: vn },
        accessEnvelope,
        fileStoragePath: docPath!,
      };

      return result;
    },
    [assertDocIdentityOrThrow, docFileID, fileName, readPersistFromDoc, ydoc]   // update - 117
  );

  /**
   * update - 118
   * @function loadFromFirebase
   * @description
   *   Loads a document from Firebase Storage using signed download URLs, applies the Yjs state,
   *   seeds identifiers to `metadata.persist`, and emits CHAT_READY when chat is hydrated.
   *   (This remains non-pure by design; it is part of the boot/switch machine.)
   */
  const loadFromFirebase = useCallback(
    async (fileStorageId: string): Promise<void> => {
      // console.log('YDocContextv2.tsx 9901 › loadFromFirebase start', { fileStorageId });

      const idFromPath =
        fileStorageId.match(/^documents\/(.+)\.bloomdocx$/)?.[1] ?? fileStorageId;

      const { downloadUrl: dUrl, access: accessData, storageGeneration, versionNumber } =
        await getDownloadUrl(idFromPath, 'doc');


    
        access.setRole(accessData.docId, accessData.role)
        access.selectDoc(accessData.docId);


      writePersistToDoc({
        storageGeneration: storageGeneration ?? null,
        versionNumber: typeof versionNumber === 'number' ? versionNumber : null,
        source: 'bootstrap',
      });
      lastKnownStorageGenerationRef.current = storageGeneration ?? null;
      lastKnownVersionNumberRef.current = typeof versionNumber === 'number' ? versionNumber : null;


      try {
        const response = await fetch(dUrl);
        if (!response.ok) {
          throw new Error(`Failed to load document: ${response.status} ${response.statusText}`);
        }
        const buffer = await response.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        await saveDocBytes(idFromPath, bytes);
        await loadData(fileName, idFromPath, new Uint8Array(buffer));
        //manager.confirmDocumentReady(idFromPath);
        // console.log('YDocContextv2.tsx 9904 › Y.Doc hydrated from download');

        // Try to fetch chat; 404 means “fresh”
        const { downloadUrl: cUrl } = await getDownloadUrl(idFromPath, 'chat');
        let chatData: ChatMessage[] = [];
        let fresh = false;
        try {
          const chatResp = await fetch(cUrl);
          if (chatResp.ok) chatData = await chatResp.json();
          else if (chatResp.status === 404) fresh = true;
          else throw new Error(`Chat download failed: ${chatResp.status} ${chatResp.statusText}`);
        } catch (err) {
          console.warn('YDocContextv2.tsx 9991 › chat fetch failed (non-fatal)', err);
        }

        emitChatReady({ docId: idFromPath, messages: Array.isArray(chatData) ? chatData : [], fresh });

        return;
      } catch (error) {
        console.error('YDocContextv2.tsx 9999 › loadFromFirebase error', error);
        toast.error('Failed to load document from Firebase');
        return;
      }
    },
    [access, emitChatReady, fileName, loadData, writePersistToDoc]
  );

  /**
   * takeMapSnapshotCallback
   *
   * Front-end wrapper around the versionHistory service. Logs entry and exit for observability.
   */
  const takeMapSnapshotCallback = useCallback(
    async (mapId: string): Promise<string> => {
      if (!docFileID) {
        console.error('YDocContextv2.tsx 6007 › No docFileID for snapshot');
        throw new Error('Cannot snapshot: missing docFileID');
      }
      // console.log('YDocContextv2.tsx 6007 › Initiating takeMapSnapshot for', mapId);
      const snapshotId = await _takeMapSnapshot(ydoc, docFileID, mapId);
      // console.log('YDocContextv2.tsx 6007 › takeMapSnapshot completed snapshotId=', snapshotId);
      return snapshotId;
    },
    [ydoc, docFileID]
  );

  /**
   * @function getPersistableBytes
   * @description
   *   Returns the current Y.Doc bytes in the exact format the server persists.
   */
  const getPersistableBytes = useCallback((): Uint8Array => {
    return persistDoc();
  }, [persistDoc]);

  /**
   * @function isSnapshotActive
   * @description
   *   Indicates whether a read-only snapshot (from version history) is mounted.
   */
  const isSnapshotActive = useCallback((): boolean => {
    return snapshotYDoc !== null;
  }, [snapshotYDoc]);

  //------------------------------ commit utilities--------------------------------------------


/**
 * @function commitHydratedDoc
 * @purpose
 *   Commit the result of a PURE hydrate op (opHydrateFromBytes) into provider state.
 *   This function centralizes the *only* place where we mutate YDoc/metadata fields
 *   based on hydration results.
 * @steps
 *   1) Swap in the Y.Doc produced by the op.
 *   2) Commit identity & metadata: docId, fileName, visibility, version.
 *   3) Clear any mounted snapshot (authoritative or cache materialization).
 */
const commitHydratedDoc = useCallback((
  out: { ydoc: Y.Doc; fileName: string; docId: string | null; visibility: 'private'|'public'; version: number; }
) => {
  // (1) Swap Y.Doc
  setYDoc(out.ydoc);

  // (2) Identity & metadata
  if (out.docId) setDocFileID(out.docId);
  setFileName(out.fileName);
  setVisibility(out.visibility);
  setVersion(out.version);

  // (3) Ensure live mode
  setSnapshotYDoc(null);
}, []);


// update - 128
/**
 * @function commitPersistIds
 * @purpose
 *   Commit authoritative storage identifiers into the replicated persist map.
 * @steps
 *   1) Write storageGeneration/versionNumber into Y.Doc metadata.persist (single source of truth)
 *   2) Mirror into "lastKnown" refs (non-UI).
 */
const commitPersistIds = useCallback((
  ids: { storageGeneration: string | null; versionNumber: number | null },
  source: 'bootstrap' | 'save' | 'initial' | 'retry' | 'conflict' = 'bootstrap'
) => {
  writePersistToDoc({
    storageGeneration: ids.storageGeneration ?? null,
    versionNumber: ids.versionNumber ?? null,
    source
  });
  lastKnownStorageGenerationRef.current = ids.storageGeneration ?? null;
  lastKnownVersionNumberRef.current = ids.versionNumber ?? null;
}, [writePersistToDoc]);




  //--------------------------------- FILE SWITCHING STATE MACHINE -----------------------------

  /**
   * update - 123
   * @effect boot/switch state machine
   * @description
   *   Drives document switching with deterministic passes. For *select*, we now perform
   *   an explicit **CACHE_CHECK**: if cached bytes exist, we materialize them into a fresh
   *   Y.Doc, set `renderReady=true` immediately for fast paint, and continue to the
   *   authoritative load which finally sets `saveReady=true`. For *create*, we run a
   *   two-state path (Close → Create) and set both readiness flags after creation.
   *   Abort/epoch guards ensure stale async work is dropped. All transitions are O(1),
   *   with O(N) only when applying/encoding Yjs bytes.
   */
  useEffect(() => {
    let aborted = false;
    const epoch = ++epochRef.current;
    inFlightAbort.current?.abort();
    const ac = new AbortController();
    inFlightAbort.current = ac;

    const isStale = () => aborted || ac.signal.aborted || epochRef.current !== epoch;

    (async () => {
      try {
        switch (machine.type) {

          case 'REQUEST_CREATE': {
            if (docFileID) {
              setBootPhase('CLOSING');
              setMachine({ type: 'CLOSING', prevId: docFileID });
              // console.log('YDocContextv2.tsx 8003 › REQUEST_CREATE (has active) → CLOSING');
            } else {
              setBootPhase('IDLE'); // pass A end
              setMachine({ type: 'READY_FOR_CREATE' }); // pass B entry
              // console.log('YDocContextv2.tsx 8004 › REQUEST_CREATE (idle) → READY_FOR_CREATE');
            }
            return;
          }

          case 'REQUEST_SELECT': {
            if (docFileID) {
              setBootPhase('CLOSING');
              setMachine({ type: 'CLOSING', prevId: docFileID });
              // console.log('YDocContextv2.tsx 8005 › REQUEST_SELECT (has active) → CLOSING');
            } else {
              setBootPhase('IDLE'); // pass A end
              setMachine({ type: 'READY_FOR_SELECT', docId: machine.docId }); // pass B entry
              // console.log('YDocContextv2.tsx 8006 › REQUEST_SELECT (idle) → READY_FOR_SELECT', { docId: machine.docId });
            }
            return;
          }

          case 'CLOSING': {
            await teardownPreviousDoc(machine.prevId);
            if (isStale()) return;
            setDocFileID(null);
            setRenderReady(false);
            setSaveReady(false);
            access.clearDoc();
            setBootPhase('IDLE');
            // console.log('YDocContextv2.tsx 8007 › CLOSING → IDLE', { prevId: machine.prevId });

            const intent = lastIntentRef.current;
            if (intent?.kind === 'create') setMachine({ type: 'READY_FOR_CREATE' });
            else if (intent?.kind === 'select' && intent.docId) {
              setMachine({ type: 'READY_FOR_SELECT', docId: intent.docId });
            } else {
              setMachine({ type: 'IDLE' });
            }
            return;
          }

          case 'READY_FOR_CREATE': {
            setBootPhase('SELECTING');
            setMachine({ type: 'CREATING_LOCAL' });
            // console.log('YDocContextv2.tsx 8008 › READY_FOR_CREATE → CREATING');
            return;
          }

          case 'CREATING_LOCAL': {
  const local = opCreateLocal();

  // (1) Commit local doc for instant paint
  commitHydratedDoc({
    ydoc: local.ydoc,
    fileName: local.fileName,
    docId: local.docId,
    visibility: local.visibility,
    version: local.version,
  });

  // (2) UI gates: paint now, save later
  setRenderReady(true);
  setSaveReady(false);
  setBootPhase('SELECTING');
  setTriggerViewSwitch(true);

  // (3) Handoff & transition
  createLocalRef.current = { docId: local.docId, bytes: local.bytes };
  setMachine({ type: 'BOOTSTRAP_NEW', docId: local.docId });
  // console.log('YDocContextv2.tsx › [update - 136] CREATING_LOCAL → BOOTSTRAP_NEW', { docId: local.docId });
  return;
} 

case 'BOOTSTRAP_NEW': {
  const handoff = createLocalRef.current;
  if (!handoff || handoff.docId !== machine.docId) {
    console.error('YDocContextv2.tsx › [update - 137] Missing local create handoff; aborting bootstrap');
    setMachine({ type: 'ERROR', message: 'Create handoff missing' });
    setBootPhase('ERROR');
    return;
  }

  try {
    const boot = await opBootstrapNewDoc({ docId: handoff.docId, bytes: handoff.bytes });
    if (isStale()) return;

    // (2) Reconcile identifiers, access, chat
    commitPersistIds(boot.identifiers, 'bootstrap');
    access.applySignal(boot.accessEnvelope);
    access.selectDoc(handoff.docId, { assumeOwner: true });
    emitChatReady({ docId: handoff.docId, messages: boot.chat, fresh: boot.chatFresh });

    // (3) Promote to ACTIVE now that it’s authoritative
    setSaveReady(true);
    setBootPhase('ACTIVE');
    setMachine({ type: 'ACTIVE', docId: handoff.docId });
    // console.log('YDocContextv2.tsx › [update - 137] BOOTSTRAP_NEW → ACTIVE', { docId: handoff.docId });

    // cleanup handoff
    createLocalRef.current = null;
  } catch (e) {
    console.warn('YDocContextv2.tsx › [update - 137] bootstrap failed (soft). Doc remains usable; save pending.', e);
    // keep UI usable, allow retry (autosave/manual) to reconcile later
    setSaveReady(false);
    setBootPhase('SELECTING');
  }
  return;
}

          case 'READY_FOR_SELECT': {
            // New three-pass select: step 1 is CACHE_CHECK
            setBootPhase('SELECTING');
            setMachine({ type: 'CACHE_CHECK', docId: machine.docId }); // update - 124
            // console.log('YDocContextv2.tsx 8010a › READY_FOR_SELECT → CACHE_CHECK', { docId: machine.docId }); // update - 124
            return;
          }

          // update - 125
          case 'CACHE_CHECK': {
            try {
              // Attempt to hydrate from local cache for fast paint
              const cached = await loadDocBytes(machine.docId);
              const hasCache = cached instanceof Uint8Array && cached.byteLength > 0;
              // console.log('YDocContextv2.tsx 8010b › CACHE_CHECK result', { docId: machine.docId, hasCache, bytes: hasCache ? cached.byteLength : 0 });

              if (hasCache) {
                // Materialize cached Y.Doc into provider and emit renderReady immediately
                //await loadData('Untitled Document', machine.docId, cached);
                const hydrated = await opHydrateFromBytes({
                 bytes: cached,
                  fileNameFallback: 'Untitled Document',
                docIdHint: machine.docId,
                });
                if (isStale()) return;
                commitHydratedDoc(hydrated);

                 // 4) UI signals: render-ready only (authoritative comes next)
                setRenderReady(true);
                setTriggerViewSwitch(true);
                setSaveReady(false); // authoritative not ready yet
                // console.log('YDocContextv2.tsx 8010c › CACHE_CHECK → renderReady=true (fast paint)', { docId: machine.docId });
              }
            } catch (e) {
              console.warn('YDocContextv2.tsx 8010d › CACHE_CHECK failed (non-fatal, proceed to auth load)', e);
            }
            // proceed to authoritative load regardless of cache hit/miss
            setMachine({ type: 'LOADING_AUTH', docId: machine.docId });
            // console.log('YDocContextv2.tsx 8010e › CACHE_CHECK → LOADING_AUTH', { docId: machine.docId });
            return;
          }

          case 'LOADING_AUTH': {
            setBootPhase('AUTH_LOADING');
            //await loadFromFirebase(machine.docId);
             // 1) PURE authoritative load: bytes + identifiers + access + ALWAYS chat
            const auth = await opLoadAuth({ docId: machine.docId });
            if (isStale()) return;
            const hydrated = await opHydrateFromBytes({
            bytes: auth.bytes,
            fileNameFallback: 'Untitled Document',
            docIdHint: auth.docId,
            });
             if (isStale()) return;
            commitHydratedDoc(hydrated);

            // 3) Commit identifiers, access, chat (driver is the only mutator)
            commitPersistIds(auth.identifiers, 'bootstrap');
            access.applySignal(auth.accessEnvelope);
            access.selectDoc(auth.docId);
            emitChatReady({ docId: auth.docId, messages: auth.chat, fresh: auth.chatFresh });


            //const meta = ydoc.getMap('metadata');
            //const id = (meta.get('docFileID') as string | undefined) ?? machine.docId;
            //setDocFileID(id);
            setRenderReady(true);
            setSaveReady(true);
            setBootPhase('ACTIVE');
            setMachine({ type: 'ACTIVE', docId: auth.docId });
            // console.log('YDocContextv2.tsx 8011 › LOADING_AUTH → ACTIVE', { docId: auth.docId });
            setTriggerViewSwitch(true);
            return;
          }

          case 'ACTIVE':
          case 'IDLE': {
            // No-op stable states
            return;
          }

          case 'ERROR': {
            // Leave to UI; callers may request again.
            return;
          }
        }
      } catch (e: any) {
        if (isStale()) return;
        setError(e?.message || 'Initialization failed');
        setBootPhase('ERROR');
        setMachine({ type: 'ERROR', message: e?.message || 'Initialization failed' });
        console.error('YDocContextv2.tsx 8099 › machine error', e);
      }
    })();

    return () => {
      aborted = true;
      ac.abort();
    };
  }, [machine, docFileID, access,  teardownPreviousDoc, ydoc, loadData, commitHydratedDoc, commitPersistIds, emitChatReady]);

  //--------------------------------- END STATE MACHINE --------------------------------

  /**
   * Memoizes and returns the context value for YDocContext.
   */
  const value = useMemo<YDocContextType>(() => ({
    ydoc,
    snapshotYDoc,
    setSnapshotYDoc,
    isReadOnly,
    fileName,
    docFileID,
    isInitialized,

    // lifecycle
    createNewDocument,
    applyUpdate,
    getState,
    updateFileName,
    loadData,
    persistDoc,

    // app helpers
    getLessonModuleJSON,
    getFileName,
    saveToFirebase,               // update - 120 (pure op exposed)
    loadFromFirebase,
    getVisibility,
    updateVisibility,
    takeMapSnapshot: takeMapSnapshotCallback,
    getPersistableBytes,
    isSnapshotActive,
    incrementVersion,
    version,

    // chat readiness
    addChatReadyListener,
    removeChatReadyListener,

    // request helpers + machine visibility
    requestCreateDocument: createDocReq,
    requestSelectDocument: selectDoc,
    bootPhase,
    renderReady,
    saveReady,
    triggerViewSwitch,
    setTriggerViewSwitch
  }), [ydoc, snapshotYDoc, isReadOnly, fileName, docFileID, isInitialized, createNewDocument, applyUpdate, getState, updateFileName, loadData, persistDoc, getLessonModuleJSON, getFileName, saveToFirebase, loadFromFirebase, getVisibility, updateVisibility, takeMapSnapshotCallback, getPersistableBytes, isSnapshotActive, incrementVersion, version, addChatReadyListener, removeChatReadyListener, createDocReq, selectDoc, bootPhase, renderReady, saveReady, triggerViewSwitch]);

  return (
    <YDocContext.Provider value={value}>
      {children}
    </YDocContext.Provider>
  );
};

export default YDocProvider;
