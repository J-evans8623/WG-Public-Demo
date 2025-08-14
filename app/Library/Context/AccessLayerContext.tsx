/***************************************************************************************
 * @file app/src/access/AccessLayerContext.tsx
 * @description
 *   AccessLayerContext is the single source of truth for client-side access posture
 *   for the *active document*. All producers (API responses that include `{ access }`,
 *   Yjs/collab events, first-time document bootstrap) feed signals/envelopes here via
 *   `applySignal`, `selectDoc`, or `setRole`. All consumers (CanvasController, autosave)
 *   read a small, stable set of properties—`role`, `canEdit`, `isOwner`, `docId`—to
 *   drive behavior. The context enforces three invariants: (1) scope signals to the
 *   currently selected doc; (2) newest-wins resolution by timestamp; (3) Owner is not
 *   downgraded by signals from other sources (ownership is authoritative). Focused
 *   logging with stable 4-digit codes aids production debugging without adding noise.
 *
 * Responsibilities:
 *   1) Hold the resolved access state for the active document.
 *   2) Provide a minimal read API (`role`, `canEdit`, `isOwner`, `docId`, `lastEvent`).
 *   3) Provide a small write API for producers (`selectDoc`, `applySignal`, `setRole`, `clearDoc`, `reset`).
 *   4) Enforce invariants: active-doc scoping, newest-wins, Owner immutability.
 ***************************************************************************************/

'use client';

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Role, AccessSignal, AccessSource, AccessEvent, AccessEnvelope } from   '@/app/studygraph/(studygraph)/types/access';

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
  // 1) Internal state retained across producers; lastAt is used for newest-wins.
  const [docId, setDocId] = useState<string | null>(null);
  const [role, setRoleState] = useState<Role>('None');
  const [prevRole, setPrevRole] = useState<Role | null>(null);
  const [lastEvent, setLastEvent] = useState<LastEvent>(null);
  const lastAtMs = useRef<number>(0);

  // 2) Derived booleans
  const canEdit = role === 'Owner' || role === 'Editor';
  const isOwner = role === 'Owner';

  // 3) Helpers
  const updateRole = useCallback((next: Role, env: LastEvent) => {
    setPrevRole((r) => (r === next ? r : role));
    setRoleState(next);
    setLastEvent(env);
    console.log('[AccessLayerContext.tsx][9101] role update', { docId, from: role, to: next, env });
  }, [role, docId]);

  const selectDoc = useCallback((id: string, seed?: SelectSeed) => {
    setDocId(id);
    setLastEvent(null);
    lastAtMs.current = 0;

    // Step-by-step: seed role if requested (for snappy UX during new-doc bootstrap)
    if (seed?.assumeOwner) {
      updateRole('Owner', {
        docId: id,
        role: 'Owner',
        signal: 'GRANT_EDIT',
        source: 'bootstrap',
        at: new Date().toISOString(),
      });
    } else if (seed?.assumeEditor) {
      updateRole('Editor', {
        docId: id,
        role: 'Editor',
        signal: 'GRANT_EDIT',
        source: 'bootstrap',
        at: new Date().toISOString(),
      });
    } else if (seed?.role) {
      updateRole(seed.role, {
        docId: id,
        role: seed.role,
        signal: null,
        source: 'bootstrap',
        at: new Date().toISOString(),
      });
    } else {
      // Unknown yet → neutral posture until a producer speaks
      updateRole('Viewer', {
        docId: id,
        role: 'Viewer',
        signal: null,
        source: 'bootstrap',
        at: new Date().toISOString(),
      });
    }

    console.log('[AccessLayerContext.tsx][9102] selectDoc', { docId: id, seed });
  }, [updateRole]);

  const applySignal = useCallback((env: AccessEnvelope) => {
    // 1) Ignore envelopes for other docs
    if (!docId || env.docId !== docId) {
      console.log('[AccessLayerContext.tsx][9103] ignoring envelope for different doc', { active: docId, incoming: env.docId });
      return;
    }

    // 2) Newest-wins: drop stale envelopes
    const atMs = Date.parse(env.at || new Date().toISOString());
    if (Number.isFinite(lastAtMs.current) && atMs <= lastAtMs.current) {
      console.log('[AccessLayerContext.tsx][9104] stale envelope dropped', { lastAt: lastAtMs.current, atMs });
      return;
    }
    lastAtMs.current = atMs;

    // 3) Owner immutability: once owner, keep as owner (server-side truth drives this in practice)
    if (role === 'Owner') {
      setLastEvent(env);
      console.log('[AccessLayerContext.tsx][9105] owner immutable; recorded event only', { env });
      return;
    }

    // 4) Resolve role from envelope; signal is advisory for UX
    const nextRole: Role = env.role ?? 'Viewer';
    updateRole(nextRole, env);
  }, [docId, role, updateRole]);

  const setRole = useCallback((next: Role, source: AccessEnvelope['source'] = 'yjs') => {
    if (!docId) {
      console.log('[AccessLayerContext.tsx][9106] setRole ignored; no active doc', { next, source });
      return;
    }
    const env: AccessEnvelope = {
      docId,
      role: next,
      signal: next === 'Viewer' ? 'EDIT_REVOKED' : 'GRANT_EDIT',
      source,
      at: new Date().toISOString(),
    };
    applySignal(env);
  }, [docId, applySignal]);

  const clearDoc = useCallback(() => {
    console.log('[AccessLayerContext.tsx][9107] clearDoc', { docId });
    setDocId(null);
    setPrevRole(role);
    setRoleState('None');
    setLastEvent(null);
    lastAtMs.current = 0;
  }, [role, docId]);

  const reset = useCallback(() => {
    console.log('[AccessLayerContext.tsx][9108] reset');
    setDocId(null);
    setPrevRole(null);
    setRoleState('None');
    setLastEvent(null);
    lastAtMs.current = 0;
  }, []);

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
