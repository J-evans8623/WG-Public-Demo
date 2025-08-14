/***************************************************************************************
 * @file firebase.ts
 * @description
 *   Provides functions for managing user data and file storage in Firebase.
 *   This file now includes methods to store, load, and delete document files using
 *   Firebase Storage, as well as functions for managing file metadata in Firestore.
 *
 *   New functions added:
 *     - deleteDocumentFile: Deletes a document file from Firebase Storage.
 *     - deleteFileMetadata: Deletes the file metadata from Firestore.
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
import FileMeta from '@/app/src/types/fileSchema';


if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is not set.');
}

if (!process.env.FIREBASE_DATABASE_URL) {
  throw new Error('FIREBASE_DATABASE_URL environment variable is not set.');
}

if (!process.env.FIREBASE_STORAGE_BUCKET) {
  throw new Error('FIREBASE_STORAGE_BUCKET environment variable is not set.');
}

// Parse the FIREBASE_SERVICE_ACCOUNT JSON string
let serviceAccount: admin.ServiceAccount;
try {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!);
} catch (error) {
  throw new Error('FIREBASE_SERVICE_ACCOUNT is not a valid JSON string.');
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
 * Store the per-user chat into Firestore under:
 *   documents/{docId}/privateChats/{userId}.messages = [ … ]
 */
/***export async function setUserChat(
  docId: string,
  userId: string,
  messages: ChatMessage[]
): Promise<void> {
  const docRef = firestore
    .collection('documents')
    .doc(docId)
    .collection('privateChats')
    .doc(userId);

  await docRef.set({ messages }, { merge: true });
}  */

/**
 * A single chat message.
 */
export interface ChatMessage {
  id: number;
  type: 'assistant' | 'user' | 'system' | 'attachment';
  content: string;
}

/**
 * Load the per-user chat from Firestore. Returns [] if none found.
 */
/*export async function getUserChat(
  docId: string,
  userId: string
): Promise<ChatMessage[]> {
  const docRef = firestore
    .collection('documents')
    .doc(docId)
    .collection('privateChats')
    .doc(userId);

  const snap = await docRef.get();
  if (!snap.exists) return [];
  const data = snap.data();
  if (!data?.messages || !Array.isArray(data.messages)) return [];
  return data.messages as ChatMessage[];
} ** */

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
  metadata: { fileName: string; docFileID: string }
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

export async function storeFileMetadata(metadata: {
  fileId: string;
  ownerId: string;
  fileName: string;
  fileStoragePath: string;
  timestamp: admin.firestore.Timestamp;
  fileSize: number;
  contentType: string;
  editors: string[]
  sharedWith?: string[];
}): Promise<void> {
  try {
    await firestore.collection('userFiles').doc(metadata.fileId).set(metadata);
    console.log(`Metadata for file ${metadata.fileId} stored successfully.`);
  } catch (error) {
    console.error('Error storing file metadata:', error);
    throw error;
  }
}


export async function updateFileMetadata(params: {
  fileId: string;
  fileName?: string;
  fileStoragePath?: string;
  timestamp?: admin.firestore.FieldValue;
  fileSize?: number;
  contentType?: string;
}): Promise<void> {
  console.log('firebase.ts 0009 › updateFileMetadata', params);
  const updates: Record<string, any> = {};
  if (params.fileName)         updates.fileName       = params.fileName;
  if (params.fileStoragePath)  updates.fileStoragePath = params.fileStoragePath;
  if (params.timestamp)        updates.timestamp      = params.timestamp;
  if (params.fileSize  != null) updates.fileSize      = params.fileSize;
  if (params.contentType)      updates.contentType    = params.contentType;

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

    const data = snap.data() as Partial<FileMeta>;
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

    const data = snap.data() as Partial<FileMeta>;
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




  // Force active sessions to re-bootstrap (downgrade or full revoke)
  try {
    await publishRevokeUser(docId, email);
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
  const data = snap.data() as Partial<FileMeta> | undefined;
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

  
  const ownedSnap = await firestore
    .collection('userFiles')
    .where('ownerId', '==', userEmail)
    .orderBy('timestamp', 'desc')
    .get();

  const sharedSnap = await firestore
    .collection('userFiles')
    .where('sharedWith', 'array-contains', userEmail)
    .where('ownerId', '!=', userEmail)
    .orderBy('ownerId')
    .orderBy('timestamp', 'desc')
    .get();

  const ownedFiles = ownedSnap.docs.map(d => d.data());
  console.log('firebase.ts 7002 › ownedFiles count', ownedFiles.length);

  const sharedFiles = sharedSnap.docs.map(d => d.data());
  console.log('firebase.ts 7003 › sharedFiles count', sharedFiles.length);

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
  } catch (error) {
    console.error('Error deleting file metadata:', error);
    throw error;
  }
}



