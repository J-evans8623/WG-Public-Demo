/**
 * @file app/src/services/uploads/FileUploadCascade.ts
 * @description
 * R2-backed document upload cascade utility that deletes all Cloudflare R2 objects associated
 * with a specific document.
 *
 * * UPDATE (Phase 3):
 * - Switched scanning strategy from Owner-Centric (`files/{email}/`) to Document-Centric (`documents/{docId}/`).
 * - This ensures that ALL assets (files and images) associated with the document are deleted,
 * regardless of who uploaded them.
 * - Removed expensive HEAD metadata checks; strictly deletes by path prefix.
 *
 * Responsibilities:
 * 1) Initialize and reuse a Cloudflare R2 S3 client.
 * 2) Enumerate all R2 objects under `documents/{docId}/`.
 * 3) Delete all found objects efficiently.
 * 4) Preserve the legacy `GridFSCascadeResult` API contract for the orchestrator.
 */

import {
  S3Client,
  ListObjectsV2Command,
  ListObjectsV2CommandInput, // update - 1
  ListObjectsV2CommandOutput, // update - 2
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import type {
  GridFSCascadeResult,
  OwnerContext,
  DocumentId,
} from '@/app/src/services/cascadeOps/cascadeTypes';

// Step 1: Maintain a lazily initialized, shared R2 client and bucket for all cascade calls.
let r2Client: S3Client | null = null;
let r2BucketName: string | null = null;

/**
 * @function getR2Client
 * @description
 * Lazily initializes and returns a Cloudflare R2 S3 client and bucket name using environment
 * configuration. This helper centralizes connectivity details for this module so that all
 * list/delete operations reuse the same underlying client.
 */
function getR2Client(): { client: S3Client; bucket: string } {
  if (!r2Client) {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucket = process.env.R2_BUCKET;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
      console.error(
        '[FileUploadCascade.ts][3100] Missing R2 configuration: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, or R2_BUCKET not set'
      );
      throw new Error(
        'R2 storage is not configured correctly. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET.'
      );
    }

    r2BucketName = bucket;

    r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    console.log('[FileUploadCascade.ts][3101] R2 client initialized successfully for cascade deletes');
  }

  if (!r2BucketName) {
    throw new Error('[FileUploadCascade.ts][3102] R2 bucket name not initialized');
  }

  return { client: r2Client, bucket: r2BucketName };
}

/**
 * @function deleteAllFileDataForDocument
 * @description
 * Deletes all uploaded files and images in Cloudflare R2 that belong to a specific document.
 *
 * * UPDATE (Phase 3):
 * Scans the prefix `documents/{documentId}/`. This captures:
 * 1. `documents/{documentId}/files/...` (PDFs, DOCX)
 * 2. `documents/{documentId}/images/...` (Inline images)
 *
 * Since the prefix is strictly scoped to this document, we no longer need to filter by metadata owner.
 * Any object found under this path is considered part of the document and is deleted.
 *
 * @param documentId - The ID of the document being deleted.
 * @param owner - (Legacy/Logging) The owner context, used here only for audit logging.
 */
export async function deleteAllFileDataForDocument(
  documentId: DocumentId,
  owner: OwnerContext
): Promise<GridFSCascadeResult> {
  const targetDocumentId = String(documentId);

  console.log('[FileUploadCascade.ts][3200] Starting Doc-Scoped cascade delete', {
    documentId: targetDocumentId,
    triggeredBy: owner.email,
  });

  const { client, bucket } = getR2Client();

  // update - 3: Switch prefix from `files/{email}/` to `documents/{docId}/`
  // This targets the root folder for this specific document.
  const docScopedPrefix = `documents/${targetDocumentId}/`;

  const deletedIds: string[] = [];
  const failures: string[] = [];
  let continuationToken: string | undefined = undefined;

  // Step 3: Paginate through all objects under the document prefix using ListObjectsV2.
  do {
    try {
      const listCommandInput: ListObjectsV2CommandInput = {
        Bucket: bucket,
        Prefix: docScopedPrefix,
        ContinuationToken: continuationToken,
      };

      const listCommand: ListObjectsV2Command = new ListObjectsV2Command(listCommandInput);
      const listResult: ListObjectsV2CommandOutput = await client.send(listCommand);

      const contents = listResult.Contents ?? [];
      
      console.log('[FileUploadCascade.ts][3201] R2 list page retrieved', {
        prefix: docScopedPrefix,
        itemCount: contents.length,
        isTruncated: listResult.IsTruncated,
      });

      // Step 4: Iterate over listed objects and delete them immediately.
      // update - 4: Removed HEAD/Metadata check loop. Everything under this prefix must die.
      for (const obj of contents) {
        const key = obj.Key;
        if (!key) continue;

        try {
          // Execute DeleteObject
          await client.send(
            new DeleteObjectCommand({
              Bucket: bucket,
              Key: key,
            })
          );

          deletedIds.push(key);
          // console.log('[FileUploadCascade.ts][3203] Deleted R2 object', { key }); // Optional verbose logging

        } catch (objError: any) {
          const msg = `Delete failed for key ${key}: ${
            objError?.message ?? 'unknown error'
          }`;
          console.error('[FileUploadCascade.ts][3204]', msg, objError);
          failures.push(msg);
        }
      }

      continuationToken = listResult.IsTruncated ? listResult.NextContinuationToken : undefined;

    } catch (pageError: any) {
      const msg = `ListObjectsV2 failed for prefix ${docScopedPrefix}: ${
        pageError?.message ?? 'unknown list error'
      }`;
      console.error('[FileUploadCascade.ts][3205]', msg, pageError);
      failures.push(msg);
      // If listing fails entirely, break to avoid infinite loop.
      break;
    }
  } while (continuationToken);

  const result: GridFSCascadeResult = {
    deletedCount: deletedIds.length,
    deletedIds,
    failures,
  };

  console.log('[FileUploadCascade.ts][3206] Doc-Scoped cascade delete complete', {
    documentId: targetDocumentId,
    deletedCount: result.deletedCount,
    failureCount: result.failures.length,
  });

  return result;
}