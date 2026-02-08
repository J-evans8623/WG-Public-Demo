// app/src/services/FBworkspaceRegistry.ts

/***************************************************************************************
 * @file FBworkspaceRegistry.ts
 * @description
 * Isolated service for functional identity resolution. 
 * Extracted from firebase.ts to break circular dependencies.
 ***************************************************************************************/

import { listUserFiles, getAclSnapshot } from './firebase';
import { UserService } from './userService';

/**
 * update - 1.2
 * @function fetchWorkspaceRegistry
 * @description
 * Authoritative service helper that generates a mapping of document functional 
 * identities for a specific user. It retrieves all files owned by or shared with 
 * the user, resolves the account status of each document's owner, and returns 
 * a Record mapping DocIDs to their "isEducatorWorkspace" boolean value.
 * This function is optimized for performance, utilizing cached UserService 
 * profile lookups to maintain O(F) complexity where F is the number of files.
 * @param userEmail - The normalized email address of the requesting user.
 * @returns {Promise<Record<string, boolean>>} A map of docId to educator status.
 */
export async function fetchWorkspaceRegistry(userEmail: string): Promise<Record<string, boolean>> {
  console.log('firebase.ts [9101] › fetchWorkspaceRegistry called for', userEmail);
  
  // 1. Initialize the registry map
  const registry: Record<string, boolean> = {};

  try {
    // 2. Fetch the base list of files (Owned + Shared) via the authoritative helper
    // Complexity: O(F) where F is the number of files the user participates in.
    const { ownedFiles, sharedFiles } = await listUserFiles(userEmail);
    const allFiles = [...ownedFiles, ...sharedFiles];

    // 3. Iterate through all files to resolve functional identity
    // We derive truth from the owner profile rather than a volatile flag on the document.
    await Promise.all(allFiles.map(async (file) => {
      try {
        // 4. Look up owner profile via UserService (utilizes Redis cache internally)
        // Complexity: O(1) per file given the existing Redis cache pattern.
        const ownerProfile = await UserService.getUserProfile(file.ownerId);
        
        // 5. Map the DocID to the boolean result of the account status check
        registry[file.fileId] = ownerProfile.accountType === 'educator';
        
      } catch (err) {
        // 6. Fail-safe: default to scholar/false if owner profile is unreachable
        console.warn('firebase.ts [9102] › identity resolution failed for doc', file.fileId, err);
        registry[file.fileId] = false;
      }
    }));

    console.log('firebase.ts [9103] › fetchWorkspaceRegistry generation complete', { 
      user: userEmail, 
      entryCount: Object.keys(registry).length 
    });

    return registry;
  } catch (error) {
    console.error('firebase.ts [9199] › fetchWorkspaceRegistry fatal error', error);
    throw error;
  }
}
/**
 * update - 1.2
 * @function fetchDocumentWorkspaceIdentity
 * @description
 * (update - 1.2)
 * Granular service utility that resolves the functional identity of a specific 
 * document. It retrieves the document's ACL snapshot to identify the owner, 
 * then queries the UserService to determine the owner's account type. 
 * This is used during the download-url handshake to provide high-integrity 
 * context for shared-link access. Time complexity is O(1) due to Redis-backed 
 * caching of both ACL snapshots and user profiles.
 * * @param docId - The unique identifier of the document to resolve.
 * @returns {Promise<boolean>} True if the document is an Educator Workspace.
 */
export async function fetchDocumentWorkspaceIdentity(docId: string): Promise<boolean> {
  try {
    // 1. Step 1: Retrieve the authoritative ACL snapshot (likely already cached in Redis)
    const acl = await getAclSnapshot(docId);
    if (!acl.docExists) return false;

    // 2. Step 2: Resolve the owner's account status from the SSoT
    const ownerProfile = await UserService.getUserProfile(acl.ownerId);
    
    // 3. Step 3: Compute instructional identity
    const isEducator = ownerProfile.accountType === 'educator';
    
    console.log('firebase.ts [9201] › Granular identity resolved', { docId, owner: acl.ownerId, isEducator });
    return isEducator;
  } catch (err) {
    console.warn('firebase.ts [9202] › Granular identity lookup failed, defaulting to false', err);
    return false;
  }
}
