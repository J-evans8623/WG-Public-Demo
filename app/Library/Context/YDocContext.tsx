import React, { createContext, useContext, useCallback, useState, useMemo, ReactNode } from 'react';
import * as Y from 'yjs';
import { toast } from 'react-toastify';
import { ConceptNode, ResourceCard } from '@/app/Library/Definitions/Definitions';


interface YDocContextType {
  // Document state
  ydoc: Y.Doc;
  fileName: string;
  driveFileId?: string;
  isInitialized: boolean;

  // Document lifecycle methods
  createNewDocument: () => Promise<void>;
  loadData: (
    fileName: string,
    driveFileId: string | undefined,
    docState: Uint8Array  // Changed to accept binary state
  ) => Promise<void>; 
  // Y.js management
  applyUpdate: (update: Uint8Array) => void;
  getState: () => Uint8Array;
  
  // File metadata management
  updateFileName: (name: string) => void;
  updateDriveId: (id?: string) => void;
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
  // State management
const [ydoc, setYDoc] = useState(() => new Y.Doc());
  const [fileName, setFileName] = useState('Untitled Document');
  const [driveFileId, setDriveFileId] = useState<string>();
  const [isInitialized, setIsInitialized] = useState(false);

  // Y.js operations
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

  // Document lifecycle methods
  const createNewDocument = useCallback(async (): Promise<void> => {
    try {
      setIsInitialized(false);

      const newYDoc = new Y.Doc();
      
      // Clear existing Y.doc state
      newYDoc.transact(() => {
        // Clear all shared data structures
        newYDoc.getMap('nodes').clear();
        newYDoc.getMap('resources').clear();
        newYDoc.getMap('subtrees').clear();


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

        // Initialize sentinel node in subtrees
        const sentinelSubtree = {
          minX: 0,
          maxX: 0,
          minY: 0,
          maxY: 0,
          width: 0,
          height: 0,
          position: { x: 0, y: 0 }
        };
        newYDoc.getMap('nodes').set(rootNode.id, rootNode);
        newYDoc.getMap('subtrees').set('sentinel-node', sentinelSubtree);
      }, { type: 'system', action: 'reset' });

      // Reset metadata
      setFileName('Untitled Document');
      setDriveFileId(undefined);
      
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
  
      // Create new YDoc and apply the state directly
      const newYDoc = new Y.Doc();
      newYDoc.transact(() => {
        Y.applyUpdate(newYDoc, docState);
      }, { type: 'system', action: 'loadData' });
  
      // Update metadata
      setFileName(fileName);
      setDriveFileId(driveFileId);
      
      // Replace old YDoc with new one
      setYDoc(newYDoc);
      setIsInitialized(true);
  
      console.log('loadData completed successfully');
    } catch (error) {
      console.error('Error in loadData:', error);
      toast.error('Failed to load document data');
      throw error;
    }
  }, []);


  // File metadata management
  const updateFileName = useCallback((name: string): void => {
    setFileName(name.trim() || 'Untitled Document');
  }, []);

  const updateDriveId = useCallback((id?: string): void => {
    setDriveFileId(id);
  }, []);

  // Context value
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
  }), [ydoc, fileName, driveFileId, isInitialized, createNewDocument, applyUpdate, getState, updateFileName, updateDriveId, loadData]);

  return (
    <YDocContext.Provider value={value}>
      {children}
    </YDocContext.Provider>
  );
};