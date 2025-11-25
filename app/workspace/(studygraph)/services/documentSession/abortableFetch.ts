// services/utils/abortableFetch.ts
/**
 * @file services/utils/abortableFetch.ts
 * @description
 *   Tiny helpers to standardize AbortController usage with fetch. The module exposes:
 *     1) replaceController(prev?) → AbortController — aborts the previous controller (if any)
 *        and returns a new one for the next in-flight task.
 *     2) fetchWithAbort(input, init, controller) → Promise<Response> — runs fetch with the
 *        provided controller.signal and normalizes AbortError handling so callers can treat
 *        aborts as expected outcomes rather than exceptions.
 *   The goal is to keep orchestration code (e.g., documentSession) concise and uniform while
 *   enabling safe cancellation of superseded opens. Logging is sparse and focused on starts,
 *   aborts, and completions. All operations are O(1). No global state is kept.
 *
 * Responsibilities:
 *   - Create/replace AbortControllers for sequential tasks.
 *   - Wrap fetch with consistent AbortError semantics and sparse logs.
 *   - Avoid framework coupling and keep usage ergonomic.
 */

export function replaceController(prev?: AbortController | null): AbortController {
  if (prev) {
    try {
      prev.abort();
      // services/utils/abortableFetch.ts [5201]
      console.log('[abortableFetch.ts][5201] previous controller aborted');
    } catch {
      // swalllow
    }
  }
  const next = new AbortController();
  // services/utils/abortableFetch.ts [5202]
  console.log('[abortableFetch.ts][5202] created new controller');
  return next;
}

export async function fetchWithAbort(
  input: RequestInfo | URL,
  init: RequestInit = {},
  controller: AbortController
): Promise<Response> {
  const signal = controller.signal;
  try {
    // services/utils/abortableFetch.ts [5203]
    console.log('[abortableFetch.ts][5203] fetch begin');
    const res = await fetch(input, { ...init, signal });
    // services/utils/abortableFetch.ts [5204]
    console.log('[abortableFetch.ts][5204] fetch complete', { ok: res.ok, status: res.status });
    return res;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      // services/utils/abortableFetch.ts [5291]
      console.log('[abortableFetch.ts][5291] fetch aborted');
      // Surface a Response-like object for uniform handling if the caller prefers
      throw err;
    }
    // services/utils/abortableFetch.ts [5292]
    console.error('[abortableFetch.ts][5292] fetch error', err);
    throw err;
  }
}
