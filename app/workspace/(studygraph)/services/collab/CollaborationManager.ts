// CollaborationManager.ts
/**
 * @file CollaborationManager.ts
 * @description
 *   Singleton WebSocket collaboration manager that persists across React re-renders.
 *   Converted from useCollabProvider hook to provide maximum stability.
 *   Manages token fetching, WebSocket connections, and automatic token refresh.
 */

import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { getCookie } from '../../components/utils/cookies';
import { createOpQueue, awaitProviderClose } from './collabSwitchGuards';
import { supersedingCall } from '@/app/src/net/SupersedingCaller';

export type CollabStatus = 'connecting' | 'connected' | 'disconnected';

type TokenBundle = { token: string; expiresIn?: number };

interface CollaborationOptions {
  /** Called when server kicks the user (revoked → close code 4003). */
  onRevoked?: (ctx: { docId: string }) => void;
  /** Called when token is invalid/expired (close code 4002) and the auto single-retry also fails. */
  onInvalidToken?: (ctx: { docId: string; error?: unknown }) => void;
}

type StatusCallback = (status: CollabStatus) => void;

class CollaborationManager {
  private static instance: CollaborationManager;
  
  // Connection state
  private provider: WebsocketProvider | null = null;
  private currentDocId: string | null = null;
  private currentYDoc: Y.Doc | null = null;
  private currentVisibility: 'private' | 'public' = 'private';
  private status: CollabStatus = 'disconnected';
  
  // Token management
  private refreshTimer: NodeJS.Timeout | null = null;
  private triedImmediateFixRef: boolean = false;
  
  // Callbacks and options
  private statusCallbacks: StatusCallback[] = [];
  private options: CollaborationOptions = {};
  
  // Development mode detection
  private isDevMode = process.env.NODE_ENV === 'development';
  private connectionAttemptCounter = 0;
  
  // ================================================================
  // RETRY LIMITING - Maximum 10 attempts per document
  // ================================================================
  private readonly MAX_RETRY_ATTEMPTS = 10;
  private readonly RETRY_RESET_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private retryCountPerDoc = new Map<string, number>();
  private retryResetTimers = new Map<string, NodeJS.Timeout>();

    // Serialized op queue for connect/disconnect sequences
  private opQueue = createOpQueue('CollabMgr');

  private constructor() {
    console.log('CollaborationManager › Singleton instance created');
  }

  static getInstance(): CollaborationManager {
    if (!CollaborationManager.instance) {
      CollaborationManager.instance = new CollaborationManager();
    }
    return CollaborationManager.instance;
  }

