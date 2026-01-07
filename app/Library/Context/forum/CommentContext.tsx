// app/Library/Context/forum/CommentContext.tsx
/***************************************************************************************************
 * @file CommentsContext.tsx — Forum SSOT (Single Source of Truth) with autonomous lifecycle
 * @description
 *   This provider is the authoritative runtime for the Forum feature and now includes an internal
 *   auto-driver that starts and stops the forum lifecycle based solely on `YDocContext` signals.
 *   The provider owns: (1) a dedicated forum Y.Doc lifecycle, (2) persistence with debounced and
 *   periodic autosaves to a signed GCS path, (3) realtime connectivity to the Yjs websocket room,
 *   and (4) a stable CRUD surface for posts and comments. In Phase 2, we remove all dependence on
 *   orchestration from `app.tsx` by reading `bootPhase`, `saveReady`, and `docFileID` directly via
 *   `useYDoc`. We compute a simple enable-gate: `okEnabled = ACTIVE && saveReady && !!docFileID`;
 *   a single effect (epoch-guarded + 200ms debounce) idempotently calls `initializeForum(docId)`
 *   when the gate opens and `shutdownForum()` when the gate closes or changes document. This keeps
 *   forum initialization deterministic, prevents duplicate connects, and ensures clean teardown on
 *   doc switches. All hot-path computations here are O(1); persistence is O(N) in bytes written,
 *   and read/update of threads is O(1) by using Yjs maps mirrored into React state. The public API
 *   remains unchanged, preserving UI compatibility while delivering a self-governed forum runtime.
 ***************************************************************************************************/

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
  useMemo,
  useRef,
} from 'react';
import * as Y from 'yjs';
import { v4 as uuidv4 } from 'uuid';
import { useSession } from 'next-auth/react';
import { useUserData } from '@/app/Library/Context/UserDataContext';
import { computeUnseen, isDirty } from '../../utils/notifications/NotificationUtils';
import { LOCAL_ORIGIN } from '../../Definitions/Definitions';
import { useForumCollaboration, ForumConnectionPhase } from './useForumCollaboration';
import { supersedingCall } from '@/app/src/net/SupersedingCaller';
import { useYDoc } from '@/app/Library/Context/YDocContext'; 

///////////////////////
// Type Definitions //
///////////////////////

export interface Comment {
  id: string;
  authorUID: string;
  body: string;
  ts: number;
}

export interface Post extends Comment {
  lessonTitle: string;
  lessonTitleId: string;
  subtopicTitle: string;
  postTitle: string;
  resourceId: string;
  id: string;
  replies: Comment[];
}



/**
 * update - 2
 * Internal CRDT field keys for the new nested schema. We keep these as constants to avoid
 * drift and to make migration/materialization deterministic and easy to audit.
 */
const CRDT_KEYS = {
  replies: 'replies',
  id: 'id',
  authorUID: 'authorUID',
  ts: 'ts',
  lessonTitle: 'lessonTitle',
  lessonTitleId: 'lessonTitleId',
  subtopicTitle: 'subtopicTitle',
  postTitle: 'postTitle',
  body: 'body',
  resourceId: 'resourceId',
} as const;

/**
 * update - 3
 * Minimal runtime type guard for Y.Map. We avoid importing internal Yjs classes and instead
 * check against the public API shape.
 */
function isYMap(val: unknown): val is Y.Map<any> {
  return !!val && typeof val === 'object' && typeof (val as any).get === 'function' && typeof (val as any).set === 'function';
}

/**
 * update - 4
 * Minimal runtime type guard for Y.Array.
 */
function isYArray(val: unknown): val is Y.Array<any> {
  return !!val && typeof val === 'object' && typeof (val as any).toArray === 'function' && typeof (val as any).push === 'function';
}


//////////////////////////////
// Context Value Interface //
//////////////////////////////

interface CommentsContextType {
  // Data
  posts: Map<string, Post>;

  // CRUD
  addPost(data: {
    lessonTitle: string;
    lessonTitleId: string;
    subtopicTitle: string;
    body: string;
    postTitle: string;
    resourceId: string;
  }): void;
  addComment(postId: string, body: string): void;
  deletePost(postId: string): void;

