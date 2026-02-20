/**
 * @file FileRetentionService.ts
 * @description 
 * This service layer module is responsible for managing the extended lifecycle of document metadata 
 * within the Bloom-Map ecosystem, specifically focusing on the retention and recovery of user notebooks. 
 * Adhering to the Single Responsibility Principle (SRP) under SOLID guidelines, this file 
 * decouples the logic of "Soft Deletion" from the HTTP-facing API endpoints. It ensures that 
 * student grades, instructional content, and binary assets are not immediately destroyed 
 * when a user requests a deletion. Instead, the service facilitates the atomic migration of 
 * metadata documents from the active 'userFiles' collection into a specialized 'recoveryBin' 
 * collection. This approach provides a 30-day safety window, allowing for administrative or 
 * user-driven recovery while maintaining database integrity through the use of Firestore 
 * transactions to prevent partial state changes or data orphaning during the archival process.
 */

import admin from 'firebase-admin';
import { firestore, deleteDocumentFile } from '@/app/src/services/firebase'; // UPDATE - 4.1: Added destructive imports
import { performOwnerCascades } from '@/app/src/services/cascadeOps/DocumentDeleteCascade'; // UPDATE - 4.2: Import cascade logic

/**
 * @function softDeleteNotebook
 * @description 
 * Performs an atomic transfer of notebook metadata from the active 'userFiles' collection 
 * to the 'recoveryBin' collection. It calculates a strict 30-day expiration window from 
 * the moment of deletion and ensures that only the authoritative owner of the file 
 * can initiate this transition, preserving all existing file metadata for future restoration.
 */
export async function softDeleteNotebook(docId: string, ownerEmail: string): Promise<void> {
    const activeRef = firestore.collection('userFiles').doc(docId);
    const binRef = firestore.collection('recoveryBin').doc(docId);

    return firestore.runTransaction(async (transaction) => {
        const snap = await transaction.get(activeRef);
        if (!snap.exists) { throw new Error('FILE_NOT_FOUND'); }
        const data = snap.data();
        if (data?.ownerId !== ownerEmail) { throw new Error('UNAUTHORIZED_DELETION_REQUEST'); }

        const now = Date.now();
        const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
        const expiresAt = new Date(now + thirtyDaysInMs);

        transaction.set(binRef, {
            ...data,
            deletedAt: admin.firestore.FieldValue.serverTimestamp(),
            expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
            originalCollection: 'userFiles'
        });
        transaction.delete(activeRef);
    });
}

// update - 1.1: Added getRecoveryBinMetadata to support bin auditing
/**
 * @function getRecoveryBinMetadata
 * @description 
 * Retrieves all notebook metadata currently residing in the 'recoveryBin' that belongs 
 * to a specific owner. This function is used to populate the user-facing "Trash" or 
 * "Recovery" interface, providing a read-only snapshot of items that are eligible 
 * for restoration before they are purged by the nightly janitor process.
 */
/**
 * @function getRecoveryBinMetadata
 * @description 
 * Retrieves all notebook metadata currently residing in the 'recoveryBin' belonging to a 
 * specific owner. To avoid the requirement of a manual composite index in Firestore, 
 * this function performs a simple equality query on the 'ownerId' and handles the 
 * chronological sorting (by expiration date) within the Node.js runtime. This approach 
 * ensures maximum reliability and ease of deployment while maintaining O(N log N) 
 * performance for the user's specific set of deleted documents.
 * (84 words)
 */
export async function getRecoveryBinMetadata(ownerEmail: string): Promise<any[]> {
    console.log('FileRetentionService [4101] › fetching bin for:', ownerEmail);
    
    // 1. Optimized Query: Removed .orderBy() to bypass the requirement for a composite index.
    // This allows the system to function immediately without manual Firebase Console configuration.
    const snapshot = await firestore.collection('recoveryBin')
        .where('ownerId', '==', ownerEmail.trim().toLowerCase())
        .get();

    // 2. Memory Transformation: Convert documents to objects and sort manually in Node.js
    const files = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            ...data,
            fileId: doc.id,
            // Convert Firestore Timestamps to ISO strings for frontend compatibility
            expiresAt: data.expiresAt?.toDate().toISOString(),
            deletedAt: data.deletedAt?.toDate().toISOString()
        };
    });

    // 3. Sort by expiration date descending (newest deletions first)
    return files.sort((a, b) => {
        const timeA = new Date(a.expiresAt || 0).getTime();
        const timeB = new Date(b.expiresAt || 0).getTime();
        return timeB - timeA;
    });
}

