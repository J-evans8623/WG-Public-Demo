// WebSocketManager.tsx

/**
 * @file WebSocketManager.tsx
 * @description
 * This file defines the WebSocketManager component and its context for managing WebSocket connections
 * within a React application. It handles the WebSocket lifecycle, integrates with Y.js for real-time
 * document synchronization, and provides connection state and control methods to child components.
 * The component ensures efficient state management and error handling for robust real-time collaboration.
 */

import React, { createContext, ReactNode, useContext, useEffect, useState, useRef } from 'react';
import { useFileContext } from './FileContext';
import { useYDoc } from './YDocContext';
import { ApiContext } from '@/app/src/context/ApiContext';
import { toast } from 'react-toastify';
import * as Y from 'yjs';

/**
 * @interface WebSocketManagerContextType
 * @description
 * Defines the structure of the WebSocketManager context, including the connection state
 * and methods to connect and disconnect the WebSocket.
 */
interface WebSocketManagerContextType {
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'error';
  connect: () => Promise<void>;
  disconnect: () => void;
}

/**
 * @context WebSocketManagerContext
 * @description
 * Creates a React context for the WebSocketManager, providing connection state
 * and control methods to consumer components.
 */
const WebSocketManagerContext = createContext<WebSocketManagerContextType | null>(null);

/**
 * @hook useWebSocketManager
 * @description
 * Custom hook to access the WebSocketManager context. Ensures that the hook is used within
 * a WebSocketManagerProvider.
 */
export const useWebSocketManager = () => {
  const context = useContext(WebSocketManagerContext);
  if (!context) {
    throw new Error('useWebSocketManager must be used within a WebSocketManagerProvider');
  }
  return context;
};

/**
 * @component WebSocketManagerProvider
 * @description
 * Main provider component that manages the WebSocket lifecycle, integrates with Y.js for
 * document synchronization, and provides connection state and control methods to its children.
 */
