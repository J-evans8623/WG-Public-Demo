// bloom-maps\app\Library\Context\YDocContext.tsx
import React, { createContext, useContext, useCallback, useState, useMemo, ReactNode } from 'react';
import * as Y from 'yjs';
import { toast } from 'react-toastify';
import { ConceptNode, ResourceCard } from '@/app/Library/Definitions/Definitions';
import { v4 as uuidv4 } from 'uuid';

interface YDocContextType {
  ydoc: Y.Doc;
  fileName: string;
  driveFileId?: string;
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
  updateDriveId: (id?: string) => void;
  persistDoc: (local: boolean) => Uint8Array;
  // NEW: Method to get lesson module JSON string
  getLessonModuleJSON: () => string;
  getFileName : () => string;

}

const YDocContext = createContext<YDocContextType | undefined>(undefined);

export const useYDoc = () => {
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
  const [ydoc, setYDoc] = useState(() => new Y.Doc());
  const [fileName, setFileName] = useState('Untitled Document');
  const [driveFileId, setDriveFileId] = useState<string>();
  const [docFileID, setDocFileID] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const applyUpdate = useCallback((update: Uint8Array): void => {
    try {
      Y.applyUpdate(ydoc, update);
    } catch (error) {
      console.error('Error applying update:', error);
      toast.error('Failed to apply document update');
    }
  }, [ydoc]);

  const getState = useCallback((): Uint8Array => {
    return Y.encodeStateAsUpdate(ydoc);
  }, [ydoc]);

  const persistDoc = useCallback((local: boolean): Uint8Array => {
    if (local) {
      setDriveFileId(undefined);
    }
    return Y.encodeStateAsUpdate(ydoc);
  }, [ydoc]);

  // Updated createNewDocument that uses a namespaced nodes map for the default concept map
  const createNewDocument = useCallback(async (): Promise<void> => {
    try {
      setIsInitialized(false);
      const newYDoc = new Y.Doc();
      const newDocId = uuidv4();
      const defaultConceptMapId = 'map-1'; // Default concept map ID
      
      newYDoc.transact(() => {
        // Clear and initialize shared data
        newYDoc.getMap('metadata').clear();
        // We no longer use a generic 'nodes' map since nodes are namespaced per concept map.
        newYDoc.getMap('resources').clear();
        newYDoc.getMap('subtrees').clear();

        // Initialize lessonModule
        const lessonModule = newYDoc.getMap('lessonModule');
        lessonModule.clear();
        lessonModule.set('title', 'Default Lesson Module');
        const conceptMaps = new Y.Array<any>();
        // Create a default concept map entry
        const defaultConceptMap = { id: defaultConceptMapId, title: 'Default Map', createdAt: new Date().toISOString() };
        conceptMaps.push([defaultConceptMap]);
        lessonModule.set('conceptMaps', conceptMaps);

        // Initialize nodes for the default concept map using a namespaced key.
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

        // Initialize subtrees sentinel (you may later namespace subtrees similarly if needed)
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

      setFileName('Untitled Document');
      setDriveFileId(undefined);
      setDocFileID(newDocId);
      setYDoc(newYDoc);
      setIsInitialized(true);
      toast.success('New document created');
    } catch (error) {
      console.error('Error creating new document:', error);
      toast.error('Failed to create new document');
    }
  }, []);

  const loadData = useCallback(async (
    fileName: string,
    driveFileId: string | undefined,
    docState: Uint8Array
  ): Promise<void> => {
    try {
      console.log('Starting loadData operation...');
      setIsInitialized(false);
      const newYDoc = new Y.Doc();
      newYDoc.transact(() => {
        Y.applyUpdate(newYDoc, docState);
      }, { type: 'system', action: 'loadData' });
      setFileName(fileName);
      setDriveFileId(driveFileId);
      const metadataMap = newYDoc.getMap('metadata');
      const loadedDocFileID = metadataMap.get('docFileID') as string || null;
      setDocFileID(loadedDocFileID);
      setYDoc(newYDoc);
      setIsInitialized(true);
      console.log('loadData completed successfully');
    } catch (error) {
      console.error('Error in loadData:', error);
      toast.error('Failed to load document data');
      throw error;
    }
  }, []);

  const getFileName = useCallback(() :string => {
    return fileName;

  }, [fileName]);

  const updateFileName = useCallback((name: string): void => {
    setFileName(name || 'Untitled Document');
  }, []);

  const updateDriveId = useCallback((id?: string): void => {
    setDriveFileId(id);
  }, []);

  // NEW: Expose a method that returns the lesson module JSON string.
  const getLessonModuleJSON = useCallback((): string => {
    const lessonModule = ydoc.getMap('lessonModule');
    return JSON.stringify(lessonModule.toJSON());
  }, [ydoc]);

  const value = useMemo((): YDocContextType => ({
    ydoc,
    fileName,
    driveFileId,
    isInitialized,
    createNewDocument,
    applyUpdate,
    getState,
    updateFileName,
    updateDriveId,
    loadData,
    persistDoc,
    docFileID,
    getLessonModuleJSON,
    getFileName,
  }), [ydoc, fileName, driveFileId, isInitialized, createNewDocument, applyUpdate, getState, updateFileName, updateDriveId, loadData, persistDoc, docFileID, getLessonModuleJSON, getFileName]);

  return (
    <YDocContext.Provider value={value}>
      {children}
    </YDocContext.Provider>
  );
};

export default YDocProvider;