   /* @function connect
   * @description
   *   Establishes a collaboration session to a specific document. With this revision, connect
   *   is fully serialized against any in-flight or pending disconnect via an internal FIFO
   *   operation queue. Within the queued operation, we first ensure that any existing provider
   *   is completely torn down (awaiting actual WS close) and then proceed with token fetch and
   *   provider initialization. The public API remains unchanged for callers. Big-O: O(1) local.
   */
  async connect(
    docId: string, 
    ydoc: Y.Doc, 
    visibility: 'private' | 'public' = 'private',
    options: CollaborationOptions = {}
  ): Promise<void> {
    // update - 3
    return this.opQueue.run(async () => {
      // Step 1: Early success if already connected to the same doc with same ydoc.
      if (this.currentDocId === docId && this.currentYDoc === ydoc && this.provider) {
        console.log('[CollaborationManager.ts][8421] › Already connected (same doc/ydoc)'); // update - 4
        return;
      }

      // Step 2: Enforce retry cap per document (serialized under queue).
      const currentRetries = this.retryCountPerDoc.get(docId) || 0; // update - 5
      if (currentRetries >= this.MAX_RETRY_ATTEMPTS) {
        const msg = `CollaborationManager › Retry limit exceeded for doc ${docId} (${currentRetries}/${this.MAX_RETRY_ATTEMPTS})`; // update - 6
        console.error('[CollaborationManager.ts][8422] › ' + msg);
        this.setStatus('disconnected'); // update - 7
        throw new Error(msg);
      }
      this.retryCountPerDoc.set(docId, currentRetries + 1); // update - 8
      if (!this.retryResetTimers.has(docId)) { // update - 9
        const t = setTimeout(() => {
          console.log('[CollaborationManager.ts][8423] › Retry counter reset for doc', docId);
          this.retryCountPerDoc.delete(docId);
          this.retryResetTimers.delete(docId);
        }, this.RETRY_RESET_INTERVAL);
        this.retryResetTimers.set(docId, t);
      }

      console.log('[CollaborationManager.ts][8424] › Connect queued → attempt', currentRetries + 1, 'doc:', docId); // update - 10

      // Step 3: Ensure any previous provider is fully closed before proceeding.
      await awaitProviderClose(this.provider); // update - 11
      this.provider = null; // update - 12

      // Step 4: Store options & update state for the new connection.
      this.options = options; // update - 13
      this.currentDocId = docId; // update - 14
      this.currentYDoc = ydoc; // update - 15
      this.currentVisibility = visibility; // update - 16
      this.triedImmediateFixRef = false; // update - 17
      this.setStatus('connecting'); // update - 18

      // Step 5: Optional jitter for dev retry visibility.
      const connectionDelay = this.isDevMode ? Math.min(currentRetries * 500, 2000) : 0; // update - 19
      if (connectionDelay > 0) {
        console.log('[CollaborationManager.ts][8425] › Dev delay (ms):', connectionDelay); // update - 20
        await new Promise((r) => setTimeout(r, connectionDelay)); // update - 21
      }

      // Step 6: Acquire token (cookie shortcut if available).
      const cookieJwt = getCookie('bm_collab'); // update - 22
      const tokenBundle = cookieJwt ? { token: cookieJwt } : await this.fetchToken(docId); // update - 23

      // Step 7: Establish the provider with the token.
      await this.connectWithToken(docId, ydoc, tokenBundle.token); // update - 24

      // Step 8: Instrumentation probe (kept).
      if (!(ydoc as any).__bmHandshakeProbe) { // update - 25
        (ydoc as any).__bmHandshakeProbe = true; // update - 26
        ydoc.on('afterTransaction', (tx: Y.Transaction) => {
          const changedParents = tx.changedParentTypes.size;
          const deletedClients = tx.deleteSet.clients.size;
          const locality = tx.local ? 'LOCAL' : 'REMOTE';
          console.log('CollaborationManager.ts [7131] › afterTransaction probe', {
            docId: this.currentDocId,
            locality,
            changedParentTypesSize: changedParents,
            deleteSetClientsSize: deletedClients,
          });
        });
      }

      // Step 9: Schedule refresh if possible and reset retries on success.
      this.scheduleRefreshIfPossible(tokenBundle); // update - 27
      console.log('[CollaborationManager.ts][8426] › Connect success → clearing retry counter for', docId); // update - 28
      this.retryCountPerDoc.delete(docId); // update - 29
      const resetTimer = this.retryResetTimers.get(docId); // update - 30
      if (resetTimer) {
        clearTimeout(resetTimer); // update - 31
        this.retryResetTimers.delete(docId); // update - 32
      }
    });
  }

