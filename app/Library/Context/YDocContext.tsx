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
 *   **Important Update:**
 *   - In the loadData function, if the loaded metadata does not contain a docFileID or fileName,
 *     the existing internal values are preserved instead of being overwritten.
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
import { ConceptNode } from '@/app/Library/Definitions/Definitions';
import { v4 as uuidv4 } from 'uuid';
import JSZip from 'jszip';
import { getUploadUrl, getDownloadUrl, initialUpload } from '@/app/studygraph/(studygraph)/components/utils/storageUrls';
import { takeMapSnapshot as _takeMapSnapshot } from '@/app/studygraph/(studygraph)/components/versionHistory/versionHistory';
import { useAccessLayer } from '@/app/Library/Context/AccessLayerContext';
import { createLessonUnitsMeta } from '../utils/calendar/lessoUnitExtractor';


interface ChatMessage {
  id: number;
  type: 'assistant' | 'user' | 'system' | 'attachment';
  content: string;
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
  loadFromFirebase: (fileStorageId: string) => Promise<ChatMessage[]>;
  getVisibility: () => 'private' | 'public';
  updateVisibility: (v: 'private' | 'public') => void;
  takeMapSnapshot: (mapId: string) => Promise<string>
   getPersistableBytes: () => Promise<Uint8Array> | Uint8Array; // NEW (Phase 5)
  isSnapshotActive: () => boolean;   
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

  /** Flag to indicate read-only mode. */
  const isReadOnly = snapshotYDoc !== null;

  const [fileName, setFileName] = useState<string>('Untitled Document');
  const [docFileID, setDocFileID] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState<boolean>(false); 
  const [visibility, setVisibility] = useState<'private'|'public'>(() => {
  const v = ydoc.getMap('metadata').get('visibility');
  return v === 'public' ? 'public' : 'private';
});
  const access = useAccessLayer();


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
      const defaultConceptMapId = 'map-1';

      // Step 1: Initialize shared maps and arrays.
      newYDoc.transact(() => {
        // Set up metadata with internal docFileID and fileName.
        const metadata = newYDoc.getMap('metadata');
        metadata.clear();
        metadata.set('docFileID', newDocId);
        metadata.set('fileName', 'Untitled Document');
        metadata.set('visibility', 'private');
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
      body: stateBytes,
      headers: { 'Content-Type': 'application/octet-stream' },
    });
    if (!putDoc.ok) {
      console.error('[YDocContext.tsx][9791] doc PUT failed', { status: putDoc.status, statusText: putDoc.statusText });
      throw new Error(`Doc upload failed: ${putDoc.status} ${putDoc.statusText}`);
    }
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
      }),
    });
    if (!saveResp.ok) {
      console.error('[YDocContext.tsx][9793] metadata sync failed', { status: saveResp.status, statusText: saveResp.statusText });
      throw new Error(`Metadata sync failed: ${saveResp.status} ${saveResp.statusText}`);
    }
    console.log('[YDocContext.tsx][9707] metadata sync complete via save.ts', { docId: newDocId });



      setIsInitialized(true);
      toast.success('New document created');
      access.selectDoc(newDocId, { assumeOwner: true });
