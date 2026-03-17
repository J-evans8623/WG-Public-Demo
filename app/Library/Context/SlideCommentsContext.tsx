/**
 * @file SlideCommentsContext.tsx
 * @description
 * This file defines the single, document-scoped React context responsible for managing slide comments
 * during an active WiseGraph study session. Its core responsibility is to act as the frontend comment
 * data layer that sits between UI components and the authenticated BFF endpoints. The provider maintains
 * an indexed in-memory cache of comments for all slides in the active document, exposes O(1) lookup by
 * slideId, and performs optimistic create, update, and delete operations so the UI feels instant even
 * when network requests take time to resolve. This file also centralizes loading, reconciliation, and
 * rollback behavior so future consumers such as SlideShowOverlay or SlideCommentsModal remain thin and
 * do not need to know anything about endpoint shapes, fetch semantics, or error recovery. The provider
 * intentionally remains document-scoped rather than slideshow-scoped so one hydrated comment dataset can
 * support fast navigation across all slides in the active document without redundant fetches.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import type {
  Comment,
  CommentsBySlideId,
  CreateSlideCommentInput,
  DeleteSlideCommentInput,
  SlideCommentRecord,
  UpdateSlideCommentInput,
} from '@/app/Library/Definitions/Definitions';
import { useYDoc } from '@/app/Library/Context/YDocContext'; 

/**
 * @interface SlideCommentsState
 * @description
 * Document-scoped state container for the comment session cache. The state tracks the active document id,
 * hydration/loading flags, an indexed comment map for O(1) slide lookup, and a small error channel for
 * later operational visibility when optimistic background work fails.
 */
interface SlideCommentsState {
  activeDocId: string | null;
  commentsBySlideId: CommentsBySlideId;
  isHydrated: boolean;
  isLoading: boolean;
  error: string | null;
}

/**
 * @interface SlideCommentsContextValue
 * @description
 * Public API exposed to slideshow consumers. The interface is intentionally shaped around the PRD:
 * document-level loading, current-slide retrieval, optimistic create/update/delete, cache clearing,
 * and reconciliation helpers for swapping temporary optimistic records with persisted backend records.
 * In Phase 3, the loading and CRUD methods become network-backed async operations while preserving an
 * instant optimistic experience for consumers.
 */
interface SlideCommentsContextValue {
  activeDocId: string | null;
  isHydrated: boolean;
  isLoading: boolean;
  error: string | null;
  commentsBySlideId: CommentsBySlideId;
  // update - 1.1
  loadDocumentComments: (docId: string) => Promise<void>;
  // update - 1.2
  clearDocumentComments: () => void;
  getCommentsForSlide: (slideId: string) => SlideCommentRecord[];
  getCommentCountForSlide: (slideId: string) => number;
  hasCommentsForSlide: (slideId: string) => boolean;
  // update - 1.3
  createComment: (input: CreateSlideCommentInput) => Promise<Comment | null>;
  // update - 1.4
  updateComment: (input: UpdateSlideCommentInput) => Promise<Comment | null>;
  // update - 1.5
  deleteComment: (input: DeleteSlideCommentInput) => Promise<boolean>;
}

type SlideCommentsAction =
  | { type: 'SET_LOADING'; payload: { docId: string } }
  | { type: 'SET_ERROR'; payload: { message: string | null } }
  | { type: 'LOAD_DOCUMENT_COMMENTS'; payload: { docId: string; comments: Comment[] } }
  | { type: 'CLEAR_DOCUMENT_COMMENTS' }
  | { type: 'CREATE_COMMENT'; payload: { comment: SlideCommentRecord } }
  | { type: 'UPDATE_COMMENT'; payload: { commentId: string; text: string; updatedAt: string } }
  | { type: 'DELETE_COMMENT'; payload: { commentId: string } }
  | { type: 'RECONCILE_CREATED_COMMENT'; payload: { temporaryCommentId: string; persistedComment: Comment } }
  | { type: 'RECONCILE_UPDATED_COMMENT'; payload: { persistedComment: Comment } }
  | { type: 'ROLLBACK_CREATED_COMMENT'; payload: { temporaryCommentId: string } }
  | { type: 'ROLLBACK_UPDATED_COMMENT'; payload: { previousComment: SlideCommentRecord } }
  | { type: 'ROLLBACK_DELETED_COMMENT'; payload: { deletedComment: SlideCommentRecord } };

const initialState: SlideCommentsState = {
  activeDocId: null,
  commentsBySlideId: {},
  isHydrated: false,
  isLoading: false,
  error: null,
};

