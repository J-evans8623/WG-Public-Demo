/**
 * @file useAssessmentEditPrivilege.ts
 * @description
 * This file implements a specialized React hook designed to enforce role-based access control 
 * (RBAC) for the quiz editing suite. Its primary responsibility is to determine whether 
 * the current user possesses sufficient administrative rights to modify a specific quiz 
 * resource, particularly focusing on the distinction between Practice Quizzes and Assessment 
 * Quizzes. The hook aggregates data from the `ApiContext` (for account type) and the 
 * `useFileList` metadata (to verify document ownership). By centralizing this logic, we 
 * ensure that sensitive assessment content is protected from unauthorized modification by 
 * students or collaborators, thereby maintaining the integrity of the gradebook and 
 * formal evaluation workflows. This abstraction follows the Single Responsibility Principle 
 * by isolating access governance from visual orchestration logic.
 */

import { useMemo } from 'react';
import { useApiContext, useFileList } from '@/app/src/context/ApiContext';

/**
 * @function useAssessmentEditPrivilege
 * @description
 * Evaluates editing privileges for a quiz based on session metadata and assignment type. 
 * If the quiz is an assessment, it strictly requires the user to be the file owner and 
 * have an 'educator' account type. For practice quizzes, it defers to general write 
 * permissions. Returns a boolean indicating if the "Edit" entry point should be surfaced. 
 * Time Complexity: O(N) where N is the count of user-owned files.
 * * @param docId - The unique identifier of the concept map file.
 * @param isAssessment - Boolean flag indicating if the current quiz is a graded assessment.
 * @returns {boolean} - True if the user is authorized to edit the quiz.
 */
export const useAssessmentEditPrivilege = (docId: string | null, isAssessment: boolean): boolean => {
  // 1. Consume account information (Scholar vs Educator)
  const { accountStatus } = useApiContext();
  
  // 2. Consume file lists to verify ownership metadata
  const { ownedFiles, isHydrated } = useFileList();

  return useMemo(() => {
    // 3. Defensive Guard: If data isn't ready or ID is missing, deny by default
    if (!docId || !isHydrated || !accountStatus) return false;

    // 4. Identification: Check if the current docId exists in the user's 'ownedFiles' bucket
    const isOwner = ownedFiles.some(f => f.fileId === docId);
    
    // 5. Verification: Confirm the user is logged in as an Educator
    const isEducator = accountStatus.accountType === 'educator';

    // 6. Privilege Branching: 
    // - If it's a practice quiz, privilege is granted (document-level ReadOnly checks apply elsewhere).
    // - If it's an assessment, privilege is strictly Educator + Owner.
    if (!isAssessment) return true;

    return isOwner && isEducator;
  }, [docId, isAssessment, ownedFiles, isHydrated, accountStatus]);
};