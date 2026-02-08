/***************************************************************************************
 * @file firebase.ts
 * @description
 *   Provides functions for managing user data and file storage in Firebase.
 *   This file now includes methods to store, load, and delete document files using
 *   Firebase Storage, as well as functions for managing file metadata in Firestore.
 *
 *   New functions added:
 *     - deleteDocumentFile: Deletes a document file from Firebase Storage.
 *     - deleteUserFileMetadatadata: Deletes the file metadata from Firestore.
 *
 * Responsibilities:
 *   - Initialize Firebase Admin SDK.
 *   - Provide Firestore-based services for user data.
 *   - Provide file storage services to persist, retrieve, and delete document files.
 *   - Provide functions to store, list, and delete file metadata.
 *
 * @author 
 * @date 
 ***************************************************************************************/
import admin from 'firebase-admin';
import { publishRevokeAllNonOwner, publishRevokeUser } from '../utils/revocationBus';
import { UserFileMetadata } from '../types/fileTypes';
import * as fs from 'fs';
import {readAclSnapshot as cacheReadAclSnapshot,   
  readRole as cacheReadRole,               
  bumpAclVersion } from './redisCache/aclCache';
  import { UserService } from './userService';



if (!process.env.FIREBASE_DATABASE_URL) {
  throw new Error('FIREBASE_DATABASE_URL environment variable is not set.');
}

if (!process.env.FIREBASE_STORAGE_BUCKET) {
  throw new Error('FIREBASE_STORAGE_BUCKET environment variable is not set.');
}

// 2. Validate Service Account Path (Strict Mode)
// We no longer accept the raw JSON string to avoid env var length limits in deployment.
if (!process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
  throw new Error('FIREBASE_SERVICE_ACCOUNT_PATH environment variable is not set. Service account must be mounted as a file.');
}

const isBuildPhase = process.env.npm_lifecycle_event === 'build';

// Parse the FIREBASE_SERVICE_ACCOUNT JSON string
let serviceAccount: admin.ServiceAccount;
try {
  const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  
  if (fs.existsSync(keyPath)) {
    // RUNTIME: Volume is mounted, file exists. Load real credentials.
    const rawKey = fs.readFileSync(keyPath, 'utf8');
    serviceAccount = JSON.parse(rawKey);
    console.log('[firebase.ts] Loaded service account from file');
  } 
  else if (isBuildPhase) {
    // BUILD TIME: Volume is NOT mounted yet. Use Mock to prevent crash.
    console.warn('[firebase.ts] Build phase detected & key file missing. Using MOCK credentials.');
    serviceAccount = {
      projectId: 'mock-build-project',
      clientEmail: 'build@mock.local',
      privateKey: '-----BEGIN PRIVATE KEY-----\n***REMOVED***\n-----END PRIVATE KEY-----\n',
    };
  }
  else {
    // RUNTIME ERROR: Not building, and file is missing. Crash hard.
    throw new Error(`Service account file not found at path: ${keyPath}`);
  }
  
} catch (error: any) {
  console.error('Failed to load Firebase Service Account:', error);
  throw new Error(`Firebase credential error: ${error.message}`);
}

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
    console.log('Firebase initialized successfully');
  } catch (error) {
    console.error('Firebase initialization error:', error);
    throw error;
  }
}

export const firestore = admin.firestore();
export const auth = admin.auth();
const bucket = admin.storage().bucket(); // Firebase Storage bucket

/**
 * FirebaseService interface defines methods for user data management.
 */
export interface FirebaseService {
  storeUserTier(userId: string, tier: string): Promise<void>;
  getUserTier(userId: string): Promise<string>;
  storeRefreshToken(userId: string, refreshToken: string): Promise<void>;
  getRefreshToken(userId: string): Promise<string | null>;
}




/**
 * FirestoreFirebaseService implements FirebaseService using Firestore.
 */
export class FirestoreFirebaseService implements FirebaseService {
  async storeUserTier(userId: string, tier: string): Promise<void> {
    await firestore.collection('users').doc(userId).set({ tier }, { merge: true });
  }

  async getUserTier(userId: string): Promise<string> {
    const doc = await firestore.collection('users').doc(userId).get();
    return doc.exists ? (doc.data()?.tier as string) : 'free';
  }