console.log('[YDocContext.tsx][9601] selectDoc (assumeOwner) seeded', { docId: newDocId });
      

      return newDocId
    } catch (error) {
      console.error('Error creating new document:', error);
      toast.error('Failed to create new document');
      throw error;
    }
  }, [access]);

  /**
   * Loads a Y.Doc state (provided as a Uint8Array) into a new Y.Doc instance.
   * Updates local state with persisted metadata from the document.
   *
   * @param fileNameParam - Default file name if metadata is missing.
   * @param driveFileIdParam - The Firebase file storage path (used only for retrieval).
   * @param docState - The encoded Y.Doc state (or ZIP archive containing it).
   */
  const loadData = useCallback(async (
    fileNameParam: string,
    driveFileIdParam: string | undefined,
    docState: Uint8Array
  ): Promise<void> => {
    try {
      console.log('Starting loadData operation...');
      setIsInitialized(false);

      const newYDoc = new Y.Doc();

      try {
        // Step 1: Attempt to apply the update directly.
        Y.applyUpdate(newYDoc, docState);
      } catch (error) {
        console.warn('Direct Y.applyUpdate failed, attempting legacy ZIP extraction:', error);
        // If direct update fails, assume docState is a ZIP archive.
        const zip = await JSZip.loadAsync(docState);
        const yjsStateFile = zip.file('document/yjsState.bin');
        if (!yjsStateFile) {
          throw new Error('Legacy file format error: Missing "document/yjsState.bin" in ZIP archive.');
        }
        const legacyYjsState = await yjsStateFile.async('uint8array');
        Y.applyUpdate(newYDoc, legacyYjsState);
      }

      // Step 2: Retrieve persisted metadata from the loaded document.
      const metadataMap = newYDoc.getMap('metadata');
      if (!metadataMap.has('visibility')){
        metadataMap.set('visibility', 'private');
      }
      const visibility : 'private'|'public' = metadataMap.get('visibility') as 'private'|'public';
      setVisibility(visibility)
      const FileName = metadataMap.get('fileName') as string
      setFileName(FileName);
      console.log(`Loaded Filename ${FileName}`)
      if (metadataMap.has('docFileID'))  {
        const internalDocID = metadataMap.get('docFileID') as string 
        setDocFileID( internalDocID);
        console.log(`Loaded DocFiledID ${internalDocID}`)
      } else {
        const internalDocID = metadataMap.get('fileId') as string
        setDocFileID( internalDocID);
        console.log(`Loaded DocFiledID ${internalDocID}`)
      }
      

      

      setYDoc(newYDoc);
      setSnapshotYDoc(null)
      setIsInitialized(true);
      console.log('loadData completed successfully');
    } catch (error) {
      console.error('Error in loadData:', error);
      toast.error('Failed to load document data');
      throw error;
    }
  }, []);

  /**
   * Returns the current file name.
   * @returns The current file name.
   */
  const getFileName = useCallback((): string => fileName, [fileName]);

  /**
   * Updates the current file name both in local state and in the Y.Doc metadata.
   * @param name - The new file name.
   */
  const updateFileName = useCallback((name: string): void => {
    const updatedName = name || 'Untitled Document';
    setFileName(updatedName);
    const metadataMap = ydoc.getMap('metadata');
    metadataMap.set('fileName', updatedName);
  }, [ydoc]);



  /**
   * Retrieves the lesson module portion of the Y.Doc as a JSON string.
   * @returns The lesson module JSON string.
   */
  const getLessonModuleJSON = useCallback((): string => {
    const lessonModule = ydoc.getMap('lessonModule');
    return JSON.stringify(lessonModule.toJSON());
  }, [ydoc]);

/**
 * Saves the current document state (and optional chat) to our single save endpoint.
 *
 * New strategy – step by step:
 * 1. Persist document: encode Y.Doc update to Uint8Array and base64-encode it.
 * 2. Upload document state: request a signed PUT URL for type='doc', then PUT the binary to Firebase Storage.
 * 3. Upload chat (if provided): request a signed PUT URL for type='chat', then PUT the JSON payload.
 * 4. Sync metadata: POST { fileName, docFileID, chatPath } to `/api/document/save` to update Firestore.
 */
  const saveToFirebase = useCallback(
    async (chatData?: ChatMessage[]): Promise<void> => {
      if (!docFileID) throw new Error('No docFileID');

      // Step 1: Generate lesson unit metadata before saving
    let lessonUnitsMeta;
    try {
      lessonUnitsMeta = createLessonUnitsMeta(ydoc);
      console.log(' 96809 FULL METADATA:', lessonUnitsMeta);
    } catch (error) {
      console.error('[YDocContext.tsx][2003] › Error generating lesson units metadata:', error);
      // Continue with save even if metadata generation fails
    }
    

      // -- upload doc state --
      const state = persistDoc();
      const fileSize = state.byteLength;
      const { uploadUrl: docUrl, fileStoragePath: docPath } = await getUploadUrl(docFileID, 'doc');


      await fetch(docUrl, {
        method: 'PUT',
        body: state,
        headers: { 'Content-Type': 'application/octet-stream' },
      });
      console.log('YDocContext.tsx 0107 › doc PUT complete', docPath);

      // -- upload chat if needed --
      let chatPath: string | undefined;
      if (chatData) {
        const { uploadUrl: cUrl, fileStoragePath: cPath } =
          await getUploadUrl(docFileID, 'chat');
        await fetch(cUrl, {
          method: 'PUT',
          body: JSON.stringify(chatData),
          headers: { 'Content-Type': 'application/json' },
        });
        chatPath = cPath;
        console.log('YDocContext.tsx 0108 › chat PUT complete', chatPath);
      }


      // Step 4: Metadata sync with lesson units metadata
    const savePayload: any = {
      fileName,
      docFileID,
      fileStoragePath: docPath,
      chatPath,
      fileSize,
    };

    // Step 5: Include lesson units metadata if generation was successful
    if (lessonUnitsMeta) {
      savePayload.lessonUnitsMeta = lessonUnitsMeta;
      console.log('[YDocContext.tsx][2006] › Including lesson units metadata in save payload');
    }

      // -- metadata sync --
      const resp = await fetch('/api/document/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(savePayload),
      });
      if (!resp.ok) throw new Error(`Meta sync failed: ${resp.statusText}`);

      // Step 1: Intercept save response access envelope

      // How did we get the download url if there was no access? Why intercept here?
    const saveResult = await resp.json();
    if (saveResult.access) {
      const manager = DocumentAccessManager.getInstance();
      manager.interceptSave(docFileID, saveResult.access);
      console.log('[YDocContext.tsx][0109] › Save access intercepted');
    }
    
      toast.success('Save complete');
    },
    [docFileID, fileName, persistDoc, ydoc]
  );

  /**
   * Loads a document file from Firebase Storage via /api/document/load.
   * @param fileStorageId - The Firebase storage file path.
   */
