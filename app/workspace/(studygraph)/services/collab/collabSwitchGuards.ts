/**
 * @file collabSwitchGuards.ts
 * @description
 *   This internal module provides two tightly-scoped utilities to eliminate race conditions
 *   during collaboration document switches without requiring any call-site changes. The first
 *   utility, `createOpQueue`, exposes a minimal serialized operation queue that guarantees
 *   connect/disconnect procedures execute one at a time in FIFO order. The second utility,
 *   `awaitProviderClose`, performs a deterministic teardown for a y-websocket `WebsocketProvider`
 *   by issuing a close and awaiting the underlying WebSocket “close” event (with a timeout
 *   fallback) before completing. Together, these helpers enforce a single-active-socket invariant
 *   and remove the overlap window where stale packets from a previously open document socket
 *   could mutate the current Y.Doc. This file is intentionally internal and has no side effects.
 *
 * Responsibilities:
 *   1) Provide a tiny, promise-based operation queue to serialize critical collaboration ops.
 *   2) Provide a robust, timeout-guarded awaitable teardown for the WebsocketProvider.
 *   3) Keep implementation details out of higher-level components to improve maintainability.
 */

import type { WebsocketProvider } from 'y-websocket';

/**
 * @function createOpQueue
 * @description
 *   Creates a minimal FIFO operation queue that serializes asynchronous tasks. Each call to
 *   `run(fn)` chains onto the previous promise, ensuring tasks do not overlap. This is used
 *   to serialize collaboration teardown and setup so only one socket lifecycle operation is
 *   active at a time. The queue self-recovers on failures by continuing the chain.
 *   Big-O: Each enqueue is O(1); tasks execute in insertion order.
 *
 * @param tag A short label used only for log identification.
 * @returns An object exposing a single method `run<T>(op: () => Promise<T>): Promise<T>`.
 */
export function createOpQueue(tag: string) {
  let chain: Promise<unknown> = Promise.resolve();

  return {
    async run<T>(op: () => Promise<T>): Promise<T> {
      const start = Date.now();
      const next = chain.then(async () => {
        // Step 1: Execute the operation once prior tasks resolve.
        // console.log(`[collabSwitchGuards.ts][${tag}][4410] › op start @ ${start}`);  // intentionally quiet
        return op();
      });
      // Step 2: Update the chain to the newly scheduled task while swallowing errors to keep the chain healthy.
      chain = next.then(
        () => {
          // console.log(`[collabSwitchGuards.ts][${tag}][4411] › op done in ${Date.now() - start}ms`);
        },
        () => {
          // console.warn(`[collabSwitchGuards.ts][${tag}][4412] › op failed in ${Date.now() - start}ms`);
        }
      );
      // Step 3: Return the actual result/error to the caller.
      return next;
    },
  };
}

/**
 * @function awaitProviderClose
 * @description
 *   Deterministically tears down a y-websocket `WebsocketProvider` by:
 *   (1) Issuing a WebSocket `close(1000, 'SWITCH_DOC')` when applicable,
 *   (2) Awaiting the underlying socket's `'close'` event with a timeout guard,
 *   (3) Finally calling `provider.destroy()` to release resources.
 *   If the provider or socket is already closed/null, this is a no-op.
 *   The function never throws; it resolves after best-effort teardown.
 *   Big-O: O(1) time and space; only constant work is performed.
 *
 * @param provider The active WebsocketProvider instance or null.
 * @param timeoutMs Optional timeout before giving up waiting for ‘close’. Default 1500ms.
 */
export async function awaitProviderClose(
  provider: WebsocketProvider | null | undefined,
  timeoutMs = 1500
): Promise<void> {
  // Step 1: Fast path—nothing to do.
  if (!provider) return;

  try {
    // Step 2: Attempt to access the underlying WebSocket (y-websocket stores it as `.ws`).
    const ws: any = (provider as any).ws;

    // Step 3: If there is a socket and it is not yet CLOSED (3), try to close and await ‘close’.
    const CLOSED = 3;
    const CLOSING = 2;

    if (ws && typeof ws.readyState === 'number' && ws.readyState !== CLOSED) {
      try {
        // Issue close if not already closing/closed.
        if (ws.readyState !== CLOSING) {
          // Purposeful log: we are about to close the current socket.
          console.log('[collabSwitchGuards.ts][7410] › Requesting WS close (SWITCH_DOC)');
          ws.close(1000, 'SWITCH_DOC');
        }
      } catch (e) {
        console.warn('[collabSwitchGuards.ts][7411] › ws.close() threw, proceeding with teardown');
      }

      // Step 4: Await the 'close' event with a timeout guard.
      await new Promise<void>((resolve) => {
        let done = false;
        const finish = (label: string) => {
          if (done) return;
          done = true;
          console.log(`[collabSwitchGuards.ts][7412] › WS close awaited via ${label}`);
          resolve();
        };

        const onClose = () => finish('event');
        const onTimeout = () => finish('timeout');

        try {
          ws.addEventListener?.('close', onClose);
        } catch {
          // ignore
        }

        setTimeout(onTimeout, Math.max(250, timeoutMs));
      });
    }

    // Step 5: Ensure provider disconnect/destroy is called (idempotent in y-websocket).
    try {
      provider.disconnect();
    } catch {
      /* ignore */
    }
    try {
      provider.destroy();
    } catch {
      /* ignore */
    }
  } catch (e) {
    // Step 6: Best-effort: never throw from teardown; just log.
    console.warn('[collabSwitchGuards.ts][7413] › awaitProviderClose encountered an error; continuing');
  }
}
