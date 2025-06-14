/**
 * lib/lessonJobBus.ts
 *
 * Responsibilities:
 *  - Maintain an in-memory registry of lesson-generation jobs (async generators) keyed by fileId.
 *  - Allow enqueueing a new AsyncGenerator that will produce { event, data, id? } chunks.
 *  - Allow a single subscriber (the SSE endpoint) to retrieve the AsyncIterator for a given fileId.
 *  - Automatically evict stale jobs after a configurable TTL to prevent memory leaks.
 */

export interface LessonChunk {
    /** SSE event name (e.g. 'stored', 'message', 'endOfStream') */
    event: string;
    /** Payload data for the event */
    data: any;
    /** Optional SSE id */
    id?: string;
  }
  
  interface JobEntry {
    iterator: AsyncGenerator<LessonChunk>;
    evictionTimer: NodeJS.Timeout;
  }
  
  const DEFAULT_JOB_TTL_MS = 1000 * 60 * 30; // 30 minutes
  
  class LessonJobBus {
    private jobs: Map<string, JobEntry> = new Map();
  
    /**
     * Enqueue a new lesson-generation job.
     * @param fileId   Unique identifier for this upload/session.
     * @param iterator An AsyncGenerator producing LessonChunk values.
     */
    public enqueue(fileId: string, iterator: AsyncGenerator<LessonChunk>): void {
      // If there's an existing job for this fileId, clear its eviction timer
      if (this.jobs.has(fileId)) {
        console.warn(`[LessonJobBus] Overwriting existing job for fileId=${fileId}`);
        clearTimeout(this.jobs.get(fileId)!.evictionTimer);
      }
  
      // Schedule automatic eviction
      const evictionTimer = setTimeout(() => {
        console.log(`[LessonJobBus] Auto-evicting job for fileId=${fileId}`);
        this.delete(fileId);
      }, DEFAULT_JOB_TTL_MS);
  
      this.jobs.set(fileId, { iterator, evictionTimer });
      console.log(`[LessonJobBus] Enqueued job for fileId=${fileId}`);
    }
  
    /**
     * Subscribe to an existing job’s output.
     * Returns the AsyncGenerator previously enqueued.
     * @param fileId Identifier of the job to subscribe to.
     * @throws Error if no job exists for the given fileId.
     */
    public subscribe(fileId: string): AsyncGenerator<LessonChunk> {
      const entry = this.jobs.get(fileId);
      if (!entry) {
        const msg = `[LessonJobBus] No job found for fileId=${fileId}`;
        console.error(msg);
        throw new Error(msg);
      }
      console.log(`[LessonJobBus] Subscriber retrieved iterator for fileId=${fileId}`);
      return entry.iterator;
    }
  
    /**
     * Delete a job from the registry, clearing its eviction timer.
     * @param fileId Identifier of the job to delete.
     */
    public delete(fileId: string): void {
      const entry = this.jobs.get(fileId);
      if (!entry) return;
      clearTimeout(entry.evictionTimer);
      this.jobs.delete(fileId);
      console.log(`[LessonJobBus] Deleted job for fileId=${fileId}`);
    }
  }
  
  // Export a singleton instance for application-wide use.
  export const jobBus = new LessonJobBus();
  