export const WebSocketManagerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { driveFileId, isInitialized, isYDocInitialized } = useFileContext();
  const { getWebSocketUrl } = useContext(ApiContext);
  const { ydoc, applyDocUpdate, getDocState } = useYDoc();
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);

  /**
   * @section Y.js Integration
   * Handles Y.js document updates by sending them through the WebSocket if the connection is open
   * and the update did not originate from the WebSocket itself. Logs detailed information about each update.
   */
  useEffect(() => {
    console.log('[WebSocketManager] Setting up Y.doc update handler');

    const handleUpdate = (update: Uint8Array, origin: any) => {
      console.log('[WebSocketManager] Y.doc update detected:', {
        updateSize: update.length,
        updateType: update.constructor.name,
        origin: origin,
        wsState: wsRef.current?.readyState
      });

      if (wsRef.current?.readyState === WebSocket.OPEN && origin !== wsRef.current) {
        console.log('[WebSocketManager] Sending update through WebSocket');
        try {
          wsRef.current.send(update);
          console.log('[WebSocketManager] Binary update sent successfully:', {
            size: update.length,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          console.error('[WebSocketManager] Failed to send update:', error);
        }
      } else {
        console.log('[WebSocketManager] Skipping update send:', {
          hasWebSocket: !!wsRef.current,
          readyState: wsRef.current?.readyState,
          isFromWebSocket: origin === wsRef.current
        });
      }
    };

    ydoc.on('update', handleUpdate);

    return () => {
      console.log('[WebSocketManager] Cleaning up Y.doc update handler');
      ydoc.off('update', handleUpdate);
    };
  }, [ydoc]);

  /**
   * @function connect
   * @description
   * Establishes the WebSocket connection by fetching the WebSocket URL, configuring binary data handling,
   * setting up event handlers for open, message, error, and close events, and managing the connection state.
   * Sends the initial Y.js document state upon successful connection.
   */
  const connect = async () => {
    if (!driveFileId || !isInitialized || !isYDocInitialized) {
      console.log('[WebSocketManager] Prerequisites not met for connection');
      return;
    }

    try {
      setConnectionState('connecting');
      const wsUrl = await getWebSocketUrl(driveFileId);
      console.log('[WebSocketManager] Establishing connection to:', wsUrl);
      
      const newWs = new WebSocket(wsUrl);
      wsRef.current = newWs;

      // Configure for binary data
      newWs.binaryType = 'arraybuffer';

      /**
       * @event onopen
       * @description
       * Handles the WebSocket open event by updating the connection state to 'connected',
       * sending the initial Y.js document state, and displaying a success toast notification.
       */
      newWs.onopen = () => {
        console.log('[WebSocketManager] Connection opened');
        setConnectionState('connected');
        
        // Send initial state
        const initialState = getDocState();
        console.log('[WebSocketManager] Sending initial state:', {
          stateSize: initialState.length,
          stateType: initialState.constructor.name,
          timestamp: new Date().toISOString()
        });
        newWs.send(initialState);
        toast.info('Connected to collaboration room');
      };

      /**
       * @event onmessage
       * @description
       * Handles incoming WebSocket messages by processing binary data,
       * applying document updates, and logging relevant information.
       */
      newWs.onmessage = async (event) => {
        console.log('[WebSocketManager] Message received:', {
          dataType: event.data?.constructor?.name,
          size: event.data?.byteLength || 0,
          timestamp: new Date().toISOString()
        });
        
        try {
          let update: Uint8Array;

          if (event.data instanceof ArrayBuffer) {
            update = new Uint8Array(event.data);
          } else if (event.data instanceof Blob) {
            const arrayBuffer = await event.data.arrayBuffer();
            update = new Uint8Array(arrayBuffer);
          } else {
            console.error('[WebSocketManager] Unexpected message format:', typeof event.data);
            return;
          }

          console.log('[WebSocketManager] Applying update:', {
            updateSize: update.length,
            timestamp: new Date().toISOString()
          });

          applyDocUpdate(update);
        } catch (error) {
          console.error('[WebSocketManager] Error processing message:', error);
        }
      };

      /**
       * @event onerror
       * @description
       * Handles WebSocket errors by updating the connection state to 'error'
       * and displaying an error toast notification.
       */
      newWs.onerror = (error) => {
        console.error('[WebSocketManager] WebSocket error:', error);
        setConnectionState('error');
        toast.error('WebSocket encountered an error');
      };

      /**
       * @event onclose
       * @description
       * Handles the WebSocket close event by updating the connection state to 'disconnected',
       * clearing the WebSocket reference, and displaying a warning toast notification.
       */
      newWs.onclose = () => {
        console.log('[WebSocketManager] Connection closed');
        setConnectionState('disconnected');
        wsRef.current = null;
        toast.warn('WebSocket connection closed');
      };

    } catch (error) {
      console.error('[WebSocketManager] Connection establishment failed:', error);
      setConnectionState('error');
      toast.error('Failed to establish WebSocket connection');
    }
  };

  /**
   * @section State Management
   * Monitors changes in connection prerequisites such as driveFileId, initialization states,
   * and manages the WebSocket connection accordingly by connecting or disconnecting as needed.
   */
  useEffect(() => {
    console.log('[WebSocketManager] Connection prerequisites changed:', {
      driveFileId,
      isInitialized,
      isYDocInitialized,
      currentState: connectionState
    });

    const shouldConnect = driveFileId && isInitialized && isYDocInitialized;
    
    if (shouldConnect) {
      connect();
    } else {
      disconnect();
    }
  }, [driveFileId, isInitialized, isYDocInitialized]);

  /**
   * @function disconnect
   * @description
   * Cleanly terminates the WebSocket connection by closing it, clearing the reference,
   * and updating the connection state to 'disconnected'.
   */
  const disconnect = () => {
    if (wsRef.current) {
      console.log('[WebSocketManager] Initiating disconnect');
      wsRef.current.close();
      wsRef.current = null;
      setConnectionState('disconnected');
    }
  };

  /**
   * @return
   * Renders the WebSocketManagerContext.Provider, supplying the connection state
   * and control methods to child components.
   */
  return (
    <WebSocketManagerContext.Provider value={{ connectionState, connect, disconnect }}>
      {children}
    </WebSocketManagerContext.Provider>
  );
};
