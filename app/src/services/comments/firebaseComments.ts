/**
 * ================================================================
 * File: firebaseComments.ts
 * ================================================================
 *
 * Responsibility
 * --------------
 * This file encapsulates all Firebase Firestore operations related
 * to the Slide Comment System. The goal of this module is to
 * centralize database access so that:
 *
 * 1. Firebase credentials remain isolated to the backend layer.
 * 2. API routes do not directly contain Firestore logic.
 * 3. Database operations remain reusable and easy to test.
 * 4. Future comment features (threads, reactions, collaborative
 *    editing) can extend this file without modifying API routes.
 *
 * The functions in this module follow a document-scoped strategy.
 * Every comment belongs to a document (`docId`) and is stored
 * under the Firestore collection:
 *
 *      documents/{docId}/comments/{commentId}
 *
 * This ensures efficient lookups when loading comments for an
 * entire document while keeping comment storage logically grouped
 * with the parent document.
 *
 * All methods return canonical `Comment` objects defined in the
 * shared Definitions file so frontend code remains type-safe.
 *
 * ================================================================
 */

import { firestore } from '@/app/src/services/firebase';
import { Comment } from "@/app/Library/Definitions/Definitions";

const COLLECTION = "comments";

/**
 * ================================================================
 * Function: getCommentsByDocument
 * ================================================================
 *
 * Purpose
 * -------
 * Retrieves every comment associated with a given document.
 *
 * This method is used during the initial hydration step of the
 * SlideCommentsContext. All comments are returned in a flat list
 * so the frontend can index them by `slideId`.
 *
 * Time Complexity
 * ---------------
 * O(N) where N = number of comments within the document.
 *
 */
export async function getCommentsByDocument(docId: string): Promise<Comment[]> {

  const snapshot = await firestore
    .collection("documents")
    .doc(docId)
    .collection(COLLECTION)
    .get();

  return snapshot.docs.map((doc) => doc.data() as Comment);
}

/**
 * ================================================================
 * Function: createComment
 * ================================================================
 *
 * Purpose
 * -------
 * Creates a new comment under a document.
 *
 * Firestore generates the comment id and timestamps are stamped
 * server-side to ensure consistent ordering.
 *
 */
export async function createComment(input: {
  docId: string;
  lessonId: string;
  slideId: string;
  userId: string;
  text: string;
}): Promise<Comment> {

  const now = new Date().toISOString();

  const ref = firestore
    .collection("documents")
    .doc(input.docId)
    .collection(COLLECTION)
    .doc();

  const comment: Comment = {
    id: ref.id,
    docId: input.docId,
    lessonId: input.lessonId,
    slideId: input.slideId,
    userId: input.userId,
    text: input.text,
    createdAt: now,
    updatedAt: now,
  };

  await ref.set(comment);

  return comment;
}

/**
 * ================================================================
 * Function: updateComment
 * ================================================================
 *
 * Purpose
 * -------
 * Updates the text content of a comment and refreshes the updatedAt
 * timestamp. This method intentionally updates only the fields that
 * change rather than writing the entire comment object. This avoids
 * Firestore type constraints associated with update() requiring a
 * field map rather than a strongly typed object.
 *
 * Time Complexity
 * ---------------
 * O(1) — direct document lookup by id.
 *
 */

export async function updateComment(
  docId: string,
  commentId: string,
  text: string
): Promise<Comment | null> {

  const ref = firestore
    .collection("documents")
    .doc(docId)
    .collection(COLLECTION)
    .doc(commentId);

  const snapshot = await ref.get();

  if (!snapshot.exists) {
    return null;
  }

  const existing = snapshot.data() as Comment;

  const updatedAt = new Date().toISOString();

  await ref.update({
    text: text,
    updatedAt: updatedAt
  });

  return {
    ...existing,
    text,
    updatedAt
  };
}

/**
 * ================================================================
 * Function: deleteComment
 * ================================================================
 *
 * Purpose
 * -------
 * Permanently deletes a comment from the document collection.
 *
 */
export async function deleteComment(
  docId: string,
  commentId: string
): Promise<boolean> {

  const ref = firestore
    .collection("documents")
    .doc(docId)
    .collection(COLLECTION)
    .doc(commentId);

  await ref.delete();

  return true;
}