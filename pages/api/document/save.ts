/**
 * @file pages/api/document/save.ts
 * @description
 *   Production-grade Next.js API route for synchronizing document metadata into Firestore
 *   after clients upload bytes to Firebase Storage. In Phase 3, this route remains the
 *   single authority for creating and updating document metadata (owner, editors,
 *   storage path, size, content type, lesson units, and the **logical version** number).
 *   The endpoint authenticates the caller, provisions metadata on first save, and
 *   enforces write access (Owner/Editor only) on subsequent saves. To support client
 *   reconciliation and optimistic concurrency, a successful response includes the latest
 *   persistence identifiers obtained from the storage and metadata source of truth:
 *   the Storage object generation and the Firestore logical `version` value. Logs are
 *   intentionally concise and carry file tags with stable 4-digit codes to aid
 *   diagnostics without flooding production logs. All responses are `Cache-Control: no-store`.
 *
 * Responsibilities:
 *   - Authenticate caller via NextAuth.
 *   - Create metadata on first save; update on subsequent saves.
 *   - Enforce write access on subsequent saves (Owner/Editor only).
 *   - Return `{ fileStorageId, access, storageGeneration, versionNumber }` on success.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import admin from 'firebase-admin';
import {
  storeFileMetadata,
  updateFileMetadata,
  addEditor,
  resolveRole,
  getLatestFileIdentifiers, // update - 1
} from '@/app/src/services/firebase';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { withRateLimitNP } from '@/app/src/services/rate-np/withRateLimitNP';

interface SaveDocumentRequest {
  fileName: string;
  docFileID: string;
  fileStoragePath: string;
  fileSize: number;
  colorCode?: string;
  lessonUnitsMeta?: {
    units: any[];
    lastUpdated: string;
    totalUnits: number;
  };
  version: number;
}

/**
 * @function handler
 * @description
 *   Handles creation and update of document metadata. On first save it provisions an
 *   owner record and basic metadata; on subsequent saves it enforces ACL (Owner/Editor),
 *   updates the mutable fields (name, size, color, lessonUnitsMeta, version), and then
 *   **echoes** the latest identifiers from the authoritative sources using
 *   `getLatestFileIdentifiers`. This echo allows the client to update its local
 *   reconciliation markers without making extra trips.
 */
 async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Step 1: Method guard
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Step 2: Authenticate
  const session = await authenticateRequest(req, res);
  if (!session) return;

  try {
    // Step 3: Parse and validate body
    const { fileName, docFileID, fileStoragePath, fileSize, lessonUnitsMeta, version, colorCode } =
      req.body as SaveDocumentRequest;

    if (
      !fileName ||
      !docFileID ||
      !fileStoragePath ||
      typeof fileSize !== 'number' ||
      !Number.isFinite(fileSize)
    ) {
      res.setHeader('Cache-Control', 'no-store');
      console.error('[save.ts][4700] › invalid request body', {
        hasFileName: !!fileName,
        hasDocId: !!docFileID,
        hasPath: !!fileStoragePath,
        fileSize,
      }); // update - 2
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log('[save.ts][4701] › incoming save', { docId: docFileID, fileName, fileSize });

    // Step 4: Determine if this is first save by checking metadata presence
    const metaRef = admin.firestore().collection('userFiles').doc(docFileID);
    const metaSnap = await metaRef.get();

    // ────────────────────────────────────────────────────────────────────────────────
    // First save path: create metadata and assign owner/editors arrays
    // ────────────────────────────────────────────────────────────────────────────────
    if (!metaSnap.exists) {
      console.log('[save.ts][4702] › first save detected; provisioning metadata');

      const metadataToStore: any = {
        fileId: docFileID,
        ownerId: session.user.email!,
        fileName,
        fileStoragePath,
        timestamp: admin.firestore.Timestamp.now(),
        fileSize,
        colorCode,
        contentType: 'application/octet-stream',
        editors: [session.user.email!],
        sharedWith: [],
        version: Number.isFinite(version) ? version : 1,
      };

      if (lessonUnitsMeta) {
        metadataToStore.lessonUnitsMeta = {
          ...lessonUnitsMeta,
          lastUpdated: admin.firestore.Timestamp.fromDate(
            new Date(lessonUnitsMeta.lastUpdated)
          ),
        };
        console.log('[save.ts][4703] › Including lesson units metadata', {
          totalUnits: lessonUnitsMeta.totalUnits,
        });
      }

      // Step 4.1: Persist metadata and guarantee the owner is an editor
      await storeFileMetadata(metadataToStore);
      await addEditor(docFileID, session.user.email!); // idempotent

      // Step 4.2: Compose access envelope
      const access = {
        docId: docFileID,
        role: 'Owner' as const,
        signal: 'GRANT_EDIT' as const,
        source: 'save' as const,
        at: new Date().toISOString(),
      };

      // Step 4.3: Echo latest identifiers for reconciliation
      const ids = await getLatestFileIdentifiers(docFileID); // update - 3

      res.setHeader('Cache-Control', 'no-store, private, max-age=0');
      console.log('[save.ts][4704] › first save complete', {
        docId: docFileID,
        path: ids.path,
        storageGeneration: ids.storageGeneration,
        versionNumber: ids.versionNumber,
      });
      return res.status(200).json({
        fileStorageId: fileStoragePath,
        access,
        storageGeneration: ids.storageGeneration ?? null,
        versionNumber: ids.versionNumber ?? (Number.isFinite(version) ? version : 1),
      });
    }

    // ────────────────────────────────────────────────────────────────────────────────
    // Subsequent saves path: enforce write ACL then apply metadata updates
    // ────────────────────────────────────────────────────────────────────────────────

    // Step 5: Enforce write ACL (Owner/Editor only)
    const role = await resolveRole(docFileID, session.user.email!);
    console.log('[save.ts][4705] › resolved role', { docId: docFileID, role });

    if (role !== 'Owner' && role !== 'Editor') {
      res.setHeader('Cache-Control', 'no-store, private, max-age=0');
      const access = {
        docId: docFileID,
        role: role === 'None' ? ('Viewer' as const) : (role as 'Owner' | 'Editor' | 'Viewer'),
        signal: 'EDIT_REVOKED' as const,
        source: 'save' as const,
        at: new Date().toISOString(),
      };
      console.warn('[save.ts][4706] › write denied (Viewer/None)', { docId: docFileID }); // update - 4
      return res.status(403).json({ error: 'ACL_DENIED_EDIT', access });
    }

    // Step 6: Build update payload (only provided fields)
    const updateParams: any = {
      fileId: docFileID,
      fileName,
      fileStoragePath,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      fileSize,
      colorCode,
      contentType: 'application/octet-stream',
      version: Number.isFinite(version) ? version : undefined,
    };

    if (lessonUnitsMeta) {
      updateParams.lessonUnitsMeta = {
        ...lessonUnitsMeta,
        lastUpdated: admin.firestore.Timestamp.fromDate(
          new Date(lessonUnitsMeta.lastUpdated)
        ),
      };
      console.log('[save.ts][4707] › Updating lesson units metadata', {
        totalUnits: lessonUnitsMeta.totalUnits,
      });
    }

    // Step 7: Persist updates
    await updateFileMetadata(updateParams);

    // Step 8: Echo latest identifiers (single SSoT helper)
    const ids = await getLatestFileIdentifiers(docFileID); // update - 5

    // Step 9: Success response with access + identifiers
    res.setHeader('Cache-Control', 'no-store, private, max-age=0');
    const access = {
      docId: docFileID,
      role,
      signal: 'GRANT_EDIT' as const,
      source: 'save' as const,
      at: new Date().toISOString(),
    };
    console.log('[save.ts][4708] › metadata updated, returning identifiers', {
      docId: docFileID,
      path: ids.path,
      storageGeneration: ids.storageGeneration,
      versionNumber: ids.versionNumber,
    });

    return res.status(200).json({
      fileStorageId: fileStoragePath,
      access,
      storageGeneration: ids.storageGeneration ?? null,
      versionNumber: ids.versionNumber ?? (Number.isFinite(version) ? version : null),
    });
  } catch (err) {
    console.error('[save.ts][4799] › save error', err);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
export default withRateLimitNP('np:documentSaveMeta')(handler);