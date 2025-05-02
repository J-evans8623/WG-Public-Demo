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

const firestore = admin.firestore();
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

/**
 * Stores file metadata into Firestore.
 * @param metadata - Object containing file metadata.
 */
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

/**
 * Lists file metadata for a given user.
 * @param userEmail - The authenticated user's email.
 * @returns An array of file metadata objects.
 */
export async function listUserFiles(userEmail: string): Promise<any[]> {
  try {
    const ownedQuerySnapshot = await firestore
      .collection('userFiles')
      .where('ownerId', '==', userEmail)
      .orderBy('timestamp', 'desc')
      .get();

    const sharedQuerySnapshot = await firestore
      .collection('userFiles')
      .where('sharedWith', 'array-contains', userEmail)
      .orderBy('timestamp', 'desc')
      .get();

    const filesMap: Record<string, any> = {};
    ownedQuerySnapshot.forEach(doc => {
      filesMap[doc.id] = doc.data();
    });
    sharedQuerySnapshot.forEach(doc => {
      filesMap[doc.id] = doc.data();
    });
    return Object.values(filesMap);
  } catch (error) {
    console.error('Error listing user files:', error);
    throw error;
  }
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
