/***************************************************************************************
 * @file AccessLayerContext.tsx - Integration Update
 * @description
 *   Updated AccessLayerContext with DocumentAccessHistoryManager integration to support
 *   intelligent access change detection and modal triggering. The context now maintains
 *   session-based access history alongside its existing role resolution functionality,
 *   enabling distinction between file switching operations and legitimate document access
 *   changes. This integration preserves all existing context functionality while adding
 *   the necessary hooks for the enhanced RefreshModal system.
 *
 *   The updates include access history initialization during document selection, automatic
 *   history updates during role changes, and seamless integration with the existing access
 *   signal processing pipeline. All changes maintain backward compatibility with existing
 *   consumers while providing the foundation for intelligent modal behavior that eliminates
 *   false positive notifications during routine file operations.
 *
 * Key Integration Points:
 *   - Document selection now initializes access history records
 *   - Role changes automatically update session-based tracking  
 *   - Signal processing integrates with history management
 *   - Existing API surface remains unchanged for compatibility
 *   - Enhanced logging provides observability for access flows
 ***************************************************************************************/

'use client';

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Role, AccessSignal, AccessSource, AccessEvent, AccessEnvelope } from   '@/app/studygraph/(studygraph)/types/access';
import DocumentAccessHistoryManager from '@/app/studygraph/(studygraph)/components/hooks/access/DocumentAccessHistoryManager';

type LastEvent = AccessEnvelope | null;

interface AccessState {
  docId: string | null;
  role: Role;
  prevRole: Role | null;
  lastEvent: LastEvent;
}

interface SelectSeed {
  /** Assume caller is owner immediately (first-boot for a new doc). */
  assumeOwner?: boolean;
  /** Assume caller is editor immediately (rare; keeps API explicit). */
  assumeEditor?: boolean;
  /** Direct role seed (use sparingly; most should send envelopes). */
  role?: Role;
}

interface AccessLayerAPI extends AccessState {
  canEdit: boolean;
  isOwner: boolean;
  /** Step 1: set the active doc (optionally seed role to speed up UX). */
  selectDoc: (docId: string, seed?: SelectSeed) => void;
  /** Step 2: apply a normalized envelope from any producer. */
  applySignal: (env: AccessEnvelope) => void;
  /** Optional direct set when decoding a trusted JWT at connect time. */
  setRole: (role: Role, source?: AccessEnvelope['source']) => void;
  /** Clear doc (navigate away). */
  clearDoc: () => void;
  /** Full reset (hard app reset). */
  reset: () => void;
}

const AccessLayerContext = createContext<AccessLayerAPI | undefined>(undefined);

export function useAccessLayer(): AccessLayerAPI {
  const ctx = useContext(AccessLayerContext);
  if (!ctx) throw new Error('useAccessLayer must be used within <AccessLayerProvider>');
  return ctx;
}