  /**
   * @function disconnect
   * @description
   *   Public, fire-and-forget disconnect. Callers do not need to await it. Internally this
   *   enqueues a teardown on the serialized operation queue to deterministically close the
   *   active provider (awaiting the actual ‘close’ event with timeout) and then resets state.
   *   Subsequent `connect()` calls will automatically wait for this teardown to complete.
   *   Big-O: O(1) local; constant-time operations.
   */
  disconnect(): void { // update - 33
    const docId = this.currentDocId;
    if (docId) {
      console.log('[CollaborationManager.ts][8427] › Disconnect requested for doc:', docId); // update - 34
    }

    // Step 1: Clear timers immediately to stop refresh churn while teardown is enqueued.
    this.clearTimers(); // update - 35

    // Step 2: Enqueue the actual close-and-reset work.
    this.opQueue.run(async () => { // update - 36
      // 2.1: Await WS close (idempotent; safe if no provider).
      await awaitProviderClose(this.provider); // update - 37

      // 2.2: Provider pointer is no longer valid.
      this.provider = null; // update - 38

      // 2.3: Reset state.
      this.currentDocId = null; // update - 39
      this.currentYDoc = null; // update - 40
      this.currentVisibility = 'private'; // update - 41
      this.triedImmediateFixRef = false; // update - 42

      // 2.4: Publish status.
      this.setStatus('disconnected'); // update - 43
      console.log('[CollaborationManager.ts][8428] › Disconnect complete'); // update - 44
    });
  }

  /**
   * DEBUGGING: Get retry information for all documents
   */
  getRetryInfo(): { docId: string; attempts: number; maxAttempts: number }[] {
    return Array.from(this.retryCountPerDoc.entries()).map(([docId, attempts]) => ({
      docId: docId.slice(0, 8) + '...',
      attempts,
      maxAttempts: this.MAX_RETRY_ATTEMPTS
    }));
  }

  /**
   * DEBUGGING: Reset retry counter for a specific document (emergency use)
   */
  resetRetryCounter(docId: string): void {
    console.log(`CollaborationManager › MANUAL RESET of retry counter for doc: ${docId}`);
    this.retryCountPerDoc.delete(docId);
    const resetTimer = this.retryResetTimers.get(docId);
    if (resetTimer) {
      clearTimeout(resetTimer);
      this.retryResetTimers.delete(docId);
    }
  }

  /**
   * DEBUGGING: Reset all retry counters (emergency use)
   */
  resetAllRetryCounters(): void {
    console.log('CollaborationManager › MANUAL RESET of ALL retry counters');
    this.retryCountPerDoc.clear();
    this.retryResetTimers.forEach(timer => clearTimeout(timer));
    this.retryResetTimers.clear();
  }

