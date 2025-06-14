/**
 * @file WebSocketManager.tsx
 * @description
 * Manages WebSocket connections for real-time document synchronization using y-websocket.
 */

import React, { createContext, ReactNode, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { WebsocketProvider } from 'y-websocket';
import { Awareness } from 'y-protocols/awareness';
import { useYDoc, } from '@/app/Library/Context/YDocContext';
import { ApiContext } from '@/app/src/context/ApiContext';


interface WebSocketManagerContextType {
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'error';
  connect: () => Promise<void>;
  disconnect: () => void;
}



const WebSocketManagerContext = createContext<WebSocketManagerContextType | null>(null);

export const useWebSocketManager = () => {
  const context = useContext(WebSocketManagerContext);
  if (!context) {
    throw new Error('useWebSocketManager must be used within a WebSocketManagerProvider');
  }
  return context;
};

export const WebSocketManagerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { getWebSocketUrl } = useContext(ApiContext);
  const { ydoc , docFileID, isInitialized} = useYDoc();
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const providerRef = useRef<WebsocketProvider | null>(null);
  const isConnectingRef = useRef<boolean>(false);


  // Create a function to handle provider cleanup
  const cleanupProvider = useCallback(() => {
    if (providerRef.current) {
      //console.log('[WebSocketManager] Cleaning up provider');
      providerRef.current.destroy();
      providerRef.current = null;
      setConnectionState('disconnected');
    }
  }, []);



// Add update observer to monitor all changes
// In WebSocketManager.tsx, replace the current useEffect with:

useEffect(() => {
  if (!ydoc) return;

  const updateHandler = async (update: Uint8Array, origin: any) => {
    /*console.log('[WebSocketManager] Update received:', {
      updateSize: update.length,
      origin: origin ? 'Provider' : 'Local',
      timestamp: new Date().toISOString()
    });*/

    //console.log('Origin Value is actually :', origin)
  };

  // Set up observer
  ydoc.on('update', updateHandler);

  // Clean up observer
  return () => {
    ydoc.off('update', updateHandler);
  };
}, [ydoc]);


  const connect = useCallback(async () => {
    if (!docFileID || !isInitialized || isConnectingRef.current) {
      /*console.log('[WebSocketManager] Prerequisites not met for connection or already connecting');*/
      return;
    }

    try {
      isConnectingRef.current = true;
      setConnectionState('connecting');
      const wsUrl = await getWebSocketUrl(docFileID);
      //console.log('[WebSocketManager] Establishing connection to:', wsUrl);

      // Extract token and ensure it's a string
      const token = wsUrl.split('?token=')[1] || '';

      // Create awareness instance
      const awareness = new Awareness(ydoc);
      
      // Configure WebSocket provider with default settings
      const newProvider = new WebsocketProvider(wsUrl, docFileID, ydoc, {
        connect: true,
        awareness,
        params: { token }
      });

      // Set up event listeners
      newProvider.on('status', ({ status }: { status: string }) => {
        //console.log('[WebSocketManager] Connection status:', status);
        switch (status) {
          case 'connected':
            setConnectionState('connected');
            //toast.info('Connected to collaboration room');
            break;
          case 'disconnected':
            setConnectionState('disconnected');
            //toast.warn('WebSocket connection closed');
            break;
          case 'error':
            setConnectionState('error');
            //toast.error('WebSocket encountered an error');
            break;
        }
      });

      // Handle connection errors with correct event type
      newProvider.on('connection-error', (event: Event, provider: WebsocketProvider) => {
        console.error('[WebSocketManager] Connection error:', {
          event,
          provider: provider.roomname,
          timestamp: new Date().toISOString()
        });
        setConnectionState('error');
        //toast.error('Failed to establish WebSocket connection');
      });

      providerRef.current = newProvider;

    } catch (error) {
      console.error('[WebSocketManager] Connection establishment failed:', error);
      setConnectionState('error');
      //toast.error('Failed to establish WebSocket connection');
    } finally {
      isConnectingRef.current = false;
    }
  }, [docFileID, isInitialized, ydoc, getWebSocketUrl]);

  const disconnect = useCallback(() => {
    //console.log('[WebSocketManager] Initiating disconnect');
    cleanupProvider();
  }, [cleanupProvider]);

  // Handle automatic connection/disconnection based on prerequisites
  useEffect(() => {
    const shouldConnect = docFileID && isInitialized ;
    


    if (shouldConnect && !providerRef.current && !isConnectingRef.current) {
      connect();
    }

    return () => {
      if (!shouldConnect && providerRef.current) {
        disconnect();
      }
    };
  }, [docFileID, isInitialized, connect, disconnect, connectionState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanupProvider();
  }, [cleanupProvider]);

  return (
    <WebSocketManagerContext.Provider value={{ connectionState, connect, disconnect }}>
      {children}
    </WebSocketManagerContext.Provider>
  );
};
