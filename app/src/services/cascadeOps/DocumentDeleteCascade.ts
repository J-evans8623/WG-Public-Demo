// app/src/services/cascadeOps/DocumentDeleteCascade.ts
/**
 * @file app/src/services/cascadeOps/DocumentDeleteCascade.ts
 * @description
 *   Orchestrates the non-critical, forward-only cascades that follow a successful owner deletion of a
 *   document’s primary records (Storage binary + Firestore doc tree). This module coordinates the two
 *   subsystems—GridFS (uploads) and Weaviate (embeddings)—in parallel. It uses Promise.allSettled to
 *   guarantee a best-effort completion that never flips the HTTP result after the critical path has
 *   succeeded. The orchestrator returns a `DocumentCascadeSummary` **including the `documentId`** per
 *   our original API contract, consolidates any system-level warnings (timeouts, unexpected errors),
 *   and preserves per-subsystem result shapes (GridFS failures vs. Embedding warnings).
 *
 * Responsibilities:
 *   1) Run GridFS and Weaviate cascades concurrently with optional timeouts.
 *   2) Aggregate into the stable `DocumentCascadeSummary` including `documentId`.
 *   3) Normalize thrown errors into warnings without impacting the route status.
 */

import { deleteAllFileDataForDocument } from './FileUploadCascade';
import { purgeByDocumentId } from '@/app/src/services/TextIndexService';
import type {
  DocumentCascadeSummary,
  GridFSCascadeResult,
  EmbeddingCascadeResult,
  OwnerContext,
  DocumentId,
} from '@/app/src/services/cascadeOps/cascadeTypes';

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then((v) => {
      clearTimeout(id);
      resolve(v);
    }).catch((e) => {
      clearTimeout(id);
      reject(e);
    });
  });
}

/**
 * @function performOwnerCascades
 * @description
 *   Executes both cascades—GridFS and Embeddings—in parallel, converts any thrown exceptions into
 *   warnings, and returns a `DocumentCascadeSummary` that **includes the `documentId`** per the
 *   original API. GridFS results carry a `failures` array (as specified), while the Embedding purge
 *   exposes `warnings`. System-level issues (rejections/timeouts) are appended to the top-level
 *   `warnings` for transparent observability. Idempotent by design; subsequent runs return zeros.
 */
export async function performOwnerCascades(
  documentId: DocumentId,
  owner: OwnerContext,
  opts: { timeoutMs?: number } = {}
): Promise<DocumentCascadeSummary> {
  const timeoutMs = typeof opts.timeoutMs === 'number' ? opts.timeoutMs : 20_000;

  const warnings: string[] = [];
  let gridfs: GridFSCascadeResult = { deletedCount: 0, deletedIds: [], failures: [] };
  let embeddings: EmbeddingCascadeResult = { deletedCount: 0, warnings: [] };

  const gridfsP = withTimeout(
    deleteAllFileDataForDocument(documentId, owner),
    timeoutMs,
    'GridFS cascade'
  );

  const embedP = withTimeout(
    purgeByDocumentId(documentId),
    timeoutMs,
    'Embeddings cascade'
  );

  const [gRes, eRes] = await Promise.allSettled([gridfsP, embedP]);

  if (gRes.status === 'fulfilled') {
    gridfs = gRes.value;
  } else {
    warnings.push(`GridFS cascade error: ${gRes.reason instanceof Error ? gRes.reason.message : String(gRes.reason)}`);
  }

  if (eRes.status === 'fulfilled') {
    embeddings = eRes.value;
  } else {
    warnings.push(`Embeddings cascade error: ${eRes.reason instanceof Error ? eRes.reason.message : String(eRes.reason)}`);
  }

  return {
    documentId,
    gridfs,
    embeddings,
    warnings,
  };
}
