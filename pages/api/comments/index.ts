/**
 * ===============================================================
 * File: pages/api/comments/index.ts
 * ===============================================================
 *
 * Responsibility
 * ---------------------------------------------------------------
 * This file implements the Backend-for-Frontend (BFF) endpoint
 * responsible for retrieving and creating slide comments.
 *
 * The endpoint acts as the secure bridge between the frontend
 * React application and the Firebase persistence layer. Its
 * job is not only to validate and delegate requests, but also
 * to ensure that comment hydration remains fresh and accurate
 * across browser reloads, document re-entry, and optimistic UI
 * reconciliation. Because the slideshow comment system depends
 * on an always-fresh document-level fetch, this route must
 * explicitly disable browser and intermediary caching so stale
 * comment payloads are never replayed after a mutation. This is
 * especially important because the frontend reload flow depends
 * on GET /api/comments returning the latest persisted state
 * rather than a cached “not modified” response from an earlier
 * empty fetch. The file therefore centralizes authentication,
 * validation, cache-control policy, response formatting, and
 * delegation to the backend Firebase comment service.
 *
 * Key responsibilities:
 *
 * 1. Verify user authentication using authenticateRequest.
 * 2. Validate incoming API requests.
 * 3. Delegate all database operations to the Firebase utility.
 * 4. Return strongly typed Comment objects to the frontend.
 * 5. Disable caching so comment hydration always reflects the
 *    latest persisted backend state.
 *
 * The endpoint intentionally contains no Firestore logic. All
 * database access is handled by the firebaseComments service.
 *
 * Supported routes:
 *
 * GET    /api/comments?docId={docId}
 * POST   /api/comments
 *
 * These routes enable the React SlideCommentsContext to
 * hydrate document comments and create new comments while
 * preserving the application's BFF architecture.
 *
 * ===============================================================
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import {
  getCommentsByDocument,
  createComment,
} from "@/app/src/services/comments/firebaseComments";
import { Comment } from "@/app/Library/Definitions/Definitions";

// update - 1.1
/**
 * ===============================================================
 * Function: sendJson
 * ===============================================================
 *
 * Purpose
 * ---------------------------------------------------------------
 * Sends a JSON response with explicit no-store caching headers.
 * This is required for the Slide Comment System because the
 * frontend rehydrates comments on document open and must never
 * receive a stale cached payload after a successful create,
 * update, or delete operation. By centralizing response writing
 * here, every success and error branch inherits the same strict
 * cache policy and content-type behavior.
 *
 * Time Complexity
 * ---------------------------------------------------------------
 * O(1)
 *
 */
function sendJson(res: NextApiResponse, status: number, data: unknown): void {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, private, max-age=0, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.status(status).json(data);
}

/**
 * ===============================================================
 * Handler: comments API
 * ===============================================================
 *
 * Purpose
 * ---------------------------------------------------------------
 * Handles fetching all comments for a document and creating
 * new comments associated with a slide.
 *
 * This handler enforces authentication, validates request
 * parameters, delegates persistence operations to the
 * Firebase utility layer, and returns uncached JSON
 * responses so document reloads always reflect the latest
 * persisted backend state.
 *
 * Time Complexity
 * ---------------------------------------------------------------
 * GET request: O(N) where N = number of comments in document.
 * POST request: O(1)
 *
 */

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    /**
     * ------------------------------------------------------------
     * Step 1 — Authenticate request
     * ------------------------------------------------------------
     */

    const session = await authenticateRequest(req, res);

    if (!session) {
      return;
    }

    const userId = session.user.email;

    /**
     * ------------------------------------------------------------
     * Step 2 — Handle GET request (load document comments)
     * ------------------------------------------------------------
     */

    if (req.method === "GET") {
      const { docId } = req.query;

      if (!docId || typeof docId !== "string") {
        return sendJson(res, 400, {
          error: "docId is required",
        });
      }

      const comments: Comment[] = await getCommentsByDocument(docId);

      // update - 1.2
      console.log("comments/index.ts [8401] › GET document comments", {
        docId,
        count: comments.length,
      });

      return sendJson(res, 200, {
        comments,
      });
    }

    /**
     * ------------------------------------------------------------
     * Step 3 — Handle POST request (create comment)
     * ------------------------------------------------------------
     */

    if (req.method === "POST") {
      const { docId, lessonId, slideId, text } = req.body;

      if (!docId || !lessonId || !slideId || !text) {
        return sendJson(res, 400, {
          error: "docId, lessonId, slideId, and text are required",
        });
      }

      const newComment = await createComment({
        docId,
        lessonId,
        slideId,
        userId,
        text,
      });

      // update - 1.3
      console.log("comments/index.ts [8402] › POST create comment", {
        docId,
        lessonId,
        slideId,
        commentId: newComment.id,
        userId,
      });

      return sendJson(res, 200, {
        comment: newComment,
      });
    }

    /**
     * ------------------------------------------------------------
     * Step 4 — Method not allowed
     * ------------------------------------------------------------
     */

    res.setHeader("Allow", ["GET", "POST"]);
    return sendJson(res, 405, {
      error: "Method not allowed",
    });
  } catch (error) {
    // update - 1.4
    console.error("comments/index.ts [8403] › handler error", error);

    return sendJson(res, 500, {
      error: "Internal server error",
    });
  }
}