/**
 * * @file pages/api/document/acl/editors.ts
 * @description
 *   Editor list management for a document. This BFF route supports:
 *
 *     • GET    → return { owner, editors[] } for a doc (readers allowed; adjust as needed)
 *     • POST   → add one or more editor emails (owners only)
 *     • DELETE → remove one or more editor emails (owners only)
 *
 *   Edits are mirrored to Firestore under:
 *     - documents/{docId}/editors/{email}
 *     - userFiles/{docId}.sharedWith[]
 *   When removing access, the server **publishes targeted revokes** so any live Yjs
 *   sockets for those users are dropped immediately (WS close 4003).
 *   Responses are marked `Cache-Control: no-store`.
 *
 * Responsibilities:
 *   - Authenticate via NextAuth (server-side session).
 *   - Resolve ACL: owners may mutate; others can only GET if they canRead (configurable).
 *   - Add/remove editor entries via service helpers (addEditor/removeEditor/listEditors).
 *   - Publish live revokes on removals for fast enforcement.
 * 
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { resolveAcl } from '@/app/src/utils/resolveAcl';
import { ErrorCode, statusForError } from '@/app/src/types/errorCodes';
import { addEditor, removeEditor, listEditors } from '@/app/src/services/firebase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await authenticateRequest(req, res);
  if (!session) return;

  const docId = (req.method === 'GET' ? req.query.docId : req.body?.docId) as string;
  if (!docId) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(400).json({ code: ErrorCode.DOC_NOT_FOUND, message: 'Missing docId' });
  }

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

  try {
    if (req.method === 'GET') {
      const payload = await listEditors(docId);
      res.setHeader('Cache-Control', 'no-store, private, max-age=0');
      return res.status(200).json(payload);
    }

    if (req.method === 'POST') {
      const emails: string[] = Array.isArray(req.body?.emails) ? req.body.emails : [];
      const normalized = emails.map((e) => String(e || '').trim().toLowerCase()).filter(Boolean);
      for (const e of normalized) await addEditor(docId, e);
      res.setHeader('Cache-Control', 'no-store, private, max-age=0');
      return res.status(200).json({ ok: true, added: normalized.length });
    }

    if (req.method === 'DELETE') {
      const target = String(req.body?.email || '').trim().toLowerCase();
      if (!target) {
        res.setHeader('Cache-Control', 'no-store');
        return res.status(400).json({ code: ErrorCode.UNAUTHORIZED, message: 'Missing email' });
      }
      await removeEditor(docId, target);
      res.setHeader('Cache-Control', 'no-store, private, max-age=0');
      return res.status(200).json({ ok: true, removed: target });
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(405).json({ code: ErrorCode.UNAUTHORIZED, message: 'Method not allowed' });
  } catch (err) {
    console.error('[acl/editors.ts][5002] error', err);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).json({ code: ErrorCode.UNAUTHORIZED, message: 'Internal error' });
  }
}