/**
 * generateUploadUrl
 * @param docId    Document identifier
 * @param type     'doc' or 'chat'
 * @param userId   REQUIRED for 'chat' (per-user scope)
 * @returns        { uploadUrl, path }
 */
export async function generateUploadUrl(
  docId: string,
  type: 'doc' | 'chat',
  userId?: string
): Promise<{ uploadUrl: string; path: string }> {
  // Determine destination path
  let destination: string;
  if (type === 'doc') {
    destination = `documents/${docId}.bloomdocx`;
  } else {
    if (!userId) throw new Error('firebase.ts 1003 › userId required for chat upload');
    destination = `documents/${docId}/privateChats/${userId}.chat.json`;
  }
  console.log(`firebase.ts 1004 › generateUploadUrl for ${type}`, { docId, userId, destination });

  const file = bucket.file(destination);
  const [uploadUrl] = await file.getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: Date.now() + 5 * 60 * 1000,
    contentType: type === 'chat' ? 'application/json' : 'application/octet-stream',
  });
  console.log('firebase.ts 1005 › uploadUrl generated', { destination });
  return { uploadUrl, path: destination };
}

/**
 * generateDownloadUrl
 * @param docId    Document identifier
 * @param type     'doc' or 'chat'
 * @param userId   REQUIRED for 'chat'
 * @returns        { downloadUrl, path }
 */
export async function generateDownloadUrl(
  docId: string,
  type: 'doc' | 'chat',
  userId?: string
): Promise<{ downloadUrl: string; path: string }> {
  let destination: string;
  if (type === 'doc') {
    destination = `documents/${docId}.bloomdocx`;
  } else {
    if (!userId) throw new Error('firebase.ts 2003 › userId required for chat download');
    destination = `documents/${docId}/privateChats/${userId}.chat.json`;
  }
  console.log(`firebase.ts 2004 › generateDownloadUrl for ${type}`, { docId, userId, destination });

  const file = bucket.file(destination);
  const [downloadUrl] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + 5 * 60 * 1000,
  });
  console.log('firebase.ts 2005 › downloadUrl generated', { destination });
  return { downloadUrl, path: destination };
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
 * @function getAclSnapshot
 * @description
 *   Read the canonical ACL posture from `userFiles/{docId}`. Returns a normalized
 *   shape (lower-cased emails, defaults for missing arrays/flags) plus `docExists`.
 *   This function does **no** authorization itself; callers use it to compose a
 *   consistent `{ access }` envelope and make policy decisions centrally.
 */
export async function getAclSnapshot(docId: string): Promise<AclSnapshot> {
  const ref = firestore.collection('userFiles').doc(docId);
  const snap = await ref.get();

  if (!snap.exists) {
    console.log('firebase.ts [4101] › getAclSnapshot: doc not found', { docId });
    return {
      docExists: false,
      ownerId: '',
      editors: [],
      sharedWith: [],
      publicEdit: false,
      publicView: false,
    };
  }

  const data = snap.data() as Partial<FileMeta>;
  const ownerId    = normEmail(data?.ownerId as string);
  const editors    = (data?.editors ?? []).map(normEmail);
  const sharedWith = (data?.sharedWith ?? []).map(normEmail);
  const publicEdit = Boolean((data as any)?.publicEdit);
  const publicView = Boolean((data as any)?.publicView);

  console.log('firebase.ts [4102] › getAclSnapshot ok', {
    docId,
    ownerId,
    editorsCount: editors.length,
    sharedCount: sharedWith.length,
    publicEdit,
    publicView
  });

  return { docExists: true, ownerId, editors, sharedWith, publicEdit, publicView };
}

/**
 * @function resolveRole
 * @description
 *   Convert an ACL snapshot + caller’s email into an effective role. If the doc
 *   doesn’t exist, returns 'None'. If `publicEdit` is true, treat all users as
 *   'Editor'. Otherwise: owner → 'Owner'; listed editor → 'Editor'; publicView or
 *   sharedWith → 'Viewer'; else 'None'. Routes may then decide read/write policy.
 */
export async function resolveRole(docId: string, email: string): Promise<Role> {
  const snap = await getAclSnapshot(docId);
  if (!snap.docExists) return 'None';

  const who = normEmail(email);
  if (who === snap.ownerId) return 'Owner';
  if (snap.publicEdit) return 'Editor';
  if (snap.editors.includes(who)) return 'Editor';
  if (snap.publicView) return 'Viewer';
  if (snap.sharedWith.includes(who)) return 'Viewer';
  return 'None';
}