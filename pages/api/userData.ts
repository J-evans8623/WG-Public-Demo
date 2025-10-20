/**********************************************************************************************
 * @file pages/api/userData.ts
 * @responsibility
 *   Per-user × per-doc userdata API.
 *   - GET  /api/userData?docId=...  → idempotent GET-or-CREATE; always 200 with payload
 *   - PUT  /api/userData?docId=...  → upsert whole document for the caller’s userId scope
 *
 *   Storage path: userData/{userId}/docs/{docId}
 *   Auth: authenticateRequest() is authoritative; we trust its userId scoping.
 *
 *   Notes:
 *   - We no longer return 404 for GET: if missing, we create a default record and return it.
 *   - This unifies client boot to “one request after saveReady”.
 **********************************************************************************************/

import type { NextApiRequest, NextApiResponse } from 'next';
import { firestore } from '@/app/src/services/firebase';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { withRateLimitNP } from '@/app/src/services/rate-np/withRateLimitNP';

/** Shape the client expects; keep minimal & backwards-compatible. */
type QuizType = 'matching' | 'multipleChoice' | 'true-false' | 'FIB';

type RevisionMetaData = {
  userId: string;
  quizStats: Record<string, any>;
  flashCardStats: Record<string, any>;
  priority: {
    flashCards: { newItems: string[]; wrongItems: string[] };
    quizzes: Record<QuizType, { newItems: string[]; wrongItems: string[] }>;
  };
  queues: {
    config: {
      flashCardQuotas: { newQuota: number; wrongQuota: number; seenQuota: number };
      quizQuotas: Record<QuizType, { newQuota: number; wrongQuota: number; seenQuota: number }>;
    };
    current: {
      flashCardQueue: any[];
      quizQueue: Record<QuizType, any[]>;
    };
  };
  GlobalQuizAttempts?: number;
  bookmarks?: Array<{
    resourceId: string;
    mapId: string;
    nodeId: string;
    addedAt?: number;
  }>;
  seenRecord?: Record<string, number>;
  /** Optional server-owned version for migrations */
  schemaVersion?: number;
};

/**
 * buildInitialPayload — update - 1
 * @purpose
 *   Produce a stable, server-owned default payload for a fresh user × doc.
 * @steps
 *   1) Fill all keys the app expects with minimal safe defaults.
 *   2) Keep shape backward-compatible so older clients don’t break.
 */
function buildInitialPayload(userId: string): RevisionMetaData {
  const baseQuizBuckets: Record<QuizType, { newItems: string[]; wrongItems: string[] }> = {
    matching: { newItems: [], wrongItems: [] },
    multipleChoice: { newItems: [], wrongItems: [] },
    'true-false': { newItems: [], wrongItems: [] },
    FIB: { newItems: [], wrongItems: [] },
  };

  const quizQuota = { newQuota: 0.25, wrongQuota: 0.25, seenQuota: 0.5 };

  return {
    userId,
    quizStats: {},
    flashCardStats: {},
    priority: {
      flashCards: { newItems: [], wrongItems: [] },
      quizzes: baseQuizBuckets,
    },
    queues: {
      config: {
        flashCardQuotas: { newQuota: 0.3, wrongQuota: 0.4, seenQuota: 0.3 },
        quizQuotas: {
          matching: quizQuota,
          multipleChoice: quizQuota,
          'true-false': quizQuota,
          FIB: quizQuota,
        },
      },
      current: {
        flashCardQueue: [],
        quizQueue: {
          matching: [],
          multipleChoice: [],
          'true-false': [],
          FIB: [],
        },
      },
    },
    GlobalQuizAttempts: 0,
    bookmarks: [],
    seenRecord: {},
    schemaVersion: 1,
  };
}

/**
 * handler 
 * @purpose
 *   Implement GET-or-CREATE and PUT upsert for per-user scoped userdata.
 * @steps
 *   1) Authenticate and resolve { userId, docId }.
 *   2) On GET:
 *      2.1) Attempt read → if exists, return 200.
 *      2.2) If not, atomically create default with a transaction and return 200.
 *   3) On PUT: write passed JSON payload verbatim as the current value.
 *   4) Otherwise 405.
 */
 async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 1) Auth + inputs
  const session = await authenticateRequest(req, res);
  if (!session) return;
  const userId = session.user.email!;

    const docId = String(req.query.docId || '').trim();
    if (!docId) {
      res.status(400).json({ error: 'Missing docId' });
      return;
    }

    const userDocRef = firestore
      .collection('userData')
      .doc(userId)
      .collection('docs')
      .doc(docId);

    if (req.method === 'GET') {
      // 2) GET-or-CREATE
      const snap = await userDocRef.get();
      if (snap.exists) {
        const data = snap.data();
        console.log('[userData][GET] found', { userId, docId, action: 'found' });
        res.status(200).json(data);
        return;
      }

      // 2.2) Create if missing (transaction to be race-safe)
      const payload = buildInitialPayload(userId);
      await firestore.runTransaction(async (tx) => {
        const again = await tx.get(userDocRef);
        if (!again.exists) {
          tx.set(userDocRef, payload, { merge: false });
        }
      });

      console.log('[userData][GET] created default', { userId, docId, action: 'created' });
      const created = await userDocRef.get();
      res.status(200).json(created.data());
      return;
    }

    if (req.method === 'PUT') {
      // 3) Upsert whole document
      const input = req.body ?? {};
      // Safety: ensure userId cannot be spoofed by the client
      const safePayload = { ...(input || {}), userId };
      await userDocRef.set(safePayload, { merge: false });
      console.log('[userData][PUT] upserted', { userId, docId });
      res.status(200).json({ ok: true });
      return;
    }

    // 4) Method not allowed
    res.setHeader('Allow', 'GET, PUT');
    res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err: any) {
    console.error('[userData] error', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export default withRateLimitNP('np:userData')(handler);