'use client';
/*****************************************************************************************
 * 
 * @file /app/Library/Context/AccessLayer/selectors.ts
 * @responsibility
 *   Derive a single, app-level access/edit readiness snapshot by **combining**
 *   policy facts from AccessLayer (role/public flags + current doc) with lifecycle
 *   facts from YDocContext (bootPhase/saveReady/snapshot). This is the **only**
 *   place that computes:
 *     - mode: 'edit' | 'readonly'        (policy + snapshot override)
 *     - status: 'PENDING' | 'READY'      (YDoc lifecycle)
 *     - editReady: boolean               (status==='READY' && mode==='edit')
 *     - docId: string | null             (from AccessLayer)
 *
 *   Pure selector = zero side effects; stable shapes; unit-test friendly.
 *****************************************************************************************/

import { useMemo } from 'react';
import { useAccessLayer } from '@/app/Library/Context/AccessLayerContext';
import { useYDoc } from '@/app/Library/Context/YDocContext';

/** update - 1 */
export type AccessEditStatus = 'PENDING' | 'READY';
/** update - 2 */
export type AccessEditMode = 'edit' | 'readonly';

/** update - 3 */
export interface AccessEditSnapshot {
  docId: string | null;
  mode: AccessEditMode;
  status: AccessEditStatus;
  editReady: boolean;
}

/**
 * @function useAccessEditSnapshot
 * @purpose
 *   Fuse AccessLayer (policy) + YDoc (lifecycle) into one compact snapshot.
 * @returns AccessEditSnapshot
 */
export function useAccessEditSnapshot(): AccessEditSnapshot {
  const access = useAccessLayer(); // expected surface: currentDocId, get(docId)
  const { bootPhase, saveReady, ydoc, docFileID } = useYDoc();



  // 1) Read current docId from AccessLayer (source of policy identity)       
  const docId = docFileID

  // 2) Pull role/public flags for current doc (defensive defaults)            
  const policy = docId ? access.get?.(docId) : undefined;
  const role: 'Owner' | 'Editor' | 'Viewer' | 'None' =
    (policy?.role as any) ?? 'None';
  const publicEdit: boolean = !!policy?.publicEdit;

  // 3) Compute policy edit capability                                         
  const canEditByPolicy =
    role === 'Owner' || role === 'Editor' || publicEdit === true;

  // 4) Snapshot override: any active snapshot forces readonly                  
  const mode: AccessEditMode = canEditByPolicy ? 'edit' : 'readonly'

  // 5) Lifecycle readiness: READY = ACTIVE ∧ saveReady                         
  const status: AccessEditStatus =
    bootPhase === 'ACTIVE' && saveReady ? 'READY' : 'PENDING';

  // 6) Final boolean for leaf handlers                                        
  const editReady = status === 'READY' && mode === 'edit';

  // 7) Memoize stable identity                                              
  return useMemo(
    () => ({ docId, mode, status, editReady }),
    [docId, mode, status, editReady]
  );
}
