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
export async function setUserChat(
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
 * Load the per-user chat from Firestore. Returns [] if none found.
 */
export async function getUserChat(
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

/**
 * Add a user to documents/{docId}/editors and mirror to userFiles.sharedWith[]
 */
export async function addEditor(docId: string, userEmail: string): Promise<void> {
  console.log('firebase.ts 0006 › addEditor', docId, userEmail);
  // 1) ACL subcollection
  await firestore
    .collection('documents')
    .doc(docId)
    .collection('editors')
    .doc(userEmail)
    .set({ addedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

  // 2) Mirror into sharedWith[]
  await firestore
    .collection('userFiles')
    .doc(docId)
    .update({
      sharedWith: admin.firestore.FieldValue.arrayUnion(userEmail)
    });
}


/**
 * Remove a user’s access to a document:
 * 1) Deletes ACL entry under documents/{docId}/editors/{userEmail}
 * 2) Removes their email from userFiles/{docId}.sharedWith
 */
export async function removeEditor(docId: string, userEmail: string): Promise<void> {
  console.log('firebase.ts 2001 › removeEditor start', docId, userEmail);
  await firestore
    .collection('documents')
    .doc(docId)
    .collection('editors')
    .doc(userEmail)
    .delete();
  await firestore
    .collection('userFiles')
    .doc(docId)
    .update({
      sharedWith: admin.firestore.FieldValue.arrayRemove(userEmail)
    });
  console.log('firebase.ts 2002 › removeEditor complete for', userEmail);
}

/**
 * Return { owner: string, editors: string[] }
 */
export async function listEditors(docId: string): Promise<{ owner: string; editors: string[] }> {
  // ① owner = userFiles/<docId>.ownerId         (flat doc → single read)
  const metaSnap = await firestore.collection('userFiles').doc(docId).get();
  const owner = (metaSnap.data()?.ownerId as string) ?? '';

  // ② editors = documents/<docId>/editors/*     (sub-collection → list of docs)
  const colSnap = await firestore
    .collection('documents')
    .doc(docId)
    .collection('editors')
    .get();

  const editors = colSnap.docs.map(d => d.id);         // document-id === user email
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
