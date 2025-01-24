/**
 * @file YDocContext.tsx
 * @description
 * Provides the Y.Doc context for the application, ensuring that system-originated updates are ignored.
 */

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import * as Y from 'yjs';
import { SystemOrigin } from './Centralize/SystemOriginTypes';

interface YDocContextType {
  ydoc: Y.Doc;
  applyDocUpdate: (update: Uint8Array) => void;
  getDocState: () => Uint8Array;
  resetYDoc: () => Promise<Y.Doc>;
  initializeYDoc: () => Promise<void>;
}

const YDocContext = createContext<YDocContextType | undefined>(undefined);

export const useYDoc = () => {
  const context = useContext(YDocContext);
  if (!context) {
    throw new Error('useYDoc must be used within a YDocProvider');
  }
  return context;
};

export const YDocProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [ydoc, setYDoc] = useState(() => new Y.Doc());
  const ydocRef = useRef<Y.Doc>(ydoc);

  useEffect(() => {
    ydocRef.current = ydoc;
  }, [ydoc]);

  /**
   * Applies a document update, ignoring system-originated updates.
   *
   * @param update - The update to apply.
   */
  const applyDocUpdate = useCallback((update: Uint8Array): void => {
    console.log('********** Entering applyDocUpdate **********');
    if (!ydocRef.current) {
      console.warn('No valid YDoc instance available');
      return;
    }

    try {
      console.log('Initial Y.Doc State:', ydocRef.current.toJSON());
      Y.applyUpdate(ydocRef.current, update);
      console.log('Updated Y.Doc State:', ydocRef.current.toJSON());
    } catch (error) {
      console.error('Error applying update:', error);
    }
    console.log('********** Leaving applyDocUpdate **********');
  }, []);

  /**
   * Retrieves the current state of the document.
   *
   * @returns The encoded state as a Uint8Array.
   */
  const getDocState = useCallback((): Uint8Array => {
    console.log('********** Entering getDocState **********');
    if (!ydocRef.current) {
      console.warn('No valid YDoc instance available');
      return new Uint8Array();
    }

    try {
      const state = Y.encodeStateAsUpdate(ydocRef.current);
      console.log('Encoded State:', state);
      return state;
    } catch (error) {
      console.error('Error encoding state:', error);
      return new Uint8Array();
    } finally {
      console.log('********** Leaving getDocState **********');
    }
  }, []);

  /**
   * Resets the Y.Doc instance, marking the operation as a system-originated reset.
   *
   * @returns A promise that resolves to the new Y.Doc instance.
   */
// Update in YDocContext.tsx
const resetYDoc = useCallback(async (): Promise<Y.Doc> => {
  return new Promise((resolve) => {
    console.log('********** Entering resetYDoc **********');
    const newDoc = new Y.Doc();

    // Initialize required shared types within a system transaction
    newDoc.transact(() => {
      newDoc.getMap('nodes');
      newDoc.getMap('resources');
    }, { type: 'system', action: 'reset' });

    if (ydocRef.current) {
      // Destroy old doc within a system transaction
      ydocRef.current.transact(() => {
        ydocRef.current?.destroy();
      }, { type: 'system', action: 'cleanup' });
    }

    setYDoc(newDoc);
    ydocRef.current = newDoc;
    console.log('New Y.Doc created and initialized with system transaction');
    console.log('********** Leaving resetYDoc **********');
    resolve(newDoc);
  });
}, []);

  /**
   * Initializes the Y.Doc instance.
   *
   * @returns A promise that resolves when initialization is complete.
   */
  const initializeYDoc = useCallback(async (): Promise<void> => {
    return new Promise((resolve) => {
      console.log('********** Entering initializeYDoc **********');
      if (!ydocRef.current) {
        const newDoc = new Y.Doc();
        newDoc.getMap('nodes');
        newDoc.getMap('resources');
        setYDoc(newDoc);
        ydocRef.current = newDoc;
      }
      console.log('********** Leaving initializeYDoc **********');
      resolve();
    });
  }, []);

  return (
    <YDocContext.Provider value={{ 
        ydoc, 
        resetYDoc,
        initializeYDoc,
        applyDocUpdate, 
        getDocState 
      }}>
      {children}
    </YDocContext.Provider>
  );
};