// update - 1.2: Added restoreNotebook to perform atomic Bin -> Active migration
/**
 * @function restoreNotebook
 * @description 
 * Reverses a previous soft-delete by moving metadata from the 'recoveryBin' back to the 
 * active 'userFiles' collection. This operation is performed within a transaction to 
 * ensure that the file is correctly re-instated with its original attributes while 
 * stripping the retention-specific timestamps (deletedAt/expiresAt) that governed its archival.
 */
export async function restoreNotebook(docId: string, ownerEmail: string): Promise<void> {
    const binRef = firestore.collection('recoveryBin').doc(docId);
    const activeRef = firestore.collection('userFiles').doc(docId);

    return firestore.runTransaction(async (transaction) => {
        // 1. Fetch document from the bin
        const snap = await transaction.get(binRef);
        if (!snap.exists) {
            throw new Error('FILE_NOT_IN_RECOVERY_BIN');
        }

        const data = snap.data();
        // 2. Security Check: Only the owner can restore
        if (data?.ownerId !== ownerEmail.trim().toLowerCase()) {
            throw new Error('UNAUTHORIZED_RESTORATION_REQUEST');
        }

        // 3. Clean up the metadata (remove bin-specific fields)
        const { deletedAt, expiresAt, originalCollection, ...originalMetadata } = data;

        // 4. Atomic Swap: Create in Active, Delete from Bin
        transaction.set(activeRef, {
            ...originalMetadata,
            updatedAt: admin.firestore.FieldValue.serverTimestamp() // Mark as modified
        });
        transaction.delete(binRef);

        console.log(`FileRetentionService [4102] › Restoration successful for docId: ${docId}`);
    });
}

/**
 * @function executePermanentPurge
 * @description 
 * UPDATE - 4.2: Performs the irreversible "Hard Delete" sequence for a notebook that has 
 * exceeded its 30-day retention period. To satisfy the constraint of not modifying the 
 * existing firebase.ts external API, this function utilizes the deleteDocumentFile 
 * abstraction to wipe Storage binaries. It then recursively removes the Firestore 
 * document tree (including snapshots and grades) and triggers the AI/GridFS cascades. 
 * This ensures system hygiene and storage cost control without exposing the raw 
 * Storage bucket instance to the service layer.
 * (93 words)
 */
export async function executePermanentPurge(docId: string): Promise<void> {
    console.log(`FileRetentionService [4201] › Hard delete starting for: ${docId}`);

    // 1. Reference the bin document to gather contextual data (path and owner)
    const binRef = firestore.collection('recoveryBin').doc(docId);
    const snap = await binRef.get();

    if (!snap.exists) {
        console.warn(`FileRetentionService [4202] › Purge aborted: docId ${docId} not found in bin.`);
        return;
    }

    const data = snap.data()!;
    const fileStoragePath = data.fileStoragePath;
    const ownerId = data.ownerId;

    // 2. Step 1: Wipe binary from Firebase Storage using the exported helper
    try {
        if (fileStoragePath) {
            // Using the service helper instead of the raw bucket instance
            await deleteDocumentFile(fileStoragePath);
            console.log(`FileRetentionService [4203] › Storage binary purged: ${fileStoragePath}`);
        }
    } catch (err) {
        console.error(`FileRetentionService [4291] › Storage purge failed (non-fatal):`, err);
    }

    // 3. Step 2: Recursively delete the Firestore document tree (Snapshots, Grades, Notes)
    try {
        const docRootRef = firestore.collection('documents').doc(docId);
        await firestore.recursiveDelete(docRootRef);
        console.log(`FileRetentionService [4204] › Firestore tree recursively deleted: documents/${docId}`);
    } catch (err) {
        console.error(`FileRetentionService [4292] › Recursive delete failed:`, err);
    }

    // 4. Step 3: Trigger forward-only cascades (Embeddings / GridFS uploads)
    try {
        // Hydrate owner context from archived metadata to satisfy cascade requirements
        await performOwnerCascades(docId, { email: ownerId } as any);
        console.log(`FileRetentionService [4205] › Owner cascades completed for: ${docId}`);
    } catch (err) {
        console.warn(`FileRetentionService [4293] › Cascades encountered issues:`, err);
    }

    // 5. Step 4: Final cleanup of the metadata record in the recoveryBin
    await binRef.delete();
    console.log(`FileRetentionService [4206] › Permanent purge finalized for: ${docId}`);
}