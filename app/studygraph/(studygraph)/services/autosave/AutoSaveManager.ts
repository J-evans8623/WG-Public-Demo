
/**
 * AutoSaveManager.ts
 *
 * Responsibilities:
 *  - Automatically persist Y.Doc changes via a single afterTransaction hook.
 *  - Debounce inactivity and enforce a guaranteed save interval.
 *  - Protect against concurrent saves and ensure final save on page unload.
 *  - Expose destroy() to clean up all listeners and timers.
 */

import * as Y from 'yjs';
import { debounce } from 'lodash';
import { LOCAL_ORIGIN } from '@/app/Library/Definitions/Definitions';

/** Configuration overrides for AutoSaveManager */
interface AutoSaveConfig {
  guaranteedSaveInterval: number;  // max ms between saves if unsaved changes exist
  inactivitySaveDelay: number;     // ms of inactivity before triggering save
}

export class AutoSaveManager {
  private ydoc: Y.Doc;
  private config: AutoSaveConfig;
  private lastSaveTime = 0;
  private hasUntrackedChanges = false;
  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  private guaranteedSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private saveCallback: () => Promise<void>;
  private isAutosaving = false;
  private savePromise: Promise<void> | null = null;
  private afterTxHandler: (tx: Y.Transaction) => void;
  private beforeUnloadHandler: ((e: BeforeUnloadEvent) => void) | null = null;

  /**
   * Constructs and begins observing only afterTransaction events.
   * @param ydoc       The Y.Doc instance to monitor.
   * @param saveCb     Callback invoked when a save should occur.
   * @param configOvrs Optional overrides for autosave timing.
   */
  constructor(
    ydoc: Y.Doc,
    saveCb: () => Promise<void>,
    configOvrs: Partial<AutoSaveConfig> = {}
  ) {
    console.log('AutoSaveManager.ts 1001 › Initializing AutoSaveManager');
    this.ydoc = ydoc;
    this.saveCallback = saveCb;
    this.config = {
      guaranteedSaveInterval: 60000,
      inactivitySaveDelay: 3000,
      ...configOvrs
    };

    // Bind and register the afterTransaction handler
     this.afterTxHandler = (tx) => {
      // Step 1: Read transaction origin fields in a defensive way.
      const origin = (tx as any).origin;
      const isLocal = (tx as any).local === true;

      // Step 2: Ignore any non-local transactions (remote sync, awareness, system loads).
      if (!isLocal) {
        console.log('AutoSaveManager.ts 1102 › afterTx ignored (non-local)', { origin, local: isLocal }); // update - 001
        return; // update - 001
      }

      // Step 3: Only accept transactions explicitly tagged with LOCAL_ORIGIN.
      if (origin !== LOCAL_ORIGIN) {
        console.log('AutoSaveManager.ts 1103 › afterTx ignored (origin mismatch)', { originExpected: LOCAL_ORIGIN, originActual: origin }); // update - 001
        return; // update - 001
      }

      // Step 4: Eligible local transaction → schedule autosave.
      console.log('AutoSaveManager.ts 1104 › afterTx accepted (local + LOCAL_ORIGIN)', { origin, local: isLocal }); // update - 001
      this.handleLocalChange(); // update - 001
    };
    this.ydoc.on('afterTransaction', this.afterTxHandler);
    
    this.setupBeforeUnloadHandler();
  }

  /** Sets up page-unload listener to flush unsaved changes. */
  private setupBeforeUnloadHandler(): void {
    const handler = async (event: BeforeUnloadEvent) => {
      if (this.hasUntrackedChanges) {
        console.log('AutoSaveManager.ts 1003 › beforeunload: unsaved changes detected');
        event.preventDefault();
        event.returnValue = '';
        try {
          await this.forceSave();
        } catch (err) {
          console.error('AutoSaveManager.ts 1004 › forceSave on unload failed', err);
        }
      }
    };
    window.addEventListener('beforeunload', handler);
    this.beforeUnloadHandler = handler;
  }

  /** Marks that a local change occurred and schedules saves. */
  private handleLocalChange(): void {
    if (this.isAutosaving) {
      console.log('AutoSaveManager.ts 1005 › Save in progress, skipping scheduling');
      return;
    }
    console.log('AutoSaveManager.ts 1006 › Scheduling save timers');
    this.hasUntrackedChanges = true;
    this.resetInactivityTimer();
    this.ensureGuaranteedSaveTimer();
  }

  
  public notifyLocalChange():void {
    this.handleLocalChange();
  }

  /** Debounced inactivity timer: triggers save after idle period. */
  private resetInactivityTimer = debounce(async (): Promise<void> => {
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
    this.inactivityTimer = setTimeout(async () => {
      if (this.hasUntrackedChanges && !this.isAutosaving) {
        console.log('AutoSaveManager.ts 1007 › Inactivity threshold reached');
        await this.save();
      }
    }, this.config.inactivitySaveDelay);
  }, 100);

  /** Ensures a guaranteed save after the max interval if unsaved changes exist. */
  private ensureGuaranteedSaveTimer(): void {
    if (!this.guaranteedSaveTimer) {
      this.guaranteedSaveTimer = setTimeout(async () => {
        if (this.hasUntrackedChanges && !this.isAutosaving) {
          console.log('AutoSaveManager.ts 1008 › Guaranteed interval reached');
          await this.save();
        }
        this.guaranteedSaveTimer = null;
      }, this.config.guaranteedSaveInterval);
    }
  }

  /** Performs the save callback with concurrency protection and logging. */
  private async save(): Promise<void> {
    console.log('AutoSaveManager.ts 1009 › save() start', {
      hasUntrackedChanges: this.hasUntrackedChanges,
      timeSinceLast: Date.now() - this.lastSaveTime
    });

    if (this.isAutosaving) {
      console.log('AutoSaveManager.ts 1010 › Already autosaving; awaiting existing promise');
      return this.savePromise || Promise.resolve();
    }
    if (!this.hasUntrackedChanges) {
      console.log('AutoSaveManager.ts 1011 › No changes to save; skipping');
      return;
    }

    this.isAutosaving = true;
    this.savePromise = (async () => {
      try {
        await this.saveCallback();
        this.lastSaveTime = Date.now();
        this.hasUntrackedChanges = false;
        this.clearTimers();
        console.log('AutoSaveManager.ts 1012 › saveCallback succeeded');
      } catch (err) {
        console.error('AutoSaveManager.ts 1013 › saveCallback failed', err);
        throw err;
      } finally {
        this.isAutosaving = false;
        this.savePromise = null;
      }
    })();

    return this.savePromise;
  }

  /** Forces an immediate save if needed. */
  public async forceSave(): Promise<void> {
    if (this.hasUntrackedChanges || this.isAutosaving) {
      console.log('AutoSaveManager.ts 1014 › forceSave invoked');
      return this.save();
    }
  }

  /** Clears any active timers for inactivity or guaranteed saves. */
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

  /** Cleans up all listeners and timers when disposing of this manager. */
  public destroy(): void {
    console.log('AutoSaveManager.ts 1015 › destroy() cleaning up');
    this.clearTimers();

    if (this.ydoc && this.afterTxHandler) {
      this.ydoc.off('afterTransaction', this.afterTxHandler);
    }
    if (this.beforeUnloadHandler) {
      window.removeEventListener('beforeunload', this.beforeUnloadHandler);
      this.beforeUnloadHandler = null;
    }
  }
}
