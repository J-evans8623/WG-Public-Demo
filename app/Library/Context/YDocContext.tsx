/***********************************************************************************************
 * @file YDocContext.tsx
 * @description
 *   Provides a React context (YDocContext) for managing the Y.Doc state, document metadata,
 *   and file persistence with Firebase Storage.
 *
 *   This update ensures that when a document is created or loaded, the document's persistent
 *   identifier (docFileID) and the file name are stored in the Y.Doc metadata. This allows
 *   subsequent saves to update the same file instead of creating new files, and preserves the
 *   file name across loads.
 *
 *
 * Responsibilities:
 *   - Manage the Y.Doc state.
 *   - Create and load document state, including persisting metadata.
 *   - Expose methods to update and retrieve document state.
 *   - Provide migration functionality for legacy .bloomdocx files.
 *
 * @author 
 * @date 
 ***********************************************************************************************/
import DocumentAccessManager from '@/app/studygraph/(studygraph)/components/hooks/access/DocumentAccessManager';
import React, {
  createContext,
  useContext,
  useCallback,
  useState,
  useMemo,
  ReactNode,
  useEffect,
  useRef
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
import { saveDocBytes } from '@/app/studygraph/(studygraph)/services/localCacheStore';
import { useApiContext } from '@/app/src/context/ApiContext';


interface ChatMessage {
  id: number;
  type: 'assistant' | 'user' | 'system' | 'attachment';
  content: string;
}


export type ChatReadyPayload = {
  /** Persistent document id (same as metadata.docFileID) */
  docId: string;
  /** Chat array for the doc (empty array if fresh) */
  messages: ChatMessage[];
  /** True when chat.json was missing (404) and we created an empty one */
  fresh: boolean;
};
type ChatReadyListener = (payload: ChatReadyPayload) => void;

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
  createNewDocument: () => Promise<string>;
  loadData: (
    fileName: string,
    driveFileId: string | undefined,
    docState: Uint8Array
  ) => Promise<void>;
  applyUpdate: (update: Uint8Array) => void;
  getState: () => Uint8Array;
  updateFileName: (name: string) => void;
  persistDoc: () => Uint8Array;
  getLessonModuleJSON: () => string;
  getFileName: () => string;
  saveToFirebase: (chatData?:ChatMessage[]) => Promise<void>;
  loadFromFirebase: (fileStorageId: string) => Promise<void>;
  getVisibility: () => 'private' | 'public';
  updateVisibility: (v: 'private' | 'public') => void;
  takeMapSnapshot: (mapId: string) => Promise<string>
  getPersistableBytes: () => Promise<Uint8Array> | Uint8Array; // NEW (Phase 5)
  isSnapshotActive: () => boolean;   
  incrementVersion: () => void;
  version:number,
  addChatReadyListener: (cb: ChatReadyListener) => void;
  removeChatReadyListener: (cb: ChatReadyListener) => void;
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
  // Initialize state for Y.Doc, fileName, driveFileId (Firebase path), internal docFileID, and initialization flag.
  const [ydoc, setYDoc] = useState<Y.Doc>(() => new Y.Doc()); // live Y doc
  const [snapshotYDoc, setSnapshotYDoc] = useState<Y.Doc | null>(null);
  const {addFileMeta, updateFileMeta, refreshList } = useApiContext();

  /** Flag to indicate read-only mode. */
  const isReadOnly = snapshotYDoc !== null;

  const [fileName, setFileName] = useState<string>('Untitled Document');
  const [docFileID, setDocFileID] = useState<string | null>(null);
  const [version, setVersion] = useState<number>(0);
  const [isInitialized, setIsInitialized] = useState<boolean>(false); 
  const [visibility, setVisibility] = useState<'private'|'public'>(() => {
  const v = ydoc.getMap('metadata').get('visibility');
  return v === 'public' ? 'public' : 'private';
});
  const access = useAccessLayer();
  const chatReadyListenersRef = useRef<Set<ChatReadyListener>>(new Set());

  //in-memory identifiers for conflict safety (no UI exposure yet).
  // These refs are O(1) to read/write and do not trigger re-renders.
  const lastKnownStorageGenerationRef = useRef<string | null>(null);
  const lastKnownVersionNumberRef = useRef<number | null>(null);


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
      console.log('YDocContext.tsx 3501 › [update-2] persist map created');
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
    console.log('YDocContext.tsx 3502 › readPersistFromDoc', out);
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
    console.log('YDocContext.tsx 3503 › writePersistToDoc', ids);
  }, [getPersistMap, ydoc]);


  /**
   * @function emitChatReady
   * @description
   *   (1) Emits the `CHAT_READY` payload to all registered listeners in insertion order;
   *   (2) Logs a single concise line for observability; (3) Intentionally synchronous.
   *   The function is O(L) where L is the listener count, which is expected to be tiny.
   */
  const emitChatReady = useCallback((payload: ChatReadyPayload) => {
    console.log('YDocContext.tsx 1110 › emitChatReady firing', { docId: payload.docId, count: payload.messages?.length ?? 0, fresh: payload.fresh });
    chatReadyListenersRef.current.forEach((cb) => {
      try {
        cb(payload);
      } catch (err) {
        // Listener errors should never break the provider.
        console.error('YDocContext.tsx 1111 › CHAT_READY listener threw', err);
      }
    });
  }, []);

  /**
   * @function addChatReadyListener
   * @description
   *   Registers a callback for `CHAT_READY`. Idempotent with respect to duplicate
   *   function references thanks to the Set. Returns void; caller should remove on unmount.
   */
  const addChatReadyListener = useCallback((cb: ChatReadyListener) => {
    chatReadyListenersRef.current.add(cb);
    console.log('YDocContext.tsx 1112 › addChatReadyListener (pool size)', chatReadyListenersRef.current.size);
  }, []);

  /**
   * @function removeChatReadyListener
   * @description
   *   Unregisters a previously added callback. Safe to call even if the callback is not
   *   present. Operates in O(1) average time due to Set semantics.
   */
  const removeChatReadyListener = useCallback((cb: ChatReadyListener) => {
    chatReadyListenersRef.current.delete(cb);
    console.log('YDocContext.tsx 1113 › removeChatReadyListener (pool size)', chatReadyListenersRef.current.size);
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
  return 1; // sensible legacy/default fallback
};


  useEffect(() => {
    if (!snapshotYDoc) return;

    console.log('YDocContext.tsx 7000 › Loaded snapshotYDoc — inspecting contents');

    // 1) Concept maps
    const lessonModule = snapshotYDoc.getMap('lessonModule');
    const cmArray = lessonModule.get('conceptMaps') as Y.Array<any> | undefined;
    const maps = cmArray ? cmArray.toArray() : [];
    console.log('YDocContext.tsx 7001 › snapshot conceptMaps:', maps);

    // 2) For each map, log nodes & resources
    maps.forEach((cm: any) => {
      const mapId = cm.id;
      const nodesKey = `nodes:${mapId}`;
      const resourcesKey = `resources:${mapId}`;

      const nodesMap = snapshotYDoc.getMap<ConceptNode>(nodesKey);
      console.log(
        'YDocContext.tsx 7002 › snapshot nodes entries:',
        nodesKey,
        'count=',
        nodesMap.size,
        Array.from(nodesMap.entries())
      );

      const resMap = snapshotYDoc.getMap<any>(resourcesKey);
      console.log(
        'YDocContext.tsx 7003 › snapshot resources entries:',
        resourcesKey,
        'count=',
        resMap.size,
        Array.from(resMap.entries())
      );
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

  // Read raw value (could be number, string, undefined, or legacy shape)
  const raw = metadata.get('version');

  // Coerce to a safe number with sensible default (1)
  let publicVersion = 1;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    publicVersion = raw;
  } else if (typeof raw === 'string' && raw.trim() !== '' && !Number.isNaN(Number(raw))) {
    publicVersion = Number(raw);
  }

  // Bump deterministically
  const newVal = publicVersion + 1;

  // NOTE: no ydoc.transact() here — caller must perform a ydoc.transact()
  // if they need the version bump to be atomic with other Y.Doc changes.
  metadata.set('version', newVal);

  // Mirror into React state for UI
  setVersion(newVal);
}, [ydoc]);

 /**
 * update - 4
 * @function assertDocIdentityOrThrow
 * @description
 *   Validates that the live Y.Doc’s replicated identity matches the intended document id
 *   we are about to save to. This ensures we never save bytes from one Y.Doc into another
 *   document’s storage path due to stale state or navigation races. The function reads the
 *   authoritative id from `metadata.docFileID` (and falls back to legacy `fileId`), logs the
 *   values, and throws an error with a stable code (`DOC_ID_MISMATCH`) if they differ.
 *   Time complexity: O(1). Can be safely called on every save attempt.
 */
const assertDocIdentityOrThrow = useCallback((intendedDocId: string): void => {
  // [Step 1] Read identity from replicated metadata (O(1) map access)
  const meta = ydoc.getMap('metadata');
  const embeddedDocId =
    (meta.get('docFileID') as string | undefined) ??
    (meta.get('fileId') as string | undefined) ??
    null;

  // [Step 2] Log both ids for observability
  console.log('YDocContext.tsx 5401 › [update - 4] assertDocIdentityOrThrow', {
    intendedDocId,
    embeddedDocId
  });

  // [Step 3] Throw a strongly-typed error to be caught by callers (autosave/manual save)
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

    const getVisibility = useCallback((): 'private' | 'public' => {
    const v = visibility
    const out = v === 'public' ? 'public' : 'private';
    console.log('YDocContext.tsx 6002 › getVisibility=', out);
    return out;
  }, [visibility]);

const updateVisibility = useCallback((v: 'private' | 'public') => {
  ydoc.getMap('metadata').set('visibility', v);
  setVisibility(v);
}, [ydoc]);

  /**
   * Creates a new document with default settings.
   * Initializes shared maps, arrays, and sets metadata (internal docFileID and fileName).
   */
  const createNewDocument = useCallback(async (): Promise<string> => {
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


      // ── [2] Encode bytes & request initial upload URLs (doc + chat) ─────────────────
    const stateBytes = Y.encodeStateAsUpdate(newYDoc);
    const fileSize = stateBytes.byteLength;

    console.log('[YDocContext.tsx][9703] requesting initialUpload URLs', { docId: newDocId, fileSize });
    const { doc, chat, access: accessEnv } = await initialUpload(newDocId);

    if (accessEnv) {
      // Reconcile with server-provided envelope (source: 'upload')
      access.applySignal(accessEnv);
      console.log('[YDocContext.tsx][9704] applied access envelope from initialUpload', accessEnv);
    }

    // ── [3] PUT document & initialized chat to Storage ──────────────────────────────
    // 3a) document bytes
    const putDoc = await fetch(doc.uploadUrl, {
      method: 'PUT',
      body: new Uint8Array(stateBytes), //
      headers: { 'Content-Type': 'application/octet-stream' },
    });
    if (!putDoc.ok) {
      console.error('[YDocContext.tsx][9791] doc PUT failed', { status: putDoc.status, statusText: putDoc.statusText });
      throw new Error(`Doc upload failed: ${putDoc.status} ${putDoc.statusText}`);
    }
    await saveDocBytes(newDocId, stateBytes)    
    console.log('[YDocContext.tsx][9705] doc PUT complete', { path: doc.fileStoragePath });

    // 3b) initialized chat (empty array for new docs)
    const putChat = await fetch(chat.uploadUrl, {
      method: 'PUT',
      body: JSON.stringify([]),
      headers: { 'Content-Type': 'application/json' },
    });
    if (!putChat.ok) {
      console.error('[YDocContext.tsx][9792] chat PUT failed', { status: putChat.status, statusText: putChat.statusText });
      throw new Error(`Chat upload failed: ${putChat.status} ${putChat.statusText}`);
    }
    console.log('[YDocContext.tsx][9706] chat PUT complete', { path: chat.fileStoragePath });

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
      console.error('[YDocContext.tsx][9793] metadata sync failed', { status: saveResp.status, statusText: saveResp.statusText });
      throw new Error(`Metadata sync failed: ${saveResp.status} ${saveResp.statusText}`);
    }
    console.log('[YDocContext.tsx][9707] metadata sync complete via save.ts', { docId: newDocId });

    // Seed identifiers from save.ts so we avoid any extra identifiers call.
      const saveSeed = await saveResp.json(); 
      const seedStorageGen = saveSeed?.storageGeneration ?? null; 
      const seedVersionNum = typeof saveSeed?.versionNumber === 'number' ? saveSeed.versionNumber : version; 
      writePersistToDoc({ storageGeneration: seedStorageGen, versionNumber: seedVersionNum, updatedBy: 'initial', source: 'initial' }); 
      lastKnownStorageGenerationRef.current = seedStorageGen; 
      lastKnownVersionNumberRef.current = seedVersionNum; 
      console.log('YDocContext.tsx 3524 › [update - 2] seeded persist identifiers from save.ts', { sg: seedStorageGen, vn: seedVersionNum }); 

      setIsInitialized(true);
      toast.success('New document created');
      access.selectDoc(newDocId, { assumeOwner: true });
     console.log('[YDocContext.tsx][9601] selectDoc (assumeOwner) seeded', { docId: newDocId });
      
    emitChatReady({ docId: newDocId, messages: [], fresh: true });
    console.log('YDocContext.tsx 1114 › CHAT_READY emitted for new doc', { docId: newDocId });

    lastKnownStorageGenerationRef.current = null;
    lastKnownVersionNumberRef.current = version;

    refreshList()
      return newDocId
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
    console.log('Starting loadData operation...');
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
    const legacyFileId = (metadataMap.get('fileId') as string | undefined) || null;

    canonicalDocId = driveFileIdParam ?? loadedDocId ?? legacyFileId ?? null;

    // CRITICAL: Stamp the canonical doc id into the new Y.Doc so we never carry stale ids.
    newYDoc.transact(() => {
      if (canonicalDocId) {
        metadataMap.set('docFileID', canonicalDocId);
        // If this was a legacy file, migrate once:
        if (legacyFileId && legacyFileId !== canonicalDocId) {
          metadataMap.delete('fileId');
        }
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

    console.log('loadData › finalized identity', {
      visibility: visibilityVal,
      fileName: finalFileName,
      docFileID: canonicalDocId
    });

    // 3) Reset/seed persistence identifiers to avoid cross-file reuse.
    // If you previously called download-urlv1 with identifiers, you can seed them here.
    // In this loader we *clear* them to be safe; upstream can overwrite after fetch.
    try {
      // Ensure a persist map exists and clear ids (so no stale SG/VN get reused).
      const persistMap = (() => {
        let p = metadataMap.get('persist') as Y.Map<any> | undefined;
        if (!(p instanceof Y.Map)) {
          p = new Y.Map();
          metadataMap.set('persist', p);
        }
        return p;
      })();

      newYDoc.transact(() => {
        // Explicitly null out both identifiers; upstream bootstrap can fill them.
        persistMap.set('storageGeneration', null);
        persistMap.set('versionNumber', null);
        persistMap.set('updatedAt', Date.now());
        persistMap.set('updatedBy', 'initial');
      }, { type: 'system', action: 'persist-reset' });

      // Also clear the in-memory refs if present in scope
      if (lastKnownStorageGenerationRef) lastKnownStorageGenerationRef.current = null;
      if (lastKnownVersionNumberRef)     lastKnownVersionNumberRef.current = null;

      console.log('loadData › persist identifiers cleared');
    } catch (e) {
      console.warn('loadData › could not reset persist identifiers (non-fatal)', e);
    }

    // 4) Initialize local React "version" from Y.Doc metadata (authoritative).
    const loadedVersion = readVersionFromMetadata(newYDoc);
    setVersion(loadedVersion);
    console.log(`Initialized local version state from Y.Doc metadata: ${loadedVersion}`);

    // 5) Commit document into provider and mark initialized.
    setYDoc(newYDoc);
    setSnapshotYDoc(null);
    setIsInitialized(true);
    console.log('loadData completed successfully');
  } catch (error) {
    console.error('Error in loadData:', error);
    toast.error('Failed to load document data');
    throw error;
  }
}, []);

/**
 * update - 3
 * @function getFileName
 * @description
 *   Returns the current file name by reading the authoritative value from the Y.Doc metadata map.
 *   If the replicated value is unavailable or invalid (e.g., not a non-empty string), the function
 *   falls back to the local React state value to ensure a robust return path. This guarantees that
 *   collaborators always converge on the same name when metadata is present while remaining resilient
 *   during initialization or partial loads. Time complexity is O(1) due to constant-time Y.Map access.
 */
const getFileName = useCallback((): string => {
  try {
    const meta = ydoc.getMap('metadata');
    const fromDoc = meta.get('fileName');
    const resolved =
      typeof fromDoc === 'string' && fromDoc.trim().length > 0 ? fromDoc : fileName;

    // YDocContext.tsx [7401]
    // eslint-disable-next-line no-console
    console.log('YDocContext.tsx [7401] getFileName resolved', {
      fromDoc,
      fallback: fileName,
      result: resolved,
    });

    return resolved;
  } catch (err) {
    // YDocContext.tsx [7491]
    // eslint-disable-next-line no-console
    console.error('YDocContext.tsx [7491] getFileName error; falling back to local state', err);
    return fileName;
  }
}, [ydoc, fileName]);


  /**
   * Updates the current file name both in local state and in the Y.Doc metadata.
   * @param name - The new file name.
   */
const updateFileName = useCallback((name: string): void => {
  const updatedName = name || fileName;

  // Keep your React state update
  setFileName(updatedName);

  // Make the Yjs change inside a transaction, marking it "local"
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

// YDocContext.tsx — updated function
/**
 * update - 1
 * @function saveToFirebase
 * @description
 *   Saves the current document state (and optional chat data) to Firebase Storage and then
 *   synchronizes metadata via `/api/document/save`. This Phase-3 update introduces conflict-safe
 *   uploads by passing the latest persisted identifiers (storage generation and logical version)
 *   as preconditions to the upload-url API. If the server detects a mismatch, it returns 409
 *   with authoritative identifiers; we reconcile them into the Y.Doc’s `metadata.persist` map
 *   and retry once. On success, we persist identifiers returned by `save.ts` so all collaborators
 *   converge on the same reconciliation markers.
 *
 *   Workflow:
 *   1) Read authoritative version from Y.Doc metadata; precompute lessonUnitsMeta (best-effort).
 *   2) Build upload preconditions from `metadata.persist` (storageGeneration, versionNumber).
 *   3) Request a signed PUT for the doc with preconditions; on 409, reconcile & retry once.
 *   4) PUT the document bytes (application/octet-stream).
 *   5) If chat provided, request signed PUT for chat and upload JSON.
 *   6) POST `/api/document/save` with current metadata; intercept access and identifiers.
 *   7) Write `{storageGeneration, versionNumber}` into `metadata.persist` and update local refs.
 */
const saveToFirebase = useCallback(
  async (chatData?: ChatMessage[]): Promise<void> => {
    if (!docFileID) throw new Error('No docFileID'); // update - 1

    // (1) Version: read directly from Y.Doc metadata (authoritative), mirror into state for UI.
    const currentVersion = readVersionFromMetadata(ydoc); // update - 1
    setVersion(currentVersion); // update - 1

    // (1b) Best-effort lessonUnitsMeta extraction (do not block on failure).
    let lessonUnitsMeta: any | undefined; // update - 1
    try {
      assertDocIdentityOrThrow(docFileID);
      lessonUnitsMeta = createLessonUnitsMeta(ydoc);
      console.log('YDocContext.tsx [9801] › lessonUnitsMeta prepared', {
        units: lessonUnitsMeta?.totalUnits ?? 0,
      });
    } catch (err) {
      console.warn('YDocContext.tsx [9802] › lessonUnitsMeta generation failed (non-fatal)', err);
    }

    // (2) Build preconditions from replicated identifiers.
    const { storageGeneration: expectSG, versionNumber: expectVN } = readPersistFromDoc(); // update - 1

    // Encode the document once.
    const bytes = persistDoc(); // update - 1
    const fileSize = bytes.byteLength; // update - 1

    // (3) Request signed PUT for doc with preconditions. Retry once on 409.
    let docUrl: string;
    let docPath: string;
    try {
      const pre = {
        expectStorageGeneration: expectSG,
        expectVersionNumber: expectVN,
      };
      const docTicket = await getUploadUrl(docFileID, 'doc', pre); // update - 1
      docUrl = docTicket.uploadUrl;
      docPath = docTicket.fileStoragePath;
      console.log('YDocContext.tsx [9803] › doc upload-url OK (preconditions accepted)', {
        docId: docFileID,
        expectSG,
        expectVN,
        path: docPath,
      });
    } catch (e: any) {
      if (e?.code === 409 && e?.body?.conflict) {
        // (3a) Reconcile identifiers from server and retry once.
        const c = e.body.conflict as {
          path: string;
          storageGeneration: string | null;
          versionNumber: number | null;
        };
        console.warn('YDocContext.tsx [9804] › precondition conflict; reconciling & retrying', c); // update - 1
        // Write authoritative identifiers to the replicated map so collaborators converge.
        writePersistToDoc({
          storageGeneration: c.storageGeneration,
          versionNumber: c.versionNumber,
          source: 'conflict',
        }); // update - 1
        lastKnownStorageGenerationRef.current = c.storageGeneration ?? null; // update - 1
        lastKnownVersionNumberRef.current = c.versionNumber ?? null; // update - 1

        // Retry with reconciled expectations.
        const retryPre = {
          expectStorageGeneration: c.storageGeneration,
          expectVersionNumber: c.versionNumber,
        };
        const docTicket = await getUploadUrl(docFileID, 'doc', retryPre); // update - 1
        docUrl = docTicket.uploadUrl;
        docPath = docTicket.fileStoragePath;
        console.log('YDocContext.tsx [9805] › doc upload-url OK on retry', {
          docId: docFileID,
          path: docPath,
        });
      } else {
        console.error('YDocContext.tsx [9890] › upload-url error (doc)', e); // update - 1
        throw e;
      }
    }

    // (4) PUT document bytes with the signed URL.
    const putDoc = await fetch(docUrl!, {
      method: 'PUT',
      body: new Uint8Array(bytes),
      headers: { 'Content-Type': 'application/octet-stream' },
    }); // update - 1
    if (!putDoc.ok) {
      console.error('YDocContext.tsx [9891] › doc PUT failed', {
        status: putDoc.status,
        text: putDoc.statusText,
      }); // update - 1
      throw new Error(`Doc upload failed: ${putDoc.status} ${putDoc.statusText}`);
    }
    await saveDocBytes(docFileID, bytes);
    console.log('YDocContext.tsx [9806] › doc PUT complete', { path: docPath }); // update - 1

    // (5) Upload chat if present (no preconditions required for per-user chat).
    let chatPath: string | undefined; // update - 1
    if (chatData) {
      const chatTicket = await getUploadUrl(docFileID, 'chat'); // update - 1
      const putChat = await fetch(chatTicket.uploadUrl, {
        method: 'PUT',
        body: JSON.stringify(chatData),
        headers: { 'Content-Type': 'application/json' },
      }); // update - 1
      if (!putChat.ok) {
        console.error('YDocContext.tsx [9892] › chat PUT failed', {
          status: putChat.status,
          text: putChat.statusText,
        }); // update - 1
        throw new Error(`Chat upload failed: ${putChat.status} ${putChat.statusText}`);
      }
      chatPath = chatTicket.fileStoragePath;
      console.log('YDocContext.tsx [9807] › chat PUT complete', { path: chatPath }); // update - 1
    }

    // (6) Sync metadata via /api/document/save.
    const savePayload: any = {
      fileName,
      docFileID,
      fileStoragePath: docPath!,
      chatPath,
      fileSize,
      version: currentVersion,
    };
    if (lessonUnitsMeta) {
      savePayload.lessonUnitsMeta = lessonUnitsMeta;
    } 

    const resp = await fetch('/api/document/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(savePayload),
    }); // update - 1
    if (!resp.ok) {
      console.error('YDocContext.tsx [9893] › save.ts rejected', {
        status: resp.status,
        text: resp.statusText,
      }); // update - 1
      throw new Error(`Meta sync failed: ${resp.status} ${resp.statusText}`);
    }

    const saveResult = await resp.json(); // update - 1
    if (saveResult?.access) {
      const manager = DocumentAccessManager.getInstance();
      manager.interceptSave(docFileID, saveResult.access);
      console.log('YDocContext.tsx [9808] › access envelope applied from save.ts'); // update - 1
    }

    // (7) Echo latest identifiers from save.ts (authoritative) into replicated map.
    const sg = saveResult?.storageGeneration ?? null;
    const vn =
      typeof saveResult?.versionNumber === 'number'
        ? saveResult.versionNumber
        : currentVersion; // update - 1
    writePersistToDoc({
      storageGeneration: sg,
      versionNumber: vn,
      source: 'save',
    }); // update - 1
    lastKnownStorageGenerationRef.current = sg; // update - 1
    lastKnownVersionNumberRef.current = vn; // update - 1
    console.log('YDocContext.tsx [9809] › identifiers updated after save', { sg, vn }); // update - 1
    const nowIso = new Date().toISOString();
      updateFileMeta(docFileID, {
        fileName,
        fileStoragePath: docPath!,
        fileSize,
        version: currentVersion,
        updatedAt: nowIso
      });
    toast.success('Save complete'); // update - 1
  },
  [assertDocIdentityOrThrow, docFileID, fileName, persistDoc, readPersistFromDoc, updateFileMeta, writePersistToDoc, ydoc]
);


/**
 * update - 2
 * @function loadFromFirebase
 * @description
 *   Loads a document from Firebase Storage using signed download URLs, applies the Yjs state
 *   into a fresh Y.Doc, and hydrates chat if available. This Phase-3 update seeds the Y.Doc’s
 *   replicated `metadata.persist` map with `{ storageGeneration, versionNumber }` obtained from
 *   the download-url API **before** bytes are fetched. This ensures collaborators converge on
 *   the same preconditions immediately after load, enabling conflict-safe subsequent uploads.
 *
 *   Workflow:
 *   1) Parse `docId` from the path and request a signed GET for the doc (identifiers included).
 *   2) Intercept access envelope; optionally elevate to Editor for publicEdit.
 *   3) Write `{storageGeneration, versionNumber}` into `metadata.persist` and local refs.
 *   4) Fetch doc bytes and load into Y.Doc via `loadData(...)`.
 *   5) Fetch chat JSON if present; emit `CHAT_READY` with `{ fresh }` indicator.
 */
const loadFromFirebase = useCallback(
  async (fileStorageId: string): Promise<void> => {
    console.log('YDocContext.tsx [9901] › loadFromFirebase start', { fileStorageId }); // update - 2

    const idFromPath =
      fileStorageId.match(/^documents\/(.+)\.bloomdocx$/)?.[1] ?? fileStorageId; // update - 2

    // (1) Request signed GET for the doc (server also returns identifiers).
    const { downloadUrl: dUrl, access: accessData, storageGeneration, versionNumber } =
      await getDownloadUrl(idFromPath, 'doc'); // update - 2
    console.log('YDocContext.tsx [9902] › download-url ready', {
      docId: idFromPath,
      sg: storageGeneration,
      vn: versionNumber,
    }); // update - 2

    // (2) Intercept access envelope and reflect publicEdit if present.
    const manager = DocumentAccessManager.getInstance();
    manager.interceptLoad(idFromPath, accessData);
    if (accessData.publicEdit) {
      access.setRole('Editor', accessData.source);
    } // update - 2

    // (3) Seed identifiers into replicated map for immediate convergence.
    writePersistToDoc({
      storageGeneration: storageGeneration ?? null,
      versionNumber: typeof versionNumber === 'number' ? versionNumber : null,
      source: 'bootstrap',
    }); // update - 2
    lastKnownStorageGenerationRef.current = storageGeneration ?? null; // update - 2
    lastKnownVersionNumberRef.current = typeof versionNumber === 'number' ? versionNumber : null; // update - 2
    console.log('YDocContext.tsx [9903] › identifiers seeded (pre-load)', {
      sg: lastKnownStorageGenerationRef.current,
      vn: lastKnownVersionNumberRef.current,
    }); // update - 2

    try {
      // (4) Fetch the document bytes and materialize into Y.Doc.
      const response = await fetch(dUrl);
      if (!response.ok) {
        throw new Error(`Failed to load document: ${response.status} ${response.statusText}`);
      }
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      await saveDocBytes(idFromPath, bytes);
      await loadData(fileName, fileStorageId, new Uint8Array(buffer));
      manager.confirmDocumentReady(idFromPath);
      console.log('YDocContext.tsx [9904] › Y.Doc hydrated from download'); // update - 2

      // (5) Try to fetch chat; treat 404 as "fresh".
      const { downloadUrl: cUrl } = await getDownloadUrl(idFromPath, 'chat'); // update - 2
      let chatData: ChatMessage[] = [];
      let fresh = false;
      try {
        const chatResp = await fetch(cUrl);
        if (chatResp.ok) chatData = await chatResp.json();
        else if (chatResp.status === 404) fresh = true;
        else throw new Error(`Chat download failed: ${chatResp.status} ${chatResp.statusText}`);
      } catch (err) {
        console.warn('YDocContext.tsx [9991] › chat fetch failed (non-fatal)', err); // update - 2
      }

      emitChatReady({ docId: idFromPath, messages: Array.isArray(chatData) ? chatData : [], fresh }); // update - 2
      console.log('YDocContext.tsx [9905] › CHAT_READY emitted', {
        docId: idFromPath,
        count: chatData.length,
        fresh,
      }); // update - 2
      return;
    } catch (error) {
      console.error('YDocContext.tsx [9999] › loadFromFirebase error', error); // update - 2
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
        console.error('YDocContext.tsx 6007 › No docFileID for snapshot');
        throw new Error('Cannot snapshot: missing docFileID');
      }
      console.log('YDocContext.tsx 6007 › Initiating takeMapSnapshot for', mapId);
      const snapshotId = await _takeMapSnapshot(ydoc, docFileID, mapId);
      console.log('YDocContext.tsx 6007 › takeMapSnapshot completed snapshotId=', snapshotId);
      return snapshotId;
    },
    [ydoc, docFileID]
  );


    /**
   * @function getPersistableBytes
   * @description
   *   Returns the current Y.Doc bytes in the exact format the server persists.
   *   This is used by DocAutoSave to PUT the document to Storage through a
   *   signed URL. The function is intentionally synchronous-friendly.
   */
  const getPersistableBytes = useCallback((): Uint8Array => {
    return persistDoc();
  }, [persistDoc]);

  /**
   * @function isSnapshotActive
   * @description
   *   Indicates whether a read-only snapshot (from version history) is mounted.
   *   DocAutoSave uses this to avoid producing writes while a snapshot is active.
   */
  const isSnapshotActive = useCallback((): boolean => {
    return snapshotYDoc !== null;
  }, [snapshotYDoc]);


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
    createNewDocument,
    applyUpdate,
    getState,
    updateFileName,
    loadData,
    persistDoc,
    getLessonModuleJSON,
    getFileName,
    saveToFirebase,
    loadFromFirebase,
    //forkDoc,
    getVisibility,
    updateVisibility,
     takeMapSnapshot: takeMapSnapshotCallback,
     getPersistableBytes,         // NEW
    isSnapshotActive,
    incrementVersion,
    version,
    addChatReadyListener,
    removeChatReadyListener

  }), [ydoc, snapshotYDoc, isReadOnly, fileName, docFileID, isInitialized, createNewDocument, applyUpdate, getState, updateFileName, loadData, persistDoc, getLessonModuleJSON, getFileName, saveToFirebase, loadFromFirebase, getVisibility, updateVisibility, takeMapSnapshotCallback,addChatReadyListener, removeChatReadyListener, getPersistableBytes, isSnapshotActive, incrementVersion, version]);

  return (
    <YDocContext.Provider value={value}>
      {children}
    </YDocContext.Provider>
  );
};

export default YDocProvider;
