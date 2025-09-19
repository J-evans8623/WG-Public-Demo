/***********************************************************************************************
 * @file pages/api/document/upload-urlv1.ts
 * @description
 *   Production-grade Next.js API route that issues short-lived, signed Firebase Storage URLs
 *   for uploads of either document bytes (`type=doc`) or a per-user chat transcript
 *   (`type=chat`). In Phase 3, this route is updated to integrate **precondition-aware
 *   uploads** using the new `generateUploadUrl(docId, type, opts, userId?)` helper from
 *   firebase.ts, where `opts` is now mandatory. For document uploads, callers may provide
 *   `expectStorageGeneration` and/or `expectVersionNumber` so that the backend verifies the
 *   latest persistence identifiers before minting the signed PUT URL. On mismatch, the
 *   route returns HTTP 409 with authoritative conflict data (path, storage generation, and
 *   logical version) enabling the client to fast-forward without re-downloading blindly.
 *   For chat uploads, behavior remains unchanged aside from the required `opts` parameter,
 *   which should be an empty object `{}`.
 *
 *   This endpoint enforces access control using the ACL snapshot (owner/editors/shared/public
 *   posture) and supports a bootstrap flow for truly new documents via `?newDoc=1`. When a
 *   document does not yet exist in the ACL store and `newDoc=1`, it will mint both doc and
 *   chat upload URLs without metadata creation; actual persistence is deferred to the save
 *   route. Purposeful log statements include a file tag and unique 4-digit codes to aid
 *   production diagnostics with low noise.
 *
 * Responsibilities:
 *   1) Authenticate via NextAuth.
 *   2) Read the ACL snapshot and infer the caller’s role locally (no writes here).
 *   3) Enforce upload policy with support for `newDoc` bootstrap.
 *   4) For documents, enforce optional preconditions (generation/version) and return 409 on conflict.
 *   5) Return `{ uploadUrl, fileStoragePath, access }` (and bootstrap chat URL if requested).
 ***********************************************************************************************/

import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { generateUploadUrl, getAclSnapshot } from '@/app/src/services/firebase';

type Role = 'Owner' | 'Editor' | 'Viewer' | 'None';