const loadFromFirebase = useCallback(
  async (fileStorageId: string): Promise<ChatMessage[]> => {
    console.log(`[loadFromFirebase] START: fileStorageId=${fileStorageId}`);
    const idFromPath =
  fileStorageId.match(/^documents\/(.+)\.bloomdocx$/)?.[1] ?? fileStorageId;

    // 1. Get doc download URL
    console.log(`[loadFromFirebase] ▶️ Requesting doc URL for ${fileStorageId}`);
    const { downloadUrl: dUrl, access:accessData } = await getDownloadUrl(idFromPath, 'doc');
    console.log(`[loadFromFirebase] ✔️ Received doc URL: ${dUrl}`);

    // Step 1: Intercept access data with DocumentAccessManager
    const manager = DocumentAccessManager.getInstance();
    manager.interceptLoad(idFromPath, accessData);
    console.log(`[loadFromFirebase] ✔️ Access data intercepted by manager`);

    if (accessData.publicEdit){
      access.setRole('Editor', accessData.source)
    }
    try {
      // 2. Fetch the document bytes (no credentials)
      console.log(`[loadFromFirebase] ▶️ Fetching doc bytes`);
      const response = await fetch(dUrl);
      console.log(`[loadFromFirebase] Response status: ${response.status}`);
      if (!response.ok) {
        throw new Error(`Failed to load document: ${response.status} ${response.statusText}`);
      }

      // 3. Get chat download URL
      console.log(`[loadFromFirebase] ▶️ Requesting chat URL for ${fileStorageId}`);
      const { downloadUrl: cUrl } = await getDownloadUrl(idFromPath, 'chat');
      console.log(`[loadFromFirebase] ✔️ Received chat URL: ${cUrl}`);

      // 4. Attempt to fetch the chat JSON, swallow 404 (no credentials)
      console.log(`[loadFromFirebase] ▶️ Fetching chat JSON`);
      let chatData: ChatMessage[] = [];
      try {
        const chatResp = await fetch(cUrl);
        console.log(`[loadFromFirebase] Chat response status: ${chatResp.status}`);
        if (chatResp.ok) {
          chatData = await chatResp.json();
        } else if (chatResp.status === 404) {
          console.warn(`[loadFromFirebase] No chat file (404); continuing with empty chat.`);
        } else {
          throw new Error(`Chat download failed: ${chatResp.status} ${chatResp.statusText}`);
        }
      } catch (err) {
        console.error(`[loadFromFirebase] Chat fetch error (non-fatal):`, err);
      }

      // 5. Read and decode document
      console.log(`[loadFromFirebase] ▶️ Reading document as arrayBuffer`);
      const buffer = await response.arrayBuffer();
      console.log(`[loadFromFirebase] 📦 Document byte length: ${buffer.byteLength}`);

      // 6. Load into Y.Doc
      console.log(`[loadFromFirebase] ▶️ Calling loadData() with fileName=${fileName}`);
      await loadData(fileName, fileStorageId, new Uint8Array(buffer));
      console.log(`[loadFromFirebase] ✔️ loadData() completed`);
      manager.confirmDocumentReady(idFromPath);
      toast.success('Document loaded from Firebase Storage successfully');
      return Array.isArray(chatData) ? chatData : [];
    } catch (error) {
      console.error('[loadFromFirebase] ❌ Error:', error);
      toast.error('Failed to load document from Firebase');
      return [];
    }
  },
  [access, fileName, loadData]
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
  }), [ydoc, snapshotYDoc, isReadOnly, fileName, docFileID, isInitialized, createNewDocument, applyUpdate, getState, updateFileName, loadData, persistDoc, getLessonModuleJSON, getFileName, saveToFirebase, loadFromFirebase, getVisibility, updateVisibility, takeMapSnapshotCallback, getPersistableBytes, isSnapshotActive]);

  return (
    <YDocContext.Provider value={value}>
      {children}
    </YDocContext.Provider>
  );
};

export default YDocProvider;
