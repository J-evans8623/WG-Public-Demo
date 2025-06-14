/***************************************************************************************
 * @file useFirestoreStream.ts
 * @description
 *   React hook to:
 *     1) Fetch a short‐lived Custom Token from our BFF (`/api/lessonStreamToken`)
 *     2) Sign in with that token
 *     3) Subscribe to Firestore chunks for a given `fileId`
 *     4) Invoke `onChunk` for each incoming chunk, and `onEnd` at stream end
 *
 * Changes:
 *  • New file for Phase 3.
 *  • Uses `listenChunks` from `firestoreLessonStream.ts`.
 *  • Authenticates via `signInWithCustomToken(auth, token)`.
 ***************************************************************************************/

import { useEffect } from 'react';
import { auth } from '@/app/src/utils/firebaseClient';
import { signInWithCustomToken } from 'firebase/auth';
import { listenChunks, Chunk } from '@/app/src/utils/firestoreLessonStream';

export interface UseFirestoreStreamOptions {
  /** Called for every new chunk */
  onChunk: (chunk: Chunk) => void;
  /** Called once the stream ends */
  onEnd: () => void;
}

/**
 * Subscribe to lesson‐stream chunks in Firestore.
 * Cleans up (unsubscribes) when `fileId` changes or component unmounts.
 */
export function useFirestoreStream(
  fileId: string,
  { onChunk, onEnd }: UseFirestoreStreamOptions
) {
  useEffect(() => {
    if (!fileId) return;

    let unsubscribeFn: () => void;

    (async () => {
      // 1) Get a custom Firebase Auth token scoped to this fileId
      const resp = await fetch(`/api/lessonStreamToken?fileId=${encodeURIComponent(fileId)}`);
      if (!resp.ok) throw new Error('Failed to retrieve stream token');
      const { token } = await resp.json();

      // 2) Sign in silently
      await signInWithCustomToken(auth, token);

      // 3) Start listening to Firestore
      unsubscribeFn = listenChunks(fileId, onChunk, onEnd);
    })().catch(err => {
      console.error('[useFirestoreStream]', err);
    });

    // 4) Cleanup on unmount or fileId change
    return () => {
      unsubscribeFn?.();
    };
  }, [fileId, onChunk, onEnd]);
}
