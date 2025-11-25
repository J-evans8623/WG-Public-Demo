// services/utils/singleFlight.ts
/**
 * @file services/utils/singleFlight.ts
 * @description
 *   A minimal, dependency-free “single-flight” utility for deduplicating concurrent async
 *   work by a key (e.g., a document ID). The helper ensures that for any given key, at most
 *   one producer function executes at a time; all concurrent callers receive the *same*
 *   underlying promise. This cuts wasteful duplicate opens/fetches and eliminates interleaved
 *   results that can cause stale commits. The surface is intentionally tiny:
 *     1) singleFlight.run(key, producer) -> Promise<T> that all waiters will share.
 *     2) singleFlight.clear(key): cancel dedupe for that key (does not abort work).
 *     3) singleFlight.peek(key): read current shared promise, if any.
 *   The structure stores only in-memory maps and never touches global state. All operations
 *   are O(1) on the number of active keys. Logging is concise and focused on lifecycle edges.
 *
 * Responsibilities:
 *   - Provide keyed, promise-based deduplication for concurrent operations.
 *   - Share the “winner” promise among callers to avoid race-prone duplication.
 *   - Allow explicit clearing without interfering with the in-flight operation itself.
 *   - Remain framework-agnostic and ergonomic to test.
 */

export type Producer<T> = () => Promise<T>;

class SingleFlight {
  private inflight = new Map<string, Promise<any>>();

  /**
   * 1) Run a producer under a key with dedupe.
   *    - If a promise exists, return it.
   *    - Otherwise, start producer, cache the promise, and remove it when settled.
   *    Time: O(1).
   */
  run<T>(key: string, producer: Producer<T>): Promise<T> {
    const existing = this.inflight.get(key);
    if (existing) {
      // services/utils/singleFlight.ts [5101]
      console.log('[singleFlight.ts][5101] hit inflight; dedup join', { key });
      return existing as Promise<T>;
    }
    const p = (async () => {
      try {
        // services/utils/singleFlight.ts [5102]
        console.log('[singleFlight.ts][5102] start producer', { key });
        return await producer();
      } finally {
        // services/utils/singleFlight.ts [5103]
        console.log('[singleFlight.ts][5103] settle producer; clearing inflight', { key });
        // Ensure eventual cleanup even on rejection
        queueMicrotask(() => this.inflight.delete(key));
      }
    })();
    this.inflight.set(key, p);
    return p;
  }

  /**
   * 2) Clear the dedupe entry for a key (does not abort the work itself).
   *    Time: O(1).
   */
  clear(key: string): void {
    this.inflight.delete(key);
    // services/utils/singleFlight.ts [5104]
    console.log('[singleFlight.ts][5104] cleared inflight entry', { key });
  }

  /**
   * 3) Peek the current promise for a key (or undefined).
   *    Time: O(1).
   */
  peek<T = unknown>(key: string): Promise<T> | undefined {
    return this.inflight.get(key) as Promise<T> | undefined;
  }
}

export const singleFlight = new SingleFlight();
