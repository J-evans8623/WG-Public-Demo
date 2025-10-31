// app/src/services/cascadeOps/cascadeTypes.ts
/**
 * @file app/src/services/cascadeOps/cascadeTypes.ts
 * @description
 *   Centralized type definitions that describe the structure of “forward-only cascading deletes” for
 *   documents. These types are shared by the storage cleanup utilities (GridFS uploads), the vector
 *   index purge utility (Weaviate embeddings), and the cascade orchestrator that collects results
 *   into a single response. By consolidating the shapes here we ensure that every participant in the
 *   cascade speaks the same contract and we avoid circular imports or ad-hoc result objects spread
 *   across the codebase. The types model success counts, explicit deleted identifiers (when
 *   available), non-fatal failures, and high-level summaries suitable for API responses. This file
 *   is intentionally small, dependency-free, and safe to import from both server routes and service
 *   modules without runtime side effects. All operations described by these types should be idempotent
 *   and optimized for O(N) throughput over matched resources while maintaining O(1) metadata overhead.
 *
 * Responsibilities:
 *   1) Provide a stable contract for per-subsystem cascade results (uploads and embeddings).
 *   2) Provide the top-level summary type used by the orchestration layer and API routes.
 *   3) Keep domain-specific details out of API handlers to simplify testing and maintenance.
 */

// update - 1: Restore the exact primitive aliases used in the agreed contract
export type OwnerEmail = string;  // update - 2
export type DocumentId = string;  // update - 3

/**
 * @interface GridFSCascadeResult
 * @description
 *   Result of deleting all GridFS-managed uploads for a given document. Includes explicit IDs of
 *   deleted files (useful for audit), a count, and a list of non-fatal failure messages. Designed
 *   to be idempotent: a second run after successful deletion should return zero matches.
 *   The failures array preserves visibility into file-level errors without failing the HTTP request.
 */
export interface GridFSCascadeResult { // update - 4
  deletedCount: number;               // update - 5
  deletedIds: string[];               // update - 6
  failures: string[];                 // update - 7
}

/**
 * @interface EmbeddingCascadeResult
 * @description
 *   Result of purging embeddings from the vector index (Weaviate) for a given document. For some
 *   providers, only counts are available; we therefore only expose totals and warnings. This is
 *   similarly idempotent: subsequent calls should produce a deletedCount of zero.
 */
export interface EmbeddingCascadeResult { // update - 8 (singular name restored)
  deletedCount: number;                   // update - 9
  warnings: string[];                     // update - 10
}

/**
 * @interface DocumentCascadeSummary
 * @description
 *   Aggregated summary produced by the cascade orchestrator. It combines the GridFS and Embedding
 *   results and normalizes system-level warnings (timeouts, partial failures). This object is safe
 *   to return in API responses. It is intentionally narrow and human-readable for observability.
 */
export interface DocumentCascadeSummary { // update - 11 (re-add documentId)
  documentId: DocumentId;                 // update - 12
  gridfs: GridFSCascadeResult;            // update - 13
  embeddings: EmbeddingCascadeResult;     // update - 14
  warnings: string[];                     // update - 15
}

/**
 * @interface OwnerContext
 * @description
 *   Minimal identity context used by the GridFS cascade to enforce a defensive ownership check
 *   prior to deletion. This is **additive** (not part of the original contract) and does not break
 *   existing imports; consumers may ignore it. Only the email is required here to avoid coupling.
 */
export interface OwnerContext {           // update - 16 (purely additive)
  email: OwnerEmail;
}
