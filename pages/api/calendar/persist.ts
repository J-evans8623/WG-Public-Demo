/**
 * @file pages/api/calendar/persist.ts
 * @responsibility
 *   Phase 1: convert to a URL-minting surface (no big bodies).
 *   - GET    → { downloadUrl, path }
 *   - POST   → { uploadUrl,  path }
 *   - DELETE → { ok: true }  (server-side delete)
 *   All calendar Storage logic lives in StudyPlanFB.ts.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import {
  generateCalendarDownloadUrl,
  generateCalendarUploadUrl,
  deleteCalendar,
} from '@/app/src/services/studyplanfb/StudyPlanFB';

/**
 * @function handler
 * @description
 *   Mint signed URLs for calendar persistence or delete the blob.
 *   // update - 2
 * @steps
 *   1) Authenticate and derive uid from session (owner-only).
 *   2) GET    → generateCalendarDownloadUrl(uid) → return { downloadUrl, path }.
 *   3) POST   → generateCalendarUploadUrl(uid)  → return { uploadUrl,  path }.
 *   4) DELETE → deleteCalendar(uid)             → return { ok: true }.
 *   5) Else   → 405.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await authenticateRequest(req, res);
  if (!session) return;

  const uid = session.user.email!;
  try {
    if (req.method === 'GET') {
      const out = await generateCalendarDownloadUrl(uid);
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json(out);
    }

    if (req.method === 'POST') {
      const out = await generateCalendarUploadUrl(uid);
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json(out);
    }

    if (req.method === 'DELETE') {
      await deleteCalendar(uid);
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err: any) {
    console.error('[calendar/persist][5001] fatal', { uid, msg: err?.message });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
