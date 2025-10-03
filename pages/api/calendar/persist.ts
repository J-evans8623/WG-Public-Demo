/**
 * @file pages/api/calendar/persist.ts
 * @responsibility
 *   Auth-protected REST endpoint (GET/POST/DELETE) that persists **only**:
 *     - studyPlan (new StudyPlanService output, incl. state)
 *     - selectedNotebooks (string[])
 *     - completedSessions (string[])
 *   Excludes legacy plan/index and scheduleConfig. Delegates storage to StudyPlanFB.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import type { StudyPlanOutput } from '@/app/studygraph/(studygraph)/components/layout/Calendar/study-planner';
import { storeStudyPlan, loadStudyPlan, clearStudyPlan  } from '@/app/src/services/studyplanfb/StudyPlanFB';

/**
 * @function handler
 * @description
 *   Dispatches GET/POST/DELETE for the new calendar persistence surface.
 *   Update - 1
 * @steps
 *   1) Authenticate via `authenticateRequest`.
 *   2) GET    → loadStudyPlan(uid) and return JSON (Dates pre-serialized in adapter).
 *   3) POST   → validate minimal payload, then storeStudyPlan(uid, payload).
 *   4) DELETE → clearStudyPlan(uid).
 *   5) On error → structured 500 with concise 4-digit code.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await authenticateRequest(req, res);
  if (!session) return; // authenticateRequest already handled response

  const uid = session.user.email!;
  try {
    if (req.method === 'GET') {
      const data = await loadStudyPlan(uid);
      // Adapter returns runtime Dates; we can safely JSON.stringify them — clients treat as strings.
      return res.status(200).json({
        studyPlan: data.studyPlan,
        selectedNotebooks: data.selectedNotebooks,
        completedSessions: data.completedSessions,
      });
    }

    if (req.method === 'POST') {
      const body = req.body ?? {};
      // Minimal defensive validation (runtime-check shape without deep cost)
      const hasPlan =
        body &&
        body.studyPlan &&
        Array.isArray(body.studyPlan.sessions) &&
        body.studyPlan.planMetadata &&
        body.studyPlan.state;

      if (!hasPlan) {
        console.log('[PRST 2001] invalid_payload');
        return res.status(400).json({ error: 'Invalid studyPlan payload' });
      }

      // Narrowed types for storage
      const payload: {
        studyPlan: StudyPlanOutput;
        selectedNotebooks: string[];
        completedSessions: string[];
      } = {
        studyPlan: body.studyPlan,
        selectedNotebooks: Array.isArray(body.selectedNotebooks) ? body.selectedNotebooks : [],
        completedSessions: Array.isArray(body.completedSessions) ? body.completedSessions : [],
      };

      await storeStudyPlan(uid, payload);
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      await clearStudyPlan(uid);
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err: any) {
    console.error('[PRST 5001] unhandled_error', { message: err?.message });
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