  /**
   * Subscribe to status changes
   */
  onStatusChange(callback: StatusCallback): () => void {
    this.statusCallbacks.push(callback);
    
    // Immediately call with current status
    callback(this.status);
    
    // Return unsubscribe function
    return () => {
      const index = this.statusCallbacks.indexOf(callback);
      if (index > -1) {
        this.statusCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Get current connection status
   */
  getStatus(): CollabStatus {
    return this.status;
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.status === 'connected';
  }

  /**
   * Get current document ID
   */
  getCurrentDocId(): string | null {
    return this.currentDocId;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private setStatus(status: CollabStatus): void {
    if (this.status !== status) {
      console.log('CollaborationManager › Status changed:', this.status, '→', status);
      this.status = status;
      this.notifyStatusChange(status);
    }
  }

  private notifyStatusChange(status: CollabStatus): void {
    this.statusCallbacks.forEach(callback => {
      try {
        callback(status);
      } catch (error) {
        console.error('CollaborationManager › Error in status callback:', error);
      }
    });
  }

  private clearTimers(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private destroyProvider(): void {
    if (this.provider) {
      try {
        this.provider.disconnect();
        this.provider.destroy();
      } catch (error) {
        console.warn('CollaborationManager › Error destroying provider:', error);
      }
      this.provider = null;
    }
  }

  /**
   * Fetch JWT token for document collaboration
   * Wrapped with SupersedingCaller to coalesce bursts and respect 429 Retry-After.
   * Note: we also do a single in-call 429 wait+retry to ensure this method resolves
   * with a token (since the caller needs it immediately to connect).
   */
  private async fetchToken(docId: string): Promise<TokenBundle> {
    console.log('CollaborationManager › Fetching token for doc:', docId);

    const key = `collab:start:${docId}`;

    // makeRequest encapsulates the fetch and a single in-call 429 retry honoring Retry-After.
    const makeRequest = async (signal: AbortSignal): Promise<Response> => {
      const doFetch = () =>
        fetch(`/api/collab/startv1?doc=${encodeURIComponent(docId)}`, {
          credentials: 'include',
          signal,
        });

      // First attempt
      let resp = await doFetch();

      if (resp.status === 429) {
        // Honor Retry-After once inside this call to keep fetchToken awaitable.
        const h = resp.headers.get('Retry-After');
        const secs = Number.isFinite(Number(h)) ? Math.max(1, Math.floor(Number(h))) : 1;

        // Wait with abort support
        await new Promise<void>((resolve, reject) => {
          const t = setTimeout(resolve, secs * 1000);
          const onAbort = () => {
            clearTimeout(t);
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
          };
          // If already aborted, short-circuit
          if (signal.aborted) {
            onAbort();
            return;
          }
          signal.addEventListener('abort', onAbort, { once: true });
        });

        // Retry once
        resp = await doFetch();
      }

      return resp;
    };

    // Use supersedingCall to ensure latest-wins and abort stale attempts.
    const response = await supersedingCall(key, {}, makeRequest);

    // If supersedingCall returned null, it means a prior Retry-After window was already scheduled
    // for this key by some earlier call. That is rare for token fetches, but if it happens we
    // surface a clear error (the queued retry will still happen in the background, but the caller
    // needs a deterministic result now).
    if (!response) {
      const msg = 'Token fetch deferred by rate limit (Retry-After active). Please try again.';
      console.error('CollaborationManager › Token fetch deferred (null response):', msg);
      throw new Error(msg);
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('CollaborationManager › Token fetch failed:', response.status, errorText);
      throw new Error(`Token fetch failed: ${response.status} ${errorText}`);
    }

    const { token, expiresIn } = await response.json();
    console.log('CollaborationManager › Token fetched successfully; expiresIn(s)=', expiresIn);

    return { token, expiresIn };
  }


  /**
   * FIXED: Establish WebSocket connection with JWT token
   * The key fix: Use a custom WebSocket class that connects to the complete URL
   */
private async connectWithToken(docId: string, ydoc: Y.Doc, jwt: string): Promise<void> {
  // Clean state before connecting
  this.clearTimers();
  this.destroyProvider();

  // Basic JWT sanity check
  if (jwt.split('.').length !== 3) throw new Error('Invalid JWT');

  const rawEndpoint = process.env.NEXT_PUBLIC_YJS_ENDPOINT || 'ws://localhost:1234';
  const endpoint = rawEndpoint.replace(/\/+$/, ''); // strip trailing slash

  // ✅ No custom WebSocket. Use y-websocket’s URL builder & params.
  this.provider = new WebsocketProvider(endpoint, docId, ydoc, {
    // y-websocket >=1.5 supports appending query params automatically
    params: { token: jwt },

    // OPTIONAL: uncomment to disable cross-tab BroadcastChannel if you prefer
     disableBc: true,
  });

  this.setupProviderEvents();
  console.log('CollaborationManager › WebSocket provider initialized (room=doc, params=?token=JWT)');
}


  /**
   * Set up WebSocket provider event listeners
   */
  private setupProviderEvents(): void {
    if (!this.provider) return;

    // Provider status events
    this.provider.on('status', (evt: { status: string }) => {
      console.log('CollaborationManager › Provider status:', evt.status);
      this.setStatus(evt.status === 'connected' ? 'connected' : 'disconnected');
    });

    this.provider.on('connection-close', (evt: unknown) => {
      console.log('CollaborationManager › Connection close event:', evt);
    });

    this.provider.on('connection-error', (evt: unknown) => {
      console.error('CollaborationManager › Connection error event:', evt);
    });

    this.provider.on('sync', (isSynced: boolean) => {
      console.log('CollaborationManager › Sync state:', isSynced ? 'synced' : 'syncing');
    });

    // WebSocket-level events
    const ws = (this.provider as any).ws as WebSocket | undefined;
    if (ws) {
      ws.addEventListener('open', () => {
        console.log('CollaborationManager › WebSocket opened successfully');
      });

      ws.addEventListener('error', (event) => {
        console.error('CollaborationManager › WebSocket error:', event);
      });

      ws.addEventListener('close', (event) => {
        console.log('CollaborationManager › WebSocket closed', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
           online: navigator.onLine, hidden: document.hidden, ts: Date.now(),
        });
        this.handleWebSocketClose(event);
      });
    }
  }

  /**
   * Handle WebSocket close events with appropriate error handling
   */
  private handleWebSocketClose(event: CloseEvent): void {
    // 4003 → revoked: notify callback
    if (event.code === 4003) {
      console.log('CollaborationManager › Access revoked by server (4003)');
      this.options.onRevoked?.({ docId: this.currentDocId! });
      this.setStatus('disconnected');
      return;
    }

    // 4002 → invalid/expired token: try ONE immediate refresh per document
    if (event.code === 4002 && !this.triedImmediateFixRef) {
      this.triedImmediateFixRef = true;
      console.log('CollaborationManager › Token invalid (4002); attempting immediate refresh...');
      
      // Check if we still have retry attempts left before trying refresh
      const currentRetries = this.retryCountPerDoc.get(this.currentDocId!) || 0;
      if (currentRetries >= this.MAX_RETRY_ATTEMPTS) {
        console.error(`CollaborationManager › Cannot attempt token refresh - retry limit exceeded (${currentRetries}/${this.MAX_RETRY_ATTEMPTS})`);
        this.options.onInvalidToken?.({ docId: this.currentDocId!, error: new Error('Retry limit exceeded') });
        this.setStatus('disconnected');
        return;
      }
      
      this.attemptTokenRefresh().catch(error => {
        console.error('CollaborationManager › Immediate token refresh failed:', error);
        this.options.onInvalidToken?.({ docId: this.currentDocId!, error });
        this.setStatus('disconnected');
      });
      return;
    }

    this.setStatus('disconnected');
  }

  /**
   * Attempt to refresh token and reconnect
   */
  private async attemptTokenRefresh(): Promise<void> {
    if (!this.currentDocId || !this.currentYDoc) {
      throw new Error('No active document for token refresh');
    }

    const tokenBundle = await this.fetchToken(this.currentDocId);
    await this.connectWithToken(this.currentDocId, this.currentYDoc, tokenBundle.token);
    this.setStatus('connected');
    this.scheduleRefreshIfPossible(tokenBundle);
  }

  /**
   * Schedule automatic token refresh before expiration
   */
  private scheduleRefreshIfPossible(tokenBundle: TokenBundle): void {
    this.clearTimers();
    
    if (!tokenBundle.expiresIn || tokenBundle.expiresIn <= 90) {
      console.log('CollaborationManager › Skipping refresh scheduling; expiresIn too small:', tokenBundle.expiresIn);
      return;
    }

    const refreshInMs = (tokenBundle.expiresIn - 60) * 1000; // Refresh 1 minute before expiry
    console.log('CollaborationManager › Scheduling token refresh in(s)=', refreshInMs / 1000);

    this.refreshTimer = setTimeout(async () => {
      try {
        console.log('CollaborationManager › Performing scheduled token refresh...');
        await this.attemptTokenRefresh();
      } catch (error) {
        console.error('CollaborationManager › Scheduled token refresh failed:', error);
        this.setStatus('disconnected');
      }
    }, refreshInMs);
  }
}

// Export singleton instance
export const collaborationManager = CollaborationManager.getInstance();