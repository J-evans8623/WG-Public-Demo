// useCollaborationManager.ts
/**
 * @file useCollaborationManager.ts
 * @description
 *   React hook interface for the CollaborationManager singleton.
 *   Provides a clean React API while maintaining singleton stability.
 */

import { useEffect, useState, useCallback } from 'react';
import * as Y from 'yjs';
import { collaborationManager, CollabStatus } from './CollaborationManager';

interface CollaborationOptions {
  /** Called when server kicks the user (revoked → close code 4003). */
  onRevoked?: (ctx: { docId: string }) => void;
  /** Called when token is invalid/expired (close code 4002) and the auto single-retry also fails. */
  onInvalidToken?: (ctx: { docId: string; error?: unknown }) => void;
}

interface UseCollaborationManagerReturn {
  status: CollabStatus;
  connect: (docId: string, ydoc: Y.Doc, visibility?: 'private' | 'public') => Promise<void>;
  disconnect: () => void;
  isConnected: boolean;
  currentDocId: string | null;
  // DEBUGGING: Retry information
  retryInfo: { docId: string; attempts: number; maxAttempts: number }[];
  resetRetryCounter: (docId: string) => void;
  resetAllRetryCounters: () => void;
}

/**
 * React hook for managing document collaboration via the singleton manager.
 * This hook provides a stable interface that won't cause disconnections on re-renders.
 */
export function useCollaborationManager(options: CollaborationOptions = {}): UseCollaborationManagerReturn {
  const [status, setStatus] = useState<CollabStatus>(collaborationManager.getStatus());
  const [currentDocId, setCurrentDocId] = useState<string | null>(collaborationManager.getCurrentDocId());

  // Subscribe to status changes from the singleton
  useEffect(() => {
    const unsubscribe = collaborationManager.onStatusChange((newStatus) => {
      setStatus(newStatus);
      setCurrentDocId(collaborationManager.getCurrentDocId());
    });

    return unsubscribe;
  }, []);

  // Connect function with stable reference
  const connect = useCallback(async (
    docId: string, 
    ydoc: Y.Doc, 
    visibility: 'private' | 'public' = 'private'
  ) => {
    console.log('useCollaborationManager › Connect requested for doc:', docId);
    try {
      await collaborationManager.connect(docId, ydoc, visibility, options);
    } catch (error) {
      console.error('useCollaborationManager › Connect failed:', error);
      throw error;
    }
  }, [options]);

  // Disconnect function with stable reference
  const disconnect = useCallback(() => {
    console.log('useCollaborationManager › Disconnect requested');
    collaborationManager.disconnect();
  }, []);

  // Debugging functions
  const resetRetryCounter = useCallback((docId: string) => {
    collaborationManager.resetRetryCounter(docId);
  }, []);

  const resetAllRetryCounters = useCallback(() => {
    collaborationManager.resetAllRetryCounters();
  }, []);

  // Computed properties
  const isConnected = status === 'connected';
  const retryInfo = collaborationManager.getRetryInfo();

  return {
    status,
    connect,
    disconnect,
    isConnected,
    currentDocId,
    retryInfo,
    resetRetryCounter,
    resetAllRetryCounters,
  };
}