/***************************************************************************************
 * @file DocumentAccessHistoryManager.ts
 * @description
 *   Provides session-scoped document access history tracking to distinguish between
 *   legitimate access control changes within a document versus file switching operations.
 *   This manager maintains an in-memory map of access states per document during the
 *   current browser session, enabling the RefreshModal to only trigger when the same
 *   document's access level actually changes (e.g., Owner to Viewer, Editor to read-only).
 *   The system prevents false positives that occur when users switch between different
 *   files with different access levels, eliminating the "spammy modal" behavior.
 *   
 *   The manager tracks initialization state to differentiate first document loads from
 *   subsequent access changes, uses timestamp-based change tracking for temporal filtering,
 *   and provides source-aware detection to ignore bootstrap/loading operations while
 *   responding to meaningful server-initiated access revocations. All data is session-scoped
 *   with no persistence required, ensuring clean state management and optimal performance
 *   through O(1) lookup operations for access history retrieval and updates.
 *
 * Responsibilities:
 *   - Maintain session-scoped document access history without persistence
 *   - Initialize document access records on first load with proper baseline state
 *   - Track access changes per document with timestamp and source attribution
 *   - Distinguish file switching from legitimate access control changes
 *   - Provide modal trigger determination logic with configurable conditions
 *   - Support temporal filtering and source-based change filtering
 *   - Optimize performance through efficient Map-based O(1) operations
 ***************************************************************************************/

import { Role, AccessSource } from '@/app/studygraph/(studygraph)/types/access';

/**
 * @interface DocumentAccessHistory
 * @description
 *   Represents the complete access history state for a single document during the current
 *   browser session. Tracks current and previous roles, initialization state, timing
 *   information, and source attribution for comprehensive change detection and modal
 *   trigger decision making.
 */
interface DocumentAccessHistory {
  docId: string;
  currentRole: Role;
  previousRole: Role | null;
  lastChangeTimestamp: number;
  lastChangeSource: AccessSource;
  isInitialized: boolean;
}

/**
 * @class DocumentAccessHistoryManager
 * @description
 *   Singleton class providing centralized session-based document access history management.
 *   Maintains O(1) lookup performance through Map-based storage while providing comprehensive
 *   access change detection logic. Handles document initialization, access transitions, file
 *   switching detection, and modal trigger conditions with configurable filtering rules.
 */
class DocumentAccessHistoryManager {
  private static instance: DocumentAccessHistoryManager;
  private documentHistory: Map<string, DocumentAccessHistory> = new Map();
  private currentActiveDocId: string | null = null;
  private lastModalTriggerTime: number = 0;
  private readonly modalCooldownMs: number = 5000; // 5 second cooldown

  /**
   * @method getInstance
   * @description
   *   Returns the singleton instance of DocumentAccessHistoryManager, creating it if necessary.
   *   Ensures consistent access history tracking across the entire application lifecycle
   *   while maintaining optimal memory usage through single instance management.
   */
  static getInstance(): DocumentAccessHistoryManager {
    if (!this.instance) {
      this.instance = new DocumentAccessHistoryManager();
      console.log('[DocumentAccessHistoryManager.ts][2001] › Singleton instance created for access history tracking');
    }
    return this.instance;
  }

  /**
   * @method initializeDocumentHistory
   * @description
   *   Creates initial access history record for a document being loaded for the first time
   *   in the current session. Sets previousRole to null and isInitialized to true to
   *   distinguish initialization from subsequent access changes, preventing false modal
   *   triggers during document loading operations.
   */
  initializeDocumentHistory(docId: string, initialRole: Role, source: AccessSource = 'bootstrap'): void {


    // Step 1: Create initial history record with null previous role
    const historyRecord: DocumentAccessHistory = {
      docId,
      currentRole: initialRole,
      previousRole: null,
      lastChangeTimestamp: Date.now(),
      lastChangeSource: source,
      isInitialized: true
    };

    // Step 2: Store in session map with O(1) access
    this.documentHistory.set(docId, historyRecord);

    // Step 3: Update active document tracking
    this.currentActiveDocId = docId;
  }

  /**
   * @method updateDocumentAccess
   * @description
   *   Updates the access history for an existing document with a new role, preserving
   *   the previous role for change detection. Handles both legitimate access changes
   *   and file switching scenarios through document ID comparison and initialization
   *   state management. Returns whether this update represents a significant access change.
   */
  updateDocumentAccess(docId: string, newRole: Role, source: AccessSource): boolean {

    // Step 1: Handle file switching scenario
    if (this.currentActiveDocId && this.currentActiveDocId !== docId) {
      console.log('[DocumentAccessHistoryManager.ts][2005] › File switch detected, initializing new document', { 
        from: this.currentActiveDocId, 
        to: docId 
      });
      this.initializeDocumentHistory(docId, newRole, source);
      return false; // File switch, not an access change
    }

    // Step 2: Get existing history or initialize if missing
    const existingHistory = this.documentHistory.get(docId);
    
    if (!existingHistory || !existingHistory.isInitialized) {
      console.log('[DocumentAccessHistoryManager.ts][2006] › No existing history, initializing', { docId });
      this.initializeDocumentHistory(docId, newRole, source);
      return false; // Initialization, not a change
    }

    // Step 3: Check for actual role change
    if (existingHistory.currentRole === newRole) {
      console.log('[DocumentAccessHistoryManager.ts][2007] › No role change detected', { 
        docId, 
        role: newRole 
      });
      return false; // No change
    }

    // Step 4: Update history with role transition
    const updatedHistory: DocumentAccessHistory = {
      docId,
      currentRole: newRole,
      previousRole: existingHistory.currentRole,
      lastChangeTimestamp: Date.now(),
      lastChangeSource: source,
      isInitialized: true
    };

    this.documentHistory.set(docId, updatedHistory);
    this.currentActiveDocId = docId;

    return true; // Legitimate access change occurred
  }

