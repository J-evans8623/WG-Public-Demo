/***************************************************************************************
 * @file app/src/infra/revocationBus.ts
 * @description
 *   Lightweight publisher that tells the Yjs server to revoke live collaboration access.
 *   Instead of opening a Redis client from serverless Next.js (which adds cost and cold
 *   starts), we POST to the Yjs container’s `/revoke` endpoint. The Yjs server then
 *   (1) closes local sockets immediately and (2) publishes to Redis (if configured) so
 *   other replicas do the same. This keeps Next.js stateless and cheap.
 *
 *   Required env:
 *     - YJS_REVOKE_URL  (e.g., http://yjs-server:1234 or public URL)
 *     - YJS_REVOKE_KEY  (shared secret; validated by Yjs server)
 *
 *   Use from admin actions after you change ACL in Firestore:
 *     await publishRevokeUser(docId, uid);
 *     await publishRevokeAllNonOwner(docId);
 ***************************************************************************************/

const YJS_REVOKE_URL = process.env.YJS_REVOKE_URL!;
const YJS_REVOKE_KEY = process.env.YJS_REVOKE_KEY!;

/**
 * @function publishRevokeUser
 * @description
 *   Requests the Yjs server to disconnect a specific user from a given document. The
 *   server immediately closes local sockets and (if Redis is configured) fans out the
 *   message to other replicas. This is safe to call from a serverless route handler
 *   right after Firestore ACL writes; no state is kept in Next.js between invocations.
 */
export async function publishRevokeUser(docId: string, uid: string): Promise<void> {
  console.log('[revocationBus.ts][3501] › publishRevokeUser', { docId, uid });
  await callRevoke({ type: 'user', docId, uid });
}

/**
 * @function publishRevokeAllNonOwner
 * @description
 *   Requests the Yjs server to disconnect everyone except owners for a document (used
 *   when publicEdit is turned off or editors are bulk-removed). The Yjs server closes
 *   local sockets and publishes to other replicas if Redis is present.
 */
export async function publishRevokeAllNonOwner(docId: string): Promise<void> {
  console.log('[revocationBus.ts][3502] › publishRevokeAllNonOwner', { docId });
  await callRevoke({ type: 'all_non_owner', docId });
}

async function callRevoke(body: any): Promise<void> {
  if (!YJS_REVOKE_URL || !YJS_REVOKE_KEY) {
    console.warn('[revocationBus.ts][3590] › revoke disabled (missing env)');
    return;
  }
  const resp = await fetch(`${YJS_REVOKE_URL}/revoke`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': YJS_REVOKE_KEY,
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    console.error('[revocationBus.ts][3599] › revoke HTTP error', resp.status, text);
  }
}
