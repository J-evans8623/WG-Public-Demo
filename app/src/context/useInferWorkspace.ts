/**
 * @file useInferWorkspace.ts
 * @description
 * (update - 2.1)
 * Refactored custom hook that serves as the unified interface for functional identity 
 * resolution. It has been simplified to leverage the session-live Predictive Registry 
 * provided by WorkspaceRegistryContext. By delegating to a global registry, the 
 * hook achieves O(1) lookup complexity and eliminates the race conditions 
 * caused by secondary library scans. It acts as the final consumer of the 
 * Authoritative SSoT established on application mount.
 */

import { useMemo } from 'react';
// update - 2.2: Import the new predictive registry context
import { useWorkspaceRegistry } from '@/app/Library/Context/WorkspaceRegistryContext'; 

export const useInferWorkspace = (docId: string | null): boolean => {
  // 1. Consume the global registry lookup method
  const { getWorkspaceIdentity } = useWorkspaceRegistry(); // update - 2.3

  /**
   * isEducatorWorkspace
   * @description
   * (update - 2.4)
   * Simplified O(1) resolution logic. It returns the authoritative identity 
   * stored in the session registry. This satisfies the requirement to 
   * anchor UI instructional tools to a persistent, race-free SSoT.
   */
  const resolvedFlag = useMemo(() => {
    if (!docId) return false;
    return getWorkspaceIdentity(docId); // update - 2.5
  }, [docId, getWorkspaceIdentity]);

  return resolvedFlag;
};