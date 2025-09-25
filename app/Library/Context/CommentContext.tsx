/**
 * @file CommentsContext.tsx
 * @description
 * This context provides a slide-scoped discussion service backed by a single Yjs CRDT map `"posts"`.
 * It defines two interfaces—`Comment` and `Post`—where `Post` extends `Comment` to include metadata
 * about the lesson, subtopic, and a master `resourceId` under which the entire thread is stored.
 * All posts are persisted in the Y.Doc under a top-level `Y.Map<string, Y.Map>` keyed by `resourceId`,
 * and each post contains a `Y.Array<Y.Map>` of reply `Comment` maps. This flat structure supports
 * straightforward CRUD operations for posts and comments without nested threads, aligning with our
 * one-dimensional discussion model. The provider syncs all Yjs updates into local React state,
 * exposing methods to create posts, add comments, delete posts, and compute counts. Purposeful
 * console logs (4-digit codes) are sprinkled at key checkpoints for online observability.
 *
 * Responsibilities:
 * - Initialize/access the top-level Y.Map("posts") from Y.Doc.
 * - Maintain `postsByResource: Map<string, Post>` in React state, synchronized via `observeDeep`.
 * - Expose `addPost`, `addComment`, `deletePost`, and `getCommentCount` methods.
 * - Serialize/deserialize between plain JS objects and Yjs CRDT maps.
 * - Log successes/failures with file-scoped codes for debugging.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import * as Y from 'yjs';
import { v4 as uuidv4 } from 'uuid';
import { useYDoc } from './YDocContext';
import { useSession } from "next-auth/react";
import { useUserData } from '@/app/Library/Context/UserDataContext';
import { computeUnseen, isDirty } from '../utils/notifications/NotificationUtils';
import { LOCAL_ORIGIN } from '../Definitions/Definitions';


///////////////////////
// Type Definitions //
///////////////////////

/**
 * Represents a single comment within a post discussion.
 * - `id`: Unique UUID identifying this comment.
 * - `authorUID`: User ID of the comment author.
 * - `body`: Text content of the comment.
 * - `ts`: Timestamp (ms since epoch) of comment creation.
 */
export interface Comment {
  id: string;
  authorUID: string;
  body: string;
  ts: number;
}

/**
 * Represents a top-level discussion thread ("post").
 * Extends `Comment` to include:
 * - Lesson and subtopic metadata (`lessonTitle`, `lessonTitleId`, `subtopicTitle`).
 * - `resourceId`: Master key associating this discussion with a resource card.
 * - `replies`: Flat array of all `Comment`s made in response to this post.
 */
export interface Post extends Comment {
  lessonTitle: string;
  lessonTitleId: string;
  subtopicTitle: string;
  postTitle:string;
  resourceId: string;
  id: string;
  replies: Comment[];
}

//////////////////////////////
// Context Value Interface //
//////////////////////////////

interface CommentsContextType {
  /**
   * Map from `resourceId` → `Post` object.
   */
  posts: Map<string, Post>;

  /**
   * Create a new discussion post under the given resource.
   */
  addPost(data: {
    lessonTitle: string;
    lessonTitleId: string;
    subtopicTitle: string;
    body: string;
    postTitle:string,
    resourceId: string;
  }): void;

  /**
   * Append a comment to an existing post by its `resourceId`.
   */
  addComment(resourceId: string, body: string): void;

  /**
   * Remove an entire post (and its comments) by `resourceId`.
   */
  deletePost(resourceId: string): void;
  getCommentCount(resourceId: string): number;
  openForum(): void;
  closeForum(): void;
  isForumOpen: boolean;
  isComposerOpen:boolean;
  activeConcept:string|null;
  getPostItemCount(postId: string): number;  
  getUnseenCount(postId: string): number;    
  // Actions
  markThreadViewed(postId: string): void;    
  // Aggregates
  getDirtyThreadTotal(): number;             
  
}

const CommentsContext = createContext<CommentsContextType | undefined>(undefined);

////////////////////////////////////
// Provider Implementation       //
////////////////////////////////////

export const CommentsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { ydoc } = useYDoc();
   const { data: session } = useSession();
  const authorUID = session?.user.name ?? 'unknown';



  // Top-level Yjs map: resourceId → Y.Map<any> (post)
  const postsRoot = ydoc.getMap<Post>('posts');

  const [posts, setPostsState] = useState<Map<string, Post>>(new Map());

    // UI-state for inline composer & full-screen forum
  const [isComposerOpen, setComposerOpen] = useState(false);
  const [isForumOpen, setForumOpen] = useState(false);
  const [activeConcept, setActiveConcept] = useState<string | null>(null);
  const { getSeenCount, markThreadSeen, clearSeenForDeleted} = useUserData();


  useEffect(() => {
  const load = () => {
    // exactly like NodesProvider:
    setPostsState(new Map(postsRoot.entries()))
  }
  load()
  const onUpdate = (_: Y.YEvent<any>[]) => {
    load()
  }
  postsRoot.observeDeep(onUpdate)
  return () => postsRoot.unobserveDeep(onUpdate)
}, [postsRoot])



  /**
   * @function addPost
   * @description
   * Creates a new `Post` CRDT under `postsRoot` keyed by `resourceId`.
   * Generates unique id and timestamp, initializes an empty replies array,
   * and writes all metadata fields in one Yjs transaction.
   */
