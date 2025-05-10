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
import { Descendant } from 'slate';

interface WebSocketManagerContextType {
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'error';
  connect: () => Promise<void>;
  disconnect: () => void;
}

interface SerializedPictureResource {
  id: string;
  nodeId: string;
  type: 'picture';
  title: string;
  imageData?: string; // Base64 encoded image data
  description?: Descendant[];
  source?: string;
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
  const { ydoc , driveFileId, isInitialized} = useYDoc();
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


// Updated type for extractImageMessages function
/**const extractImageMessages = useCallback((resourcesMap: Y.Map<any>): ImageMessage[] => {
  
  resourcesMap.forEach((nodeResources: any, nodeId: string) => {
    // Check if nodeResources is a Y.Map
    if (nodeResources instanceof Y.Map) {
      nodeResources.forEach((resource: any, resourceId: string) => {
        if (
          resource && 
          typeof resource === 'object' &&
          resource.type === 'picture' && 
          'serverUrl' in resource
        ) {
          messages.push({
            id: resource.id,
            nodeId,
            type: 'picture',
            serverUrl: resource.serverUrl,
            title: resource.title,
            description: resource.description,
            source: resource.source
          });
        }
      });
    }
  });
  
  return messages;
}, []); */
  

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

    // Only process updates from other clients
    if (origin instanceof WebsocketProvider) {
      try {
        const resourcesMap = ydoc.getMap('resources');
        
        // Extract and filter new image messages
        //const imageMessages = extractImageMessages(resourcesMap);
        //const newImageMessages = imageMessages.filter(msg => !imageAssets.has(msg.id));
        
       /** if (newImageMessages.length > 0) {
          //console.log('[WebSocketManager] Found new images to fetch:', newImageMessages);
          await fetchImageOnUpdate(newImageMessages);
        }  */

        // Log current document state
        /*console.log('[WebSocketManager] Current document state:', {
          totalResources: resourcesMap.size,
          hasChanges: Y.encodeStateAsUpdate(ydoc).length > 0,
          timestamp: new Date().toISOString()
        });*/
      } catch (error) {
        console.error('[WebSocketManager] Error processing update:', error);
      }
    }
  };

  // Set up observer
  ydoc.on('update', updateHandler);

  // Clean up observer
  return () => {
    ydoc.off('update', updateHandler);
  };
}, [ydoc]);


  const connect = useCallback(async () => {
    if (!driveFileId || !isInitialized || isConnectingRef.current) {
      /*console.log('[WebSocketManager] Prerequisites not met for connection or already connecting');*/
      return;
    }

    try {
      isConnectingRef.current = true;
      setConnectionState('connecting');
      const wsUrl = await getWebSocketUrl(driveFileId);
      //console.log('[WebSocketManager] Establishing connection to:', wsUrl);

      // Extract token and ensure it's a string
      const token = wsUrl.split('?token=')[1] || '';

      // Create awareness instance
      const awareness = new Awareness(ydoc);
      
      // Configure WebSocket provider with default settings
      const newProvider = new WebsocketProvider(wsUrl, driveFileId, ydoc, {
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

      // Handle sync status with enhanced logging
      newProvider.on('sync', (isSynced: boolean) => {
        /*console.log('[WebSocketManager] Sync status:', {
          isSynced,
          timestamp: new Date().toISOString(),
          documentId: driveFileId,
          provider: providerRef.current ? 'active' : 'inactive'
        });*/

        if (isSynced) {
          // Log the state of resources after sync
          try {
            const resourcesMap = ydoc.getMap('resources');
            /*console.log('[WebSocketManager] Resources after sync:', {
              totalResources: resourcesMap.size,
              resourceKeys: Array.from(resourcesMap.keys())
            });*/
            //toast.success('Document synchronized');
          } catch (error) {
            console.error('[WebSocketManager] Error checking resources after sync:', error);
          }
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
  }, [driveFileId, isInitialized, ydoc, getWebSocketUrl]);

  const disconnect = useCallback(() => {
    //console.log('[WebSocketManager] Initiating disconnect');
    cleanupProvider();
  }, [cleanupProvider]);

  // Handle automatic connection/disconnection based on prerequisites
  useEffect(() => {
    const shouldConnect = driveFileId && isInitialized ;
    
    /*console.log('[WebSocketManager] Connection state check:', {
      shouldConnect,
      hasProvider: !!providerRef.current,
      isConnecting: isConnectingRef.current,
      connectionState
    });*/

    if (shouldConnect && !providerRef.current && !isConnectingRef.current) {
      connect();
    }

    return () => {
      if (!shouldConnect && providerRef.current) {
        disconnect();
      }
    };
  }, [driveFileId, isInitialized, connect, disconnect, connectionState]);

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
