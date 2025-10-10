// app/Library/Context/CommentContext.tsx
/***************************************************************************************************
 * @file CommentsContext.tsx — Forum SSOT (Single Source of Truth)
 * @description
 *   This provider is the authoritative runtime for the Forum feature. It owns the dedicated forum
 *   Y.Doc lifecycle, persistence, realtime connection proxying, and the public CRUD API consumed
 *   by forum UI components. The design explicitly separates responsibilities:
 *     (1) Persistence: initializeForum(docId) loads bytes via /api/forum/load (if present), applies
 *         to a fresh Y.Doc, and starts a low-noise autosave policy (debounce on local changes +
 *         periodic background save + best-effort "save on unload"). Saves PUT encoded bytes to a
 *         short-lived signed URL from /api/forum/save. Persistence is O(N) in update bytes, with
 *         network latency dominating; steady-state computations are O(1).
 *     (2) Realtime: useForumCollaboration is used strictly to attach/detach a Yjs WebSocket
 *         provider once a forumDoc exists. The hook exposes isConnected; this context mirrors it as
 *         forumRoomConnected. The socket concerns never perform persistence or CRUD.
 *     (3) CRUD + UI API: this context exposes the same flat thread model as before (postsRoot is a
 *         Y.Map keyed by postId; each Post carries a flat replies array). All CRUD operations are
 *         applied to the forumDoc. Observers keep an in-memory Map<string, Post> in sync for fast
 *         reads, counters, and unseen/seen helpers. Time complexity is O(1) to read/update, aside
 *         from encoding work during persistence.
 *
 *   Key goals:
 *     • Keep the forum isolated from the main document collaboration (no cross-doc leakage).
 *     • Provide deterministic initialization/teardown on doc switches and view transitions.
 *     • Offer purposeful console logs with file tag + 4-digit codes for production debugging.
 *     • Preserve existing UI contracts: posts map and helper methods are unchanged.
 *
 * Responsibilities:
 *   - Initialize and own a dedicated forumDoc (Y.Doc) per selected docId
 *   - Load/save forum bytes via signed URLs; implement debounced + periodic autosave
 *   - Start/stop a socket connection (via useForumCollaboration) and proxy status
 *   - Maintain a posts Map in React state, backed by a Y.Map("posts") inside forumDoc
 *   - Expose CRUD (addPost, addComment, deletePost) and utility counters
 *   - Provide lifecycle methods: initializeForum / shutdownForum with idempotency
 *   - Emit concise, high-value logs for observability
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
import { useForumCollaboration } from './useForumCollaboration';

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
}

const CommentsContext = createContext<CommentsContextType | undefined>(undefined);

////////////////////////////////////
// Provider Implementation        //
////////////////////////////////////

export const CommentsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { data: session } = useSession();
  const authorUID = session?.user?.name ?? 'unknown';


  const [forumDoc, setForumDoc] = useState<Y.Doc | null>(null); 
  const [forumDocReady, setForumDocReady] = useState(false); 
  const [forumStatus, setForumStatus] = useState<{ isSaving: boolean; lastError: string | null; lastSavedAt: number | null }>({
    isSaving: false,
    lastError: null,
    lastSavedAt: null,
  }); 
  const currentDocIdRef = useRef<string | null>(null); 
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null); //  (debounce)
  const periodicRef = useRef<NodeJS.Timeout | null>(null); // (interval)
  const dirtySinceRef = useRef<number | null>(null); // (dirty tracking)
  const docUpdateDetachRef = useRef<(() => void) | null>(null); // (observer cleanup)

  // Socket hook (connection-only) — proxy connection status up to context
  const { connect, disconnect, status } = useForumCollaboration(); 
  const forumRoomConnected = status.isConnected; 

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

  /**
   * @function _observePostsIntoState
   * @description
   *   Attach observeDeep to postsRoot and mirror into React state. Defensive no-ops when the doc
   *   is not ready. This makes reads O(1) for components while the CRDT remains authoritative.
   */
  const _observePostsIntoState = useCallback(() => {
    if (!postsRoot) return;
    const load = () => setPosts(new Map(postsRoot.entries()));
    load();
    const onUpdate = (_: Y.YEvent<any>[]) => load();
    postsRoot.observeDeep(onUpdate);
    console.log('CommentsContext.tsx [7707] › posts observer attached');
    return () => {
      postsRoot.unobserveDeep(onUpdate);
      console.log('CommentsContext.tsx [7708] › posts observer detached');
    };
  }, [postsRoot]); 

  useEffect(() => {
    const detach = _observePostsIntoState();
    return () => {
      if (detach) detach();
    };
  }, [_observePostsIntoState]); 


      /**
   * @function _saveForumToStorage
   * @description
   *   Encodes forumDoc into bytes and uploads to a signed PUT URL from /api/forum/save. Debounce and
   *   periodic loops both call here. If doc is clean (no dirtySinceRef), skip for interval caller.
   *   On success, clears dirty marker and updates lastSavedAt.
   */
  const _saveForumToStorage = useCallback(
    async (reason: 'debounce' | 'interval' | 'unload'): Promise<void> => {
      const docId = currentDocIdRef.current;
      const y = forumDoc;
      if (!docId || !y) return;

      // skip interval saves when not dirty, with explicit log
      if (reason === 'interval' && !dirtySinceRef.current) {
        console.log('CommentsContext.tsx [7715] › save:skip interval (clean)', { docId });
        return;
      }

      //6: skip unload save when clean (optional optimization)
      if (reason === 'unload' && !dirtySinceRef.current) {
        console.log('CommentsContext.tsx [7716] › save:skip unload (clean)', { docId });
        return;
      }

      try {
        setForumStatus((s) => ({ ...s, isSaving: true }));
        console.log('CommentsContext.tsx [7704] › save:start', { docId, reason, dirtySince: dirtySinceRef.current });

        const bytes = Y.encodeStateAsUpdateV2(y);
        

        const res = await fetch(`/api/forum/save?doc=${encodeURIComponent(docId)}`, {
          method: 'POST',
          credentials: 'include',
        });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`forum save failed (${res.status}) ${text}`);
        }
        const { uploadUrl, contentType } = (await res.json()) as { uploadUrl: string; path: string; contentType: string };

        const put = await fetch(uploadUrl, {
          method: 'PUT',
          body:new Uint8Array(bytes),
          headers: { 'Content-Type': contentType || 'application/octet-stream' },
        });
        if (!put.ok) {
          const text = await put.text().catch(() => '');
          throw new Error(`forum upload failed (${put.status}) ${text}`);
        }

        setForumStatus((s) => ({ ...s, isSaving: false, lastError: null, lastSavedAt: Date.now() }));
        dirtySinceRef.current = null;
        console.log('CommentsContext.tsx [7705] › save:ok', { bytes: bytes.byteLength, reason });
      } catch (err: any) {
        setForumStatus((s) => ({ ...s, isSaving: false, lastError: err?.message ?? 'save error' }));
        console.error('CommentsContext.tsx [7791] › save:error', { error: err?.message, reason });
      }
    },
    [forumDoc],
  ); 

   /**
   * @function _stopAutosave
   * @description
   *   Clears timers and resets dirty tracking. Safe to call multiple times during shutdown.
   */
  const _stopAutosave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (periodicRef.current) clearInterval(periodicRef.current);
    saveTimerRef.current = null;
    periodicRef.current = null;
    console.log('CommentsContext.tsx [7712] › autosave stopped');
  }, []); 
  
  /**
   * @function shutdownForum
   * @description
   *   Gracefully stop autosave, disconnect the provider, clear ready flags/state, and null out
   *   the current forumDoc to prevent cross-doc leakage. Safe to call multiple times.
   */
  const shutdownForum = useCallback((): void => {
    console.log('CommentsContext.tsx [7795] › shutdown:start', { docId: currentDocIdRef.current });
    try {
      _stopAutosave();
      // ensure we detach Yjs update observers for the previous forumDoc
      if (docUpdateDetachRef.current) {
        try { docUpdateDetachRef.current(); } catch { /* no-op */ }
        docUpdateDetachRef.current = null;
      }
      disconnect();
      setForumDocReady(false);
      setForumDoc(null);
      setPosts(new Map());
      currentDocIdRef.current = null;
      dirtySinceRef.current = null;
      console.log('CommentsContext.tsx [7794] › shutdown:ok');
    } catch (e: any) {
      console.warn('CommentsContext.tsx [7796] › shutdown:warn', { error: e?.message });
    }
  }, [disconnect, _stopAutosave]); 


  /**
   * @function _scheduleDebouncedSave
   * @description
   *   Debounce forum saves to reduce write amplification. Each local Y update marks the doc "dirty"
   *   and schedules a save in a short window (e.g., 2s). Periodic autosave also runs independently.
   */
  const _scheduleDebouncedSave = useCallback(() => {
    // Step 1 — mark dirty
    dirtySinceRef.current = dirtySinceRef.current ?? Date.now();

    // Step 2 — clear prior debounce
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    // Step 3 — schedule
    saveTimerRef.current = setTimeout(() => {
      void _saveForumToStorage('debounce');
    }, 5000);
  }, [_saveForumToStorage]); 

  /**
   * @function _attachDocUpdateObserver
   * @description
   *   Observe low-level Y updates to trigger the debounce saver. Idempotent attachment on new docs.
   *   IMPORTANT: Only mark dirty for **local** updates by checking the Yjs `origin`. This prevents
   *   remote activity from causing our client to save unnecessarily, reducing write amplification.
   */
  const _attachDocUpdateObserver = useCallback(() => {
    if (!forumDoc) return () => {};
    //  enforce LOCAL_ORIGIN filter; Yjs passes (update, origin) to listeners
    const onUpdate = (_u?: Uint8Array, origin?: unknown) => {
      if (origin === LOCAL_ORIGIN) {
        _scheduleDebouncedSave();
      } else {
        // Optional low-noise trace to prove remote updates are ignored for dirty tracking
        // console.log('CommentsContext.tsx [7713] › update ignored (remote origin)');
      }
    };
    forumDoc.on('update', onUpdate);
    console.log('CommentsContext.tsx [7709] › forumDoc update observer attached');
    return () => {
      forumDoc.off('update', onUpdate);
      console.log('CommentsContext.tsx [7710] › forumDoc update observer detached');
    };
  }, [forumDoc, _scheduleDebouncedSave]); 



  /**
   * @function _startPeriodicAutosave
   * @description
   *   Background autosave (e.g., every 60s). Writes only if dirtySinceRef is set. Ensures that
   *   long-running sessions will eventually persist data even without further edits.
   */
  const _startPeriodicAutosave = useCallback(() => {
    if (periodicRef.current) clearInterval(periodicRef.current);
    periodicRef.current = setInterval(() => {
      // add visibility log for skip vs save path
      if (!dirtySinceRef.current) {
        console.log('CommentsContext.tsx [7714] › periodic check: clean, skipping');
      }
      void _saveForumToStorage('interval');
    }, 60000);
    console.log('CommentsContext.tsx [7711] › periodic autosave started');
  }, [_saveForumToStorage]);



  /**
   * @function _loadForumFromStorage
   * @description
   *   Calls /api/forum/load for a signed read URL and applies bytes to a new Y.Doc when found.
   *   Returns the populated Y.Doc (existing or empty). Errors are surfaced via forumStatus.
   */
  const _loadForumFromStorage = useCallback(async (docId: string): Promise<Y.Doc> => {
    const next = new Y.Doc();
    try {
      console.log('CommentsContext.tsx [7701] › load:start', { docId });
      const res = await fetch(`/api/forum/load?doc=${encodeURIComponent(docId)}`, {
        method: 'GET',
        credentials: 'include',
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`forum load failed (${res.status}) ${text}`);
      }
      const payload: { exists: boolean; downloadUrl?: string; path?: string } = await res.json();
      if (payload.exists && payload.downloadUrl) {
        const fileRes = await fetch(payload.downloadUrl, { method: 'GET' });
        if (!fileRes.ok) {
          const text = await fileRes.text().catch(() => '');
          throw new Error(`forum bytes fetch failed (${fileRes.status}) ${text}`);
        }
        const buf = new Uint8Array(await fileRes.arrayBuffer());
        Y.applyUpdateV2(next, buf);
        console.log('CommentsContext.tsx [7702] › load:applied', { bytes: buf.byteLength });
      } else {
        console.log('CommentsContext.tsx [7703] › load:empty', { docId });
      }
      return next;
    } catch (err: any) {
      console.error('CommentsContext.tsx [7792] › load:error', { docId, error: err?.message });
      setForumStatus((s) => ({ ...s, lastError: err?.message ?? 'load error' }));
      return next; // proceed with empty doc
    }
  }, []); 



  /**
   * @function initializeForum
   * @description
   *   Idempotent initializer for the forum. If already initialized for docId, it's a no-op.
   *   1) Load bytes → Y.Doc
   *   2) Set forumDoc + ready flag
   *   3) Attach change observers and autosave policy
   *   4) Connect realtime room via useForumCollaboration
   */
  const initializeForum = useCallback(async (docId: string): Promise<void> => {
    if (!docId) return;
    if (currentDocIdRef.current === docId && forumDoc) {
      console.log('CommentsContext.tsx [7713] › init:no-op (same docId)');
      return;
    }

    // If switching docs, shutdown first
    if (currentDocIdRef.current && currentDocIdRef.current !== docId) {
      shutdownForum();
    }

    try {
      console.log('CommentsContext.tsx [7701] › init:start', { docId });
      const next = await _loadForumFromStorage(docId);

      setForumDoc(next);
      currentDocIdRef.current = docId;
      setForumDocReady(true);
      setForumStatus((s) => ({ ...s, lastError: null }));

      // attach doc update observer and store detacher in a ref
      if (docUpdateDetachRef.current) {
        try { docUpdateDetachRef.current(); } catch { /* no-op */ }
      }
      docUpdateDetachRef.current = _attachDocUpdateObserver();

      // DO NOT call _observePostsIntoState here; useEffect above handles it per postsRoot

      // Start autosave policy
      _startPeriodicAutosave();

      // Start realtime connection (socket-only)
      await connect(docId, next);
      console.log('CommentsContext.tsx [7711] › connect:requested', { docId });
    } catch (e: any) {
      console.error('CommentsContext.tsx [7793] › init:error', { docId, error: e?.message });
      setForumStatus((s) => ({ ...s, lastError: e?.message ?? 'init error' }));
    }
  }, [
    _loadForumFromStorage,
    _attachDocUpdateObserver,
    _startPeriodicAutosave,
    connect,
    forumDoc,
    shutdownForum,
  ]); 

  // Best-effort save on unload
  useEffect(() => {
    const onUnload = () => {
      
      if (forumDoc && currentDocIdRef.current && dirtySinceRef.current) {
        
        _saveForumToStorage('unload');
      }
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [forumDoc, _saveForumToStorage]); 

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
        console.log('CommentsContext.tsx [7723] › addPost', { id, resourceId });
      }, LOCAL_ORIGIN);
    },
    [forumDoc, postsRoot, authorUID],
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
        console.log('CommentsContext.tsx [7724] › addComment', { postId, commentId: newComment.id });
      }, LOCAL_ORIGIN);
    },
    [forumDoc, postsRoot, authorUID],
  ); 

  const deletePost = useCallback(
    (postId: string) => {
      if (!forumDoc || !postsRoot) return;
      if (!postsRoot.has(postId)) return;
      forumDoc.transact(() => {
        postsRoot.delete(postId);
        console.log('CommentsContext.tsx [7725] › deletePost', { postId });
      }, LOCAL_ORIGIN);
      clearSeenForDeleted(postId);
    },
    [forumDoc, postsRoot, clearSeenForDeleted],
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
    console.log('CommentsContext.tsx [7726] › closeForum');
  }, []);

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
      }}
    >
      {children}
    </CommentsContext.Provider>
  );
};

/**
 * @function useComments
 * @description
 *   Read the full forum SSOT API. Throws outside the provider to prevent silent failures.
 *   All methods are O(1) except persistence, which scales with encoded update bytes O(N).
 */
export function useComments(): CommentsContextType {
  const ctx = useContext(CommentsContext);
  if (!ctx) throw new Error('useComments must be used within CommentsProvider');
  return ctx;
}
