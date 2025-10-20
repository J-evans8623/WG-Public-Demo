/**
 * @file app/src/net/SupersedingAwait.ts
 * @description
 *   This module provides a **standalone**, production-ready “awaitable superseding caller” that
 *   mirrors the semantics of our non-awaiting superseder but additionally exposes a Promise that
 *   resolves when the **next successful** response for a given key arrives. It runs with its own
 *   internal registry so it does not modify or depend upon the original `SupersedingCaller.ts`.
 *   Core behaviors: (1) coalesce by key with newest payload winning, (2) abort any in-flight
 *   request when superseded, (3) honor `429` with an exact single reattempt at `Retry-After`,
 *   and (4) notify all registered waiters upon the next `resp.ok`. Logging is minimal, targeted,
 *   and consistent with the app’s observability style. Complexity is O(1) per event; network
 *   dominates cost. This helper is used by flows that must await server acknowledgment (e.g. create).
 *
 * Responsibilities:
 *   1) Provide `supersedingCallAwait(key, payload, makeRequest)` that resolves on next success.
 *   2) Maintain per-key state: latest payload/seq, in-flight abort controller, retry schedule.
 *   3) Ensure exactly one retry timer based on `Retry-After` headers for `429` responses.
 *   4) Safely resolve and clear waiter callbacks on success without leaking memory.
 *   5) Keep implementation entirely independent from the original non-awaiting superseder.
 */

type CallerKey = string;
type MakeRequest = (signal: AbortSignal, payload: unknown) => Promise<Response>;

type State = {
  latestPayload: unknown;
  latestSeq: number;
  inFlight: null | { ac: AbortController; seq: number };
  retryAtMs: number;
  timerId: null | ReturnType<typeof setTimeout>;
  waiters: Array<(resp: Response) => void>;
};

const registry = new Map<CallerKey, State>();

/**
 * @function supersedingCallAwait
 * @description
 *   Register the latest payload for a key and ensure the next request uses it. If a prior call
 *   is in-flight it is aborted, and if `Retry-After` applies a single timer is scheduled. The
 *   returned Promise resolves with the **next successful** Response (i.e., `resp.ok === true`),
 *   regardless of whether that success occurs immediately or after a scheduled retry. Non-429
 *   failures are surfaced by eventually resolving with a later success or by caller cancellation.
 *   This function does not throw on HTTP errors; it resolves only on success.
 *
 * @param key - Stable identifier to coalesce calls (e.g., "docSave:<docId>").
 * @param payload - Arbitrary JSON-compatible data to send on the next attempt.
 * @param makeRequest - A function that performs the fetch and accepts an AbortSignal.
 */
export function supersedingCallAwait(
  key: CallerKey,
  payload: unknown,
  makeRequest: MakeRequest
): Promise<Response> {
  const st = ensureState(key);

  // 1) Register a waiter up-front; it will be resolved on the NEXT success.
  const waiter = new Promise<Response>((resolve) => {
    st.waiters.push(resolve);
  });

  // 2) Update latest payload + sequence
  st.latestPayload = payload;
  st.latestSeq++;
  console.log('[SupersedingAwait.ts][5601] register-latest', { key, seq: st.latestSeq });

  // 3) Abort any stale in-flight
  if (st.inFlight) {
    console.log('[SupersedingAwait.ts][5602] abort in-flight', { key, seq: st.inFlight.seq });
    st.inFlight.ac.abort();
    st.inFlight = null;
  }

  // 4) Schedule or send now
  const now = Date.now();
  if (st.retryAtMs > now) {
    rescheduleTimer(key, makeRequest);
  } else {
    void sendNow(key, makeRequest);
  }

  return waiter;
}

/** Internal: send immediately with the current latest payload. */
async function sendNow(key: CallerKey, makeRequest: MakeRequest): Promise<void> {
  const st = registry.get(key)!;
  const seq = st.latestSeq;
  const currentPayload = st.latestPayload;

  const ac = new AbortController();
  st.inFlight = { ac, seq };
  console.log('[SupersedingAwait.ts][5603] dispatch', { key, seq });

  try {
    const resp = await makeRequest(ac.signal, currentPayload);

    // Superseded while awaiting? Ignore outcome.
    if (seq !== st.latestSeq) {
      console.log('[SupersedingAwait.ts][5604] stale-response ignored', { key, seq, latest: st.latestSeq });
      st.inFlight = null;
      return;
    }

    if (resp.status === 429) {
      const ra = parseRetryAfterSeconds(resp) ?? 1;
      st.inFlight = null;
      st.retryAtMs = Date.now() + ra * 1000;
      console.log('[SupersedingAwait.ts][5605] 429 schedule', { key, retryAfterSec: ra });
      rescheduleTimer(key, makeRequest);
      return;
    }

    if (resp.ok) {
      st.inFlight = null;
      st.retryAtMs = 0;
      if (st.timerId) {
        clearTimeout(st.timerId);
        st.timerId = null;
      }
      console.log('[SupersedingAwait.ts][5606] success', { key, seq });
      flushWaiters(st, resp);
      return;
    }

    // Non-429 failure: allow caller to re-enqueue by calling us again with newer payload.
    st.inFlight = null;
    console.warn('[SupersedingAwait.ts][5607] non-429 failure', { key, status: resp.status });
    // Intentionally do not auto-retry here; upstream will typically re-call with fresher payload.
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      console.log('[SupersedingAwait.ts][5608] aborted (superseded)', { key, seq });
      st.inFlight = null;
      return;
    }
    console.error('[SupersedingAwait.ts][5609] exception', { key, error: String(e) });
    st.inFlight = null;
  }
}

/** Internal: ensure exactly one timer for a pending Retry-After window. */
function rescheduleTimer(key: CallerKey, makeRequest: MakeRequest) {
  const st = registry.get(key)!;
  if (st.timerId) {
    clearTimeout(st.timerId);
    st.timerId = null;
  }
  const delay = Math.max(0, st.retryAtMs - Date.now());
  console.log('[SupersedingAwait.ts][5610] set-timer', { key, delayMs: delay });
  st.timerId = setTimeout(() => {
    st.timerId = null;
    void sendNow(key, makeRequest);
  }, delay);
}

/** Internal: parse Retry-After header as seconds. */
function parseRetryAfterSeconds(resp: Response): number | null {
  const h = resp.headers.get('Retry-After');
  if (!h) return null;
  const n = Number(h);
  return Number.isFinite(n) ? Math.max(1, Math.floor(n)) : null;
}

/** Internal: get or create per-key state. */
function ensureState(key: CallerKey): State {
  let st = registry.get(key);
  if (!st) {
    st = {
      latestPayload: null,
      latestSeq: 0,
      inFlight: null,
      retryAtMs: 0,
      timerId: null,
      waiters: [],
    };
    registry.set(key, st);
    console.log('[SupersedingAwait.ts][5611] create-state', { key });
  }
  return st;
}

/** Internal: resolve and clear all waiter callbacks with the successful response. */
function flushWaiters(st: State, resp: Response) {
  if (!st.waiters.length) return;
  const ws = st.waiters.slice(0);
  st.waiters.length = 0;
  ws.forEach(fn => {
    try { fn(resp); } catch { /* no-op */ }
  });
}
