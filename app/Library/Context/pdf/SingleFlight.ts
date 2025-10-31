/**
 * @file app/Library/Context/pdf/SingleFlight.ts
 * @description
 *   SingleFlight is a tiny, self-contained coordinator that enforces "latest-wins" semantics for
 *   asynchronous operations such as PDF loads. When a new operation begins, it (1) cancels the
 *   previous in-flight operation via AbortController (for fetches and any consumer-respected
 *   signals), (2) issues a monotonically increasing token that uniquely identifies the current
 *   attempt, and (3) exposes helpers to check token freshness at await boundaries. This prevents
 *   stale promises from mutating state after a user has navigated elsewhere and ensures tightly
 *   serialized behavior without dangling overlapping work. Consumers use `begin()` to obtain the
 *   token and signal, guard state updates with `isCurrent(token)`, and call `cancelPrevious()` or
 *   start a new `begin()` to supersede any earlier attempt. The module has no runtime dependencies,
 *   is framework-agnostic, and is designed for predictable teardown under rapid user interaction.
 *
 * Responsibilities (step-by-step):
 *   1) Maintain a monotonically increasing "current token" representing the most recent operation.
 *   2) Hold and cancel an AbortController associated with the current token.
 *   3) Provide `begin()` to atomically create a new token + controller and cancel any prior one.
 *   4) Provide `isCurrent(token)` so callers can cheaply ignore late resolves from stale tokens.
 *   5) Provide `cancelPrevious()` for explicit aborts (e.g., on unmount).
 *
 * Big-O:
 *   All operations are O(1). There is no collection growth; memory stays constant.
 */

export type SingleFlightTicket = {
  /** Unique token for this attempt. Only mutations guarded by this token should proceed. */
  token: number;
  /** AbortSignal for cancel-aware consumers (e.g., fetch). */
  signal: AbortSignal;
};

export class SingleFlight {
  /** Monotonically increasing token of the most recent attempt. */
  private currentToken = 0;
  /** AbortController associated with the current token (if any). */
  private controller: AbortController | null = null;

  /**
   * begin
   * @description
   *   Start a new attempt: abort any previous attempt, allocate a fresh AbortController, increment
   *   the global token, and return the ticket for the caller. This guarantees "latest-wins."
   */
  begin(): SingleFlightTicket {
    // 1) Cancel any prior attempt
    if (this.controller) {
      try {
        this.controller.abort();
      } catch {
        /* no-op */
      }
    }
    // 2) Allocate a new controller and token
    this.controller = new AbortController();
    this.currentToken += 1;
    // 3) Return the ticket to the caller
    return { token: this.currentToken, signal: this.controller.signal };
  }

  /**
   * isCurrent
   * @description
   *   Returns true if the provided token still matches the most recent attempt. Call this after
   *   any awaited step to decide whether to continue or bail out silently.
   */
  isCurrent(token: number): boolean {
    return token === this.currentToken;
  }

  /**
   * cancelPrevious
   * @description
   *   Explicitly abort the current in-flight operation (if any). Useful on component unmount or
   *   when upstream logic deterministically ends a flow without starting another.
   */
  cancelPrevious(): void {
    if (this.controller) {
      try {
        this.controller.abort();
      } catch {
        /* no-op */
      } finally {
        this.controller = null;
      }
    }
  }
}

/**
 * microDelay
 * @description
 *   Tiny utility for inserting short, awaited gaps (e.g., after destroy()) to give the browser
 *   time to release resources and avoid tight races under rapid switching.
 */
export const microDelay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
