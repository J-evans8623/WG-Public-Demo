/**
 * @file pages/api/document/save.ts
 * @description
 *   Document metadata sync endpoint. **Phase 3 update**: this route now returns a
 *   normalized `{ access }` envelope describing the caller’s effective role and any
 *   access signal. It enforces write ACL for subsequent saves: Owners/Editors can
 *   save, Viewers get 403 with `EDIT_REVOKED`. First-save path provisions metadata
 *   and ownership as before. All responses are `Cache-Control: no-store`.
 *
 * Responsibilities:
 *   - Authenticate caller via NextAuth.
 *   - Create metadata on first save; update on subsequent saves.
 *   - Enforce write access on subsequent saves (Owner/Editor only).
 *   - Return `{ fileStorageId, access }` on success; `{ error, access }` on 403.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import admin from 'firebase-admin';
import {
  storeFileMetadata,
  updateFileMetadata,
  addEditor,
  resolveRole,
} from '@/app/src/services/firebase';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';

interface SaveDocumentRequest {
  fileName: string;
  docFileID: string;
  fileStoragePath: string;
  fileSize: number;
  lessonUnitsMeta?: {
    units: any[];
    lastUpdated: string;
    totalUnits: number;
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const session = await authenticateRequest(req, res);
  if (!session) return;

  try {
    const { fileName, docFileID, fileStoragePath, fileSize , lessonUnitsMeta} =
      req.body as SaveDocumentRequest;

    if (!fileName || !docFileID || !fileStoragePath || typeof fileSize !== 'number') {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log('[save.ts][4701] › incoming save', { docId: docFileID, fileName, fileSize });

    const metaRef  = admin.firestore().collection('userFiles').doc(docFileID);
    const metaSnap = await metaRef.get();

    // ── First save: create metadata and assign ownership ───────────────────
    if (!metaSnap.exists) {
      console.log('[save.ts][4702] › first save detected; provisioning metadata');
      const metadataToStore: any = {
        fileId: docFileID,
        ownerId: session.user.email!,
        fileName,
        fileStoragePath,
        timestamp: admin.firestore.Timestamp.now(),
        fileSize,
        contentType: 'application/octet-stream',
        editors: [session.user.email!],
        sharedWith: [],
      };

      if (lessonUnitsMeta) {
        metadataToStore.lessonUnitsMeta = {
          ...lessonUnitsMeta,
          lastUpdated: admin.firestore.Timestamp.fromDate(new Date(lessonUnitsMeta.lastUpdated)),
        };
        console.log('[save.ts][4703] › Including lesson units metadata:', lessonUnitsMeta.totalUnits, 'units');
      }

      await storeFileMetadata(metadataToStore);
      await addEditor(docFileID, session.user.email!); // no-op if already present
      res.setHeader('Cache-Control', 'no-store, private, max-age=0');

      const access = {
        docId: docFileID,
        role: 'Owner' as const,
        signal: 'GRANT_EDIT' as const,
        source: 'save' as const,
        at: new Date().toISOString(),
      };
      console.log('[save.ts][4703] › first save complete', { docId: docFileID });

      return res.status(200).json({ fileStorageId: fileStoragePath, access });
    }

    else {


    const updateParams: any = {
        fileId: docFileID,
        fileName,
        fileStoragePath,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        fileSize,
        contentType: 'application/octet-stream'
      };

    if (lessonUnitsMeta) {
        updateParams.lessonUnitsMeta = {
          ...lessonUnitsMeta,
          lastUpdated: admin.firestore.Timestamp.fromDate(new Date(lessonUnitsMeta.lastUpdated)),
        };
        console.log('[save.ts][4704] › Updating lesson units metadata:', lessonUnitsMeta.totalUnits, 'units');
      }


    // ── Subsequent saves: enforce write ACL ────────────────────────────────
    const role = await resolveRole(docFileID, session.user.email!);
    console.log('[save.ts][4704] › resolved role', { docId: docFileID, role });

    if (role !== 'Owner' && role !== 'Editor') {
      res.setHeader('Cache-Control', 'no-store, private, max-age=0');
      const access = {
        docId: docFileID,
        role: role === 'None' ? ('Viewer' as const) : (role as 'Owner' | 'Editor' | 'Viewer'),
        signal: 'EDIT_REVOKED' as const,
        source: 'save' as const,
        at: new Date().toISOString(),
      };
      console.warn('[save.ts][4705] › write denied (Viewer/None)', { docId: docFileID });
      return res.status(403).json({ error: 'ACL_DENIED_EDIT', access });
    }

    await updateFileMetadata(updateParams);

    res.setHeader('Cache-Control', 'no-store, private, max-age=0');
    const access = {
      docId: docFileID,
      role,
      signal: 'GRANT_EDIT' as const,
      source: 'save' as const,
      at: new Date().toISOString(),
    };
    console.log('[save.ts][4706] › metadata updated', { docId: docFileID });
    return res.status(200).json({ fileStorageId: fileStoragePath, access });

    }
  } catch (err) {
    console.error('[save.ts][4799] › save error', err);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
