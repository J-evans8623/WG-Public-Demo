// app/src/net/SupersedingCaller.ts
/**
 * @file app/src/net/SupersedingCaller.ts
 * @responsibility
 *   Reusable client-side caller that guarantees "latest snapshot wins".
 *   - Coalesces multiple save attempts into one in-flight or scheduled call per key.
 *   - On 429, respects Retry-After exactly once and schedules a single retry timer.
 *   - If new data arrives before the retry fires, it replaces the queued payload (flushes stale).
 *   - If a previous call is in-flight, it is aborted, and the latest payload is sent/scheduled.
 *   This is endpoint-agnostic and can be reused across your 15+ APIs.
 */

type CallerKey = string; // e.g. "userData:doc:<docId>"

type MakeRequest = (signal: AbortSignal, payload: unknown) => Promise<Response>;

type State = {
  latestPayload: unknown;
  latestSeq: number;                  // monotonically increasing; newest snapshot wins
  inFlight: null | { ac: AbortController; seq: number };
  retryAtMs: number;                  // 0 if no retry scheduled
  timerId: null | ReturnType<typeof setTimeout>;
};

const registry = new Map<CallerKey, State>();

/**
 * supersedingCall
 * @purpose
 *   Public entry point: register/update the latest payload and ensure that the
 *   next network attempt uses this payload (now or at the scheduled retry time).
 * @steps
 *   1) Get or create state for the key; bump latestSeq and store latestPayload.
 *   2) Abort any in-flight call (we’ll send the newest payload).
 *   3) If we’re inside a Retry-After window, (re)schedule a single timer and return.
 *   4) Otherwise, send immediately. Handle 200/429/errors accordingly.
 */
export async function supersedingCall(
  key: CallerKey,
  payload: unknown,
  makeRequest: MakeRequest
): Promise<Response | null> {
  const st = ensureState(key);
  st.latestPayload = payload;
  st.latestSeq++;

  // 1) Abort any in-flight (flush stale in-progress work)
  if (st.inFlight) {
    st.inFlight.ac.abort();
    st.inFlight = null;
  }

  // 2) If we must wait due to Retry-After, (re)schedule a single wake-up and exit.
  const now = Date.now();
  if (st.retryAtMs > now) {
    rescheduleTimer(key, makeRequest);
    return null;
  }

  // 3) Send now
  return sendNow(key, makeRequest);
}




/**
 * sendNow
 * @purpose
 *   Fire the PUT/POST immediately with the latest payload.
 * @steps
 *   1) Snapshot seq + payload.
 *   2) Create an AbortController; mark inFlight.
 *   3) Await request.
 *   4) On 200–299: clear inFlight/timer/retryAt if this response is for the latest seq.
 *   5) On 429: parse Retry-After, schedule a single retry; leave latest payload intact.
 *   6) On abort: ignore (we superseded). On other errors: minimal backoff is optional.
 */
async function sendNow(key: CallerKey, makeRequest: MakeRequest): Promise<Response | null> {
  const st = registry.get(key)!;

  const seq = st.latestSeq;
  const currentPayload = st.latestPayload;

  const ac = new AbortController();
  st.inFlight = { ac, seq };

  try {
    const resp = await makeRequest(ac.signal, currentPayload);

    // If this is not the latest sequence anymore, ignore the outcome.
    if (seq !== st.latestSeq) {
      st.inFlight = null;
      return null;
    }

    if (resp.status === 429) {
      const ra = parseRetryAfterSeconds(resp) ?? 1;
      st.inFlight = null;
      st.retryAtMs = Date.now() + ra * 1000;
      rescheduleTimer(key, makeRequest);
      return resp;
    }

    if (resp.ok) {
      // Success for the latest seq: clear all state
      st.inFlight = null;
      st.retryAtMs = 0;
      if (st.timerId) {
        clearTimeout(st.timerId);
        st.timerId = null;
      }
      return resp;
    }

    // Non-429 error: leave latest payload; optional small delay then retry, or bubble up.
    st.inFlight = null;
    return resp;
  } catch (e: any) {
    // If we aborted due to superseding, ignore. Otherwise, surface the error.
    if (e?.name === 'AbortError') {
      st.inFlight = null;
      return null;
    }
    st.inFlight = null;
    return null;
  }
}

/**
 * rescheduleTimer
 * @purpose
 *   Ensure exactly one timer exists and will fire at retryAtMs, using whatever the
 *   latest payload is at that moment (thus older data is flushed).
 */
function rescheduleTimer(key: CallerKey, makeRequest: MakeRequest) {
  const st = registry.get(key)!;
  if (st.timerId) {
    clearTimeout(st.timerId);
    st.timerId = null;
  }
  const delay = Math.max(0, st.retryAtMs - Date.now());
  st.timerId = setTimeout(() => {
    st.timerId = null;
    // If a newer payload arrives before this fires, latestSeq/payload will be different — perfect.
    sendNow(key, makeRequest);
  }, delay);
}

/** Utility: parse Retry-After header in seconds. */
function parseRetryAfterSeconds(resp: Response): number | null {
  const h = resp.headers.get('Retry-After');
  if (!h) return null;
  const n = Number(h);
  return Number.isFinite(n) ? Math.max(1, Math.floor(n)) : null;
}

function ensureState(key: CallerKey): State {
  let st = registry.get(key);
  if (!st) {
    st = { latestPayload: null, latestSeq: 0, inFlight: null, retryAtMs: 0, timerId: null };
    registry.set(key, st);
  }
  return st;
}
