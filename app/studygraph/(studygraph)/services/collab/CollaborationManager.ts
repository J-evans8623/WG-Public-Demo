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

  private constructor() {
    console.log('CollaborationManager › Singleton instance created');
  }

  static getInstance(): CollaborationManager {
    if (!CollaborationManager.instance) {
      CollaborationManager.instance = new CollaborationManager();
    }
    return CollaborationManager.instance;
  }

  /**
   * Connect to a document's collaboration channel
   */
  async connect(
    docId: string, 
    ydoc: Y.Doc, 
    visibility: 'private' | 'public' = 'private',
    options: CollaborationOptions = {}
  ): Promise<void> {


        // Don't reconnect if already connected to the same doc with same ydoc
    if (this.currentDocId === docId && this.currentYDoc === ydoc && this.provider) {
      console.log('CollaborationManager › Already connected to doc:', docId);
      return;
    }

    // ================================================================
    // RETRY LIMIT ENFORCEMENT
    // ================================================================
    const currentRetries = this.retryCountPerDoc.get(docId) || 0;
    if (currentRetries >= this.MAX_RETRY_ATTEMPTS) {
      const errorMsg = `CollaborationManager › RETRY LIMIT EXCEEDED for doc ${docId} (${currentRetries}/${this.MAX_RETRY_ATTEMPTS} attempts). Blocking further attempts for ${this.RETRY_RESET_INTERVAL / 60000} minutes.`;
      console.error(errorMsg);
      this.setStatus('disconnected');
      throw new Error(`Connection retry limit exceeded (${this.MAX_RETRY_ATTEMPTS} attempts). Please try again later.`);
    }

    // Increment retry counter for this document
    this.retryCountPerDoc.set(docId, currentRetries + 1);
    
    // Set up reset timer for this document (resets counter after interval)
    if (!this.retryResetTimers.has(docId)) {
      const resetTimer = setTimeout(() => {
        console.log(`CollaborationManager › Resetting retry counter for doc ${docId}`);
        this.retryCountPerDoc.delete(docId);
        this.retryResetTimers.delete(docId);
      }, this.RETRY_RESET_INTERVAL);
      this.retryResetTimers.set(docId, resetTimer);
    }

    console.log(`CollaborationManager › Connection attempt ${currentRetries + 1}/${this.MAX_RETRY_ATTEMPTS} for doc: ${docId}`);


    console.log('CollaborationManager › Connecting to doc:', docId);
    
    // Store options
    this.options = options;
    
    // Disconnect existing connection first
    this.disconnect();
    
    // Update state
    this.currentDocId = docId;
    this.currentYDoc = ydoc;
    this.currentVisibility = visibility;
    this.triedImmediateFixRef = false;
    
    // Set status to connecting
    this.setStatus('connecting');
    
    try {
      // Reduced backoff for debugging - max 2 seconds instead of 3
      const connectionDelay = this.isDevMode 
        ? Math.min((currentRetries) * 500, 2000) 
        : 0;

      if (connectionDelay > 0) {
        console.log(`CollaborationManager › Applying connection delay: ${connectionDelay}ms (attempt ${currentRetries + 1})`);
        await new Promise(resolve => setTimeout(resolve, connectionDelay));
      }

      // Acquire token (cookie shortcut if present)
      const cookieJwt = getCookie('bm_collab');
      const tokenBundle = cookieJwt 
        ? { token: cookieJwt } 
        : await this.fetchToken(docId);

      // Establish connection
      await this.connectWithToken(docId, ydoc, tokenBundle.token);
      
      if (!(ydoc as any).__bmHandshakeProbe) {
        (ydoc as any).__bmHandshakeProbe = true;
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

      // Schedule token refresh if needed
      this.scheduleRefreshIfPossible(tokenBundle);
      
      // SUCCESS: Reset retry counter for this document
      console.log(`CollaborationManager › Connection successful! Resetting retry counter for doc ${docId}`);
      this.retryCountPerDoc.delete(docId);
      const resetTimer = this.retryResetTimers.get(docId);
      if (resetTimer) {
        clearTimeout(resetTimer);
        this.retryResetTimers.delete(docId);
      }
      
    } catch (error) {
      console.error(`CollaborationManager › Connection failed (attempt ${currentRetries + 1}/${this.MAX_RETRY_ATTEMPTS}):`, error);
      this.setStatus('disconnected');
      throw error;
    }
  }

  /**
   * Disconnect from current collaboration session
   */
  disconnect(): void {
    if (this.currentDocId) {
      console.log('CollaborationManager › Disconnecting from doc:', this.currentDocId);
    }

    // Clear timers
    this.clearTimers();
    
    // Destroy provider
    this.destroyProvider();
    
    // Reset state
    this.currentDocId = null;
    this.currentYDoc = null;
    this.currentVisibility = 'private';
    this.triedImmediateFixRef = false;
    
    // Update status
    this.setStatus('disconnected');
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
   */
  private async fetchToken(docId: string): Promise<TokenBundle> {
    console.log('CollaborationManager › Fetching token for doc:', docId);
    
    const response = await fetch(`/api/collab/startv1?doc=${encodeURIComponent(docId)}`, {
      credentials: 'include'
    });

    if (!response.ok) {
      const errorText = await response.text();
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
    /*console.log('CollaborationManager › Establishing WebSocket connection', {
      docId,
      jwtLength: jwt.length,
      jwtPreview: jwt.substring(0, 50) + '...'
    });*/

    // Clean state before connecting
    this.clearTimers();
    this.destroyProvider();

    // Validate JWT format
    const jwtParts = jwt.split('.');
    if (jwtParts.length !== 3) {
      throw new Error(`Invalid JWT format: expected 3 parts, got ${jwtParts.length}`);
    }

    /*console.log('CollaborationManager › JWT validation passed:', {
      parts: jwtParts.length,
      headerLength: jwtParts[0].length,
      payloadLength: jwtParts[1].length,
      signatureLength: jwtParts[2].length
    });*/

    // Build the complete WebSocket URL that the Yjs server expects
    const rawEndpoint = process.env.NEXT_PUBLIC_YJS_ENDPOINT || 'ws://localhost:1234';
    const endpoint = rawEndpoint.replace(/\/+$/, ''); // strip trailing slashes
    const encodedDoc = encodeURIComponent(docId);
    const encodedToken = encodeURIComponent(jwt);
    
    // This is the URL format your Yjs server expects: ws://localhost:1234/{docId}?token={jwt}
    const completeUrl = `${endpoint}/${encodedDoc}?token=${encodedToken}`;

   /* console.log('CollaborationManager › Target URL (token hidden):', 
      `${endpoint}/${encodedDoc}?token=***`);*/

    // Create a custom WebSocket class that ignores y-websocket's URL construction
    // and connects directly to our complete URL
    class TokenizedWebSocket extends WebSocket {
      constructor(url?: string | URL, protocols?: string | string[]) {
        // Ignore the URL that y-websocket passes and use our complete URL instead
        console.log('TokenizedWebSocket › Connecting to complete URL with token');
        super(completeUrl, protocols);
      }
    }

    // Create the WebsocketProvider with dummy parameters since we handle URL construction
    // The empty string room name prevents y-websocket from appending anything to our URL
    this.provider = new WebsocketProvider('dummy://localhost', '', ydoc, {
      WebSocketPolyfill: TokenizedWebSocket,
    });

    // Set up event listeners
    this.setupProviderEvents();

    console.log('CollaborationManager › WebSocket provider initialized with custom WebSocket class');
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