  async storeRefreshToken(userId: string, refreshToken: string): Promise<void> {
    try {
      const docRef = firestore.collection('users').doc(userId);
      const doc = await docRef.get();
      if (!doc.exists) {
        await docRef.set({
          refreshToken,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        await docRef.update({
          refreshToken,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    } catch (error) {
      console.error('Error storing refresh token:', error);
      throw error;
    }
  }

  async getRefreshToken(userId: string): Promise<string | null> {
    const doc = await firestore.collection('users').doc(userId).get();
    return doc.exists ? (doc.data()?.refreshToken as string) : null;
  }
}

/**
 * A single chat message.
 */
export interface ChatMessage {
  id: number;
  type: 'assistant' | 'user' | 'system' | 'attachment';
  content: string;
}


/**
 * Stores a document file into Firebase Storage.
 * @param fileId - Unique identifier for the file.
 * @param content - Buffer containing the file content.
 * @param metadata - Object containing file metadata (e.g., fileName, docFileID).
 * @returns The file storage identifier (path) upon successful upload.
 */
export async function storeDocumentFile(
  fileId: string,
  content: Buffer,
  metadata: { fileName: string; docFileID: string; version:number }
): Promise<string> {
  const destination = `documents/${fileId}.bloomdocx`;
  try {
    const file = bucket.file(destination);
    await file.save(content, {
      metadata: {
        contentType: 'application/octet-stream',
        metadata: {
          fileName: metadata.fileName,
          docFileID: metadata.docFileID,
           ...(metadata.version !== undefined ? { version: String(metadata.version) } : {}),
        },
      },
    });
    console.log(`File uploaded successfully to ${destination}`);
    return destination;
  } catch (error) {
    console.error('Error storing document file:', error);
    throw error;
  }
}


// app/src/services/firebase.ts  (singleton Admin file; excerpt shows only the new helper)
/**
 * 
 * @function getObjectGeneration
 * @description
 *   Reads the current Firebase Storage object metadata for a given path and returns the
 *   object’s generation as a string, or null if it cannot be determined. This helper
 *   centralizes all Storage metadata access behind our Admin singleton to preserve the
 *   project’s initialization pattern and make future backend caching straightforward:
 *   higher layers call one function whose implementation we can later cache or batch.
 *   Time complexity is O(1) for the lookup; network latency dominates in practice.
 */
export async function getObjectGeneration(path: string): Promise<string | null> { 
  try {
    const file = bucket.file(path); // uses the already-initialized admin.storage().bucket()
    const [meta] = await file.getMetadata();
    const gen = (meta?.generation ?? null) as string | null;
    console.log('firebase.ts [8211] › getObjectGeneration', { path, generation: gen }); 
    return gen;
  } catch (e) {
    console.warn('firebase.ts [8212] › getObjectGeneration failed (non-fatal)', { path, err: e });
    return null;
  }
}


/**
 * Loads a document file from Firebase Storage.
 * @param fileId - The file storage identifier (path) to retrieve.
 * @returns A Buffer containing the file content.
 */
export async function loadDocumentFile(fileId: string): Promise<Buffer> {
  try {
    const file = bucket.file(fileId);
    const data = await file.download();
    console.log(`File downloaded successfully from ${fileId}`);
    return data[0];
  } catch (error) {
    console.error('Error loading document file:', error);
    throw error;
  }
}

// firebase.ts - Updated storeFileMetadata function

export async function storeFileMetadata(metadata: {
  fileId: string;
  ownerId: string;
  fileName: string;
  fileStoragePath: string;
  timestamp: admin.firestore.Timestamp;
  fileSize: number;
  contentType: string;
  editors: string[];
  sharedWith?: string[];
  lessonUnitsMeta?: {
    unitsByMap: Record<string, any[]>;
    lastUpdated: admin.firestore.Timestamp;
    totalUnits: number;
  };
  colorCode?:string;
  version:number;
  isEducatorWorkspace?: boolean;
}): Promise<void> {
  try {
    console.log(`[firebase.ts] Storing metadata for file ${metadata.fileId}`);
    
    // Add debug logging to verify lessonUnitsMeta is included
    if (metadata.lessonUnitsMeta) {
      console.log(`[firebase.ts] Including lesson units metadata with ${metadata.lessonUnitsMeta.totalUnits} units`);
      console.log(`[firebase.ts] Units by map keys:`, Object.keys(metadata.lessonUnitsMeta.unitsByMap));
    } else {
      console.log(`[firebase.ts] No lesson units metadata to store`);
    }
    
    await firestore.collection('userFiles').doc(metadata.fileId).set(metadata);
    console.log(`Metadata for file ${metadata.fileId} stored successfully.`);
  } catch (error) {
    console.error('Error storing file metadata:', error);
    throw error;
  }
}

// firebase.ts - Updated updateFileMetadata function

export async function updateFileMetadata(params: {
  fileId: string;
  colorCode?: string;
  fileName?: string;
  fileStoragePath?: string;
  timestamp?: admin.firestore.FieldValue;
  fileSize?: number;
  contentType?: string;
  lessonUnitsMeta?: {
    unitsByMap: Record<string, any[]>;
    lastUpdated: admin.firestore.Timestamp;
    totalUnits: number;
  };
  version:number;
  //  New count fields added to the params interface
  lessonCount?: number;
  cardCount?: number;
  quizCount?: number;
  isEducatorWorkspace?: boolean;
}): Promise<void> {
  console.log('firebase.ts 0009 › updateFileMetadata', params);
  
  const updates: Record<string, any> = {};
  if (params.fileName)         updates.fileName       = params.fileName;
  if (params.colorCode)         updates.colorCode       = params.colorCode;
  if (params.fileStoragePath)  updates.fileStoragePath = params.fileStoragePath;
  if (params.timestamp)        updates.timestamp      = params.timestamp;
  if (params.fileSize != null) updates.fileSize       = params.fileSize;
  if (params.contentType)      updates.contentType    = params.contentType;
  
  if (params.isEducatorWorkspace !== undefined) updates.isEducatorWorkspace = params.isEducatorWorkspace;
  // Add lessonUnitsMeta to updates if provided
  if (params.lessonUnitsMeta) {
    updates.lessonUnitsMeta = params.lessonUnitsMeta;
    console.log('firebase.ts › Including lesson units metadata update with', params.lessonUnitsMeta.totalUnits, 'units');
  }

  if (typeof params.version === 'number' && Number.isFinite(params.version)) {
    updates.version = params.version;
    console.log('firebase.ts › Including version update:', params.version);
  }

  // update - 22: Map new count fields to the Firestore updates object
  if (typeof params.lessonCount === 'number') updates.lessonCount = params.lessonCount;
  if (typeof params.cardCount === 'number')   updates.cardCount   = params.cardCount;
  if (typeof params.quizCount === 'number')   updates.quizCount   = params.quizCount;
  

  await firestore
    .collection('userFiles')
    .doc(params.fileId)
    .update(updates);
}

// helpers (keep near top of file)
function normEmail(e: string) {
  return String(e || '').trim().toLowerCase();
}

/**
 * Promote a user to editor.
 * - SSoT: update userFiles/{docId}.editors & .sharedWith
 * - Mirror: upsert documents/{docId}/editors/{email}
 */
export async function addEditor(docId: string, userEmail: string): Promise<void> {
  const email = normEmail(userEmail);
  console.log('firebase.ts › addEditor', { docId, email });

  const ufRef = firestore.collection('userFiles').doc(docId);

  await firestore.runTransaction(async tx => {
    const snap = await tx.get(ufRef);
    if (!snap.exists) throw new Error(`userFiles/${docId} not found`);

    const data = snap.data() as Partial<UserFileMetadata>;
    const editors = new Set<string>((data?.editors ?? []).map(normEmail));
    const shared  = new Set<string>((data?.sharedWith ?? []).map(normEmail));

    editors.add(email);          // write access
    shared.add(email);           // all shares superset

    tx.update(ufRef, {
      editors: Array.from(editors),
      sharedWith: Array.from(shared),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: email, // optional: who triggered the change
    });
  });

  try {
    const ver = await bumpAclVersion(docId); // update - 11
    console.log('firebase.ts [8411] › addEditor bumped ACL version', { docId, ver }); // update - 11
  } catch (e) {
    console.warn('firebase.ts [8412] › addEditor bumpAclVersion failed (non-fatal)', { docId, err: e }); // update - 11
  }

}

/**
 * Remove a user's editor rights.
 * - Default: demote to read-only (keeps sharedWith)
 * - If opts.revoke === true: remove entirely from sharedWith too
 * - SSoT: mutate only userFiles/{docId}
 * - Mirror: delete documents/{docId}/editors/{email}
 * - Always publish a targeted revoke to force downgrade of live sockets.
 */
export async function removeEditor(
  docId: string,
  userEmail: string,
  opts: { revoke?: boolean } = {}
): Promise<void> {
  const email = normEmail(userEmail);
  const revoke = Boolean(opts.revoke);
  console.log('firebase.ts › removeEditor', { docId, email, revoke });

  const ufRef = firestore.collection('userFiles').doc(docId);

  await firestore.runTransaction(async tx => {
    const snap = await tx.get(ufRef);
    if (!snap.exists) return;

    const data = snap.data() as Partial<UserFileMetadata>;
    const owner = normEmail(data?.ownerId as string);
    if (email === owner) throw new Error('Cannot change owner editor status');

    const editors = new Set<string>((data?.editors ?? []).map(normEmail));
    const shared  = new Set<string>((data?.sharedWith ?? []).map(normEmail));

    editors.delete(email);        // remove write
    if (revoke) shared.delete(email); // optionally remove read

    const update: Record<string, any> = {
      editors: Array.from(editors),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: email,
    };
    if (revoke) update.sharedWith = Array.from(shared);

    tx.update(ufRef, update);
  });


  // 1) Bump version post-mutation so cached readers see fresh ACL posture.
  try {
    const ver = await bumpAclVersion(docId); // update - 12
    console.log('firebase.ts [8421] › removeEditor bumped ACL version', { docId, ver }); // update - 12
  } catch (e) {
    console.warn('firebase.ts [8422] › removeEditor bumpAclVersion failed (non-fatal)', { docId, err: e }); // update - 12
  }

  // Force active sessions to re-bootstrap (downgrade or full revoke)
  try {
    await publishRevokeUser(docId, email); // this bullshit doesn't work sorry ...
  } catch (e) {
    console.warn('firebase.ts › publishRevokeUser failed (non-fatal)', e);
  }
}


/**
 * Return editor list from the SSoT (userFiles).
 * `documents/{docId}/editors` is only a mirror; do not read it here.
 */
export async function listEditors(docId: string): Promise<{ owner: string; editors: string[] }> {
  const snap = await firestore.collection('userFiles').doc(docId).get();
  const data = snap.data() as Partial<UserFileMetadata> | undefined;
  const owner = normEmail(data?.ownerId as string);
  const editors = (data?.editors ?? []).map(normEmail);
  return { owner, editors };
}


export interface UserFilesList {
  ownedFiles: any[];
  sharedFiles: any[];
}

/**
 * Lists file metadata for a given user.
 * Returns separate arrays for owned and shared files, each ordered by timestamp desc.
 */
export async function listUserFiles(userEmail: string): Promise<UserFilesList> {
  console.log('firebase.ts 7001 › listUserFiles called for', userEmail);
  const normalizedEmail = normEmail(userEmail);
  
  const ownedSnap = await firestore
    .collection('userFiles')
    .where('ownerId', '==', userEmail)
    .orderBy('timestamp', 'desc')
    .get();

  const sharedSnap = await firestore
    .collection('userFiles')
    .where('sharedWith', 'array-contains', normalizedEmail)
    .where('ownerId', '!=', userEmail)
    .orderBy('ownerId')
    .orderBy('timestamp', 'desc')
    .get();
// Convert owned files with proper typing
  const ownedFiles: UserFileMetadata[] = ownedSnap.docs.map(doc => {
    const data = doc.data() as Partial<UserFileMetadata>;
    return {
      fileId: doc.id,
      colorCode: data.colorCode,
      ownerId: data.ownerId || '',
      fileName: data.fileName || 'Untitled',
      fileStoragePath: data.fileStoragePath || '',
      timestamp: data.timestamp || admin.firestore.Timestamp.now(),
      fileSize: data.fileSize || 0,
      contentType: data.contentType || 'application/octet-stream',
      editors: data.editors || [],
      sharedWith: data.sharedWith || [],
      publicEdit: (data as any).publicEdit || false,
      publicView: (data as any).publicView || false,
      lessonUnitsMeta: (data as any).lessonUnitsMeta || undefined,
      version: data.version!,
      // Computed fields
      
      role: 'Owner',
      updatedAt: data.timestamp 
        ? (data.timestamp as any).toDate?.() 
          ? (data.timestamp as any).toDate().toISOString()
          : new Date(data.timestamp as any).toISOString()
        : new Date().toISOString()
    };
  });

  // Convert shared files with proper typing
  const sharedFiles: UserFileMetadata[] = sharedSnap.docs.map(doc => {
    const data = doc.data() as Partial<UserFileMetadata>;
    const editors = (data.editors || []).map(e => normEmail(e));
    const isEditor = editors.includes(normalizedEmail);
    
    return {
      fileId: doc.id,
      ownerId: data.ownerId || '',
      colorCode: data.colorCode,
      fileName: data.fileName || 'Untitled',
      fileStoragePath: data.fileStoragePath || '',
      timestamp: data.timestamp || admin.firestore.Timestamp.now(),
      fileSize: data.fileSize || 0,
      contentType: data.contentType || 'application/octet-stream',
      editors: data.editors || [],
      sharedWith: data.sharedWith || [],
      publicEdit: (data as any).publicEdit || false,
      publicView: (data as any).publicView || false,
      lessonUnitsMeta: (data as any).lessonUnitsMeta || undefined,
      version: data.version!,
      role: isEditor ? 'Editor' : 'Viewer',
      updatedAt: data.timestamp 
        ? (data.timestamp as any).toDate?.() 
          ? (data.timestamp as any).toDate().toISOString()
          : new Date(data.timestamp as any).toISOString()
        : new Date().toISOString()
    };
  });
  const filesWithLessonMeta = ownedFiles.filter(f => f.lessonUnitsMeta).length;
  console.log('firebase.ts 7002 › ownedFiles count', ownedFiles.length);
  console.log('firebase.ts 7003 › sharedFiles count', sharedFiles.length);
  console.log('firebase.ts 7002.5 › ownedFiles with lesson metadata', filesWithLessonMeta);

  return { ownedFiles, sharedFiles };
}

/**
 * Deletes a document file from Firebase Storage.
 * @param fileStorageId - The storage path of the file to be deleted.
 */
export async function deleteDocumentFile(fileStorageId: string): Promise<void> {
  try {
    const file = bucket.file(fileStorageId);
    await file.delete();
    console.log(`File ${fileStorageId} deleted successfully from Firebase Storage.`);
  } catch (error) {
    console.error('Error deleting document file:', error);
    throw error;
  }
}

/**
 * Deletes file metadata from Firestore.
 * @param fileId - The file's unique identifier (document id in Firestore).
 */
export async function deleteFileMetadata(fileId: string): Promise<void> {
  try {
    await firestore.collection('userFiles').doc(fileId).delete();
    console.log(`File metadata for ${fileId} deleted successfully from Firestore.`);
    try {
      const ver = await bumpAclVersion(fileId); // update - 13
      console.log('firebase.ts [8431] › deleteFileMetadata bumped ACL version', { fileId, ver }); // update - 13
    } catch (e) {
      console.warn('firebase.ts [8432] › deleteFileMetadata bumpAclVersion failed (non-fatal)', { fileId, err: e }); // update - 13
    }
  } catch (error) {
    console.error('Error deleting file metadata:', error);
    throw error;
  }
}

export async function addToSharedWith(docId: string, userEmail: string): Promise<void> {
  const email = normEmail(userEmail);
  const docRef = firestore.collection('userFiles').doc(docId);
  
  await docRef.update({
    sharedWith: admin.firestore.FieldValue.arrayUnion(email),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  try {
    const ver = await bumpAclVersion(docId); 
    console.log('firebase.ts [8441] › addToSharedWith bumped ACL version', { docId, ver }); 
  } catch (e) {
    console.warn('firebase.ts [8442] › addToSharedWith bumpAclVersion failed (non-fatal)', { docId, err: e });
  }
}

/**
 * update - 6
 * @function generateUploadUrl
 * @description
 *   Extends the existing upload helper to enforce Phase-3 preconditions for **doc** uploads.
 *   Backward compatible:
 *     - Chat: unchanged behavior.
 *     - Doc without opts: unchanged behavior (just returns a signed PUT URL).
 *     - Doc with `opts.expect*`: compares expectations to the latest identifiers.
 *       • Match  → mints URL and returns `{ ok:true, uploadUrl, path }`
 *       • Mismatch → returns `{ ok:false, conflict:{ path, storageGeneration, versionNumber } }`
 *
 *   Workflow:
 *   1) Compute canonical path via resolvePaths(docId, type, userId).
 *   2) If type==='chat': mint v4 write URL (return legacy shape `{ uploadUrl, path }`).
 *   3) If type==='doc' and no opts provided: mint v4 write URL (legacy behavior).
 *   4) If type==='doc' and opts provided:
 *      4.1) Read latest identifiers via getLatestFileIdentifiers(docId).
 *      4.2) Compare expectations vs latest; on mismatch → return conflict payload.
 *      4.3) On match → mint v4 write URL and return `{ ok:true, uploadUrl, path }`.
 */
export async function generateUploadUrl(
  docId: string,
  type: 'doc' | 'chat',
  opts: { expectStorageGeneration?: string | null; expectVersionNumber?: number | null },
  userId?:string,
): Promise<
  | { uploadUrl: string; path: string } // legacy success (chat or doc without opts)
  | { ok: true; uploadUrl: string; path: string } // doc with opts, preconditions satisfied
  | { ok: false; conflict: { path: string; storageGeneration: string | null; versionNumber: number | null } } // doc with opts, conflict
> {
  // 1) Canonical path
  const destination = resolvePaths(docId, type, userId); // update - 6

  // 2) Chat → legacy behavior
  if (type === 'chat') {
    const file = bucket.file(destination);
    const [uploadUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 5 * 60 * 1000,
      contentType: 'application/json',
    });
    console.log('firebase.ts [upd-6] › chat uploadUrl generated', { destination });
    return { uploadUrl, path: destination };
  }

  // 4) Doc with preconditions → enforce Phase-3 expectations
  // 4.1) Latest identifiers
  const latest = await getLatestFileIdentifiers(docId);
  const sgLatest = latest.storageGeneration;
  const vnLatest = latest.versionNumber;

  // 4.2) Compare expectations
  const sgOk =
    opts.expectStorageGeneration == null || opts.expectStorageGeneration === sgLatest;
  const vnOk =
    opts.expectVersionNumber == null || opts.expectVersionNumber === vnLatest;

  if (!(sgOk && vnOk)) {
    console.log('firebase.ts [upd-6] › precondition mismatch → conflict', {
      docId,
      expected: { sg: opts.expectStorageGeneration, vn: opts.expectVersionNumber },
      latest,
    });
    return {
      ok: false,
      conflict: {
        path: latest.path,
        storageGeneration: sgLatest,
        versionNumber: vnLatest,
      },
    };
  }

  // 4.3) Preconditions satisfied → mint signed PUT URL
  const file = bucket.file(latest.path);
  const [uploadUrl] = await file.getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: Date.now() + 5 * 60 * 1000,
    contentType: 'application/octet-stream',
  });
  console.log('firebase.ts [upd-6] › preconditions ok → doc uploadUrl minted', {
    docId,
    path: latest.path,
    sgLatest,
    vnLatest,
  });
  return { ok: true, uploadUrl, path: latest.path };
}


/**
 * update - 7
 * @function generateDownloadUrl
 * @description
 *   Extends the existing download helper to optionally return identifiers for **doc**
 *   so the client can seed `metadata.persist.*` on open. Backward compatible:
 *     - Without opts or for 'chat' → legacy `{ downloadUrl, path }`.
 *     - With `opts.includeIdentifiers===true` and type==='doc' → also includes
 *       `{ storageGeneration, versionNumber }` in the response.
 *
 *   Workflow:
 *   1) If includeIdentifiers+doc → call getLatestFileIdentifiers(docId) for {path, sg, vn}.
 *   2) Else compute canonical path via resolvePaths(docId, type, userId).
 *   3) Mint v4 read URL for chosen path.
 *   4) Return legacy shape or the extended shape (for doc+identifiers).
 */
export async function generateDownloadUrl(
  docId: string,
  type: 'doc' | 'chat',
  opts: { includeIdentifiers?: boolean },
  userId?: string,
): Promise<
  | { downloadUrl: string; path: string } // legacy
  | { downloadUrl: string; path: string; storageGeneration: string | null; versionNumber: number | null } // extended (doc)
> {
  // 1) Prefer identifier-bearing path for doc when requested
  let path: string;
  let storageGeneration: string | null | undefined;
  let versionNumber: number | null | undefined;

  if (type === 'doc' && opts?.includeIdentifiers) {
    const latest = await getLatestFileIdentifiers(docId);
    path = latest.path;
    storageGeneration = latest.storageGeneration;
    versionNumber = latest.versionNumber;
  } else {
    // 2) Canonical path (legacy)
    path = resolvePaths(docId, type, userId); // update - 7
  }

  // 3) Signed read URL
  const file = bucket.file(path);
  const [downloadUrl] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + 5 * 60 * 1000,
  });

  // 4) Return appropriate shape
  if (type === 'doc' && opts?.includeIdentifiers) {
    console.log('firebase.ts [upd-7] › doc downloadUrl+ids generated', {
      docId,
      path,
      storageGeneration,
      versionNumber,
    });
    return { downloadUrl, path, storageGeneration: storageGeneration ?? null, versionNumber: versionNumber ?? null };
  }

  console.log('firebase.ts [upd-7] › downloadUrl generated', { type, docId, path });
  return { downloadUrl, path };
}



/**
 * @function setPublicEdit
 * @description
 *   Sets the `publicEdit` flag on the document root under `documents/{docId}`. If the
 *   value transitions from `true` to `false`, we immediately publish a **revoke all
 *   non-owner** message so the Yjs server disconnects every non-owner with close code
 *   4003. This enables “instant revoke” semantics when owners turn off anyone-can-edit.
 *   Reads the prior flag to detect transitions, writes the new value, and logs both
 *   sides for observability without emitting noisy, redundant logs.
 */
export async function setPublicEdit(docId: string, enabled: boolean): Promise<void> {
  console.log('firebase.ts [8037] › setPublicEdit start', { docId, enabled });
  const docRef = firestore.collection('userFiles').doc(docId);
  const snap = await docRef.get();
  const was = Boolean(snap.data()?.publicEdit);
  await docRef.set({ publicEdit: enabled }, { merge: true });
  console.log('firebase.ts [8038] › setPublicEdit write ok', { docId, was, now: enabled });

  try {
    const ver = await bumpAclVersion(docId); // update - 15
    console.log('firebase.ts [8451] › setPublicEdit bumped ACL version', { docId, ver }); // update - 15
  } catch (e) {
    console.warn('firebase.ts [8452] › setPublicEdit bumpAclVersion failed (non-fatal)', { docId, err: e }); // update - 15
  }

  if (was && !enabled) {
    try {
      await publishRevokeAllNonOwner(docId);
      console.log('firebase.ts [8039] › publishRevokeAllNonOwner done', { docId });
    } catch (e) {
      // Non-fatal: new sockets will be denied, existing ones will be dropped on token refresh.
      console.warn('firebase.ts [8097] › publishRevokeAllNonOwner failed (non-fatal)', e);
    }
  }
}

/**
 * @function setPublicView
 * @description
 *   Sets the `publicView` flag on the document root under `documents/{docId}`. This does
 *   not trigger revocations because read-only sockets remain safe and do not mutate the
 *   shared state. We still log the old and new values for debugging and change tracking.
 */
export async function setPublicView(docId: string, enabled: boolean): Promise<void> {
  console.log('firebase.ts [8040] › setPublicView start', { docId, enabled });
  const docRef = firestore.collection('userFiles').doc(docId);
  const snap = await docRef.get();
  const was = Boolean(snap.data()?.publicView);
  await docRef.set({ publicView: enabled }, { merge: true });
  console.log('firebase.ts [8041] › setPublicView write ok', { docId, was, now: enabled });

  try {
    const ver = await bumpAclVersion(docId); // update - 16
    console.log('firebase.ts [8461] › setPublicView bumped ACL version', { docId, ver }); // update - 16
  } catch (e) {
    console.warn('firebase.ts [8462] › setPublicView bumpAclVersion failed (non-fatal)', { docId, err: e }); // update - 16
  }
}


/** Role emitted by resolveRole() for API routes */
export type Role = 'Owner' | 'Editor' | 'Viewer' | 'None';

export interface AclSnapshot {
  docExists: boolean;
  ownerId: string;
  editors: string[];
  sharedWith: string[];
  publicEdit: boolean;
  publicView: boolean;
}


/**
 * update - 9
 * @function _loadAclSnapshotFromFirestore
 * @description
 *   Internal helper that performs the authoritative Firestore read and normalization for the ACL
 *   snapshot shape. This is passed to the cache layer as the loader function. It never touches
 *   Redis directly to avoid circular dependencies and keep read logic testable in isolation.
 */
async function _loadAclSnapshotFromFirestore(docId: string): Promise<AclSnapshot> { // update - 9
  const ref = firestore.collection('userFiles').doc(docId);
  const snap = await ref.get();

  if (!snap.exists) {
    console.log('firebase.ts [4101] › _loadAclSnapshotFromFirestore: doc not found', { docId }); // update - 9
    return {
      docExists: false,
      ownerId: '',
      editors: [],
      sharedWith: [],
      publicEdit: false,
      publicView: false,
    };
  }

  const data = snap.data() as Partial<UserFileMetadata>;
  const ownerId    = normEmail(data?.ownerId as string);
  const editors    = (data?.editors ?? []).map(normEmail);
  const sharedWith = (data?.sharedWith ?? []).map(normEmail);
  const publicEdit = Boolean((data as any)?.publicEdit);
  const publicView = Boolean((data as any)?.publicView);

  console.log('firebase.ts [4102] › _loadAclSnapshotFromFirestore ok', { // update - 9
    docId,
    ownerId,
    editorsCount: editors.length,
    sharedCount: sharedWith.length,
    publicEdit,
    publicView
  });

  return { docExists: true, ownerId, editors, sharedWith, publicEdit, publicView };
}


export async function getAclSnapshotFresh(docId: string): Promise<AclSnapshot> {
  // Call the authoritative Firestore loader directly, bypassing Redis.
  return _loadAclSnapshotFromFirestore(docId);
}


/**
 * update - 10
 * @function getAclSnapshot
 * @description
 *   Returns a normalized ACL snapshot using a versioned, Redis-backed cache-aside flow. The loader
 *   is the authoritative Firestore read `_loadAclSnapshotFromFirestore`. Negative results (“doc not
 *   found”) are short-lived to avoid storms. Firestore remains the source of truth.
 */
export async function getAclSnapshot(docId: string): Promise<AclSnapshot> { // update - 10
  const snap = await cacheReadAclSnapshot(docId, () => _loadAclSnapshotFromFirestore(docId)); // update - 10
  return (snap ?? { 
    docExists: false, ownerId: '', editors: [], sharedWith: [], publicEdit: false, publicView: false
  }); 
}

/**
 * @function resolveRole
 * @description
 *   Convert an ACL snapshot + caller’s email into an effective role. If the doc
 *   doesn’t exist, returns 'None'. If `publicEdit` is true, treat all users as
 *   'Editor'. Otherwise: owner → 'Owner'; listed editor → 'Editor'; publicView or
 *   sharedWith → 'Viewer'; else 'None'. Routes may then decide read/write policy.
 */
export async function resolveRole(docId: string, email: string, snapshot?:AclSnapshot): Promise<Role> {
  const who = normEmail(email); // update - 17
  // If caller provided a snapshot, we can compute deterministically; still benefit from role cache.
  const compute = async (): Promise<Role> => { // update - 17
    const snap = snapshot ?? (await getAclSnapshot(docId)); // update - 17
    if (!snap.docExists) return 'None';
    if (who === snap.ownerId) return 'Owner';
    if (snap.publicEdit) return 'Editor';
    if (snap.editors.includes(who)) return 'Editor';
    if (snap.publicView) return 'Viewer';
    if (snap.sharedWith.includes(who)) return 'Viewer';
    return 'None';
  };
  const role = await cacheReadRole(docId, who, compute); // update - 17
  return role; // update - 17
}


/**
 * update - 2
 * @function resolvePaths
 * @description
 *   Canonical path resolver for GCS objects.
 *   Returns the exact bucket path for a given doc/chat artifact so every caller
 *   computes paths consistently (eliminates scattered string assembly).
 *
 *   Workflow:
 *   1) Validate inputs (docId always; userId required for 'chat').
 *   2) For 'doc' → return `documents/{docId}.bloomdocx`.
 *   3) For 'chat' → return `documents/{docId}/privateChats/{userId}.chat.json`.
 *   4) Log a single concise line for observability.
 */
export function resolvePaths(
  docId: string,
  type: 'doc' | 'chat',
  userId?: string
): string {
  // 1) Validate inputs
  if (!docId || typeof docId !== 'string') {
    throw new Error('resolvePaths: invalid docId');
  }
  if (type === 'chat' && !userId) {
    throw new Error('resolvePaths: userId required for chat path');
  }

  // 2/3) Compute canonical path
  const path =
    type === 'doc'
      ? `documents/${docId}.bloomdocx`
      : `documents/${docId}/privateChats/${userId}.chat.json`;

  // 4) Log (low-noise)
  console.log('firebase.ts [upd-2] › resolvePaths', { type, docId, userId: !!userId, path });
  return path;
}


/**
 * update - 3
 * @function getLatestFileIdentifiers
 * @description
 *   Single source of truth for persistence identifiers used by Phase 3:
 *   returns the canonical doc path, current Storage generation, and Firestore
 *   logical version in *one* atomic helper (cache-friendly later).
 *
 *   Workflow:
 *   1) Resolve canonical doc path via resolvePaths(docId, 'doc').
 *   2) Read Storage object metadata → extract `generation` (string|null).
 *   3) Read Firestore `userFiles/{docId}.version` → coerce to number|null.
 *   4) Log a concise line and return `{ path, storageGeneration, versionNumber }`.
 */
export async function getLatestFileIdentifiers(docId: string): Promise<{
  path: string;
  storageGeneration: string | null;
  versionNumber: number | null;
}> {
  // 1) Path (SSoT)
  const path = resolvePaths(docId, 'doc');

  // 2) Storage metadata (generation)
  let storageGeneration: string | null = null;
  try {
    const [meta] = await bucket.file(path).getMetadata();
    storageGeneration = (meta?.generation ?? null) as string | null;
  } catch (e) {
    console.warn('firebase.ts [upd-3] › storage generation read failed (non-fatal)', { docId, path, err: e });
  }

  // 3) Firestore logical version
  let versionNumber: number | null = null;
  try {
    const snap = await firestore.collection('userFiles').doc(docId).get();
    const raw = snap.exists ? (snap.data() as any)?.version : null;
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      versionNumber = raw;
    } else if (typeof raw === 'string' && raw.trim() !== '' && !Number.isNaN(Number(raw))) {
      versionNumber = Number(raw);
    } else {
      versionNumber = null;
    }
  } catch (e) {
    console.warn('firebase.ts [upd-3] › version read failed (non-fatal)', { docId, err: e });
  }

  // 4) Return identifiers
  console.log('firebase.ts [upd-3] › getLatestFileIdentifiers', { docId, path, storageGeneration, versionNumber });
  return { path, storageGeneration, versionNumber };
}


/**
 * update - 18
 * @function readDocBytesById
 * @description
 *   Resolves the canonical Storage path for a document’s Y.Doc by its persistent id and downloads
 *   the raw bytes using the Admin SDK helper `loadDocumentFile`. This consolidates IO and path
 *   logic in one place so service-layer code (e.g., lesson extraction, AI) can stay pure and testable.
 *   Returns a Uint8Array for zero-copy downstream use. Time complexity is O(1); network dominates.
 */
export async function readDocBytesById(docId: string): Promise<Uint8Array> { // update - 18
  const path = resolvePaths(docId, 'doc');                                  // update - 18
  const buf = await loadDocumentFile(path);                                  // update - 18
  console.log('firebase.ts 8511 › readDocBytesById', { docId, path, byteLength: buf?.length ?? 0 }); // update - 18
  return new Uint8Array(buf);                                                // update - 18
}

