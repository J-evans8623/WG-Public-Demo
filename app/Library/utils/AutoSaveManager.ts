// AutoSaveManager.ts
import * as Y from 'yjs';
import { debounce } from 'lodash';
import { WebsocketProvider } from 'y-websocket';
import { v4 as uuidv4 } from 'uuid';

/**
 * Configuration interface for AutoSaveManager
 */
interface AutoSaveConfig {
  guaranteedSaveInterval: number;  // Maximum time between saves if changes exist
  inactivitySaveDelay: number;    // Time to wait after last change before saving
}

/**
 * Manages automatic saving of Y.js documents with protection against concurrent saves
 * and proper handling of local vs. remote changes.
 */
export class AutoSaveManager {
  private ydoc: Y.Doc;
  private config: AutoSaveConfig;
  private lastSaveTime: number = 0;
  private hasUntrackedChanges: boolean = false;
  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  private guaranteedSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private saveCallback: () => Promise<void>;
  private isAutosaving: boolean = false;
  private savePromise: Promise<void> | null = null;
  private nodesObserver: ((event: Y.YMapEvent<any>) => void) | null = null;
  private resourcesObserver: ((event: Y.YMapEvent<any>) => void) | null = null;
  private id: string;

  /**
   * Named handler for Y.Doc updates
   */
  private handleYdocUpdate = (update: Uint8Array, origin: any) => {
    // Ignore updates from WebsocketProvider, 'autosave', and system actions
    if (
      origin instanceof WebsocketProvider ||
      origin === 'autosave' ||
      (origin && typeof origin === 'object' && origin.type === 'system')
    ) {
      console.log('[AutoSaveManager] Ignoring update from origin:', origin);
      return;
    }

    const hasActualChanges = update.length > 0;
    console.log('[AutoSaveManager] Update detected:', {
      updateSize: update.length,
      hasActualChanges,
      origin: origin
    });

    if (hasActualChanges) {
      this.handleLocalChange();
    }
  };

  /**
   * Creates a new AutoSaveManager instance
   * @param ydoc - The Y.js document to monitor
   * @param saveCallback - Function to call when saving is needed
   * @param config - Optional configuration overrides
   */
  constructor(
    ydoc: Y.Doc, 
    saveCallback: () => Promise<void>,
    config: Partial<AutoSaveConfig> = {}
  ) {
    this.ydoc = ydoc;
    this.saveCallback = saveCallback;
    this.config = {
      guaranteedSaveInterval: 60000, // 1 minute
      inactivitySaveDelay: 10000,    // 10 seconds
      ...config
    };

    this.id = uuidv4();

    this.setupObservers();
    this.setupBeforeUnloadHandler();
  }

  /**
   * Sets up observers for Y.js document changes
   * Monitors both document-level updates and specific shared types
   */
  private setupObservers(): void {
    console.log(`[AutoSaveManager ${this.id}] Setting up observers`);

    // Attach the named handler
    this.ydoc.on('update', this.handleYdocUpdate);

    const nodesMap = this.ydoc.getMap('nodes');
    const resourcesMap = this.ydoc.getMap('resources');

    // Keep observers just for logging purposes but don't trigger saves
    this.nodesObserver = (event: Y.YMapEvent<any>) => {
      const hasChanges = event.changes.keys.size > 0 || 
                        event.changes.delta.length > 0;
      if (hasChanges) {
        console.log('[AutoSaveManager] Nodes map changed');
      }
    };

    this.resourcesObserver = (event: Y.YMapEvent<any>) => {
      const hasChanges = event.changes.keys.size > 0 || 
                        event.changes.delta.length > 0;
      if (hasChanges) {
        console.log('[AutoSaveManager] Resources map changed');
      }
    };

    nodesMap.observe(this.nodesObserver);
    resourcesMap.observe(this.resourcesObserver);
  }

  /**
   * Sets up handler for page unload events to ensure changes are saved
   */
  private setupBeforeUnloadHandler(): void {
    const beforeUnloadHandler = async (event: BeforeUnloadEvent) => {
      if (this.hasUntrackedChanges) {
        event.preventDefault();
        event.returnValue = '';
        
        try {
          await this.forceSave();
        } catch (error) {
          console.error('[AutoSaveManager] Failed to save before unload:', error);
        }
      }
    };

    window.addEventListener('beforeunload', beforeUnloadHandler);

    // Store reference for removal
    this.beforeUnloadHandler = beforeUnloadHandler;
  }

