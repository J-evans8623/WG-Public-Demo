// app/Library/Context/pdf/LruPdfCache.ts
/**
 * @file LruPdfCache.ts (Phase 3 – memory-cap tuned)
 * @description
 *   A focused Least-Recently-Used cache specialized for PDF.js document lifecycles in your React app.
 *   This cache owns the pair (PDFDocumentProxy, PDFDocumentLoadingTask) per URL and centralizes
 *   destruction so that worker threads and parsing state are deterministically torn down in the
 *   correct order. Earlier phases introduced (1) an async destruction queue to serialize cleanup,
 *   (2) proper awaiting of `loadingTask.destroy()` followed by `pdf.destroy()`, and (3) defensive
 *   health checks. In **Phase 3**, we tighten steady-state memory by allowing a **capacity of 1**—
 *   truly holding only the active document when your workflow rapidly switches between PDFs. This
 *   reduces background memory pressure without changing call-sites. All operations are O(1) on
 *   average for map lookups and evictions; the destruction queue is linear only in eviction count.
 *
 * Responsibilities:
 *   1) Store at most N (now possibly 1) active PDF documents keyed by URL.
 *   2) Return cached documents in O(1) and maintain recency order for LRU eviction.
 *   3) Queue destruction of evicted/overwritten entries to avoid worker accumulation.
 *   4) Provide `clear()` and `waitForPendingDestructions()` for orchestrated resets.
 */

import type {
  PDFDocumentProxy,
  PDFDocumentLoadingTask,
} from 'pdfjs-dist/types/src/display/api';

export interface LruPdfEntry {
  pdf: PDFDocumentProxy;
  loadingTask: PDFDocumentLoadingTask;
  lastAccessed: number;
}

export class LruPdfCache {
  private store: Map<string, LruPdfEntry>;
  private capacity: number;
  private destroyQueue: Promise<void> = Promise.resolve();

  constructor(capacity: number) {
    // update - 1: Allow true capacity=1 to minimize memory; no forced floor of 2.
    // Guard only against nonsensical values (<=0).
    this.capacity = Math.max(1, capacity); // update - 1
    this.store = new Map();
    // console.log(`[LruPdfCache] Initialized with capacity: ${this.capacity}`);
  }

  /**
   * get
   * @description
   *   Retrieve an entry by URL, update its recency (LRU move-to-recent), and return the PDFDocumentProxy.
   *   If not found, returns undefined. The method performs O(1) operations.
   */
  get(url: string): PDFDocumentProxy | undefined {
    const entry = this.store.get(url);
    if (!entry) {
      // console.log(`[LruPdfCache] Cache miss: ${url}`);
      return undefined;
    }
    // Move entry to most-recent
    this.store.delete(url);
    entry.lastAccessed = Date.now();
    this.store.set(url, entry);
    // console.log(`[LruPdfCache] Cache hit: ${url}`);
    return entry.pdf;
  }

  /**
   * set
   * @description
   *   Insert or replace an entry for a URL, then enforce capacity by evicting the least-recently-used entry.
   *   Destruction is serialized via a queue to prevent worker accumulation on rapid switches.
   */
  set(url: string, pdf: PDFDocumentProxy, loadingTask: PDFDocumentLoadingTask): void {
    // console.log(`[LruPdfCache] Setting: ${url} (current size: ${this.store.size}/${this.capacity})`);
    const existing = this.store.get(url);
    if (existing) {
      // console.log(`[LruPdfCache] Replacing existing entry: ${url}`);
      this.queueDestroy(existing, url);
      this.store.delete(url);
    }
    this.store.set(url, { pdf, loadingTask, lastAccessed: Date.now() });
    this.evictIfNeeded();
  }

  /**
   * delete
   * @description
   *   Remove a specific URL from the cache and destroy its resources.
   */
  delete(url: string): boolean {
    const entry = this.store.get(url);
    if (!entry) {
      // console.log(`[LruPdfCache] Delete called but entry not found: ${url}`);
      return false;
    }
    // console.log(`[LruPdfCache] Deleting: ${url}`);
    this.queueDestroy(entry, url);
    return this.store.delete(url);
  }

  /**
   * clear
   * @description
   *   Destroy and remove all entries. Waits for queued destructions before clearing the store.
   */
  async clear(): Promise<void> {
    // console.log(`[LruPdfCache] Clearing all entries (${this.store.size} total)`);
    const entries = Array.from(this.store.entries());
    for (const [url, entry] of entries) {
      this.queueDestroy(entry, url);
    }
    await this.destroyQueue;
    this.store.clear();
    // console.log('[LruPdfCache] Clear complete');
  }

  /** size — current number of resident entries (O(1)). */
  get size(): number {
    return this.store.size;
  }

  /** keys — current keys in recency order (oldest..newest). */
  keys(): string[] {
    return Array.from(this.store.keys());
  }

  /** stats — lightweight snapshot for logging/telemetry (O(1)). */
  stats(): { size: number; capacity: number; urls: string[] } {
    return { size: this.size, capacity: this.capacity, urls: this.keys() };
  }

  /** Enforce LRU capacity (O(1) amortized; while-loop runs at most count of excess). */
  private evictIfNeeded(): void {
    while (this.store.size > this.capacity) {
      const oldestKey = this.store.keys().next().value as string | undefined;
      if (!oldestKey) break;
      const oldest = this.store.get(oldestKey);
      if (oldest) {
        // console.log(`[LruPdfCache] Evicting LRU entry: ${oldestKey}`);
        this.queueDestroy(oldest, oldestKey);
      }
      this.store.delete(oldestKey);
    }
  }

  /** Chain destruction to avoid concurrent worker teardown bursts (O(1) enqueue). */
  private queueDestroy(entry: LruPdfEntry, url: string): void {
    this.destroyQueue = this.destroyQueue
      .then(() => this.destroyEntry(entry, url))
      .catch(err => {
        console.error(`[LruPdfCache] Error in destroy queue for ${url}:`, err);
      });
  }

  /** Await loadingTask.destroy() then pdf.destroy(), with a brief interstitial delay. */
  private async destroyEntry(entry: LruPdfEntry, url: string): Promise<void> {
    // console.log(`[LruPdfCache] Destroying entry: ${url}`);
    try {
      await entry.loadingTask.destroy();
      // console.log(`[LruPdfCache] ✅ LoadingTask destroyed: ${url}`);
    } catch (err) {
      console.warn(`[LruPdfCache] ⚠️ Error destroying LoadingTask for ${url}:`, err);
    }
    await new Promise(r => setTimeout(r, 50));
    try {
      await entry.pdf.destroy();
      // console.log(`[LruPdfCache] ✅ PDF document destroyed: ${url}`);
    } catch (err) {
      console.warn(`[LruPdfCache] ⚠️ Error destroying PDF for ${url}:`, err);
    }
  }

  /** Allow callers to wait for pending destructions (useful before critical transitions). */
  async waitForPendingDestructions(): Promise<void> {
    await this.destroyQueue;
  }
}
