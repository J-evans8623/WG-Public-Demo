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
import { 
   CalendarMonth, DailyStudyPlan,
  CalendarData, 
} from '@/app/Library/Definitions/CalendarDefinitions';



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
}): Promise<void> {
  console.log('firebase.ts 0009 › updateFileMetadata', params);
  
  const updates: Record<string, any> = {};
  if (params.fileName)         updates.fileName       = params.fileName;
  if (params.fileStoragePath)  updates.fileStoragePath = params.fileStoragePath;
  if (params.timestamp)        updates.timestamp      = params.timestamp;
  if (params.fileSize != null) updates.fileSize       = params.fileSize;
  if (params.contentType)      updates.contentType    = params.contentType;
  
  // Add lessonUnitsMeta to updates if provided
  if (params.lessonUnitsMeta) {
    updates.lessonUnitsMeta = params.lessonUnitsMeta;
    console.log('firebase.ts › Including lesson units metadata update with', params.lessonUnitsMeta.totalUnits, 'units');
  }

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
      // Computed fields
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

  const data = snap.data() as Partial<UserFileMetadata>;
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

/**
 * Stores enhanced user calendar data in Firestore with complete structure support.
 * Handles CalendarMonth serialization, enhanced ScheduleConfig, and session completion
 * tracking while maintaining proper timestamp management and version control.
 */
export async function storeCalendarData(
  userId: string, 
  calendarData: CalendarData
): Promise<void> {
  console.log('[firebase.ts][9101] › Storing enhanced calendar data for user:', userId);
  
  try {
    const docRef = firestore.collection('users').doc(userId).collection('calendar').doc('current');
    
    // Step 1: Serialize enhanced calendar data with proper timestamp handling for complex structures
    const serializedData = {
      selectedNotebooks: calendarData.selectedNotebooks,
      scheduleConfig: {
        unitsPerBlockSession: calendarData.scheduleConfig.unitsPerBlockSession,
        revisionsPerLesson: calendarData.scheduleConfig.revisionsPerLesson,
        startDate: admin.firestore.Timestamp.fromDate(calendarData.scheduleConfig.startDate),
        daysPerWeek: calendarData.scheduleConfig.daysPerWeek,
        // Step 2: Serialize enhanced configuration fields
        subjectsPerDay: calendarData.scheduleConfig.subjectsPerDay,
        preferredTimeSlots: calendarData.scheduleConfig.preferredTimeSlots,
        maxSessionsPerDay: calendarData.scheduleConfig.maxSessionsPerDay,
      },
      // Step 3: Serialize CalendarMonth with nested DailyStudyPlan structures
      currentMonth: calendarData.currentMonth ? {
        year: calendarData.currentMonth.year,
        month: calendarData.currentMonth.month,
        dailyPlans: calendarData.currentMonth.dailyPlans.map(plan => ({
          date: admin.firestore.Timestamp.fromDate(plan.date),
          sessions: plan.sessions.map(session => ({
            id: session.id,
            date: admin.firestore.Timestamp.fromDate(session.date),
            notebookMeta: {
              fileId: session.notebookMeta.fileId,
              filePath: session.notebookMeta.filePath,
              fileName: session.notebookMeta.fileName,
              lessonUnits: session.notebookMeta.lessonUnits,
              lastUpdated: admin.firestore.Timestamp.fromDate(session.notebookMeta.lastUpdated),
              version: session.notebookMeta.version,
              color: session.notebookMeta.color,
            },
            targetLessonUnits: session.targetLessonUnits,
            type: session.type,
            sessionConfig: session.sessionConfig,
            metadata: session.metadata,
            timeSlot: session.timeSlot,
          })),
          subjectSummary: plan.subjectSummary,
          totalDuration: plan.totalDuration,
          completedSessions: plan.completedSessions,
        })),
        monthlySummary: calendarData.currentMonth.monthlySummary,
      } : null,
      // Step 4: Handle session completion tracking
      completedSessions: calendarData.completedSessions,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      version: calendarData.version,
    };
    
    await docRef.set(serializedData);
    console.log('[firebase.ts][9102] › Enhanced calendar data stored successfully with monthly structure');
    
  } catch (error) {
    console.error('[firebase.ts][9103] › Error storing enhanced calendar data:', error);
    throw new Error('Failed to store enhanced calendar data');
  }
}

/**
 * Loads enhanced user calendar data from Firestore with proper deserialization.
 * Reconstructs CalendarMonth structures, enhanced ScheduleConfig, and session completion
 * tracking while handling version compatibility and providing comprehensive defaults.
 */
export async function loadCalendarData(userId: string): Promise<CalendarData | null> {
  console.log('[firebase.ts][9104] › Loading enhanced calendar data for user:', userId);
  
  try {
    const docRef = firestore.collection('users').doc(userId).collection('calendar').doc('current');
    const snapshot = await docRef.get();
    
    if (!snapshot.exists) {
      console.log('[firebase.ts][9105] › No calendar data found for user:', userId);
      return null;
    }
    
    const data = snapshot.data() as any;
    
    // Step 1: Deserialize enhanced calendar data with comprehensive date reconstruction
    const deserializedData: CalendarData = {
      selectedNotebooks: data.selectedNotebooks || [],
      scheduleConfig: {
        unitsPerBlockSession: data.scheduleConfig?.unitsPerBlockSession || 3,
        revisionsPerLesson: data.scheduleConfig?.revisionsPerLesson || 2,
        startDate: data.scheduleConfig?.startDate instanceof admin.firestore.Timestamp 
          ? data.scheduleConfig.startDate.toDate()
          : new Date(data.scheduleConfig?.startDate || Date.now()),
        daysPerWeek: data.scheduleConfig?.daysPerWeek || [1, 2, 3, 4, 5],
        // Step 2: Deserialize enhanced configuration fields with defaults
        subjectsPerDay: data.scheduleConfig?.subjectsPerDay || 3,
        preferredTimeSlots: data.scheduleConfig?.preferredTimeSlots || ['morning', 'afternoon', 'evening'],
        maxSessionsPerDay: data.scheduleConfig?.maxSessionsPerDay || 6,
      },
      // Step 3: Deserialize CalendarMonth with nested DailyStudyPlan structures
      currentMonth: data.currentMonth ? {
        year: data.currentMonth.year,
        month: data.currentMonth.month,
        dailyPlans: (data.currentMonth.dailyPlans || []).map((plan: any) => ({
          date: plan.date instanceof admin.firestore.Timestamp 
            ? plan.date.toDate()
            : new Date(plan.date),
          sessions: (plan.sessions || []).map((session: any) => ({
            id: session.id,
            date: session.date instanceof admin.firestore.Timestamp
              ? session.date.toDate()
              : new Date(session.date),
            notebookMeta: {
              fileId: session.notebookMeta.fileId,
              filePath: session.notebookMeta.filePath,
              fileName: session.notebookMeta.fileName,
              lessonUnits: session.notebookMeta.lessonUnits || [],
              lastUpdated: session.notebookMeta.lastUpdated instanceof admin.firestore.Timestamp
                ? session.notebookMeta.lastUpdated.toDate()
                : new Date(session.notebookMeta.lastUpdated),
              version: session.notebookMeta.version,
              color: session.notebookMeta.color,
            },
            targetLessonUnits: session.targetLessonUnits || [],
            type: session.type,
            sessionConfig: session.sessionConfig || { unitCount: 0 },
            metadata: session.metadata || { 
              sessionTitle: '', 
              estimatedDuration: 0, 
              topicTitles: [] 
            },
            timeSlot: session.timeSlot,
          })),
          subjectSummary: plan.subjectSummary || {},
          totalDuration: plan.totalDuration || 0,
          completedSessions: plan.completedSessions || [],
        })),
        monthlySummary: data.currentMonth.monthlySummary || {
          totalSessions: 0,
          totalStudyTime: 0,
          activeNotebooks: [],
          completionRate: 0,
        },
      } : null,
      // Step 4: Handle session completion tracking deserialization
      completedSessions: data.completedSessions || [],
      lastUpdated: data.lastUpdated instanceof admin.firestore.Timestamp
        ? data.lastUpdated.toDate()
        : new Date(data.lastUpdated || Date.now()),
      version: data.version || '2.0',
    };
    
    console.log('[firebase.ts][9106] › Enhanced calendar data loaded successfully, currentMonth exists:', !!deserializedData.currentMonth);
    return deserializedData;
    
  } catch (error) {
    console.error('[firebase.ts][9107] › Error loading enhanced calendar data:', error);
    return null;
  }
}

/**
 * Clears all enhanced calendar data for a user from Firestore including monthly structures.
 * Provides comprehensive reset functionality while maintaining user document structure
 * and ensuring proper cleanup of complex calendar configurations and monthly data.
 */
export async function clearCalendarData(userId: string): Promise<void> {
  console.log('[firebase.ts][9108] › Clearing enhanced calendar data for user:', userId);
  
  try {
    const docRef = firestore.collection('users').doc(userId).collection('calendar').doc('current');
    await docRef.delete();
    
    console.log('[firebase.ts][9109] › Enhanced calendar data cleared successfully');
    
  } catch (error) {
    console.error('[firebase.ts][9110] › Error clearing enhanced calendar data:', error);
    throw new Error('Failed to clear enhanced calendar data');
  }
}

/**
 * Updates specific fields in enhanced user calendar data without overwriting the entire document.
 * Handles partial updates for CalendarMonth structures, enhanced configuration changes,
 * and session completion updates while preserving complex nested data integrity.
 */
export async function updateCalendarData(
  userId: string, 
  updates: Partial<CalendarData>
): Promise<void> {
  console.log('[firebase.ts][9111] › Updating enhanced calendar data for user:', userId);
  
  try {
    const docRef = firestore.collection('users').doc(userId).collection('calendar').doc('current');
    
    const updateData: any = {
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    };
    
    // Step 1: Handle selectedNotebooks updates
    if (updates.selectedNotebooks) {
      updateData.selectedNotebooks = updates.selectedNotebooks;
    }
    
    // Step 2: Handle enhanced scheduleConfig updates with proper serialization
    if (updates.scheduleConfig) {
      updateData.scheduleConfig = {
        unitsPerBlockSession: updates.scheduleConfig.unitsPerBlockSession,
        revisionsPerLesson: updates.scheduleConfig.revisionsPerLesson,
        startDate: updates.scheduleConfig.startDate instanceof Date
          ? admin.firestore.Timestamp.fromDate(updates.scheduleConfig.startDate)
          : admin.firestore.Timestamp.fromDate(new Date(updates.scheduleConfig.startDate)),
        daysPerWeek: updates.scheduleConfig.daysPerWeek,
        subjectsPerDay: updates.scheduleConfig.subjectsPerDay,
        preferredTimeSlots: updates.scheduleConfig.preferredTimeSlots,
        maxSessionsPerDay: updates.scheduleConfig.maxSessionsPerDay,
      };
    }
    
    // Step 3: Handle CalendarMonth updates with nested structure serialization
    if (updates.currentMonth !== undefined) {
      if (updates.currentMonth === null) {
        updateData.currentMonth = null;
      } else {
        updateData.currentMonth = {
          year: updates.currentMonth.year,
          month: updates.currentMonth.month,
          dailyPlans: updates.currentMonth.dailyPlans.map(plan => ({
            date: admin.firestore.Timestamp.fromDate(plan.date),
            sessions: plan.sessions.map(session => ({
              ...session,
              date: admin.firestore.Timestamp.fromDate(session.date),
              notebookMeta: {
                ...session.notebookMeta,
                lastUpdated: admin.firestore.Timestamp.fromDate(session.notebookMeta.lastUpdated),
              },
            })),
            subjectSummary: plan.subjectSummary,
            totalDuration: plan.totalDuration,
            completedSessions: plan.completedSessions,
          })),
          monthlySummary: updates.currentMonth.monthlySummary,
        };
      }
    }
    
    // Step 4: Handle session completion tracking updates
    if (updates.completedSessions) {
      updateData.completedSessions = updates.completedSessions;
    }
    
    // Step 5: Handle version updates
    if (updates.version) {
      updateData.version = updates.version;
    }
    
    await docRef.update(updateData);
    console.log('[firebase.ts][9112] › Enhanced calendar data updated successfully');
    
  } catch (error) {
    console.error('[firebase.ts][9113] › Error updating enhanced calendar data:', error);
    throw new Error('Failed to update enhanced calendar data');
  }
}