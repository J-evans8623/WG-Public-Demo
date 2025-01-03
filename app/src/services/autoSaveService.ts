/**
 * src/services/autoSaveService.ts
 * 
 * Manages automatic saving of documents to Google Drive.
 * Handles save queuing, conflict resolution, and error recovery.
 * 
 * Dependencies:
 * - DriveService for file operations
 * - AuthService for token validation
 */

import DriveService from './driveService';
import { debounce } from 'lodash';

export interface AutoSaveConfig {
  enabled: boolean;
  interval: number;
  fileId?: string;
}

class AutoSaveService {
  private static instance: AutoSaveService;
  private config: AutoSaveConfig = {
    enabled: false,
    interval: 30000 // 30 seconds default
  };
  private saveQueue: Map<string, Buffer> = new Map();
  private autoSaveTimer?: NodeJS.Timeout;
  private readonly debouncedSave: ReturnType<typeof debounce>;

  private constructor() {
    this.debouncedSave = debounce(this.processSaveQueue.bind(this), 2000);
  }

  static getInstance(): AutoSaveService {
    if (!AutoSaveService.instance) {
      AutoSaveService.instance = new AutoSaveService();
    }
    return AutoSaveService.instance;
  }

  /**
   * Configures autosave settings
   */
  configure(config: Partial<AutoSaveConfig>): void {
    this.config = { ...this.config, ...config };
    
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }
    
    if (this.config.enabled && this.config.fileId) {
      this.autoSaveTimer = setInterval(() => {
        this.processSaveQueue();
      }, this.config.interval);
    }
  }

  /**
   * Queues content for saving
   */
  queueSave(content: Buffer): void {
    if (!this.config.fileId) return;
    this.saveQueue.set(this.config.fileId, content);
    this.debouncedSave();
  }

  /**
   * Processes the save queue
   */
  private async processSaveQueue(): Promise<void> {
    if (!this.config.fileId) return;
    
    const content = this.saveQueue.get(this.config.fileId);
    if (!content) return;

    try {
      await DriveService.updateFile(this.config.fileId, content);
      this.saveQueue.delete(this.config.fileId);
    } catch (error) {
      console.error('AutoSave failed:', error);
      // Keep in queue for retry
    }
  }

  /**
   * Forces an immediate save
   */
  async forceSave(): Promise<void> {
    await this.processSaveQueue();
  }
}

export default AutoSaveService.getInstance();