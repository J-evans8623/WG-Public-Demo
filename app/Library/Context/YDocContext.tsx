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
  ReactNode
} from 'react';
import * as Y from 'yjs';
import { toast } from 'react-toastify';
import { ConceptNode } from '@/app/Library/Definitions/Definitions';
import { v4 as uuidv4 } from 'uuid';
import JSZip from 'jszip';


interface ChatMessage {
  id: number;
  type: 'assistant' | 'user' | 'system' | 'attachment';
  content: string;
}

export interface YDocContextType {
  ydoc: Y.Doc;
  fileName: string;
  docFileID: string | null;
  isInitialized: boolean;
  createNewDocument: () => Promise<void>;
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
  const [ydoc, setYDoc] = useState<Y.Doc>(() => new Y.Doc());
  const [fileName, setFileName] = useState<string>('Untitled Document');
  const [driveFileId, setDriveFileId] = useState<string>();
  const [docFileID, setDocFileID] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

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

  /**
   * Creates a new document with default settings.
   * Initializes shared maps, arrays, and sets metadata (internal docFileID and fileName).
   */
  const createNewDocument = useCallback(async (): Promise<void> => {
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

        newYDoc.getMap('resources').clear();
        newYDoc.getMap('subtrees').clear();

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
      setIsInitialized(true);
      toast.success('New document created');
    } catch (error) {
      console.error('Error creating new document:', error);
      toast.error('Failed to create new document');
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
      console.log(`metadata map observed in loaddata`)
      console.log(metadataMap)
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
   * Updates the Firebase storage file path.
   * @param id - The new drive file ID.
   */
  const updateDriveId = useCallback((id?: string): void => {
    setDriveFileId(id);
  }, []);

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
 */
const saveToFirebase = useCallback(
  async (chatData?: ChatMessage[]): Promise<void> => {
    if (!docFileID) {
      throw new Error('Document has no ID; cannot save.');
    }

    // 1) encode Yjs state
    const docState = persistDoc();
    const base64Data = Buffer.from(docState).toString('base64');

    // 2) Read the up-to-date fileName from metadata
    const metadataMap = ydoc.getMap('metadata');
    const currentFileName = (metadataMap.get('fileName') as string) || 'Untitled Document';

    // 3) build payload including chatData (if provided)
    const payload: {
      fileName: string;
      docFileID: string;
      fileData: string;
      chatData?: ChatMessage[];
    } = {
      fileName: currentFileName,
      docFileID,
      fileData: base64Data
    };
    if (chatData) {
      payload.chatData = chatData;
    }

    // 4) POST
    const res = await fetch('/api/document/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(`Save failed: ${res.statusText}`);
    }
    toast.success('Saved document & chat');
  },
  [persistDoc, docFileID, ydoc]
);

  /**
   * Loads a document file from Firebase Storage via /api/document/load.
   * @param fileStorageId - The Firebase storage file path.
   */
  const loadFromFirebase = useCallback(async (fileStorageId: string): Promise<ChatMessage[]> => {
    console.log(`LoadFromFirebase called with docID ${docFileID}`);
    console.log(`LoadFromFirebase called with FileStorageID ${fileStorageId}`);
    try {
      const response = await fetch(
        `/api/document/load?fileStorageId=${encodeURIComponent(fileStorageId)}`,
        { credentials: 'include' }
      );
      if (!response.ok) {
        throw new Error(`Failed to load document: ${response.statusText}`);
      }
      const { fileData, chatData } = await response.json();
      console.log(fileData)

      // Decode the base64 data.
      const buffer = Buffer.from(fileData, 'base64');
      const docState = new Uint8Array(buffer);

      // Load the document state without overwriting the internal docFileID.
      await loadData(fileName, fileStorageId, docState);
      toast.success('Document loaded from Firebase Storage successfully');
      return Array.isArray(chatData)? chatData:[];
    } catch (error) {
      console.error('Error loading document from Firebase:', error);
      toast.error('Failed to load document from Firebase');

      return [];
    }
  }, [fileName, loadData]);

  /**
   * Memoizes and returns the context value for YDocContext.
   */
  const value = useMemo<YDocContextType>(() => ({
    ydoc,
    fileName,
    docFileID,
    isInitialized,
    createNewDocument,
    applyUpdate,
    getState,
    updateFileName,
    updateDriveId,
    loadData,
    persistDoc,
    getLessonModuleJSON,
    getFileName,
    saveToFirebase,
    loadFromFirebase,
  }), [
    ydoc,
    fileName,
    docFileID,
    isInitialized,
    createNewDocument,
    applyUpdate,
    getState,
    updateFileName,
    updateDriveId,
    loadData,
    persistDoc,
    getLessonModuleJSON,
    getFileName,
    saveToFirebase,
    loadFromFirebase,
  ]);

  return (
    <YDocContext.Provider value={value}>
      {children}
    </YDocContext.Provider>
  );
};

export default YDocProvider;
