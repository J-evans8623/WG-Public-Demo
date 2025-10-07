/*****************************************************************************************
 * @file AccessLayerContext.tsx
 * @responsibility
 *   Provide a single in-app source of truth for per-document access policy (role/public flags),
 *   track the current doc id, and expose a small API that other providers/components can use.
 *   This update fixes the context value shape to fully implement `AccessLayerAPI` and adds
 *   missing methods to the memoized value (`currentDocId`, `get`, `seedFromList`).
 *****************************************************************************************/

import React, { createContext, useMemo, useCallback, useRef, useEffect } from 'react';
import { Role,   AccessEnvelope } from   '@/app/studygraph/(studygraph)/types/access';
import type { UserFileMetadata } from '@/app/src/types/fileTypes';
import {  useFileList} from '@/app/src/context/ApiContext';
type AccessRecord = {
  role: Role;
  updatedAt: number;
  publicEdit?: boolean;
  publicView?: boolean;
  
};

export interface AccessLayerAPI {
  /** currently selected doc id (null when none) */
  currentDocId: string | null;
  /** quick read for a doc’s policy facts (undefined if unknown) */
  get: (docId: string) => AccessRecord | undefined;
  /** bulk seed from file lists */
  seedFromList: (files: UserFileMetadata[]) => void;

  /** derived helpers / selected doc facts */
  docId: string | null;
  role: Role;
  prevRole: Role | null;
  lastEvent: 'seed' | 'signal' | 'select' | 'clear' | 'reset' | null;
  canEdit: boolean;
  isOwner: boolean;

  /** mutators */
  selectDoc: (docId: string, opts?: { assumeOwner?: boolean }) => void;
  applySignal: (env: AccessEnvelope) => void;
  setRole: (docId: string, role: Role) => void;
  clearDoc: () => void;
  reset: () => void;
}

const Ctx = createContext<AccessLayerAPI | undefined>(undefined);

export const useAccessLayer = (): AccessLayerAPI => {
  const v = React.useContext(Ctx);
  if (!v) throw new Error('useAccessLayer must be used within AccessLayerProvider');
  return v;
};