const addPost = useCallback(
  ({
    lessonTitle,
    lessonTitleId,
    subtopicTitle,
    postTitle,
    body,
    resourceId,
  }: {
    lessonTitle: string
    lessonTitleId: string
    subtopicTitle: string
    postTitle:string
    body: string
    resourceId: string
  }) => {
    if (postsRoot.has(resourceId)) return
    const newPost: Post = {
      id: uuidv4(),
      authorUID,
      body,
      ts: Date.now(),
      lessonTitle,
      lessonTitleId,
      subtopicTitle,
      resourceId,
      postTitle,
      replies: [],
    }
    ydoc.transact(() => {
      postsRoot.set(newPost.id, newPost)
      console.log(`CommentsContext › addPost ${newPost.id}`)
    }, LOCAL_ORIGIN)
  },
  [ydoc, postsRoot, authorUID]
)

  /**
   * @function addComment
   * @description
   * Appends a flat `Comment` to the `replies` array of the post keyed by `resourceId`.
   * Generates a unique id and timestamp, wrapped in a single Yjs transaction.
   */
const addComment = useCallback(
  (postId: string, body: string) => {
    const post = postsRoot.get(postId)
    if (!post) return
    const newComment: Comment = {
      id: uuidv4(),
      authorUID,
      body,
      ts: Date.now(),
    }
    const updated: Post = {
      ...post,
      replies: [...post.replies, newComment],
    }
    ydoc.transact(() => {
      postsRoot.set(postId, updated)
      console.log(`CommentsContext › addComment ${newComment.id}`)
    }, LOCAL_ORIGIN)
  },
  [ydoc, postsRoot, authorUID]
)

  /**
   * @function deletePost
   * @description
   * Removes the entire `Post` entry (and its comments) from `postsRoot` by `resourceId`
   * in a Yjs transaction. Logs the deletion event.
   */
const deletePost = useCallback(
    (postId: string) => {
      if (!postsRoot.has(postId)) return;
      ydoc.transact(() => postsRoot.delete(postId), LOCAL_ORIGIN);
      clearSeenForDeleted(postId); // update - 4
      console.log(`CommentsContext › deletePost ${postId}`);
    },
    [ydoc, postsRoot, clearSeenForDeleted]
  );
  /**
   * @function getCommentCount
   * @description
   * Returns the number of replies on the post keyed by `resourceId`, or zero if none.
   */
const getCommentCount = useCallback(
  (postId: string) => posts.get(postId)?.replies.length ?? 0,
  [posts]
)



 /**
   * @function getPostItemCount
   * @purpose
   *  Return the canonical "size" of a thread (post itself + replies).
   *  Steps:
   *   1) Look up post in local map.
   *   2) If missing, return 0 (defensive).
   *   3) Otherwise return 1 + number of replies.
   */
  const getPostItemCount = useCallback((postId: string): number => {
    // Step 1
    const p = posts.get(postId);
    // Step 2
    if (!p) return 0;
    // Step 3
    return 1 + (p.replies?.length ?? 0);
  }, [posts]);




  /**
   * @function getUnseenCount
   * @purpose
   *  O(1) computation of unseen items for a thread.
   *  Steps:
   *   1) Read currentCount via getPostItemCount.
   *   2) Read seenCount from UserDataContext.
   *   3) Return computeUnseen(currentCount, seenCount).
   */
  const getUnseenCount = useCallback((postId: string): number => {
    // Step 1
    const current = getPostItemCount(postId);
    // Step 2
    const seen = getSeenCount(postId);
    // Step 3
    return computeUnseen(current, seen);
  }, [getPostItemCount, getSeenCount]);



/**
   * @function markThreadViewed
   * @purpose
   *  Mark everything currently in the thread as seen.
   *  Steps:
   *   1) Compute current size with getPostItemCount.
   *   2) Persist seenCount via markThreadSeen(postId, size).
   */
  const markThreadViewed = useCallback((postId: string) => {
    // Step 1
    const size = getPostItemCount(postId);
    // Step 2
    if (size > 0) markThreadSeen(postId, size);
  }, [getPostItemCount, markThreadSeen]);



  /**
   * @function getDirtyThreadTotal
   * @purpose
   *  Count how many threads have unseen > 0 (for the header badge).
   *  Steps:
   *   1) Iterate visible posts.
   *   2) Compute unseen per post via getUnseenCount.
   *   3) Count those with isDirty(unseen).
   */
  const getDirtyThreadTotal = useCallback((): number => {
    // Step 1
    let total = 0;
    for (const [postId] of posts.entries()) {
      // Step 2
      const unseen = getUnseenCount(postId);
      // Step 3
      if (isDirty(unseen)) total++;
    }
    return total;
  }, [posts, getUnseenCount]); 
  


  // ── UI Controls ───────────────────────────────────────────────────────────────


  const openForum = useCallback(() => {
    setForumOpen(true);
  }, []);

  const closeForum = useCallback(() => {
    setForumOpen(false);
    setActiveConcept(null);
    console.log(`CommentsContext › closeForum`);
  }, []);



  return (
    <CommentsContext.Provider
      value={{
        posts,
        addPost,
        addComment,
        deletePost,
        getCommentCount,
        openForum,
        closeForum,
        isForumOpen,
        isComposerOpen,
        activeConcept,
        getPostItemCount,
        getUnseenCount,
        markThreadViewed,
        getDirtyThreadTotal,
      }}
    >
      {children}
    </CommentsContext.Provider>
  );
};

/**
 * @function useComments
 * @description
 * Custom hook to consume `CommentsContext` safely. Returns full API for
 * managing posts and comments keyed by resource IDs. Throws if used outside provider.
 */
export function useComments(): CommentsContextType {
  const ctx = useContext(CommentsContext);
  if (!ctx) throw new Error('useComments must be used within CommentsProvider');
  return ctx;
}