/**
 * @function handler
 * @description
 *   Validates method and authentication, parses inputs, evaluates ACL-derived role, and
 *   then issues a signed PUT URL for Firebase Storage. For `type='doc'`, the function
 *   accepts optional precondition query parameters (`expectStorageGeneration`,
 *   `expectVersionNumber`) which are forwarded to the centralized Firebase helper to
 *   enforce conditional uploads. If preconditions fail, it returns HTTP 409 along with
 *   authoritative conflict information so the client can reconcile state efficiently.
 *   For `type='chat'`, the function returns a signed PUT URL scoped by the caller user id.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  // Step 1: Method guard
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Step 2: Authenticate
  const session = await authenticateRequest(req, res);
  if (!session) return;
  const uid = String(session.user?.email || '').trim().toLowerCase();

  // Step 3: Parse required query parameters
  const docFileID = Array.isArray(req.query.docFileID)
    ? req.query.docFileID[0]
    : (req.query.docFileID as string | undefined);

  const type = Array.isArray(req.query.type)
    ? (req.query.type[0] as 'doc' | 'chat')
    : (req.query.type as 'doc' | 'chat' | undefined);

  // Step 3.1: Optional bootstrap flag for new documents
  const newDoc =
    req.query.newDoc === '1' ||
    req.query.newDoc === 'true' ||
    (Array.isArray(req.query.newDoc) &&
      (req.query.newDoc[0] === '1' || req.query.newDoc[0] === 'true'));

  // Step 3.2: Optional precondition parameters (Phase 3)
  //           These are relevant only for `type='doc'`, but we parse them here once.
  const expectStorageGenerationRaw = Array.isArray(req.query.expectStorageGeneration)
    ? req.query.expectStorageGeneration[0]
    : (req.query.expectStorageGeneration as string | undefined);

  const expectVersionNumberRaw = Array.isArray(req.query.expectVersionNumber)
    ? req.query.expectVersionNumber[0]
    : (req.query.expectVersionNumber as string | undefined);

  // Normalize/parse version to number if provided
  const expectVersionNumber =
    expectVersionNumberRaw != null && expectVersionNumberRaw !== ''
      ? Number(expectVersionNumberRaw)
      : undefined;

  const expectStorageGeneration =
    expectStorageGenerationRaw != null && expectStorageGenerationRaw !== ''
      ? String(expectStorageGenerationRaw)
      : undefined;

  console.log('[upload-urlv1.ts][4801] › parsed params', {
    docFileID,
    type,
    newDoc,
    expectStorageGeneration,
    expectVersionNumber,
  }); // update - 1

  if (!docFileID || (type !== 'doc' && type !== 'chat')) {
    res.setHeader('Cache-Control', 'no-store');
    console.error('[upload-urlv1.ts][4802] › invalid params');
    return res.status(400).json({ error: 'Invalid docFileID or type' });
  }

  try {
    // Step 4: Read ACL posture and infer role locally
    const acl = await getAclSnapshot(docFileID);
    console.log('[upload-urlv1.ts][4803] › acl snapshot', {
      exists: acl.docExists,
      owner: acl.ownerId,
      editors: acl.editors.length,
      shared: acl.sharedWith.length,
      publicEdit: acl.publicEdit,
      publicView: acl.publicView,
    });

    const inferRole = (): Role => {
      if (!acl.docExists) return 'None';
      if (uid === acl.ownerId) return 'Owner';
      if (acl.publicEdit) return 'Editor';
      if (acl.editors.includes(uid)) return 'Editor';
      if (acl.publicView) return 'Viewer';
      if (acl.sharedWith.includes(uid)) return 'Viewer';
      return 'None';
    };

    // Step 5: Bootstrap for brand-new document (no ACL yet)
    if (!acl.docExists) {
      if (newDoc) {
        // 5.1 Issue doc upload URL (no preconditions for first write)
        const docResult = await generateUploadUrl(
          docFileID,
          'doc',
          {}, // mandatory opts; empty for bootstrap
          uid
        ); // update - 2

        // Normalize document result (legacy or ok:true)
        let uploadUrl: string;
        let fileStoragePath: string;
        if ('ok' in (docResult as any)) {
          if ((docResult as any).ok === false) {
            // Extremely unlikely in bootstrap, but guard for completeness
            const conflict = (docResult as any).conflict;
            console.warn('[upload-urlv1.ts][4804] › unexpected conflict in bootstrap', conflict);
            res.setHeader('Cache-Control', 'no-store');
            return res.status(409).json({
              error: 'PRECONDITION_FAILED',
              conflict,
              access: {
                docId: docFileID,
                role: 'Owner' as const,
                signal: 'EDIT_REVOKED' as const,
                source: 'upload' as const,
                at: new Date().toISOString(),
              },
            });
          }
          uploadUrl = (docResult as any).uploadUrl;
          fileStoragePath = (docResult as any).path;
        } else {
          uploadUrl = (docResult as any).uploadUrl;
          fileStoragePath = (docResult as any).path;
        }

        // 5.2 Issue chat upload URL for same brand-new doc
        const chatResult = await generateUploadUrl(
          docFileID,
          'chat',
          {}, // mandatory opts, but unused by chat
          uid
        ); // update - 3

        const chatUploadUrl = (chatResult as any).uploadUrl as string;
        const chatFileStoragePath = (chatResult as any).path as string;

        const access = {
          docId: docFileID,
          role: 'Owner' as const,
          signal: 'GRANT_EDIT' as const,
          source: 'upload' as const,
          at: new Date().toISOString(),
        };

        res.setHeader('Cache-Control', 'no-store, private, max-age=0');
        console.log('[upload-urlv1.ts][4805] › bootstrap URLs ready (doc+chat)', {
          docId: docFileID,
          fileStoragePath,
          chatFileStoragePath,
        });
        return res.status(200).json({
          uploadUrl,
          fileStoragePath,
          chatUploadUrl,
          chatFileStoragePath,
          access,
        });
      }

      // 5.3 Not a bootstrap request → treat as not found
      const access = {
        docId: docFileID,
        role: 'Viewer' as const,
        signal: 'EDIT_REVOKED' as const,
        source: 'upload' as const,
        at: new Date().toISOString(),
      };
      res.setHeader('Cache-Control', 'no-store');
      console.warn('[upload-urlv1.ts][4806] › DOC_NOT_FOUND (no bootstrap)', {
        docId: docFileID,
        type,
      });
      return res.status(404).json({ error: 'DOC_NOT_FOUND', access });
    }

    // Step 6: ACL exists → enforce policy
    const role = inferRole();
    console.log('[upload-urlv1.ts][4807] › role inferred', { docId: docFileID, uid, role });

    // Owners/Editors (or publicEdit via role inference) can upload doc; chat always allowed when doc exists
    if (type === 'doc') {
      const canEdit = role === 'Owner' || role === 'Editor';
      if (!canEdit) {
        const access = {
          docId: docFileID,
          role: role === 'None' ? ('Viewer' as const) : role,
          signal: 'EDIT_REVOKED' as const,
          source: 'upload' as const,
          at: new Date().toISOString(),
        };
        res.setHeader('Cache-Control', 'no-store');
        console.warn('[upload-urlv1.ts][4808] › ACL_DENIED_EDIT for doc upload', {
          docId: docFileID,
          uid,
          role,
        });
        return res.status(403).json({ error: 'ACL_DENIED_EDIT', access });
      }
    }

    // Step 7: Mint upload URL (with preconditions for documents if provided)
    if (type === 'doc') {
      const result = await generateUploadUrl(
        docFileID,
        'doc',
        {
          expectStorageGeneration:
            expectStorageGeneration === undefined ? null : expectStorageGeneration,
          expectVersionNumber:
            expectVersionNumber === undefined || Number.isNaN(expectVersionNumber)
              ? null
              : expectVersionNumber,
        }, // update - 4 (mandatory opts with preconditions)
        uid
      );

      if ('ok' in (result as any)) {
        // precondition path
        if ((result as any).ok === false) {
          const conflict = (result as any).conflict;
          console.warn('[upload-urlv1.ts][4809] › precondition conflict', {
            docId: docFileID,
            conflict,
          });
          res.setHeader('Cache-Control', 'no-store');
          const access = {
            docId: docFileID,
            role,
            signal: 'EDIT_REVOKED' as const,
            source: 'upload' as const,
            at: new Date().toISOString(),
          };
          return res.status(409).json({ error: 'PRECONDITION_FAILED', conflict, access });
        }

        // ok:true
        const access = {
          docId: docFileID,
          role,
          signal: 'GRANT_EDIT' as const,
          source: 'upload' as const,
          at: new Date().toISOString(),
        };
        res.setHeader('Cache-Control', 'no-store, private, max-age=0');
        console.log('[upload-urlv1.ts][4810] › preconditions OK, signed URL ready', {
          docId: docFileID,
          path: (result as any).path,
        });
        return res.status(200).json({
          uploadUrl: (result as any).uploadUrl,
          fileStoragePath: (result as any).path,
          access,
        });
      }

      // Legacy success shape (no preconditions provided)
      const access = {
        docId: docFileID,
        role,
        signal: 'GRANT_EDIT' as const,
        source: 'upload' as const,
        at: new Date().toISOString(),
      };
      res.setHeader('Cache-Control', 'no-store, private, max-age=0');
      console.log('[upload-urlv1.ts][4811] › legacy doc upload URL ready', {
        docId: docFileID,
        path: (result as any).path,
      });
      return res.status(200).json({
        uploadUrl: (result as any).uploadUrl,
        fileStoragePath: (result as any).path,
        access,
      });
    }

    // Step 8: Chat uploads (no preconditions, but opts is mandatory)
    const chatRes = await generateUploadUrl(
      docFileID,
      'chat',
      {}, // update - 5 (mandatory opts, unused by chat)
      uid
    );
    const chatAccess = {
      docId: docFileID,
      role,
      signal: null as null,
      source: 'upload' as const,
      at: new Date().toISOString(),
    };
    res.setHeader('Cache-Control', 'no-store, private, max-age=0');
    console.log('[upload-urlv1.ts][4812] › chat upload URL ready', {
      docId: docFileID,
      path: (chatRes as any).path,
    });
    return res.status(200).json({
      uploadUrl: (chatRes as any).uploadUrl,
      fileStoragePath: (chatRes as any).path,
      access: chatAccess,
    });
  } catch (err) {
    console.error('[upload-urlv1.ts][4899] › error generating URL', err);
    res.setHeader('Cache-Control', 'no-store');
    const access = {
      docId: Array.isArray(req.query.docFileID)
        ? req.query.docFileID[0]
        : (req.query.docFileID as string) || '',
      role: 'Viewer' as const,
      signal: 'EDIT_REVOKED' as const,
      source: 'upload' as const,
      at: new Date().toISOString(),
    };
    return res.status(500).json({ error: 'Failed to generate upload URL', access });
  }
}
