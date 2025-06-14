/**
 * @file app/src/utils/callWithRetry.ts
 * @description
 *   Provides a utility function to execute asynchronous tasks with
 *   exponential backoff, jitter, and honoring OpenAI's `Retry-After` header
 *   to handle transient rate-limit (429) errors without dropping requests.
 */

interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
}

/**
 * Executes the provided async function with retry logic on rate-limit errors.
 * @param taskFn - A zero-arg function that returns a Promise of the task.
 * @param options - Optional configuration for max retries and base delay.
 * @returns The result of the successful taskFn invocation.
 * @throws The last error if retries are exhausted or a non-429 error occurs.
 */
export async function callWithRetry<T>(
  taskFn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 5, baseDelayMs = 200 } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await taskFn();
    } catch (err: any) {
      // If it's not a rate-limit error or we've exhausted retries, rethrow
      const isRateLimit = err.status === 429;
      if (!isRateLimit || attempt === maxRetries) {
        throw err;
      }

      // Determine delay: honor Retry-After header if present
      const retryAfterHeader = err.response?.headers?.['retry-after'];
      let delayMs: number;
      if (retryAfterHeader) {
        const seconds = parseInt(retryAfterHeader, 10);
        delayMs = isNaN(seconds) ? baseDelayMs : seconds * 1000;
      } else {
        // exponential backoff with jitter
        const exponential = baseDelayMs * Math.pow(2, attempt);
        const jitter = Math.random() * baseDelayMs;
        delayMs = exponential + jitter;
      }

      // Wait before next retry
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  // This line should be unreachable
  throw new Error('callWithRetry: exceeded maximum retry attempts');
}