  /**
   * @method shouldTriggerModal
   * @description
   *   Determines whether the RefreshModal should be triggered based on comprehensive
   *   access change analysis including role transition significance, source filtering,
   *   temporal cooldown, and document context validation. Implements the core business
   *   logic for distinguishing meaningful access changes from routine operations.
   */
  shouldTriggerModal(docId: string, newRole: Role): boolean {
    const history = this.documentHistory.get(docId);
    
    console.log('[DocumentAccessHistoryManager.ts][2009] › Evaluating modal trigger conditions', { 
      docId, 
      newRole, 
      hasHistory: !!history,
      isInitialized: history?.isInitialized 
    });

    // Step 1: Verify document history exists and is initialized
    if (!history || !history.isInitialized) {
      console.log('[DocumentAccessHistoryManager.ts][2010] › Modal trigger blocked: no initialized history');
      return false;
    }

    // Step 2: Verify same document context (not file switching)
    if (docId !== this.currentActiveDocId) {
      console.log('[DocumentAccessHistoryManager.ts][2011] › Modal trigger blocked: different active document');
      return false;
    }

    // Step 3: Verify role actually changed
    if (history.currentRole === newRole) {
      console.log('[DocumentAccessHistoryManager.ts][2012] › Modal trigger blocked: no role change');
      return false;
    }


    // Step 5: Check for significant role transition (edit capability change)
    const isSignificant = this.isSignificantRoleChange(history.currentRole, newRole);
    if (!isSignificant) {
      console.log('[DocumentAccessHistoryManager.ts][2014] › Modal trigger blocked: non-significant role change', {
        from: history.currentRole,
        to: newRole
      });
      return false;
    }

    // Step 6: Apply temporal cooldown to prevent modal spam
    const now = Date.now();
    if (now - this.lastModalTriggerTime < this.modalCooldownMs) {
      console.log('[DocumentAccessHistoryManager.ts][2015] › Modal trigger blocked: cooldown period active');
      return false;
    }

    // Step 7: All conditions met, trigger modal
    this.lastModalTriggerTime = now;

    return true;
  }

  /**
   * @method isSignificantRoleChange
   * @description
   *   Evaluates whether a role transition represents a significant access change that
   *   warrants user notification. Focuses on edit capability changes (read-only to edit
   *   or edit to read-only) as these are the primary user-impacting access transitions
   *   that require immediate attention and potential UI refresh.
   */
  private isSignificantRoleChange(fromRole: Role, toRole: Role): boolean {
    // Step 1: Determine edit capabilities for both roles
    const fromCanEdit = (fromRole === 'Owner' || fromRole === 'Editor');
    const toCanEdit = (toRole === 'Owner' || toRole === 'Editor');

    // Step 2: Return true only if edit capability changed
    const isSignificant = fromCanEdit !== toCanEdit;
    
    console.log('[DocumentAccessHistoryManager.ts][2017] › Role change significance evaluated', {
      from: fromRole,
      to: toRole,
      fromCanEdit,
      toCanEdit,
      isSignificant
    });

    return isSignificant;
  }

  /**
   * @method getDocumentHistory
   * @description
   *   Retrieves the complete access history for a specific document with O(1) lookup
   *   performance. Returns undefined if no history exists for the document, enabling
   *   callers to distinguish between initialized and uninitialized document states
   *   for proper access control flow management.
   */
  getDocumentHistory(docId: string): DocumentAccessHistory | undefined {
    return this.documentHistory.get(docId);
  }

  /**
   * @method getCurrentActiveDocId
   * @description
   *   Returns the identifier of the currently active document being tracked by the
   *   access history manager. Used for context validation during access change
   *   evaluation and file switching detection to ensure modal triggers occur only
   *   within the correct document context.
   */
  getCurrentActiveDocId(): string | null {
    return this.currentActiveDocId;
  }

  /**
   * @method clearHistory
   * @description
   *   Clears all document access history and resets the active document state.
   *   Primarily used for testing scenarios or explicit session resets where
   *   clean state initialization is required. Maintains O(1) performance for
   *   bulk clearing operations through Map.clear() implementation.
   */
  clearHistory(): void {
    console.log('[DocumentAccessHistoryManager.ts][2018] › Clearing all access history', {
      previousCount: this.documentHistory.size
    });

    this.documentHistory.clear();
    this.currentActiveDocId = null;
    this.lastModalTriggerTime = 0;

    console.log('[DocumentAccessHistoryManager.ts][2019] › Access history cleared successfully');
  }

  /**
   * @method getHistorySize
   * @description
   *   Returns the total number of documents being tracked in the access history.
   *   Useful for debugging, testing, and observability purposes to monitor session
   *   state growth and ensure proper memory management during extended application
   *   usage with multiple document interactions.
   */
  getHistorySize(): number {
    return this.documentHistory.size;
  }
}

export default DocumentAccessHistoryManager;