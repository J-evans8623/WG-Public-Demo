// services/utils/yIdentity.ts
/**
 * @file services/utils/yIdentity.ts
 * @description
 *   Safe identity reading for Yjs documents. Given raw bytes that encode a Y.Doc update,
 *   this helper constructs a shadow Y.Doc, applies the update, and extracts the canonical
 *   document identifier from metadata. The function never mutates live app state, never
 *   touches global contexts, and returns a conservative `null` on corrupt/legacy data.
 *   Identity extraction prefers `metadata.docFileID` and falls back to `metadata.fileId`.
 *   Logging is concise and focused on decode attempts and results. The function is O(U)
 *   where U is the size of the incoming update; memory is bounded to one transient Y.Doc.
 *
 * Responsibilities:
 *   - Decode bytes into a shadow Y.Doc safely.
 *   - Extract `docFileID | fileId` from metadata map.
 *   - Avoid side effects and return `null` on failure.
 */

import * as Y from 'yjs';

export function readDocIdFromBytes(bytes: Uint8Array): string | null {
  try {
    // services/utils/yIdentity.ts [5301]
    console.log('[yIdentity.ts][5301] attempting shadow decode for identity');
    const shadow = new Y.Doc();
    Y.applyUpdate(shadow, bytes);
    const meta = shadow.getMap('metadata');
    const id =
      (meta.get('docFileID') as string | undefined) ??
      (meta.get('fileId') as string | undefined) ??
      null;
    // services/utils/yIdentity.ts [5302]
    console.log('[yIdentity.ts][5302] decoded identity', { id });
    shadow.destroy();
    return id ?? null;
  } catch (err) {
    // services/utils/yIdentity.ts [5391]
    console.warn('[yIdentity.ts][5391] identity decode failed (non-fatal)', err);
    return null;
  }
}
