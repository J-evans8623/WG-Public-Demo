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

  const initializeWebSocket = useCallback(async (documentId: string, currentYdoc: Y.Doc) => {
    console.log('Initializing WebSocket connection...');
    
    // Clean up existing provider first
    if (provider) {
      provider.destroy();
      setProvider(null);
    }
    
    setStatus('connecting');
    
    try {
      const wsUrl = await getWebSocketUrl(documentId);
      
      // Add connection parameters
      const wsProvider = new WebsocketProvider(wsUrl, documentId, currentYdoc, {
        connect: true,
        params: {},
        WebSocketPolyfill: WebSocket,
        resyncInterval: 10000,
        maxBackoffTime: 10000,
        disableBc: true // Disable broadcast channel
      });
  
      // Add proper event listeners with correct type signatures
      wsProvider.on('status', ({ status: connectionStatus }: { status: string }) => {
        console.log(`WebSocket status changed: ${connectionStatus}`);
        setStatus(connectionStatus === 'connected' ? 'connected' : 
                  connectionStatus === 'connecting' ? 'connecting' : 'disconnected');
      });
  
      wsProvider.on('connection-error', (event: Event, provider: WebsocketProvider) => {
        console.error('WebSocket connection error:', event);
        setStatus('disconnected');
      });
  
      setProvider(wsProvider);
      console.log('WebSocket provider initialized successfully');
      
      return wsProvider;
    } catch (error) {
      console.error('Failed to initialize WebSocket:', error);
      setStatus('disconnected');
      throw error;
    }
  }, [getWebSocketUrl]);
  /**
   * Resets the current Y.Doc and WebSocketProvider, then initializes new instances.
   * @param {string} newDocumentId - The ID of the new document to load.
   * @returns {Promise<Y.Doc>} - Returns the new Y.Doc instance.
   */
  const resetWebSocketAndYDoc = useCallback(async (newDocumentId: string): Promise<Y.Doc> => {
    console.log(`Resetting Y.Doc and WebSocket for document: ${newDocumentId}`);
  
    // Clean up existing connections
    if (provider) {
      provider.destroy();
      setProvider(null);
    }
  
    // Create new Y.Doc instance
    const newYdoc = new Y.Doc();
    
    try {
      // Initialize new WebSocket connection
      await initializeWebSocket(newDocumentId, newYdoc);
      setYdoc(newYdoc);
      return newYdoc;
    } catch (error) {
      newYdoc.destroy();
      throw error;
    }
  }, [provider, initializeWebSocket]);

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
      }
      ydoc.destroy();
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
