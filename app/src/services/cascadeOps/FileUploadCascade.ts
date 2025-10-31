// app/src/services/uploads/FileUploadCascade.ts
/**
 * @file app/src/services/uploads/FileUploadCascade.ts
 * @description
 *   Deletes all GridFS-managed uploads that belong to a specific document. This utility provides a
 *   single public function `deleteAllFileDataForDocument(documentId, owner)` and hides Mongo/GridFS
 *   specifics from callers. It enforces a defensive ownership guard by verifying the stored file
 *   metadata’s `owner` matches the provided owner email before deletion. The function returns a
 *   `GridFSCascadeResult` containing a deletion count, concrete deleted IDs for auditability, and a
 *   collection of non-fatal failure messages for traceability. All operations are idempotent; running
 *   the cascade on an already-clean document produces zero matches. Time complexity is O(N) where N
 *   is the number of matched files; lookups use an indexed metadata field for O(1) targeting.
 *
 * Responsibilities:
 *   1) Locate files by `metadata.document_id` with a precise indexable filter.
 *   2) Validate ownership prior to deletion for each matched file.
 *   3) Delete matched files and aggregate results/failures for observability.
 */

import mongoose from 'mongoose';
import { GridFSBucket } from 'mongodb';
import connectDB from '@/app/src/config/db';
import type { GridFSCascadeResult, OwnerContext, DocumentId } from '@/app/src/services/cascadeOps/cascadeTypes';

async function getBucket(): Promise<GridFSBucket> {
  await connectDB();
  const db = mongoose.connection.db;
  if (!db) throw new Error('GridFS not available: missing DB connection');
  return new mongoose.mongo.GridFSBucket(db, { bucketName: 'files' });
}

/**
 * @function deleteAllFileDataForDocument
 * @description
 *   Finds all GridFS files tagged with `metadata.document_id === documentId`, verifies each file’s
 *   `metadata.owner` matches the provided `owner.email`, and deletes them from the bucket. Any file-level
 *   issues (owner mismatch, missing metadata, delete failure) are collected into `failures` rather than
 *   throwing, keeping the cascade best-effort and non-blocking for the caller’s HTTP lifecycle.
 *   Returns a `GridFSCascadeResult` and is idempotent by design.
 */
export async function deleteAllFileDataForDocument(
  documentId: DocumentId,
  owner: OwnerContext
): Promise<GridFSCascadeResult> {
  const bucket = await getBucket();

  const cursor = bucket.find({ 'metadata.document_id': documentId });
  const deletedIds: string[] = [];
  const failures: string[] = [];

  // 1) Iterate matches O(N) and delete one-by-one to preserve partial results
  // 2) Enforce defensive ownership match at point of deletion
  // 3) Collect failures without throwing
  for await (const file of cursor as any as AsyncIterable<any>) {
    try {
      const fileId = String(file._id);
      const meta = file?.metadata ?? {};
      const fileOwner = meta.owner;

      if (!fileOwner || fileOwner !== owner.email) {
        failures.push(`Owner mismatch or missing owner for file ${fileId}`);
        continue;
      }

      await bucket.delete(file._id);
      deletedIds.push(fileId);
    } catch (err: any) {
      failures.push(`Delete failed for ${String(file?._id)}: ${err?.message ?? 'unknown error'}`);
    }
  }

  return {
    deletedCount: deletedIds.length,
    deletedIds,
    failures,
  };
}
