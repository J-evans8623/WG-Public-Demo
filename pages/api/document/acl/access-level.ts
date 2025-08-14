/**
 * 
 *  @file pages/api/document/acl/access-level.ts
 * @description
 *   Unified ACL endpoint to set a document’s sharing mode. This BFF route accepts a
 *   single JSON payload describing the desired access level and applies the change
 *   atomically using Firestore + the Firebase service helpers:
 *
 *     • accessLevel === "anyone"   → setPublicEdit(docId, true)          (owners only)
 *     • accessLevel === "readonly" → setPublicEdit(docId, false) +
 *                                    setPublicView(docId, true)          (owners only)
 *     • accessLevel === "editors"  → setPublicEdit(docId, false) +
 *                                    (optional) setPublicView(docId, publicView?) +
 *                                    addEditor(docId, email) for each    (owners only)
 *
 *   When turning OFF public edit, the server publishes a **revoke-all-non-owner**
 *   event so the Yjs server immediately disconnects all non-owners (WS close 4003).
 *   Responses are marked `Cache-Control: no-store`.
 *
 * Responsibilities:
 *   - Authenticate the caller via NextAuth (server-side session).
 *   - Resolve ACL and enforce **owner-only** mutations of global sharing.
 *   - Update Firestore public flags and editor list via service helpers.
 *   - Return machine-readable error codes on failure (see ErrorCode enum).
 *
 * 
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { resolveAcl } from '@/app/src/utils/resolveAcl';
import { ErrorCode, statusForError } from '@/app/src/types/errorCodes';
import { setPublicEdit, setPublicView, addEditor } from '@/app/src/services/firebase';

type Body = {
  docId: string;
  accessLevel: 'anyone' | 'readonly' | 'editors';
  publicView?: boolean;      // optional when accessLevel === 'editors'
  editors?: string[];        // optional list to add when accessLevel === 'editors'
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(405).json({ code: ErrorCode.UNAUTHORIZED, message: 'Method not allowed' });
  }

  const session = await authenticateRequest(req, res);
  if (!session) return;

  const { docId, accessLevel, publicView, editors } = (req.body || {}) as Body;
  if (!docId || !accessLevel) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(400).json({ code: ErrorCode.DOC_NOT_FOUND, message: 'Missing docId or accessLevel' });
  }

  try {
    const email = session.user?.email?.toLowerCase() || '';
    const acl = await resolveAcl(docId, email);

    if (!acl.docExists) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(statusForError(ErrorCode.DOC_NOT_FOUND)).json({ code: ErrorCode.DOC_NOT_FOUND });
    }
    if (!acl.isOwner) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(statusForError(ErrorCode.ACL_DENIED_EDIT)).json({ code: ErrorCode.ACL_DENIED_EDIT });
    }

    // Apply access mode
    if (accessLevel === 'anyone') {
      await setPublicEdit(docId, true);
      await setPublicView(docId, true); // edit implies view
    } else if (accessLevel === 'readonly') {
      await setPublicEdit(docId, false);
      await setPublicView(docId, true);
    } else if (accessLevel === 'editors') {
      await setPublicEdit(docId, false);
      if (typeof publicView === 'boolean') {
        await setPublicView(docId, publicView);
      }
      if (Array.isArray(editors)) {
        const toAdd = editors
          .map(e => String(e || '').trim().toLowerCase())
          .filter(Boolean);
        for (const e of toAdd) {
          await addEditor(docId, e);
        }
      }
    }

    res.setHeader('Cache-Control', 'no-store, private, max-age=0');
    return res.status(200).json({
      ok: true,
      applied: { docId, accessLevel, publicView: typeof publicView === 'boolean' ? publicView : undefined, added: editors?.length ?? 0 }
    });
  } catch (err) {
    console.error('[acl/access-level.ts][5001] error', err);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).json({ code: ErrorCode.UNAUTHORIZED, message: 'Internal error' });
  }
}
