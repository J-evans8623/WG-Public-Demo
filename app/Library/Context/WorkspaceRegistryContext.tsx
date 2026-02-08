/***********************************************************************************************
 * @file WorkspaceRegistryContext.tsx
 * @description
 * This provider serves as the frontend's Predictive Registry and Single Source of Truth (SSoT) 
 * for document functional identity. Its primary responsibility is to maintain a session-live 
 * mapping of Document IDs to their "isEducatorWorkspace" status, ensuring that UI triggers 
 * can be rendered with O(1) complexity. By hydrating this mapping from the BFF registry 
 * endpoint on mount and persisting it in session storage, the context eliminates the 
 * race conditions associated with document-level handshakes. It provides an optimistic 
 * upsert method that allows the creation path to immediately register new notebooks 
 * without additional network round-trips. This architecture follows the SOLID principle 
 * of Single Responsibility by isolating functional identity from general file metadata.
 ***********************************************************************************************/

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useSession } from 'next-auth/react';

/** * Map of DocID to boolean indicating Educator Workspace status.
 * This structure is optimized for O(1) lookups during UI resolution.
 */
type RegistryMap = Record<string, boolean>;

interface WorkspaceRegistryContextType {
  /** Retrieves identity for a specific doc from local memory. */
  getWorkspaceIdentity: (docId: string) => boolean;
  /** Manually injects/updates a document's identity in the registry. */
  upsertIdentity: (docId: string, isEducator: boolean) => void;
  /** True when the initial session hydration is complete. */
  isHydrated: boolean;
}

const WorkspaceRegistryContext = createContext<WorkspaceRegistryContextType | undefined>(undefined);

const CACHE_KEY = 'bloom_workspace_registry_v1';

export const WorkspaceRegistryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { status } = useSession();
  const [registry, setRegistry] = useState<RegistryMap>({});
  const [isHydrated, setIsHydrated] = useState(false);

  // 1. Internal helper to commit data to both state and session cache.
  const commitRegistry = useCallback((data: RegistryMap) => {
    setRegistry(data);
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('[WorkspaceRegistry] Cache persistence failed', e);
    }
  }, []);

  // 2. Authoritative hydration logic. 
  // Aim: Only one network request per session.
  const hydrateRegistry = useCallback(async () => {
    // 2.1. Attempt fast-path load from local session cache
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        setRegistry(JSON.parse(cached));
        setIsHydrated(true);
        console.log('[WorkspaceRegistry] Predictive Registry hydrated from cache');
      } catch (e) {
        sessionStorage.removeItem(CACHE_KEY);
      }
    }

    // 2.2. Foreground revalidation from BFF SSoT
    try {
      const resp = await fetch('/api/workspace/registry');
      if (resp.ok) {
        const data = await resp.json();
        commitRegistry(data);
        setIsHydrated(true);
        console.log('[WorkspaceRegistry] Predictive Registry synced with BFF');
      }
    } catch (err) {
      console.error('[WorkspaceRegistry] Hydration failed', err);
    }
  }, [commitRegistry]);

  // 3. Trigger hydration as soon as the user is authenticated.
  useEffect(() => {
    if (status === 'authenticated') {
      hydrateRegistry();
    }
  }, [status, hydrateRegistry]);

  /**
   * @function getWorkspaceIdentity
   * @description
   * Performs an O(1) lookup in the predictive registry. This function is the primary 
   * interface for UI triggers like useInferWorkspace.
   */
  const getWorkspaceIdentity = useCallback((docId: string): boolean => {
    return !!registry[docId];
  }, [registry]);

  /**
   * @function upsertIdentity
   * @description
   * Optimistically adds a new document to the registry. This is vital for the 
   * creation fast-path, allowing brand-new notebooks to render correctly 
   * without waiting for a background refresh.
   */
  const upsertIdentity = useCallback((docId: string, isEducator: boolean) => {
    setRegistry(prev => {
      const next = { ...prev, [docId]: isEducator };
      // Async update to session storage
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(next)); } catch (e) {}
      return next;
    });
    console.log('[WorkspaceRegistry] Identity upserted locally:', { docId, isEducator });
  }, []);

  return (
    <WorkspaceRegistryContext.Provider value={{ getWorkspaceIdentity, upsertIdentity, isHydrated }}>
      {children}
    </WorkspaceRegistryContext.Provider>
  );
};

export const useWorkspaceRegistry = () => {
  const ctx = useContext(WorkspaceRegistryContext);
  if (!ctx) throw new Error('useWorkspaceRegistry must be used within WorkspaceRegistryProvider');
  return ctx;
};