export const AccessLayerProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  // ─────────────────────────────────────────────────────────────────────────────
  // State stores
  // ─────────────────────────────────────────────────────────────────────────────
  const mapRef = useRef<Map<string, AccessRecord>>(new Map());
  const currentDocIdRef = useRef<string | null>(null);
  const roleRef = useRef<Role>('None');
  const prevRoleRef = useRef<Role | null>(null);
  const lastEventRef = useRef<AccessLayerAPI['lastEvent']>(null);
  const { ownedFiles, sharedFiles, isHydrated} = useFileList();





  // ─────────────────────────────────────────────────────────────────────────────
  // Derived booleans (read from refs each call)
  // ─────────────────────────────────────────────────────────────────────────────
  const canEditOf = useCallback((r: AccessRecord | undefined): boolean => {
    // 1) Owners and Editors can edit
    if (r?.role === 'Owner' || r?.role === 'Editor') return true;
    // 2) Public edit grants edit
    if (r?.publicEdit === true) return true;
    // 3) Otherwise read-only
    return false;
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // API: get
  // ─────────────────────────────────────────────────────────────────────────────
  /**
   * @function get
   * @purpose Return the stored policy facts for a specific docId, or undefined.
   * @steps
   *   1) Read from the in-memory map
   *   2) Return a direct reference (callers should treat as readonly)
   */
  const get = useCallback<AccessLayerAPI['get']>((docId) => {
    return mapRef.current.get(docId);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // API: seedFromList
  // ─────────────────────────────────────────────────────────────────────────────
  /**
   * @function seedFromList
   * @purpose Bulk-seed access records from file list responses.
   * @steps
   *   1) For each file, create/replace the record using file.role/public flags
   *   2) Track updatedAt with a wall clock number (ms)
   *   3) If current doc is touched and role changes, keep prevRole for diffing
   *   4) Mark lastEvent for observability
   */
  const seedFromList = useCallback<AccessLayerAPI['seedFromList']>((files) => { // update - 1

    let touchedCurrent = false;

    for (const f of files) {
      // Normalize role (default Viewer if missing)
      const role: Role = (f.role as Role) || 'Viewer';
      const record: AccessRecord = {
        role,
        publicEdit: f.publicEdit,
        publicView: f.publicView,
        updatedAt: Date.parse(f.updatedAt),
      };

      const currentRecord = mapRef.current.get(f.fileId)
      
      // check if current record exist
      if (currentRecord) {
        // if it exist check which record is the most recent
         if (currentRecord.updatedAt < record.updatedAt) {
        // if record is the most recent then overwrite record otherwise ignore...
        mapRef.current.set(f.fileId, record);
      }
      // other wise if there was no current record then simply add it to the list
      } else {
        mapRef.current.set(f.fileId, record);
      }

      if (currentDocIdRef.current === f.fileId) {
        touchedCurrent = true;
      }
    }

    if (touchedCurrent) {
      const cur = mapRef.current.get(currentDocIdRef.current!);
      if (cur && cur.role !== roleRef.current) {
        prevRoleRef.current = roleRef.current;
        roleRef.current = cur.role;
      }
    }

    lastEventRef.current = 'seed';
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // API: selectDoc
  // ─────────────────────────────────────────────────────────────────────────────
  /**
   * @function selectDoc
   * @purpose Set the active/current doc id and optionally assume owner in absence of data.
   * @steps
   *   1) Set current id
   *   2) Read record; if missing and assumeOwner, synthesize a record
   *   3) Track prevRole / role diffs
   *   4) Record lastEvent
   */
  const selectDoc = useCallback<AccessLayerAPI['selectDoc']>((docId, opts) => { // update - 2
    currentDocIdRef.current = docId;

    let rec = mapRef.current.get(docId);
    if (!rec && opts?.assumeOwner) {
      rec = { role: 'Viewer', updatedAt: Date.now() };
      mapRef.current.set(docId, rec);
    }

    const newRole = rec?.role ?? 'None';
    if (newRole !== roleRef.current) {
      prevRoleRef.current = roleRef.current;
      roleRef.current = newRole;
    }

    lastEventRef.current = 'select';
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // API: applySignal
  // ─────────────────────────────────────────────────────────────────────────────
  /**
   * @function applySignal
   * @purpose Ingest server envelopes (save/download etc.) into the store.
   * @steps
   *   1) Upsert record by docId
   *   2) Update timestamps and public flags
   *   3) If record concerns current doc, update role/prevRole
   *   4) Record lastEvent
   */
  const applySignal = useCallback<AccessLayerAPI['applySignal']>((env) => {      // update - 3
    const rec = mapRef.current.get(env.docId) ?? { role: 'None', updatedAt: 0 };
    const next: AccessRecord = {
      role: (env.role as Role) ?? rec.role,
      publicEdit: env.publicEdit ?? rec.publicEdit,
      publicView: env.publicView ?? rec.publicView,
      updatedAt: Date.parse(env.at) || Date.now(),
    };
    mapRef.current.set(env.docId, next);

    if (currentDocIdRef.current === env.docId) {
      if (next.role !== roleRef.current) {
        prevRoleRef.current = roleRef.current;
        roleRef.current = next.role;
      }
    }

    lastEventRef.current = 'signal';
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // API: setRole
  // ─────────────────────────────────────────────────────────────────────────────
  /**
   * @function setRole
   * @purpose Manually stamp a role for a doc (best-effort hint).
   * @steps
   *   1) Upsert record with given role
   *   2) If targeting current doc, update role/prevRole
   *   3) Mark lastEvent
   */
  const setRole = useCallback<AccessLayerAPI['setRole']>((docId, role) => {      // update - 4
    const existed = mapRef.current.get(docId);
    const next: AccessRecord = {
      role,
      publicEdit: existed?.publicEdit,
      publicView: existed?.publicView,
      updatedAt: Date.now(),
    };
    mapRef.current.set(docId, next);

    if (currentDocIdRef.current === docId) {
      if (next.role !== roleRef.current) {
        prevRoleRef.current = roleRef.current;
        roleRef.current = next.role;
      }
    }

    lastEventRef.current = 'signal';
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // API: clearDoc / reset
  // ─────────────────────────────────────────────────────────────────────────────
  const clearDoc = useCallback<AccessLayerAPI['clearDoc']>(() => {               // update - 5
    currentDocIdRef.current = null;
    prevRoleRef.current = roleRef.current;
    roleRef.current = 'None';
    lastEventRef.current = 'clear';
  }, []);

  const reset = useCallback<AccessLayerAPI['reset']>(() => {                     // update - 6
    mapRef.current.clear();
    currentDocIdRef.current = null;
    prevRoleRef.current = null;
    roleRef.current = 'None';
    lastEventRef.current = 'reset';
  }, []);


  // Use to syncrhonize list of access records from ApiContext to accesslayerContext
  // Compares updateAt to determine which record to keep
  useEffect(()=>{
    const listfiles = [...ownedFiles, ...sharedFiles]
    seedFromList(listfiles)

  }, [ownedFiles, seedFromList, sharedFiles])

  // ─────────────────────────────────────────────────────────────────────────────
  // Memoized context value (complete AccessLayerAPI)
  // ─────────────────────────────────────────────────────────────────────────────
  /**
   * @function value (memo)
   * @purpose Provide a stable object implementing `AccessLayerAPI`.
   * @steps
   *   1) Compute derived booleans from current refs
   *   2) Return full API including the previously missing fields
   */
  const value = useMemo<AccessLayerAPI>(() => {                                   // update - 7
    const docId = currentDocIdRef.current;
    const rec = docId ? mapRef.current.get(docId) : undefined;
    const canEdit = canEditOf(rec);
    const isOwner = rec?.role === 'Owner';

    return {
      // required by interface (previously missing)
      currentDocId: currentDocIdRef.current,                                      // ✅ added
      get,                                                                        // ✅ added
      seedFromList,                                                               // ✅ added

      // convenience mirrors (selected doc view)
      docId,
      role: rec?.role ?? 'None',
      prevRole: prevRoleRef.current,
      lastEvent: lastEventRef.current,
      canEdit,
      isOwner,

      // mutators
      selectDoc,
      applySignal,
      setRole,
      clearDoc,
      reset,
    };
  }, [canEditOf, get, seedFromList, selectDoc, applySignal, setRole, clearDoc, reset]); // deps
  // NOTE: we intentionally read refs inside the memo to avoid spurious re-renders.

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};