export const AccessLayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Step 1: Initialize history manager singleton integration
  const historyManager = DocumentAccessHistoryManager.getInstance();

  // Step 2: Internal state retained across producers; lastAt is used for newest-wins.
  const [docId, setDocId] = useState<string | null>(null);
  const [role, setRoleState] = useState<Role>('None');
  const [prevRole, setPrevRole] = useState<Role | null>(null);
  const [lastEvent, setLastEvent] = useState<LastEvent>(null);
  const lastAtMs = useRef<number>(0);

  // Step 3: Derived booleans
  const canEdit = role === 'Owner' || role === 'Editor';
  const isOwner = role === 'Owner';

  // Step 4: Enhanced role update with history integration
  const updateRole = useCallback((next: Role, env: LastEvent) => {
    console.log('[AccessLayerContext.tsx][4001] › Role update initiated', { 
      docId, 
      from: role, 
      to: next, 
      source: env?.source 
    });

    // Step 4a: Update React state
    setPrevRole((r) => (r === next ? r : role));
    setRoleState(next);
    setLastEvent(env);

    // Step 4b: Update access history if we have a document context
    if (docId && env) {
      const historyChanged = historyManager.updateDocumentAccess(docId, next, env.source);
      console.log('[AccessLayerContext.tsx][4002] › Access history updated', { 
        docId, 
        role: next, 
        historyChanged 
      });
    }

    console.log('[AccessLayerContext.tsx][4003] › Role update completed', { 
      docId, 
      newRole: next, 
      source: env?.source 
    });
  }, [role, docId, historyManager]);

  /**
   * @method selectDoc
   * @description
   *   Enhanced document selection that initializes both AccessLayer state and access
   *   history tracking. Handles role seeding for optimistic UX while ensuring proper
   *   history initialization to support intelligent modal trigger detection during
   *   subsequent access changes and file operations.
   */
  const selectDoc = useCallback((id: string, seed?: SelectSeed) => {
    console.log('[AccessLayerContext.tsx][4004] › Document selection started', { 
      docId: id, 
      seed,
      previousDoc: docId 
    });

    // Step 1: Update document context
    setDocId(id);
    setLastEvent(null);
    lastAtMs.current = 0;

    // Step 2: Determine initial role from seed
    let initialRole: Role = 'Viewer';
    let source: AccessSource = 'bootstrap';

    if (seed?.assumeOwner) {
      initialRole = 'Owner';
    } else if (seed?.assumeEditor) {
      initialRole = 'Editor';
    } else if (seed?.role) {
      initialRole = seed.role;
    }

    // Step 3: Create access envelope for history tracking
    const bootstrapEnvelope: AccessEnvelope = {
      docId: id,
      role: initialRole,
      signal: 'GRANT_EDIT',
      source,
      at: new Date().toISOString(),
    };

    // Step 4: Initialize access history for new document
    historyManager.initializeDocumentHistory(id, initialRole, source);

    // Step 5: Update role through standard pipeline
    updateRole(initialRole, bootstrapEnvelope);

    console.log('[AccessLayerContext.tsx][4005] › Document selection completed', { 
      docId: id, 
      initialRole, 
      source 
    });
  }, [updateRole, historyManager, docId]);

  /**
   * @method applySignal
   * @description
   *   Enhanced signal processing that maintains existing envelope handling while
   *   integrating access history updates. Preserves all existing invariants including
   *   document scoping, newest-wins resolution, and Owner immutability while adding
   *   the necessary hooks for intelligent access change detection.
   */
  const applySignal = useCallback((env: AccessEnvelope) => {
    console.log('[AccessLayerContext.tsx][4006] › Signal application started', { 
      docId: env.docId, 
      role: env.role, 
      source: env.source,
      currentDoc: docId 
    });

    // Step 1: Ignore envelopes for other docs
    if (!docId || env.docId !== docId) {
      console.log('[AccessLayerContext.tsx][4007] › Signal ignored for different document', { 
        active: docId, 
        incoming: env.docId 
      });
      return;
    }

    // Step 2: Newest-wins: drop stale envelopes
    const atMs = Date.parse(env.at || new Date().toISOString());
    if (Number.isFinite(lastAtMs.current) && atMs <= lastAtMs.current) {
      console.log('[AccessLayerContext.tsx][4008] › Stale envelope dropped', { 
        lastAt: lastAtMs.current, 
        incomingAt: atMs 
      });
      return;
    }
    lastAtMs.current = atMs;

    // Step 3: Owner immutability: once owner, keep as owner (server-side truth drives this in practice)
    if (role === 'Owner') {
      setLastEvent(env);
      console.log('[AccessLayerContext.tsx][4009] › Owner immutable; recorded event only', { env });
      return;
    }

    // Step 4: Resolve role from envelope; signal is advisory for UX
    const nextRole: Role = env.role ?? 'Viewer';
    
    // Step 5: Update through standard pipeline (includes history integration)
    updateRole(nextRole, env);
    
    console.log('[AccessLayerContext.tsx][4010] › Signal application completed', { 
      docId: env.docId, 
      newRole: nextRole, 
      source: env.source 
    });
  }, [docId, role, updateRole]);

  /**
   * @method setRole
   * @description
   *   Enhanced direct role setting that maintains existing functionality while
   *   integrating with access history tracking. Preserves the existing API for
   *   backward compatibility while ensuring history updates occur through the
   *   standard signal processing pipeline for consistent access change detection.
   */
  const setRole = useCallback((next: Role, source: AccessEnvelope['source'] = 'yjs') => {
    console.log('[AccessLayerContext.tsx][4011] › Direct role set requested', { 
      docId, 
      next, 
      source 
    });

    if (!docId) {
      console.log('[AccessLayerContext.tsx][4012] › Direct role set ignored; no active doc', { 
        next, 
        source 
      });
      return;
    }

    // Step 1: Create envelope for standard processing pipeline
    const env: AccessEnvelope = {
      docId,
      role: next,
      signal: next === 'Viewer' ? 'EDIT_REVOKED' : 'GRANT_EDIT',
      source,
      at: new Date().toISOString(),
    };

    // Step 2: Process through standard signal pipeline
    applySignal(env);
  }, [docId, applySignal]);

  /**
   * @method clearDoc
   * @description
   *   Enhanced document clearing that maintains existing state management while
   *   preserving access history for potential future reference. The history
   *   remains available for the session duration to support proper change
   *   detection if the same document is reopened during the current session.
   */
  const clearDoc = useCallback(() => {
    console.log('[AccessLayerContext.tsx][4013] › Document clear requested', { 
      docId,
      historySize: historyManager.getHistorySize() 
    });

    // Step 1: Clear AccessLayer state
    setDocId(null);
    setPrevRole(role);
    setRoleState('None');
    setLastEvent(null);
    lastAtMs.current = 0;

    console.log('[AccessLayerContext.tsx][4014] › Document cleared successfully', { 
      previousDoc: docId 
    });
  }, [role, docId, historyManager]);

  /**
   * @method reset
   * @description
   *   Enhanced full reset that clears both AccessLayer state and all access
   *   history for complete session cleanup. Used for hard application resets
   *   where complete state initialization is required, ensuring no stale
   *   history affects subsequent access change detection.
   */
  const reset = useCallback(() => {
    console.log('[AccessLayerContext.tsx][4015] › Full reset requested', {
      currentDoc: docId,
      historySize: historyManager.getHistorySize()
    });

    // Step 1: Clear AccessLayer state  
    setDocId(null);
    setPrevRole(null);
    setRoleState('None');
    setLastEvent(null);
    lastAtMs.current = 0;

    // Step 2: Clear access history
    historyManager.clearHistory();

    console.log('[AccessLayerContext.tsx][4016] › Full reset completed');
  }, [docId, historyManager]);

  // Step 6: Memoized context value with enhanced API
  const value = useMemo<AccessLayerAPI>(() => ({
    docId, role, prevRole, lastEvent, canEdit, isOwner,
    selectDoc, applySignal, setRole, clearDoc, reset,
  }), [docId, role, prevRole, lastEvent, canEdit, isOwner, selectDoc, applySignal, setRole, clearDoc, reset]);

  return (
    <AccessLayerContext.Provider value={value}>
      {children}
    </AccessLayerContext.Provider>
  );
};