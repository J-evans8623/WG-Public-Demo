// app/src/services/TextIndexService.ts
/**
 * @file app/src/services/TextIndexService.ts
 * @description
 *   Minimal wrapper around the vector index (Weaviate) that exposes a single public method
 *   `purgeByDocumentId(documentId)` to batch-delete text embeddings associated with a given document.
 *   The service isolates client configuration, transforms provider responses into the stable
 *   `EmbeddingCascadeResult` contract, and converts provider errors into human-readable warnings
 *   without throwing. This keeps the cascade best-effort and prevents the API route from failing
 *   once the critical Firestore/Storage delete is successful. The function is idempotent: re-running
 *   after a successful purge returns a zero `deletedCount`. Time complexity is effectively O(1) from
 *   the caller’s perspective; work is delegated to the index provider’s batch engine.
 *
 * Responsibilities:
 *   1) Hide Weaviate specifics from callers and return a stable shape.
 *   2) Perform a document-scoped batch delete (filter: `document_id == ${docId}`).
 *   3) Normalize remote errors to warnings to keep the cascade non-blocking.
 */

import weaviate from 'weaviate-ts-client';
import type { EmbeddingCascadeResult, DocumentId } from '@/app/src/services/cascadeOps/cascadeTypes';

const client = weaviate.client({
  scheme: process.env.WEAVIATE_SCHEME ?? 'http',
  host: process.env.WEAVIATE_HOST ?? 'localhost:8080',
});

export async function purgeByDocumentId(documentId: DocumentId): Promise<EmbeddingCascadeResult> {
  const warnings: string[] = [];
  let deletedCount = 0;

  try {
    const where = {
      path: ['document_id'],
      operator: 'Equal',
      valueString: documentId,
    };

    // Provider-specific batch delete; shape depends on the server version.
    const res: any = await client.batch
      .objectsBatchDeleter()
      .withClassName('TextChunk')
      .withWhere(where as any)
      .withOutput('verbose')
      .do();

    // Defensive parsing: capture count if exposed, otherwise leave at 0
    // (We favor correctness over optimistic claims.)
    const matchCount =
      res?.results?.matches ??
      res?.results?.successful ??
      res?.results?.modified ??
      0;

    deletedCount = typeof matchCount === 'number' ? matchCount : 0;
  } catch (err: any) {
    warnings.push(`Weaviate purge error: ${err?.message ?? 'unknown error'}`);
  }

  return { deletedCount, warnings };
}