  // Counters / helpers
  getCommentCount(postId: string): number;
  getPostItemCount(postId: string): number;
  getUnseenCount(postId: string): number;
  markThreadViewed(postId: string): void;
  getDirtyThreadTotal(): number;

  // UI controls
  openForum(): void;
  closeForum(): void;
  isForumOpen: boolean;
  isComposerOpen: boolean;
  activeConcept: string | null;

  // Forum lifecycle + status (SSOT)
  initializeForum(docId: string): Promise<void>;
  shutdownForum(): void;
  forumDocReady: boolean;
  forumRoomConnected: boolean;
  forumStatus: { isSaving: boolean; lastError: string | null; lastSavedAt: number | null };
  forumConnectionPhase: ForumConnectionPhase;
  currentUserId: string;
  editPost(postId: string, newTitle: string, newBody: string): void;
}

const CommentsContext = createContext<CommentsContextType | undefined>(undefined);

////////////////////////////////////
// Provider Implementation        //
////////////////////////////////////

export const CommentsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { data: session } = useSession();
  const authorUID = session?.user?.name ?? 'unknown';

  // update - 201: pull authoritative run-gate inputs from YDocContext
  const { bootPhase, saveReady, docFileID } = useYDoc(); // update - 201

  const [forumDoc, setForumDoc] = useState<Y.Doc | null>(null);
  const [forumDocReady, setForumDocReady] = useState(false);
  const [forumStatus, setForumStatus] = useState<{ isSaving: boolean; lastError: string | null; lastSavedAt: number | null }>({
    isSaving: false,
    lastError: null,
    lastSavedAt: null,
  });
  const currentDocIdRef = useRef<string | null>(null);


  // Socket hook (connection-only) — proxy connection status up to context
  const { connect, disconnect, status } = useForumCollaboration();
  const forumRoomConnected = status.isConnected;
  const forumConnectionPhase = status.phase;

  // postsRoot is resolved from the forumDoc SSoT
  const postsRoot = useMemo(() => {
    if (!forumDoc) return null;
    return forumDoc.getMap<Y.Map<any>>('posts');
  }, [forumDoc]);

  const [posts, setPosts] = useState<Map<string, Post>>(new Map());

  // Seen-tracking bridges
  const { getSeenCount, markThreadSeen, clearSeenForDeleted } = useUserData();

  // UI-state for inline composer & full-screen forum
  const [isComposerOpen] = useState(false);
  const [isForumOpen, setForumOpen] = useState(false);
  const [activeConcept, setActiveConcept] = useState<string | null>(null);


  // 3. THE SIMPLIFIED SAVE FUNCTION (Transactional)
  // We keep the 'keepalive' fix here to ensure saves survive page unloads
  const saveForumNow = useCallback(async () => {
    const docId = currentDocIdRef.current;
    const y = forumDoc; // We can read state directly as we will call this from event handlers
    
    if (!docId || !y) return;

    try {
      setForumStatus((s) => ({ ...s, isSaving: true }));
      const bytes = Y.encodeStateAsUpdateV2(y);
      
      // Using a unique key for the "SupersedingCaller" ensures we don't overlap saves
      // if the user somehow manages to click 'Reply' twice instantly.
      const key = `forum:save:${docId}`; 

      const makeRequest = async (signal: AbortSignal) => {
        // 1. Get Upload URL
        const res = await fetch(`/api/forum/save?doc=${encodeURIComponent(docId)}`, {
          method: 'POST',
          credentials: 'include',
          keepalive: true, // Vital for "Save on Submit" if they close tab immediately
          signal,
        });
        if (!res.ok) return res;

        const { uploadUrl, contentType } = (await res.json()) as { uploadUrl: string; path: string; contentType: string };

        // 2. Upload Bytes
        const put = await fetch(uploadUrl, {
          method: 'PUT',
          body: new Uint8Array(bytes),
          headers: { 'Content-Type': contentType || 'application/octet-stream' },
          keepalive: true,
          signal,
        });
        return put;
      };

      const resp = await supersedingCall(key, { reason: 'transaction' }, makeRequest);
      
      if (!resp || !resp.ok) {
         const text = resp ? await resp.text().catch(() => '') : 'Rate limited';
         throw new Error(`Save failed: ${text}`);
      }

      setForumStatus((s) => ({ ...s, isSaving: false, lastError: null, lastSavedAt: Date.now() }));
      console.log('CommentsContext.tsx › Transactional save complete');
    } catch (err: any) {
      console.error('CommentsContext.tsx › save:error', err);
      setForumStatus((s) => ({ ...s, isSaving: false, lastError: err?.message }));
    }
  }, [forumDoc]);



  /**
   * @function _getOrCreateRepliesArray
   * @description
   *   Ensures a post map contains a Y.Array at key "replies". This is critical for CRDT-correct
   *   reply creation: replies must be appended via yReplies.push([...]) rather than rewriting a
   *   whole Post object. If a legacy or partially-created post is missing the array, we create
   *   it within the caller's transaction. Returns a stable Y.Array reference for subsequent
   *   operations. Time complexity is O(1), with no iteration.
   */
  const _getOrCreateRepliesArray = useCallback((yPost: Y.Map<any>): Y.Array<Y.Map<any>> => {
    const existing = yPost.get(CRDT_KEYS.replies);
    if (isYArray(existing)) return existing as Y.Array<Y.Map<any>>;

    // update - 7: create replies array when missing
    const next = new Y.Array<Y.Map<any>>(); // update - 7
    yPost.set(CRDT_KEYS.replies, next); // update - 7
    return next;
  }, []);



   /**
   * @function _materializePostsFromCrdt
   * @description
   *   Converts the authoritative CRDT state into plain JS Post objects for UI consumption.
   *   We read scalar fields from each yPost map and convert the replies Y.Array into a sorted
   *   Comment[] array (stable for rendering). This function intentionally does not mutate CRDT
   *   state; it is a pure projection used to keep the public useComments() API unchanged.
   *   Time complexity is O(N + R) across all posts and replies, suitable for forum-scale data.
   */
  const _materializePostsFromCrdt = useCallback((): Map<string, Post> => {
    const root = postsRoot;
    if (!root) return new Map();

    const next = new Map<string, Post>();

    for (const [postId, rawVal] of root.entries()) {
      const yPost = rawVal;

      // Defensive: skip corrupted entries
      if (!isYMap(yPost)) continue;

      const yRepliesRaw = yPost.get(CRDT_KEYS.replies);
      const yReplies = isYArray(yRepliesRaw) ? (yRepliesRaw as Y.Array<Y.Map<any>>) : null;

      const replies: Comment[] = yReplies
        ? yReplies
            .toArray()
            .filter((r) => isYMap(r))
            .map((r) => {
              const id = (r as Y.Map<any>).get(CRDT_KEYS.id) as string;
              const author = ((r as Y.Map<any>).get(CRDT_KEYS.authorUID) as string) ?? 'unknown';
              const body = ((r as Y.Map<any>).get(CRDT_KEYS.body) as string) ?? '';
              const ts = Number((r as Y.Map<any>).get(CRDT_KEYS.ts) ?? 0);
              return { id, authorUID: author, body, ts };
            })
        : [];

      // Keep reply order stable for UI (ascending by ts)
      replies.sort((a, b) => a.ts - b.ts);

      const post: Post = {
        id: (yPost.get(CRDT_KEYS.id) as string) ?? postId,
        authorUID: (yPost.get(CRDT_KEYS.authorUID) as string) ?? 'unknown',
        body: (yPost.get(CRDT_KEYS.body) as string) ?? '',
        ts: Number(yPost.get(CRDT_KEYS.ts) ?? 0),
        lessonTitle: (yPost.get(CRDT_KEYS.lessonTitle) as string) ?? '',
        lessonTitleId: (yPost.get(CRDT_KEYS.lessonTitleId) as string) ?? '',
        subtopicTitle: (yPost.get(CRDT_KEYS.subtopicTitle) as string) ?? '',
        resourceId: (yPost.get(CRDT_KEYS.resourceId) as string) ?? '',
        postTitle: (yPost.get(CRDT_KEYS.postTitle) as string) ?? '',
        replies,
      };

      next.set(post.id, post);
    }

    return next;
  }, [postsRoot]);




  /**
   * @function _migrateLegacyPostsIfNeeded
   * @description
   *   One-time in-place migration that upgrades legacy persisted schema (postsRoot values stored
   *   as plain JS Post objects) into the new CRDT-first nested schema. The migration is executed
   *   inside a single Yjs transaction immediately after loading bytes, ensuring no data loss and
   *   producing deterministic CRDT structures for all future edits/replies. Returns the number of
   *   posts migrated. Time complexity is O(N + R) over posts and replies only during load.
   */
  const _migrateLegacyPostsIfNeeded = useCallback(
    (doc: Y.Doc): number => {
      const root = doc.getMap<any>('posts'); // legacy could be any shape
      let migrated = 0;

      doc.transact(() => {
        for (const [postId, rawVal] of root.entries()) {
          // New schema: value is a Y.Map => no migration needed.
          if (isYMap(rawVal)) continue;

          // Legacy schema: value is a plain object (expected shape: Post)
          if (!rawVal || typeof rawVal !== 'object') continue;

          const legacy = rawVal as any;

          const yPost = new Y.Map<any>(); // update - 8
          yPost.set(CRDT_KEYS.id, String(legacy.id ?? postId)); // update - 8
          yPost.set(CRDT_KEYS.authorUID, String(legacy.authorUID ?? 'unknown')); // update - 8
          yPost.set(CRDT_KEYS.ts, Number(legacy.ts ?? Date.now())); // update - 8
          yPost.set(CRDT_KEYS.lessonTitle, String(legacy.lessonTitle ?? '')); // update - 8
          yPost.set(CRDT_KEYS.lessonTitleId, String(legacy.lessonTitleId ?? '')); // update - 8
          yPost.set(CRDT_KEYS.subtopicTitle, String(legacy.subtopicTitle ?? '')); // update - 8
          yPost.set(CRDT_KEYS.postTitle, String(legacy.postTitle ?? '')); // update - 8
          yPost.set(CRDT_KEYS.body, String(legacy.body ?? '')); // update - 8
          yPost.set(CRDT_KEYS.resourceId, String(legacy.resourceId ?? '')); // update - 8

          const yReplies = new Y.Array<Y.Map<any>>(); // update - 8
          const legacyReplies = Array.isArray(legacy.replies) ? legacy.replies : [];
          for (const lr of legacyReplies) {
            if (!lr || typeof lr !== 'object') continue;
            const yReply = new Y.Map<any>();
            yReply.set(CRDT_KEYS.id, String(lr.id ?? uuidv4()));
            yReply.set(CRDT_KEYS.authorUID, String(lr.authorUID ?? 'unknown'));
            yReply.set(CRDT_KEYS.body, String(lr.body ?? ''));
            yReply.set(CRDT_KEYS.ts, Number(lr.ts ?? Date.now()));
            yReplies.push([yReply]);
          }
          yPost.set(CRDT_KEYS.replies, yReplies); // update - 8

          // Replace legacy plain object with yPost map under same postId key.
          root.set(postId, yPost); // update - 8
          migrated++;
        }
      }, LOCAL_ORIGIN);

      if (migrated > 0) {
        console.warn('[FORUM_CRDT] migrated posts from legacy schema', { migrated }); // update - 9 (proof hook)
      }

      return migrated;
    },
    [],
  );



  /**
   * @function _observePostsIntoState
   * @description
   *   Attach observeDeep to postsRoot and mirror into React state. Defensive no-ops when the doc
   *   is not ready. This makes reads O(1) for components while the CRDT remains authoritative.
   *   The function ensures that list rendering and counters remain fast even as the Y.Doc grows.
   */
  const _observePostsIntoState = useCallback(() => {
    if (!postsRoot) return;
    const load = () => {
      const next = _materializePostsFromCrdt(); // update - 10
      setPosts(next); // update - 10
    };
    load();
    const onUpdate = (_: Y.YEvent<any>[]) => load();
    postsRoot.observeDeep(onUpdate);
    // console.log('CommentsContext.tsx [7707] › posts observer attached');
    return () => {
      postsRoot.unobserveDeep(onUpdate);
      // console.log('CommentsContext.tsx [7708] › posts observer detached');
    };
  }, [_materializePostsFromCrdt, postsRoot]);

  useEffect(() => {
    const detach = _observePostsIntoState();
    return () => {
      if (detach) detach();
    };
  }, [_observePostsIntoState]);



  /**
   * @function shutdownForum
   * @description
   *   Gracefully stop autosave, disconnect the provider, clear ready flags/state, and null out
   *   the current forumDoc to prevent cross-doc leakage. Safe to call multiple times. This is
   *   invoked by the autonomous driver when the enable-gate closes or the doc id changes.
   */
  const shutdownForum = useCallback((): void => {
    try {

      disconnectRef.current(); 
      setForumDocReady(false);
      setForumDoc(null);
      setPosts(new Map());
      currentDocIdRef.current = null;
      // // console.log('CommentsContext.tsx [7794] › shutdown:ok');
    } catch (e: any) {
      console.warn('CommentsContext.tsx [7796] › shutdown:warn', { error: e?.message });
    }
  }, []); // Keep only _stopAutosave in deps



  /**
   * @function _loadForumFromStorage
   * @description
   *   Calls /api/forum/load for a signed read URL and applies bytes to a new Y.Doc when found.
   *   Wrapped with SupersedingCaller for back-pressure. Returns an always-usable new Y.Doc.
   */
  const _loadForumFromStorage = useCallback(async (docId: string): Promise<Y.Doc> => {
    const next = new Y.Doc();
    try {
      // console.log('CommentsContext.tsx [7701] › load:start', { docId });

      // update - 21: wrap /api/forum/load
      const key = `forum:load:${docId}`;
      const makeRequest = async (signal: AbortSignal) => {
        const res = await fetch(`/api/forum/load?doc=${encodeURIComponent(docId)}`, {
          method: 'GET',
          credentials: 'include',
          signal,
        });
        if (!res.ok) return res;

        const payload: { exists: boolean; downloadUrl?: string; path?: string } = await res.json();
        if (payload.exists && payload.downloadUrl) {
          const fileRes = await fetch(payload.downloadUrl, { method: 'GET', signal });
          if (!fileRes.ok) return fileRes;
          const buf = new Uint8Array(await fileRes.arrayBuffer());
          Y.applyUpdateV2(next, buf);
          // console.log('CommentsContext.tsx [7702] › load:applied', { bytes: buf.byteLength });
        } else {
          // console.log('CommentsContext.tsx [7703] › load:empty', { docId });
        }
        return new Response(null, { status: 200 });
      };

      const resp = await supersedingCall(key, {}, makeRequest); // update - 21
      if (!resp) {
        // console.log('CommentsContext.tsx [7717] › load deferred by Retry-After (scheduled)', { docId }); // update - 21
        return next;
      }

      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(`forum load failed (${resp.status}) ${text}`);
      }

      return next;
    } catch (err: any) {
      console.error('CommentsContext.tsx [7792] › load:error', { docId, error: err?.message });
      setForumStatus((s) => ({ ...s, lastError: err?.message ?? 'load error' }));
      return next; // proceed with empty doc
    }
  }, []);

  // Stable ref indirections for side-effectful operations
  const connectRef = useRef(connect);
  const disconnectRef = useRef(disconnect);
  const loadRef = useRef(_loadForumFromStorage);
  const shutdownRef = useRef(shutdownForum);
   // update - 12: initializeRef is assigned AFTER initializeForum declaration (fixes TDZ risk)
  const initializeRef = useRef<(id: string) => Promise<void>>(async () => Promise.resolve());

  useEffect(() => {
    connectRef.current = connect;
    disconnectRef.current = disconnect;
    loadRef.current = _loadForumFromStorage;
    shutdownRef.current = shutdownForum;
    // update - 204: keep initializer up to date
    initializeRef.current = initializeForum; // update - 204
  });

  /**
   * @function initializeForum
   * @description
   *   Idempotent initializer for the forum. If already initialized for docId, it's a no-op.
   *   1) Load bytes → Y.Doc, 2) commit forumDoc, 3) attach update observers and start autosave,
   *   4) connect the realtime room via y-websocket. All steps are guarded to prevent leakage
   *   across doc switches. Complexity is O(N) in the size of loaded bytes; steady state O(1).
   *
   *   update - 22: Stabilize callback identity ([]) and read side-effectful functions from refs to
   *   prevent dependency cycles. This keeps parent components free of render loops.
   */
  const initializeForum = React.useCallback(async (docId: string): Promise<void> => {
    if (!docId) return;

    // No-op if already initialized for this doc
    if (currentDocIdRef.current === docId && forumDoc) {
      // // console.log('CommentsContext.tsx [7713] › init:no-op (same docId)');
      return;
    }

    // If switching docs, shutdown first (via stable ref)
    if (currentDocIdRef.current && currentDocIdRef.current !== docId) {
      shutdownRef.current();
    }

    try {
      // Load forum bytes to a fresh Y.Doc via stable ref
      const next = await loadRef.current(docId);


      
        // update - 13: migrate legacy schema in-place before UI reads materialized state
        _migrateLegacyPostsIfNeeded(next); 

      // Commit SSOT state
      setForumDoc(next);
      currentDocIdRef.current = docId;
      setForumDocReady(true);
      setForumStatus((s) => ({ ...s, lastError: null }));

      // Start realtime connection (socket-only) through stable ref
      await connectRef.current(docId, next);
      // // console.log('CommentsContext.tsx [7711] › connect:requested', { docId });
    } catch (e: any) {
      console.error('CommentsContext.tsx [7793] › init:error', { docId, error: e?.message });
      setForumStatus((s) => ({ ...s, lastError: e?.message ?? 'init error' }));
    }
  }, [_migrateLegacyPostsIfNeeded, forumDoc]); // stable identity

  useEffect(() => {
    initializeRef.current = initializeForum; // update - 14
  }, [initializeForum]);

  // ───────────────────────────────────────────────────────────────────────────────
  // CRUD — unchanged surface; now operates on forumDoc/postsRoot
  // ───────────────────────────────────────────────────────────────────────────────

  const addPost = useCallback(
    ({
      lessonTitle,
      lessonTitleId,
      subtopicTitle,
      postTitle,
      body,
      resourceId,
    }: {
      lessonTitle: string;
      lessonTitleId: string;
      subtopicTitle: string;
      postTitle: string;
      body: string;
      resourceId: string;
    }) => {
      if (!forumDoc || !postsRoot) return;
      const id = uuidv4();
      const newPost: Post = {
        id,
        authorUID,
        body,
        ts: Date.now(),
        lessonTitle,
        lessonTitleId,
        subtopicTitle,
        resourceId,
        postTitle,
        replies: [],
      };
forumDoc.transact(() => {
        // update - 15: create nested CRDT yPost with field-level keys
        const yPost = new Y.Map<any>(); // update - 15
        yPost.set(CRDT_KEYS.id, id); // update - 15
        yPost.set(CRDT_KEYS.authorUID, authorUID); // update - 15
        yPost.set(CRDT_KEYS.body, body); // update - 15
        yPost.set(CRDT_KEYS.ts, Date.now()); // update - 15
        yPost.set(CRDT_KEYS.lessonTitle, lessonTitle); // update - 15
        yPost.set(CRDT_KEYS.lessonTitleId, lessonTitleId); // update - 15
        yPost.set(CRDT_KEYS.subtopicTitle, subtopicTitle); // update - 15
        yPost.set(CRDT_KEYS.resourceId, resourceId); // update - 15
        yPost.set(CRDT_KEYS.postTitle, postTitle); // update - 15

        const yReplies = new Y.Array<Y.Map<any>>(); // update - 15
        yPost.set(CRDT_KEYS.replies, yReplies); // update - 15

        postsRoot.set(id, yPost); // update - 15

        console.log('[FORUM_CRDT] addPost uses postsRoot.set(id, yPostMap)', { id, resourceId }); // update - 16 (proof hook)
        saveForumNow();
      }, LOCAL_ORIGIN);
    },
    [forumDoc, postsRoot, authorUID, saveForumNow],
  );

   const addComment = useCallback(
    (postId: string, body: string) => {
      if (!forumDoc || !postsRoot) return;

      const yPost = postsRoot.get(postId);
      if (!yPost || !isYMap(yPost)) return;

      const replyId = uuidv4();

      forumDoc.transact(() => {
        const yReplies = _getOrCreateRepliesArray(yPost); // update - 17

        const prevLen = yReplies.length; // update - 17
        const yReply = new Y.Map<any>(); // update - 17
        yReply.set(CRDT_KEYS.id, replyId); // update - 17
        yReply.set(CRDT_KEYS.authorUID, authorUID); // update - 17
        yReply.set(CRDT_KEYS.body, body); // update - 17
        yReply.set(CRDT_KEYS.ts, Date.now()); // update - 17

        // update - 18: CRDT-correct append (no whole-post rewrite)
        yReplies.push([yReply]); // update - 18

        const nextLen = yReplies.length; // update - 18

        console.warn('[FORUM_CRDT] addComment uses yReplies.push (no whole-post overwrite)', {
          postId,
          replyId,
          prevLen,
          nextLen,
        }); // update - 19 (proof hook)

        saveForumNow();
      }, LOCAL_ORIGIN);
    },
    [forumDoc, postsRoot, authorUID, saveForumNow, _getOrCreateRepliesArray],
  );

  const deletePost = useCallback(
    (postId: string) => {
      if (!forumDoc || !postsRoot) return;
      if (!postsRoot.has(postId)) return;
      forumDoc.transact(() => {
        postsRoot.delete(postId);
        saveForumNow();
        // console.log('CommentsContext.tsx [7725] › deletePost', { postId });
      }, LOCAL_ORIGIN);
      clearSeenForDeleted(postId);
    },
    [forumDoc, postsRoot, clearSeenForDeleted, saveForumNow],
  );

  const getCommentCount = useCallback((postId: string) => posts.get(postId)?.replies.length ?? 0, [posts]);

  const getPostItemCount = useCallback(
    (postId: string): number => {
      const p = posts.get(postId);
      return p ? 1 + (p.replies?.length ?? 0) : 0;
    },
    [posts],
  );

  const getUnseenCount = useCallback(
    (postId: string): number => {
      const current = getPostItemCount(postId);
      const seen = getSeenCount(postId);
      return computeUnseen(current, seen);
    },
    [getPostItemCount, getSeenCount],
  );

  const markThreadViewed = useCallback(
    (postId: string) => {
      const size = getPostItemCount(postId);
      if (size > 0) markThreadSeen(postId, size);
    },
    [getPostItemCount, markThreadSeen],
  );

  const getDirtyThreadTotal = useCallback((): number => {
    let total = 0;
    for (const [postId] of posts.entries()) {
      const unseen = getUnseenCount(postId);
      if (isDirty(unseen)) total++;
    }
    return total;
  }, [posts, getUnseenCount]);

  // UI controls
  const openForum = useCallback(() => setForumOpen(true), []);
  const closeForum = useCallback(() => {
    setForumOpen(false);
    setActiveConcept(null);
    // console.log('CommentsContext.tsx [7726] › closeForum');
  }, []);


  const editPost = useCallback(
    (postId: string, newTitle: string, newBody: string) => {
      if (!forumDoc || !postsRoot) return;

      const yPost = postsRoot.get(postId);
      if (!yPost || !isYMap(yPost)) return;

      forumDoc.transact(() => {
        // update - 20: field-level sets for CRDT-correct merging
        const beforeTitle = yPost.get(CRDT_KEYS.postTitle); // update - 20
        const beforeBody = yPost.get(CRDT_KEYS.body); // update - 20

        yPost.set(CRDT_KEYS.postTitle, newTitle); // update - 20
        yPost.set(CRDT_KEYS.body, newBody); // update - 20

        console.warn('[FORUM_CRDT] editPost uses yPost.set(field) (no whole-post overwrite)', {
          postId,
          fields: [
            { key: CRDT_KEYS.postTitle, before: beforeTitle, after: newTitle },
            { key: CRDT_KEYS.body, before: beforeBody, after: newBody },
          ],
        }); // update - 21 (proof hook)

        saveForumNow();
      }, LOCAL_ORIGIN);
    },
    [forumDoc, postsRoot, saveForumNow],
  );

  // ───────────────────────────────────────────────────────────────────────────────
  // Autonomous driver: start/stop forum based on YDocContext signals
  // ───────────────────────────────────────────────────────────────────────────────

  // update - 205: lifecycle driver refs (epoch + debounce + connection guard)
  const lastDocIdRef = useRef<string | null>(null); // update - 205
  const driverEpochRef = useRef(0); // update - 205
  const driverCooldownRef = useRef<NodeJS.Timeout | null>(null); // update - 205
  const driverConnectingRef = useRef(false); // update - 205

  /**
   * @function useEffect(autoStartStop)
   * @description
   *   Single-owner effect that computes `okEnabled = bootPhase==='ACTIVE' && saveReady && !!docId`.
   *   It debounces by 200ms to absorb transient flips, then:
   *     • shutdown when gate closes and a forum was running,
   *     • no-op when the same docId is already active,
   *     • shutdown old + initialize new when switching docIds,
   *   with guards against concurrent connects and stale epochs. This avoids render loops by not
   *   depending on forum status and by calling initializer through a stable ref.
   */
  useEffect(() => {
    const okEnabled = bootPhase === 'ACTIVE' && saveReady && !!docFileID; // update - 206
    const nextDocId: string | null = okEnabled ? (docFileID as string) : null; // update - 206

    const epoch = ++driverEpochRef.current; // update - 206
    if (driverCooldownRef.current) clearTimeout(driverCooldownRef.current); // update - 206
    driverCooldownRef.current = setTimeout(() => {
      if (epoch !== driverEpochRef.current) return; // stale debounce window // update - 206

      // Case A: gate closed -> ensure shutdown if previously active
      if (!nextDocId) {
        if (lastDocIdRef.current !== null) {
          shutdownRef.current();
          lastDocIdRef.current = null;
        }
        return;
      }

      // Case B: already running same doc
      if (lastDocIdRef.current === nextDocId) return;

      // Case C: switch / cold start
      if (driverConnectingRef.current) return;
      driverConnectingRef.current = true;

      // Shutdown old if present
      if (lastDocIdRef.current) {
        shutdownRef.current();
      }

      // Initialize new
      initializeRef.current(nextDocId)
        .catch((e) => console.error('CommentsContext.tsx [7801] › auto-init error', e))
        .finally(() => {
          if (epoch === driverEpochRef.current) {
            lastDocIdRef.current = nextDocId;
          }
          driverConnectingRef.current = false;
        });
    }, 200);

    return () => {
      if (driverCooldownRef.current) {
        clearTimeout(driverCooldownRef.current);
        driverCooldownRef.current = null;
      }
    };
  }, [bootPhase, saveReady, docFileID]); // intentionally minimal deps; no forum status here // update - 206

  return (
    <CommentsContext.Provider
      value={{
        // Data + CRUD
        posts,
        addPost,
        addComment,
        deletePost,
        getCommentCount,
        getPostItemCount,
        getUnseenCount,
        markThreadViewed,
        getDirtyThreadTotal,

        // UI
        openForum,
        closeForum,
        isForumOpen,
        isComposerOpen,
        activeConcept,

        // Forum lifecycle + status
        initializeForum,
        shutdownForum,
        forumDocReady,
        forumRoomConnected,
        forumStatus,
        forumConnectionPhase,
        currentUserId: authorUID,
        editPost,
      }}
    >
      {children}
    </CommentsContext.Provider>
  );
};

/**
 * @function useComments
 * @description
 *   Read the full forum SSOT API. Throws outside the provider to prevent silent failures. All
 *   methods are O(1) except persistence, which scales with encoded update bytes O(N). By exposing
 *   a stable surface, UI components can remain oblivious to the underlying auto-driver changes.
 */
export function useComments(): CommentsContextType {
  const ctx = useContext(CommentsContext);
  if (!ctx) throw new Error('useComments must be used within CommentsProvider');
  return ctx;
}
