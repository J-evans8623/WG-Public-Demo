// File: src/context/YDocContext.tsx

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { ApiContext } from '@/app/src/context/ApiContext';
import { useFileContext } from './FileProvider';
import { toast } from 'react-toastify'; // For user notifications

interface YDocContextType {
  ydoc: Y.Doc;
  provider: WebsocketProvider | null;
  status: 'connected' | 'connecting' | 'disconnected';
  resetWebSocketAndYDoc: (newDocumentId: string) => Promise<Y.Doc>;
  encodeDocState: () => Uint8Array;
  applyDocUpdate: (update: Uint8Array) => void;
  syncYDocState: () => void;
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
  const { getWebSocketUrl } = useContext(ApiContext);
  const { driveFileId } = useFileContext();
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [status, setStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');
  const [ydoc, setYdoc] = useState<Y.Doc>(new Y.Doc());

  /**
   * Encodes the entire Y.Doc state as a binary update.
   * @returns {Uint8Array} The binary representation of the current Y.Doc state.
   */
  const encodeDocState = useCallback((): Uint8Array => {
    const update = Y.encodeStateAsUpdate(ydoc);
    console.log('Y.Doc state encoded.');
    return update;
  }, [ydoc]);

  /**
   * Applies a binary update to the Y.Doc.
   * @param {Uint8Array} update - A Uint8Array representing Y.js changes.
   */
  const applyDocUpdate = useCallback((update: Uint8Array): void => {
    Y.applyUpdate(ydoc, update);
    console.log('Y.Doc update applied.');
  }, [ydoc]);

  /**
   * Synchronizes Y.Doc state with the remote server.
   */
  const syncYDocState = useCallback((): void => {
    if (!provider) {
      console.error('WebSocketProvider is not initialized.');
      return;
    }

    const ws = provider.ws;

    if (!ws) {
      console.error('WebSocket connection is not available. Ensure the provider is connected.');
      return;
    }

    // Check if WebSocket is open before sending data
    if (ws.readyState !== WebSocket.OPEN) {
      console.error('WebSocket is not open. Cannot synchronize Y.Doc state.');
      return;
    }

    // Encode the current state
    const encodedState = encodeDocState();

    // Send the encoded state to the server
    ws.send(encodedState);
    console.log('Y.Doc state synchronized with the server.');
    toast.success('Document synchronized successfully.');
  }, [provider, encodeDocState]);

  /**
   * Initializes the WebSocket connection with the current Y.Doc and document ID.
   * @param {string} documentId - The ID of the document to connect to.
   * @param {Y.Doc} currentYdoc - The Y.Doc instance to use.
   */
  const initializeWebSocket = useCallback(async (documentId: string, currentYdoc: Y.Doc) => {
    setStatus('connecting');
    try {
      const wsUrl = await getWebSocketUrl(documentId);
      const wsProvider = new WebsocketProvider(wsUrl, documentId, currentYdoc);

      wsProvider.on('status', (event: { status: string }) => {
        if (event.status === 'connected') {
          setStatus('connected');
          // Synchronize Y.Doc state with server upon connection
          syncYDocState();
        } else if (event.status === 'connecting') {
          setStatus('connecting');
        } else {
          setStatus('disconnected');
        }
      });

      setProvider(wsProvider);
      console.log('WebSocketProvider initialized.');
    } catch (error) {
      console.error('Failed to initialize WebSocket:', error);
      setStatus('disconnected');
      toast.error('Failed to connect to the collaboration server.');
    }
  }, [getWebSocketUrl, syncYDocState]);

  /**
   * Resets the current Y.Doc and WebSocketProvider, then initializes new instances.
   * @param {string} newDocumentId - The ID of the new document to load.
   * @returns {Promise<Y.Doc>} - Returns the new Y.Doc instance.
   */
  const resetWebSocketAndYDoc = useCallback(async (newDocumentId: string): Promise<Y.Doc> => {
    console.log(`Resetting Y.Doc and WebSocketProvider for new document ID: ${newDocumentId}`);

    // Destroy existing WebSocketProvider
    if (provider) {
      provider.destroy();
      setProvider(null);
      setStatus('disconnected');
      console.log('Existing WebSocketProvider destroyed.');
    }

    // Destroy existing Y.Doc
    ydoc.destroy();
    const newYdoc = new Y.Doc();
    setYdoc(newYdoc);
    console.log('Existing Y.Doc destroyed and new instance created.');

    // Initialize new WebSocketProvider with the new Y.Doc
    await initializeWebSocket(newDocumentId, newYdoc);
    console.log('New WebSocketProvider initialized for the new document.');

    return newYdoc;
  }, [provider, initializeWebSocket, ydoc]);

  useEffect(() => {
    if (!driveFileId) {
      console.warn('No documentId available. WebSocket connection not established.');
      return;
    }

    initializeWebSocket(driveFileId, ydoc);

    return () => {
      if (provider) {
        provider.destroy();
        setProvider(null);
        setStatus('disconnected');
        console.log('WebSocketProvider destroyed on cleanup.');
      }
      ydoc.destroy();
      console.log('Y.Doc destroyed on cleanup.');
    };
  }, [driveFileId, initializeWebSocket, provider, ydoc]);

  const contextValue: YDocContextType = {
    ydoc,
    provider,
    status,
    resetWebSocketAndYDoc,
    encodeDocState,
    applyDocUpdate,
    syncYDocState,
  };

  return (
    <YDocContext.Provider value={contextValue}>
      {children}
    </YDocContext.Provider>
  );
};
