// bloom-maps\pages\api\gradebook\route.ts
/***************************************************************************************************
 * @file app/api/gradebook/route.ts
 * @description
 *   Next.js App Router GET endpoint that returns the Gradebook snapshot for a given document. This
 *   route composes three parts: (1) authentication, (2) access control requiring Owner + Educator
 *   for visibility over student results, and (3) aggregation via the Firestore helper
 *   getGradebookSnapshot. The endpoint emits a single concise log indicating docId and result sizes.
 *   It consistently returns JSON with `Cache-Control: no-store` to prevent intermediary caching.
 *   Complexity is O(S + A + E) dominated by Firestore reads inside the helper; HTTP overhead is O(1).
 *
 * Responsibilities:
 *   1) Authenticate the caller and read their account type (educator required).
 *   2) Enforce Owner role on the requested docId using resolveRole.
 *   3) Delegate to getGradebookSnapshot and return the resulting matrix.
 ***************************************************************************************************/

import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { resolveRole } from '@/app/src/services/firebase';
import { getGradebookSnapshot } from '@/app/src/services/gradebook/gradebookFB';

function json(data: unknown, init?: number): NextResponse {
  return new NextResponse(JSON.stringify(data), {
    status: init ?? 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, private, max-age=0',
    },
  });
}

/**
 * GET
 * Returns the gradebook snapshot (students × assignments × latest/highest scores) for the docId.
 * Guards: Owner + Educator. Query param: ?docId=...
 */
export async function GET(req: Request): Promise<NextResponse> {
  try {
    // 1) Auth + profile
    const session = await authenticateRequest({} as any, {} as any);
    if (!session) return json({ error: 'UNAUTHORIZED' }, 401);

    // 2) Extract docId from query
    const url = new URL(req.url);
    const docId = url.searchParams.get('docId') || '';
    if (!docId) return json({ error: 'VALIDATION_ERROR: docId' }, 400);

    // 3) Role + account type checks
    const role = await resolveRole(docId, session.user.email);
    const isEducator = session.user.accountType === 'educator';
    console.log('app/api/gradebook/route.ts [9301] › GET snapshot guard', { docId, role, isEducator });
    if (role !== 'Owner' || !isEducator) {
      return json({ error: 'ACL_DENIED_OWNER_EDUCATOR_REQUIRED' }, 403);
    }

    // 4) Delegate
    const snapshot = await getGradebookSnapshot(docId);
    console.log('app/api/gradebook/route.ts [9302] › GET snapshot ok', {
      docId,
      students: snapshot.students.length,
      assignments: snapshot.assignments.length,
    });

    return json(snapshot, 200);
  } catch (err: any) {
    console.error('app/api/gradebook/route.ts [9399] › GET snapshot error', { err: String(err?.message ?? err) });
    return json({ error: String(err?.message ?? 'INTERNAL') }, 500);
  }
}
