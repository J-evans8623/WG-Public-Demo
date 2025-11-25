/**
 * @file CommentDefinitions.ts
 * @description
 * This file defines the TypeScript interfaces and helper functions for representing comments
 * and replies in our Yjs-based CRDT. It exports `Comment` and `Reply` interfaces, which model
 * the essential fields (id, authorUID, body, ts, and for replies a replyTo). To bridge between
 * plain JS objects and Yjs, it provides `makeCommentMap` for constructing a `Y.Map` from a
 * `Comment` (initializing nested replies as a `Y.Array<Y.Map>`) and `mapToComment` for reading
 * a `Y.Map` back into a `Comment`. These serializers ensure all comment state remains inside
 * the shared `Y.Doc` under the top-level “comments” map.  
 *  
 * Responsibilities:
 * - Define the schema for comment CRDT state inside Y.Doc.  
 * - Provide serialization (`makeCommentMap`) and deserialization (`mapToComment`) utilities  
 *   so that higher-level code can treat comments as plain objects while storing them as CRDT maps.
 * - Ensure nested replies are preserved as CRDT arrays of maps, allowing threaded discussions  
 *   to merge safely offline-first and sync in real time.
 */

import * as Y from 'yjs';

/**
 * Represents a top-level comment in a concept.  
 * - `id`: unique UUID for this comment.  
 * - `authorUID`: user ID of the creator.  
 * - `body`: the comment text.  
 * - `ts`: timestamp (ms since epoch).  
 * - `replies`: optional CRDT array for nested replies.
 */
export interface Comment {
  id: string;
  authorUID: string;
  body: string;
  ts: number;
  replies?: Y.Array<Y.Map<any>>;
}

/**
 * Represents a reply to another comment.  
 * Inherits all Comment fields and adds `replyTo` to denote the parent comment’s id.
 */
export interface Reply extends Comment {
  replyTo: string;
}

/**
 * @function makeCommentMap
 * @description
 * Creates a Y.Map representation of a Comment object by writing all its fields into a CRDT map,
 * including initializing a nested Y.Array for replies. If `comment.replies` already contains
 * Y.Maps, it appends them; otherwise it creates an empty array. This map can then be pushed
 * into the shared `comments.get(conceptID)` Y.Array.
 *
 * @param comment - Plain JS Comment object to serialize.
 * @returns A Y.Map<any> containing all comment fields plus a CRDT `replies` array.
 */
export function makeCommentMap(comment: Comment): Y.Map<any> {
  const map = new Y.Map<any>();
  map.set('id', comment.id);
  map.set('authorUID', comment.authorUID);
  map.set('body', comment.body);
  map.set('ts', comment.ts);
  const repliesArray = new Y.Array<Y.Map<any>>();
  if (comment.replies) {
    (comment.replies as Y.Array<Y.Map<any>>).forEach(r => repliesArray.push([r]));
  }
  map.set('replies', repliesArray);
  return map;
}

/**
 * @function mapToComment
 * @description
 * Reads a Y.Map (stored in the comments CRDT) and reconstructs a plain JS Comment object,
 * extracting primitive fields and returning the raw `replies` array for downstream rendering.
 *
 * @param yMap - The Y.Map that was previously created via `makeCommentMap`.
 * @returns A Comment object with id, authorUID, body, ts, and replies array.
 */
export function mapToComment(yMap: Y.Map<any>): Comment {
  const comment: Comment = {
    id: yMap.get('id'),
    authorUID: yMap.get('authorUID'),
    body: yMap.get('body'),
    ts: yMap.get('ts'),
    replies: yMap.get('replies'),
  };
  return comment;
}