const SlideCommentsContext = createContext<SlideCommentsContextValue | undefined>(undefined);

/**
 * @function createIsoTimestamp
 * @description
 * Generates a transport-safe ISO timestamp for optimistic session work. This keeps local optimistic
 * records aligned with the canonical shared `Comment` contract while remaining independent of backend
 * timestamp serialization details.
 */
function createIsoTimestamp(): string {
  return new Date().toISOString();
}

/**
 * @function createTemporaryCommentId
 * @description
 * Generates a deterministic-feeling temporary id for optimistic comment creation. The goal is not
 * cryptographic uniqueness but rather a stable session-safe identifier that can later be reconciled
 * with the persisted server id returned by backend endpoints.
 */
function createTemporaryCommentId(slideId: string): string {
  return `temp-comment-${slideId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * @function normalizePersistedComment
 * @description
 * Converts a canonical persisted comment into the session-level record shape used by the context.
 * This ensures all hydrated comments start in a synchronized state and that later selectors operate
 * against one consistent internal structure.
 */
function normalizePersistedComment(comment: Comment): SlideCommentRecord {
  return {
    ...comment,
    syncState: 'synced',
    isOptimistic: false,
  };
}

/**
 * @function indexCommentsBySlideId
 * @description
 * Normalizes a flat comment collection into an O(1) slide-indexed map. This operation is O(N) over the
 * incoming comment list and is intentionally centralized here so later hydration logic never duplicates
 * indexing work in consuming UI components.
 */
function indexCommentsBySlideId(comments: Comment[]): CommentsBySlideId {
  return comments.reduce<CommentsBySlideId>((accumulator, comment) => {
    const normalizedComment = normalizePersistedComment(comment);
    const slideBucket = accumulator[normalizedComment.slideId] ?? [];
    slideBucket.push(normalizedComment);
    accumulator[normalizedComment.slideId] = slideBucket;
    return accumulator;
  }, {});
}

/**
 * @function replaceCommentInIndex
 * @description
 * Replaces an existing comment by id inside the indexed slide map. The function performs O(S + C) work
 * in the worst case across indexed slides and per-slide comments, which is acceptable here because it is
 * used only during explicit reconciliation or rollback boundaries rather than hot-path lookups.
 */
function replaceCommentInIndex(
  commentsBySlideId: CommentsBySlideId,
  nextComment: SlideCommentRecord,
  targetCommentId: string
): CommentsBySlideId {
  const nextIndex: CommentsBySlideId = { ...commentsBySlideId };

  for (const [slideId, comments] of Object.entries(nextIndex)) {
    const targetIndex = comments.findIndex((comment) => comment.id === targetCommentId);

    if (targetIndex >= 0) {
      const updatedComments = [...comments];
      updatedComments[targetIndex] = nextComment;

      if (nextComment.slideId !== slideId) {
        nextIndex[slideId] = updatedComments.filter((comment) => comment.id !== targetCommentId);
        nextIndex[nextComment.slideId] = [...(nextIndex[nextComment.slideId] ?? []), nextComment];
      } else {
        nextIndex[slideId] = updatedComments;
      }

      return nextIndex;
    }
  }

  return nextIndex;
}

/**
 * @function removeCommentFromIndex
 * @description
 * Removes a comment by id from the indexed slide map and returns both the updated index and the removed
 * record when present. The helper centralizes deletion behavior so optimistic delete and rollback logic
 * do not duplicate search and splice steps across multiple reducer branches.
 */
function removeCommentFromIndex(
  commentsBySlideId: CommentsBySlideId,
  targetCommentId: string
): { nextIndex: CommentsBySlideId; removedComment: SlideCommentRecord | null } {
  const nextIndex: CommentsBySlideId = { ...commentsBySlideId };

  for (const [slideId, comments] of Object.entries(nextIndex)) {
    const targetIndex = comments.findIndex((comment) => comment.id === targetCommentId);

    if (targetIndex >= 0) {
      const removedComment = comments[targetIndex];
      const updatedComments = comments.filter((comment) => comment.id !== targetCommentId);

      nextIndex[slideId] = updatedComments;
      return { nextIndex, removedComment };
    }
  }

  return { nextIndex, removedComment: null };
}

// update - 2.1
/**
 * @function findCommentInIndex
 * @description
 * Searches for a specific comment record across the indexed slide map and returns the matching comment
 * when found. This helper is used by optimistic update/delete flows to derive the current persisted
 * identifiers needed for backend requests without forcing UI consumers to pass redundant document data.
 * The lookup is O(S + C) in the worst case and is acceptable because it runs only during explicit user
 * mutations rather than on hot-path render selectors.
 */
function findCommentInIndex(
  commentsBySlideId: CommentsBySlideId,
  targetCommentId: string
): SlideCommentRecord | null {
  for (const comments of Object.values(commentsBySlideId)) {
    const matchedComment = comments.find((comment) => comment.id === targetCommentId);
    if (matchedComment) {
      return matchedComment;
    }
  }

  return null;
}

// update - 2.2
/**
 * @function parseJsonResponse
 * @description
 * Reads and parses a fetch Response safely, returning `null` when the body is empty or invalid JSON.
 * This prevents repeated defensive parsing logic across all network methods and keeps mutation flows
 * concise while still allowing meaningful error extraction from BFF endpoint responses.
 */
async function parseJsonResponse(response: Response): Promise<any | null> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * @function slideCommentsReducer
 * @description
 * Reducer implementing all document hydration, optimistic CRUD, and reconciliation state transitions for
 * the Slide Comment System. Each branch performs only the minimum mutation needed to keep the state
 * coherent, predictable, and ready for backend synchronization in later phases.
 */
function slideCommentsReducer(
  state: SlideCommentsState,
  action: SlideCommentsAction
): SlideCommentsState {
  switch (action.type) {
    case 'SET_LOADING': {
      return {
        ...state,
        activeDocId: action.payload.docId,
        isLoading: true,
        error: null,
      };
    }

    case 'SET_ERROR': {
      return {
        ...state,
        error: action.payload.message,
        isLoading: false,
      };
    }

    case 'LOAD_DOCUMENT_COMMENTS': {
      return {
        activeDocId: action.payload.docId,
        commentsBySlideId: indexCommentsBySlideId(action.payload.comments),
        isHydrated: true,
        isLoading: false,
        error: null,
      };
    }

    case 'CLEAR_DOCUMENT_COMMENTS': {
      return initialState;
    }

    case 'CREATE_COMMENT': {
      const nextIndex: CommentsBySlideId = { ...state.commentsBySlideId };
      const slideComments = nextIndex[action.payload.comment.slideId] ?? [];
      nextIndex[action.payload.comment.slideId] = [...slideComments, action.payload.comment];

      return {
        ...state,
        commentsBySlideId: nextIndex,
        error: null,
      };
    }

    case 'UPDATE_COMMENT': {
      const nextIndex: CommentsBySlideId = { ...state.commentsBySlideId };

      for (const [slideId, comments] of Object.entries(nextIndex)) {
        const targetIndex = comments.findIndex((comment) => comment.id === action.payload.commentId);

        if (targetIndex >= 0) {
          const updatedComments = [...comments];
          updatedComments[targetIndex] = {
            ...updatedComments[targetIndex],
            text: action.payload.text,
            updatedAt: action.payload.updatedAt,
            syncState:
              updatedComments[targetIndex].isOptimistic || updatedComments[targetIndex].syncState === 'pending-create'
                ? 'pending-create'
                : 'pending-update',
          };
          nextIndex[slideId] = updatedComments;

          return {
            ...state,
            commentsBySlideId: nextIndex,
            error: null,
          };
        }
      }

      return state;
    }

    case 'DELETE_COMMENT': {
      const deletionResult = removeCommentFromIndex(state.commentsBySlideId, action.payload.commentId);

      return {
        ...state,
        commentsBySlideId: deletionResult.nextIndex,
        error: null,
      };
    }

    case 'RECONCILE_CREATED_COMMENT': {
      const reconciledComment = normalizePersistedComment(action.payload.persistedComment);

      return {
        ...state,
        commentsBySlideId: replaceCommentInIndex(
          state.commentsBySlideId,
          reconciledComment,
          action.payload.temporaryCommentId
        ),
        error: null,
      };
    }

    case 'RECONCILE_UPDATED_COMMENT': {
      const reconciledComment = normalizePersistedComment(action.payload.persistedComment);

      return {
        ...state,
        commentsBySlideId: replaceCommentInIndex(
          state.commentsBySlideId,
          reconciledComment,
          action.payload.persistedComment.id
        ),
        error: null,
      };
    }

    case 'ROLLBACK_CREATED_COMMENT': {
      const rollbackResult = removeCommentFromIndex(state.commentsBySlideId, action.payload.temporaryCommentId);

      return {
        ...state,
        commentsBySlideId: rollbackResult.nextIndex,
      };
    }

    case 'ROLLBACK_UPDATED_COMMENT': {
      const restoredComment: SlideCommentRecord = {
        ...action.payload.previousComment,
        syncState: 'synced',
        isOptimistic: false,
      };

      return {
        ...state,
        commentsBySlideId: replaceCommentInIndex(
          state.commentsBySlideId,
          restoredComment,
          action.payload.previousComment.id
        ),
      };
    }

    case 'ROLLBACK_DELETED_COMMENT': {
      const nextIndex: CommentsBySlideId = { ...state.commentsBySlideId };
      const restoredComment: SlideCommentRecord = {
        ...action.payload.deletedComment,
        syncState: 'synced',
        isOptimistic: false,
      };

      nextIndex[restoredComment.slideId] = [...(nextIndex[restoredComment.slideId] ?? []), restoredComment];

      return {
        ...state,
        commentsBySlideId: nextIndex,
      };
    }

    default:
      return state;
  }
}

/**
 * @function SlideCommentsProvider
 * @description
 * Provides document-scoped comment state and public comment operations to slideshow consumers. The provider
 * owns hydration state, indexed storage, optimistic CRUD, rollback/reconciliation helpers, and in Phase 3
 * also owns all network communication with the authenticated BFF comment endpoints. This ensures consuming
 * UI components remain focused on rendering and user interaction rather than fetch orchestration.
 */
export const SlideCommentsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(slideCommentsReducer, initialState);
  const { docFileID } = useYDoc();

  /**
   * @description
   * Tracks the most recent document load request so stale responses do not overwrite newer document
   * hydration results when the active document changes quickly.
   */
  const latestLoadRequestIdRef = useRef<string | null>(null);


    /**
   * @description
   * Tracks the last document id that the provider synchronized against so we can detect document switches,
   * clear stale cache immediately, and avoid carrying comments from one notebook into another.
   */
  const lastSyncedDocIdRef = useRef<string | null>(null);

  // update - 3.2
  /**
   * @function setDocumentError
   * @description
   * Stores or clears a document-level error message associated with hydration or background synchronization.
   * This helper remains internal to the provider’s async workflows so consumers interact only with the public
   * data API and read state via `error`.
   */
  const setDocumentError = useCallback((message: string | null) => {
    dispatch({
      type: 'SET_ERROR',
      payload: { message },
    });
  }, []);

  // update - 3.3
  /**
   * @function loadDocumentComments
   * @description
   * Loads all comments for the provided document from the authenticated BFF endpoint, then normalizes and
   * hydrates the session cache. The method is document-scoped and uses a request token guard so stale
   * responses are ignored when multiple document loads overlap.
   */
  const loadDocumentComments = useCallback(async (docId: string): Promise<void> => {
    const requestId = `load-${docId}-${Date.now()}`;
    latestLoadRequestIdRef.current = requestId;

    dispatch({
      type: 'SET_LOADING',
      payload: { docId },
    });

    lastSyncedDocIdRef.current = docId;

    try {
      const response = await fetch(`/api/comments?docId=${encodeURIComponent(docId)}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      const payload = await parseJsonResponse(response);

      if (latestLoadRequestIdRef.current !== requestId) {
        return;
      }

      if (!response.ok) {
        throw new Error(payload?.error ?? 'Failed to load document comments');
      }

      const comments: Comment[] = Array.isArray(payload?.comments) ? payload.comments : [];

      dispatch({
        type: 'LOAD_DOCUMENT_COMMENTS',
        payload: { docId, comments },
      });
    } catch (error: any) {
      if (latestLoadRequestIdRef.current !== requestId) {
        return;
      }

      setDocumentError(error?.message ?? 'Failed to load document comments');
    }
  }, [setDocumentError]);

  /**
   * @function clearDocumentComments
   * @description
   * Resets the provider to an empty initial state. This is useful when the active document changes and the
   * calling layer wants to ensure no stale comment cache survives across sessions.
   */
  const clearDocumentComments = useCallback(() => {
    latestLoadRequestIdRef.current = null;
    dispatch({ type: 'CLEAR_DOCUMENT_COMMENTS' });
  }, []);

  /**
   * @function getCommentsForSlide
   * @description
   * Returns the comment list for a single slide in O(1) time using the indexed state map. This is one of the
   * central guarantees of the PRD because slideshow navigation should never require re-scanning the full
   * document comment collection.
   */
  const getCommentsForSlide = useCallback(
    (slideId: string): SlideCommentRecord[] => {
      return state.commentsBySlideId[slideId] ?? [];
    },
    [state.commentsBySlideId]
  );

  /**
   * @function getCommentCountForSlide
   * @description
   * Returns the number of comments for a single slide in O(1) time. This helper exists so later slideshow UI
   * can render comment badges and presence indicators without duplicating length logic in the component tree.
   */
  const getCommentCountForSlide = useCallback(
    (slideId: string): number => {
      return (state.commentsBySlideId[slideId] ?? []).length;
    },
    [state.commentsBySlideId]
  );

  /**
   * @function hasCommentsForSlide
   * @description
   * Returns a boolean presence check for slide comments in O(1) time. This supports future trigger styling and
   * keeps presence logic semantically separate from count rendering.
   */
  const hasCommentsForSlide = useCallback(
    (slideId: string): boolean => {
      return (state.commentsBySlideId[slideId] ?? []).length > 0;
    },
    [state.commentsBySlideId]
  );

  // update - 3.4
  /**
   * @function createComment
   * @description
   * Performs an optimistic create mutation by first inserting a temporary comment into local state, then
   * calling the authenticated BFF create endpoint in the background. Success replaces the optimistic record
   * with the authoritative persisted comment; failure rolls back the local insertion and surfaces an error.
   */
  const createComment = useCallback(async (input: CreateSlideCommentInput): Promise<Comment | null> => {
    const timestamp = createIsoTimestamp();

    const optimisticComment: SlideCommentRecord = {
      id: createTemporaryCommentId(input.slideId),
      docId: input.docId,
      lessonId: input.lessonId,
      slideId: input.slideId,
      userId: input.userId,
      text: input.text,
      createdAt: timestamp,
      updatedAt: timestamp,
      syncState: 'pending-create',
      isOptimistic: true,
      requestId: `create-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };

    dispatch({
      type: 'CREATE_COMMENT',
      payload: { comment: optimisticComment },
    });

    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          docId: input.docId,
          lessonId: input.lessonId,
          slideId: input.slideId,
          text: input.text,
        }),
      });

      const payload = await parseJsonResponse(response);

      if (!response.ok) {
        throw new Error(payload?.error ?? 'Failed to create comment');
      }

      const persistedComment: Comment | null = payload?.comment ?? null;

      if (!persistedComment) {
        throw new Error('Create comment response did not include comment payload');
      }

      dispatch({
        type: 'RECONCILE_CREATED_COMMENT',
        payload: {
          temporaryCommentId: optimisticComment.id,
          persistedComment,
        },
      });

      setDocumentError(null);
      return persistedComment;
    } catch (error: any) {
      dispatch({
        type: 'ROLLBACK_CREATED_COMMENT',
        payload: {
          temporaryCommentId: optimisticComment.id,
        },
      });

      setDocumentError(error?.message ?? 'Failed to create comment');
      return null;
    }
  }, [setDocumentError]);

  // update - 3.5
  /**
   * @function updateComment
   * @description
   * Performs an optimistic update mutation by patching the cached comment immediately, then issuing a
   * background PUT request using identifiers derived from the current indexed cache. On success the local
   * comment is reconciled with backend truth; on failure the previous snapshot is restored.
   */
  const updateComment = useCallback(async (input: UpdateSlideCommentInput): Promise<Comment | null> => {
    const existingComment = findCommentInIndex(state.commentsBySlideId, input.commentId);

    if (!existingComment) {
      setDocumentError('Failed to update comment: comment not found in cache');
      return null;
    }

    const optimisticUpdatedAt = createIsoTimestamp();

    dispatch({
      type: 'UPDATE_COMMENT',
      payload: {
        commentId: input.commentId,
        text: input.text,
        updatedAt: optimisticUpdatedAt,
      },
    });

    const previousCommentSnapshot: SlideCommentRecord = { ...existingComment };

    try {
      const response = await fetch(`/api/comments/${encodeURIComponent(input.commentId)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          docId: existingComment.docId,
          text: input.text,
        }),
      });

      const payload = await parseJsonResponse(response);

      if (!response.ok) {
        throw new Error(payload?.error ?? 'Failed to update comment');
      }

      const persistedComment: Comment | null = payload?.comment ?? null;

      if (!persistedComment) {
        throw new Error('Update comment response did not include comment payload');
      }

      dispatch({
        type: 'RECONCILE_UPDATED_COMMENT',
        payload: {
          persistedComment,
        },
      });

      setDocumentError(null);
      return persistedComment;
    } catch (error: any) {
      dispatch({
        type: 'ROLLBACK_UPDATED_COMMENT',
        payload: {
          previousComment: previousCommentSnapshot,
        },
      });

      setDocumentError(error?.message ?? 'Failed to update comment');
      return null;
    }
  }, [state.commentsBySlideId, setDocumentError]);

  // update - 3.6
  /**
   * @function deleteComment
   * @description
   * Performs an optimistic delete mutation by removing the cached comment immediately, then issuing a
   * background DELETE request. The method derives docId from the cached record, rolls back on failure,
   * and returns a boolean that indicates whether the deletion ultimately succeeded.
   */
  const deleteComment = useCallback(async (input: DeleteSlideCommentInput): Promise<boolean> => {
    const existingComment = findCommentInIndex(state.commentsBySlideId, input.commentId);

    if (!existingComment) {
      setDocumentError('Failed to delete comment: comment not found in cache');
      return false;
    }

    const deletedCommentSnapshot: SlideCommentRecord = {
      ...existingComment,
      syncState: 'pending-delete',
    };

    dispatch({
      type: 'DELETE_COMMENT',
      payload: {
        commentId: input.commentId,
      },
    });

    try {
      const response = await fetch(
        `/api/comments/${encodeURIComponent(input.commentId)}?docId=${encodeURIComponent(existingComment.docId)}`,
        {
          method: 'DELETE',
          headers: {
            Accept: 'application/json',
          },
        }
      );

      const payload = await parseJsonResponse(response);

      if (!response.ok) {
        throw new Error(payload?.error ?? 'Failed to delete comment');
      }

      setDocumentError(null);
      return true;
    } catch (error: any) {
      dispatch({
        type: 'ROLLBACK_DELETED_COMMENT',
        payload: {
          deletedComment: deletedCommentSnapshot,
        },
      });

      setDocumentError(error?.message ?? 'Failed to delete comment');
      return false;
    }
  }, [state.commentsBySlideId, setDocumentError]);



  /**
   * @effect
   * Synchronizes the comment cache with the real active document from YDocContext. When the document id
   * changes, the provider clears stale state immediately and then loads the comments for the newly active
   * document. This makes YDocContext the authoritative source of document identity for the comment system.
   */
  useEffect(() => {
    if (!docFileID) {
      if (lastSyncedDocIdRef.current !== null || state.activeDocId !== null || state.isHydrated) {
        clearDocumentComments();
        lastSyncedDocIdRef.current = null;
      }
      return;
    }

    const documentSwitched = lastSyncedDocIdRef.current !== docFileID;
    const providerOutOfSync = state.activeDocId !== docFileID;
    const shouldHydrate = documentSwitched || providerOutOfSync || !state.isHydrated;

    if (!shouldHydrate || state.isLoading) {
      return;
    }

    if (documentSwitched && (state.activeDocId !== null || state.isHydrated)) {
      clearDocumentComments();
    }

    void loadDocumentComments(docFileID);
  }, [
    docFileID,
    state.activeDocId,
    state.isHydrated,
    state.isLoading,
    clearDocumentComments,
    loadDocumentComments,
  ]);

  const value = useMemo<SlideCommentsContextValue>(
    () => ({
      activeDocId: state.activeDocId,
      isHydrated: state.isHydrated,
      isLoading: state.isLoading,
      error: state.error,
      commentsBySlideId: state.commentsBySlideId,
      loadDocumentComments,
      clearDocumentComments,
      getCommentsForSlide,
      getCommentCountForSlide,
      hasCommentsForSlide,
      createComment,
      updateComment,
      deleteComment,
    }),
    [
      state.activeDocId,
      state.isHydrated,
      state.isLoading,
      state.error,
      state.commentsBySlideId,
      loadDocumentComments,
      clearDocumentComments,
      getCommentsForSlide,
      getCommentCountForSlide,
      hasCommentsForSlide,
      createComment,
      updateComment,
      deleteComment,
    ]
  );

  return <SlideCommentsContext.Provider value={value}>{children}</SlideCommentsContext.Provider>;
};

/**
 * @function useSlideComments
 * @description
 * Accessor hook for the document-scoped slide comments context. Throws immediately when used outside the
 * provider so integration errors fail fast and are easy to diagnose during UI wiring.
 */
export function useSlideComments(): SlideCommentsContextValue {
  const context = useContext(SlideCommentsContext);

  if (!context) {
    throw new Error('useSlideComments must be used within a SlideCommentsProvider');
  }

  return context;
}