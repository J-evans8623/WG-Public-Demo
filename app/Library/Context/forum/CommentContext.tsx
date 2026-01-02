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
import { useYDoc } from '@/app/Library/Context/YDocContext'; // update - 200

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
    return forumDoc.getMap<Post>('posts');
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
   * @function _observePostsIntoState
   * @description
   *   Attach observeDeep to postsRoot and mirror into React state. Defensive no-ops when the doc
   *   is not ready. This makes reads O(1) for components while the CRDT remains authoritative.
   *   The function ensures that list rendering and counters remain fast even as the Y.Doc grows.
   */
  const _observePostsIntoState = useCallback(() => {
    if (!postsRoot) return;
    const load = () => setPosts(new Map(postsRoot.entries()));
    load();
    const onUpdate = (_: Y.YEvent<any>[]) => load();
    postsRoot.observeDeep(onUpdate);
    // console.log('CommentsContext.tsx [7707] › posts observer attached');
    return () => {
      postsRoot.unobserveDeep(onUpdate);
      // console.log('CommentsContext.tsx [7708] › posts observer detached');
    };
  }, [postsRoot]);

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

      disconnectRef.current(); // update - 202: use stable ref indirection
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
  // update - 203: init ref to avoid depending on initializeForum in drivers
  const initializeRef = useRef<(id: string) => Promise<void>>(() => Promise.resolve()); // update - 203

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
  }, [forumDoc]); // stable identity

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
        postsRoot.set(id, newPost);
        saveForumNow();
        // console.log('CommentsContext.tsx [7723] › addPost', { id, resourceId });
      }, LOCAL_ORIGIN);
    },
    [forumDoc, postsRoot, authorUID, saveForumNow],
  );

  const addComment = useCallback(
    (postId: string, body: string) => {
      if (!forumDoc || !postsRoot) return;
      const post = postsRoot.get(postId);
      if (!post) return;
      const newComment: Comment = {
        id: uuidv4(),
        authorUID,
        body,
        ts: Date.now(),
      };
      const updated: Post = { ...post, replies: [...(post.replies ?? []), newComment] };
      forumDoc.transact(() => {
        postsRoot.set(postId, updated);
        saveForumNow();
        // console.log('CommentsContext.tsx [7724] › addComment', { postId, commentId: newComment.id });
      }, LOCAL_ORIGIN);
    },
    [forumDoc, postsRoot, authorUID, saveForumNow],
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
      
      const post = postsRoot.get(postId);
      if (!post) return;

      // Create updated object maintaining other props
      const updatedPost: Post = {
        ...post,
        postTitle: newTitle,
        body: newBody,
        // Ensure timestamp doesn't change if you want to keep original sort, 
        // or update it if you want it to bump up. 
        // Usually, edits don't change 'ts' but might add an 'editedAt' field.
        // For now, we just update content.
      };

      forumDoc.transact(() => {
        postsRoot.set(postId, updatedPost);
        saveForumNow();

      }, LOCAL_ORIGIN);
    },
    [forumDoc, postsRoot, saveForumNow]
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
