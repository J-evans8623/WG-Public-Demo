/**
 * ===============================================================
 * File: pages/api/comments/[commentId].ts
 * ===============================================================
 *
 * Responsibility
 * ---------------------------------------------------------------
 * This file implements the item-level Backend-for-Frontend (BFF)
 * endpoint for the Slide Comment System. Its responsibility is to
 * handle mutations on a single comment identified by `commentId`.
 * Specifically, it supports updating the text of an existing
 * comment and deleting an existing comment from the document-
 * scoped Firestore comment collection.
 *
 * This endpoint exists to preserve the application’s architecture:
 * the frontend must never communicate directly with Firebase, and
 * all persistence work must be mediated by authenticated Next.js
 * API routes. The file therefore performs four core duties:
 *
 * 1. Authenticate the request using authenticateRequest.
 * 2. Validate route parameters and request payload/query data.
 * 3. Delegate all database mutations to the backend Firebase
 *    comment utility layer.
 * 4. Return simple JSON payloads that the frontend can use to
 *    reconcile optimistic update/delete state transitions.
 *
 * This file intentionally contains no Firestore access logic. All
 * reads and writes are delegated to firebaseComments.ts so that
 * path construction, persistence rules, and future comment storage
 * changes remain centralized in one backend service.
 *
 * ===============================================================
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { authenticateRequest } from "@/app/src/auth/authenticateRequest";
import {
  deleteComment,
  updateComment,
} from "@/app/src/services/comments/firebaseComments";
import type { Comment } from "@/app/Library/Definitions/Definitions";

/**
 * ===============================================================
 * Function: sendJson
 * ===============================================================
 *
 * Purpose
 * ---------------------------------------------------------------
 * Sends a JSON response with strict no-store caching headers so
 * comment mutation responses are never cached by intermediaries.
 * This mirrors the style used in other BFF endpoints across the
 * codebase and keeps response formatting consistent.
 *
 * Time Complexity
 * ---------------------------------------------------------------
 * O(1)
 *
 */
function sendJson(res: NextApiResponse, status: number, data: unknown): void {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, private, max-age=0");
  res.status(status).json(data);
}

/**
 * ===============================================================
 * Function: getRouteCommentId
 * ===============================================================
 *
 * Purpose
 * ---------------------------------------------------------------
 * Extracts the dynamic `commentId` route parameter from the Next.js
 * request object and validates that it is a single string value.
 * This function throws a stable validation error so the handler can
 * map it to an HTTP 400 response predictably.
 *
 * Time Complexity
 * ---------------------------------------------------------------
 * O(1)
 *
 */
function getRouteCommentId(req: NextApiRequest): string {
  const routeValue = req.query?.commentId;
  const commentId = Array.isArray(routeValue) ? routeValue[0] : routeValue;

  if (!commentId || typeof commentId !== "string") {
    throw new Error("VALIDATION_ERROR: commentId");
  }

  return commentId;
}

/**
 * ===============================================================
 * Function: getDocIdFromRequest
 * ===============================================================
 *
 * Purpose
 * ---------------------------------------------------------------
 * Extracts and validates `docId` from either the request body
 * (preferred for PUT) or query string (preferred for DELETE).
 * Because comments are stored in a document-scoped collection,
 * docId is required to resolve the Firestore path safely.
 *
 * Time Complexity
 * ---------------------------------------------------------------
 * O(1)
 *
 */
function getDocIdFromRequest(req: NextApiRequest): string {
  const bodyDocId =
    req.body && typeof req.body === "object" ? req.body.docId : undefined;
  const queryDocId = req.query?.docId;
  const normalizedQueryDocId = Array.isArray(queryDocId) ? queryDocId[0] : queryDocId;
  const docId = bodyDocId ?? normalizedQueryDocId;

  if (!docId || typeof docId !== "string") {
    throw new Error("VALIDATION_ERROR: docId");
  }

  return docId;
}

/**
 * ===============================================================
 * Function: getTextFromRequestBody
 * ===============================================================
 *
 * Purpose
 * ---------------------------------------------------------------
 * Extracts and validates the `text` field required by the PUT
 * update flow. This ensures only valid text payloads reach the
 * backend Firebase utility and prevents malformed update requests
 * from silently mutating comment records.
 *
 * Time Complexity
 * ---------------------------------------------------------------
 * O(1)
 *
 */
function getTextFromRequestBody(req: NextApiRequest): string {
  const text = req.body?.text;

  if (!text || typeof text !== "string") {
    throw new Error("VALIDATION_ERROR: text");
  }

  return text;
}

/**
 * ===============================================================
 * Handler: comment item mutations
 * ===============================================================
 *
 * Purpose
 * ---------------------------------------------------------------
 * Handles authenticated item-level comment mutation requests.
 *
 * Supported methods:
 *
 * 1. PUT    — update a comment’s text
 * 2. DELETE — remove a comment
 *
 * The handler validates route and payload/query parameters, then
 * delegates the actual persistence work to firebaseComments.ts.
 *
 * Time Complexity
 * ---------------------------------------------------------------
 * PUT:    O(1)
 * DELETE: O(1)
 *
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  try {
    // Step 1. Authenticate the request before any mutation work.
    const session = await authenticateRequest(req as any, res as any);

    if (!session) {
      return;
    }

    // Step 2. Validate and extract the route-level comment id.
    let commentId = "";
    try {
      commentId = getRouteCommentId(req);
    } catch (error: any) {
      return sendJson(res, 400, { error: error?.message ?? "VALIDATION_ERROR: commentId" });
    }

    // Step 3. Handle update requests.
    if (req.method === "PUT") {
      let docId = "";
      let text = "";

      try {
        docId = getDocIdFromRequest(req);
        text = getTextFromRequestBody(req);
      } catch (error: any) {
        return sendJson(res, 400, { error: error?.message ?? "VALIDATION_ERROR" });
      }

      const updatedComment: Comment | null = await updateComment(docId, commentId, text);

      if (!updatedComment) {
        return sendJson(res, 404, { error: "COMMENT_NOT_FOUND" });
      }

      return sendJson(res, 200, {
        comment: updatedComment,
      });
    }

    // Step 4. Handle delete requests.
    if (req.method === "DELETE") {
      let docId = "";

      try {
        docId = getDocIdFromRequest(req);
      } catch (error: any) {
        return sendJson(res, 400, { error: error?.message ?? "VALIDATION_ERROR: docId" });
      }

      await deleteComment(docId, commentId);

      return sendJson(res, 200, {
        success: true,
        commentId,
      });
    }

    // Step 5. Reject unsupported methods explicitly.
    res.setHeader("Allow", ["PUT", "DELETE"]);
    return sendJson(res, 405, { error: "METHOD_NOT_ALLOWED" });

  } catch (error: any) {
    console.error("comments/[commentId].ts [8501] › handler error", {
      error: error?.message ?? "UNKNOWN_ERROR",
    });

    return sendJson(res, 500, {
      error: "INTERNAL_SERVER_ERROR",
    });
  }
}