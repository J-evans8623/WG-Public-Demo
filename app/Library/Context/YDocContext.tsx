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
import React, {
  createContext,
  useContext,
  useCallback,
  useState,
  useMemo,
  ReactNode,
  useEffect
} from 'react';
import * as Y from 'yjs';
import { toast } from 'react-toastify';
import { ConceptNode } from '@/app/Library/Definitions/Definitions';
import { v4 as uuidv4 } from 'uuid';
import JSZip from 'jszip';
import { useCollabProvider } from '@/app/studygraph/collab/useCollabProvider';
import { getUploadUrl, getDownloadUrl } from '@/app/studygraph/(studygraph)/components/utils/storageUrls';
import { takeMapSnapshot as _takeMapSnapshot } from '@/app/studygraph/(studygraph)/components/versionHistory/versionHistory';
import { makeCommentMap, mapToComment, Comment, Reply } from '@/app/studygraph/(studygraph)/components/layout/forum/comment/CommentDefinitions';

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
  /*forkDoc: () => Promise<string>;*/
  updateFileName: (name: string) => void;
  persistDoc: () => Uint8Array;
  getLessonModuleJSON: () => string;
  getFileName: () => string;
  saveToFirebase: (chatData?:ChatMessage[]) => Promise<void>;
  loadFromFirebase: (fileStorageId: string) => Promise<ChatMessage[]>;
  getVisibility: () => 'private' | 'public';
  updateVisibility: (v: 'private' | 'public') => void;
  takeMapSnapshot: (mapId: string) => Promise<string>
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

const { status } = useCollabProvider(ydoc, docFileID, visibility);

    // Notify on connection
  useEffect(() => {
    if (status === 'connected') {
      console.log('111- Ydoc Connected to live collaboration');
    }
  }, [status]);
  
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
      setIsInitialized(true);
      toast.success('New document created');

      return newDocId
    } catch (error) {
      console.error('Error creating new document:', error);
      toast.error('Failed to create new document');
      throw error;
    }
  }, []);

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

      // -- upload doc state --
      const state = persistDoc();
      const fileSize = state.byteLength;
      const base64 = Buffer.from(state).toString('base64');
      const { uploadUrl: docUrl, fileStoragePath: docPath } = await getUploadUrl(docFileID, 'doc');


      await fetch(docUrl, {
        method: 'PUT',
        body: new Uint8Array(Buffer.from(base64, 'base64')),
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

      // -- metadata sync --
      const resp = await fetch('/api/document/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          fileName,
          docFileID,
          fileStoragePath:docPath,
          chatPath,
          fileSize,
        }),
      });
      if (!resp.ok) throw new Error(`Meta sync failed: ${resp.statusText}`);
      toast.success('Save complete');
    },
    [docFileID, fileName, persistDoc]
  );

  /**
   * Loads a document file from Firebase Storage via /api/document/load.
   * @param fileStorageId - The Firebase storage file path.
   */
const loadFromFirebase = useCallback(
  async (fileStorageId: string): Promise<ChatMessage[]> => {
    console.log(`[loadFromFirebase] START: fileStorageId=${fileStorageId}`);

    // 1. Get doc download URL
    console.log(`[loadFromFirebase] ▶️ Requesting doc URL for ${fileStorageId}`);
    const { downloadUrl: dUrl } = await getDownloadUrl(fileStorageId, 'doc');
    console.log(`[loadFromFirebase] ✔️ Received doc URL: ${dUrl}`);

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
      const { downloadUrl: cUrl } = await getDownloadUrl(fileStorageId, 'chat');
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

      toast.success('Document loaded from Firebase Storage successfully');
      return Array.isArray(chatData) ? chatData : [];
    } catch (error) {
      console.error('[loadFromFirebase] ❌ Error:', error);
      toast.error('Failed to load document from Firebase');
      return [];
    }
  },
  [fileName, loadData]
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

 /* 
 // Needs to be reviewed, fundamental flaw, changing the docId doesn't not "truly"
end a collaboration session, distributing a file this way could theoretically cause multiple people to have acces
to the same file, if any number of these person decide to make the document public.


 const forkDoc = useCallback(async (): Promise<string> => {
  if (!docFileID) throw new Error("No doc to fork")

  const newId = uuidv4()
  // 1) clone the Y.Doc
  const update = Y.encodeStateAsUpdate(ydoc)
  const copy = new Y.Doc()
  Y.applyUpdate(copy, update)
  

  // 2) stamp on the new ID
  copy.getMap('metadata').set('docFileID', newId)
  const state = Y.encodeStateAsUpdate(copy);
  const base64 = Buffer.from(state).toString('base64');

  const { uploadUrl: docUrl, fileStoragePath: docPath } = await getUploadUrl(newId, 'doc');


  await fetch(docUrl, {
    method: 'PUT',
    body: new Uint8Array(Buffer.from(base64, 'base64')),
    headers: { 'Content-Type': 'application/octet-stream' },
    });
    console.log('YDocContext.tsx 0107 › doc PUT complete', docPath);

  // 3) save only the copy once
 /** const payload = {
    fileName: copy.getMap('metadata').get('fileName'),
    docFileID: newId,
    fileData: Buffer.from(Y.encodeStateAsUpdate(copy)).toString('base64'),
  } **/ 
  
  /**const res = await fetch('/api/document/save',  {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    })
  const { fileStorageId } = await res.json() 


  return fileStorageId
}, [ydoc, docFileID])  **/


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
     takeMapSnapshot: takeMapSnapshotCallback
  }), [ydoc, snapshotYDoc, isReadOnly, fileName, docFileID, isInitialized, createNewDocument, applyUpdate, getState, updateFileName, loadData, persistDoc, getLessonModuleJSON, getFileName, saveToFirebase, loadFromFirebase, getVisibility, updateVisibility, takeMapSnapshotCallback]);

  return (
    <YDocContext.Provider value={value}>
      {children}
    </YDocContext.Provider>
  );
};

export default YDocProvider;