  // Store the beforeUnloadHandler to remove it later
  private beforeUnloadHandler: ((event: BeforeUnloadEvent) => void) | null = null;

  /**
   * Handles local changes to the document
   * Manages save timers and change tracking
   */
  private handleLocalChange(): void {
    if (!this.isAutosaving) {
      console.log('[AutoSaveManager] Local change detected, initiating save timers');
      this.hasUntrackedChanges = true;
      this.resetInactivityTimer();
      this.ensureGuaranteedSaveTimer();
    } else {
      console.log('[AutoSaveManager] Save in progress, change tracking deferred');
    }
  }

  /**
   * Resets the inactivity timer with debouncing
   * Saves after a period of inactivity
   */
  private resetInactivityTimer = debounce(async (): Promise<void> => {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }

    this.inactivityTimer = setTimeout(async () => {
      if (this.hasUntrackedChanges && !this.isAutosaving) {
        console.log('Inactivity threshold reached attempting save.....')
        await this.save();
      }
    }, this.config.inactivitySaveDelay);
  }, 100);

  /**
   * Ensures the guaranteed save timer is running
   * Forces a save after maximum interval if changes exist
   */
  private ensureGuaranteedSaveTimer(): void {
    if (!this.guaranteedSaveTimer) {
      this.guaranteedSaveTimer = setTimeout(async () => {
        if (this.hasUntrackedChanges && !this.isAutosaving) {
          console.log('Guaranteed save threshold reached attempting save.....')
          await this.save();
        }
        this.guaranteedSaveTimer = null;
      }, this.config.guaranteedSaveInterval);
    }
  }

  /**
   * Performs the actual save operation with concurrency protection
   */
  private async save(): Promise<void> {
    console.log('[AutoSaveManager] Save requested:', {
      hasUntrackedChanges: this.hasUntrackedChanges,
      isAutosaving: this.isAutosaving,
      lastSaveTime: this.lastSaveTime,
      timeSinceLastSave: Date.now() - this.lastSaveTime
    });

    // Return existing promise if save is in progress
    if (this.isAutosaving) {
      console.log('[AutoSaveManager] Save already in progress, waiting...');
      return this.savePromise || Promise.resolve();
    }

    if (!this.hasUntrackedChanges) {
      console.log('[AutoSaveManager] No untracked changes, skipping save');
      return Promise.resolve();
    }

    try {
      this.isAutosaving = true;
      this.savePromise = (async () => {
        try {
          await this.saveCallback();
          this.lastSaveTime = Date.now();
          this.hasUntrackedChanges = false;
          this.clearTimers();
        } finally {
          this.isAutosaving = false;
          this.savePromise = null;
          console.log('AutoSave completed exiting save.....');
        }
      })();

      return this.savePromise;
    } catch (error) {
      console.error('[AutoSaveManager] Save failed:', error);
      this.isAutosaving = false;
      this.savePromise = null;
      throw error;
    }
  }

  /**
   * Forces an immediate save if there are untracked changes
   */
  public async forceSave(): Promise<void> {
    if (this.hasUntrackedChanges || this.isAutosaving) {
      return this.save();
    }
  }

  /**
   * Cleans up all active timers
   */
  private clearTimers(): void {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
    if (this.guaranteedSaveTimer) {
      clearTimeout(this.guaranteedSaveTimer);
      this.guaranteedSaveTimer = null;
    }
  }

  /**
   * Cleans up resources when the manager is destroyed
   */
  public destroy(): void {
    console.log('[AutoSaveManager] Destroying instance');
    this.clearTimers();
    
    if (this.ydoc) {
      // Properly remove the named handler
      this.ydoc.off('update', this.handleYdocUpdate);
      
      const nodesMap = this.ydoc.getMap('nodes');
      const resourcesMap = this.ydoc.getMap('resources');
      
      // Properly unregister observers
      if (this.nodesObserver) {
        nodesMap.unobserve(this.nodesObserver);
      }
      if (this.resourcesObserver) {
        resourcesMap.unobserve(this.resourcesObserver);
      }
    }
    
    if (this.beforeUnloadHandler) {
      window.removeEventListener('beforeunload', this.beforeUnloadHandler);
      this.beforeUnloadHandler = null;
    }
  }
}
