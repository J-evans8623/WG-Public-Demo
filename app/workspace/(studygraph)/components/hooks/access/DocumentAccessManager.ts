/***************************************************************************************
 * @file DocumentAccessManager.ts (marked for removal)
 * @description
 *   Module-scoped singleton that provides race-condition-immune document access state
 *   management for the entire application. This class serves as the single source of truth
 *   for determining canvas edit capabilities by maintaining timestamped access records
 *   synchronized with server-side access control decisions. The manager eliminates React
 *   state propagation timing issues through promise-based workflow synchronization, ensuring
 *   that canvas rendering decisions wait for definitive access resolution. It captures
 *   access information from multiple sources (file lists, document loads, saves) and uses
 *   newest-wins timestamp conflict resolution to maintain consistency across rapid file
 *   switching operations. The singleton pattern ensures persistence across React re-renders
 *   while providing a clean API for integration with existing document loading workflows.
 *
 * Responsibilities:
 *   - Maintain timestamped access records for all loaded documents
 *   - Provide race-condition-immune canEdit() decisions for canvas rendering
 *   - Synchronize access state from file lists, document operations, and server responses
 *   - Manage document selection workflow with PENDING/READY status transitions
 *   - Support promise-based waiting for definitive access resolution
 *
 * Update rationale:
 *   This revision introduces a referentially stable snapshot cache used by the React
 *   `useSyncExternalStore` bridge. Previously, `getSnapshot()` created a fresh object on
 *   each call, which caused React to perceive spurious changes and re-render indefinitely
 *   in strict/concurrent modes. We now compute a compact key from the effective state
 *   (`status | currentDocId | canEdit(current)`), cache the last snapshot object, and
 *   return the cached reference when the key is unchanged. We also ensure `emit()` is
 *   invoked only when any of those effective fields change (status, active doc, or the
 *   effective canEdit for the active doc). This eliminates infinite update loops while
 *   preserving real-time reactivity. Logging remains purposeful and minimal, with
 *   4-digit codes enabling quick grep across production logs.
 ***************************************************************************************/

import type { AccessEnvelope } from '@/app/workspace/(studygraph)/types/access';
import type { UserFileMetadata } from '@/app/src/types/fileTypes';

/**
 * @interface AccessRecord
 * @description
 *   Complete access information for a single document including computed edit capability,
 *   user role, public access flags, and timestamp for conflict resolution. The canEdit
 *   field provides the definitive answer for canvas rendering decisions while other fields
 *   support debugging and detailed access analysis.
 */
interface AccessRecord {
  docId: string;
  canEdit: boolean;
  role: 'Owner' | 'Editor' | 'Viewer' | 'None';
  publicEdit?: boolean;
  publicView?: boolean;
  timestamp: number;
  source: 'list' | 'create' | 'load' | 'save' | 'download' | 'bootstrap';
}

/** Public snapshot shape consumed by React bridge. */
export type AccessSnapshot = {                        
  mode: 'edit' | 'readonly';                          
  status: AccessStatus;                               
  docId: string | null;                             
};

/**
 * @type AccessStatus
 * @description
 *   Workflow state indicating whether access resolution is complete. PENDING means
 *   access information is being loaded/resolved, READY means definitive access state
 *   is available for canvas rendering decisions.
 */
type AccessStatus = 'PENDING' | 'READY';

/**
 * @class DocumentAccessManager
 * @description
 *   Singleton class providing centralized document access state management with
 *   race-condition immunity through promise-based synchronization. Maintains access
 *   records for all documents and provides deterministic canEdit decisions for canvas
 *   rendering while handling complex access resolution workflows and conflict resolution.
 */
class DocumentAccessManager {
  private static instance: DocumentAccessManager;
  private accessRecords: Map<string, AccessRecord> = new Map();
  private status: AccessStatus = 'READY';
  private currentDocId: string | null = null;
  private readyPromise: Promise<void> | null = null;
  private readyResolve: (() => void) | null = null;

  // ────────────────────────────────────────────────────────────────────────────
  // 1) Event-driven subscription bridge for React (Strategy A)                
  // ────────────────────────────────────────────────────────────────────────────
  private listeners: Set<() => void> = new Set();
  private notifyScheduled = false;

  // ────────────────────────────────────────────────────────────────────────────
  // 2) Snapshot caching for referential stability (fixes infinite re-render)   
  // ────────────────────────────────────────────────────────────────────────────
  private lastSnapshot: AccessSnapshot | null = null;                           // update - 9
  private lastKey: string | null = null;                                        // update - 10

  /**
   * @function subscribe
   * @description
   *   1) Registers a listener that will be invoked whenever the effective DAM state
   *      changes for the **active document** (docId, mode, or status).
   *   2) Returns an unsubscribe function.
   *   3) O(1) add/remove and O(L) notify where L is the number of listeners (small).
   */
  subscribe = (listener: () => void): (() => void) => {                         // update - 3
    this.listeners.add(listener);                                               // update - 3
    return () => this.listeners.delete(listener);                               // update - 3
  };

  /**
   * @function getSnapshot
   * @description
   *   Returns a **pure**, side-effect-free snapshot of the current effective access state:
   *   { mode, status, docId }. This function performs O(1) work: one Map lookup and
   *   constant-time checks. It now caches the last snapshot and returns the same object
   *   reference if the effective key hasn't changed, guaranteeing referential stability
   *   for React's `useSyncExternalStore`. This prevents unnecessary renders and the
   *   “Maximum update depth exceeded” loop seen when a new object was returned each call.
   */
  getSnapshot = (): AccessSnapshot => {                                         // update - 11
    const docId = this.currentDocId;                                            // update - 11
    const record = docId ? this.accessRecords.get(docId) : undefined;           // update - 11
    const canEdit = !!record?.canEdit;                                          // update - 11
    const mode: 'edit' | 'readonly' = canEdit ? 'edit' : 'readonly';            // update - 11
    const key = `${this.status}|${docId ?? ''}|${canEdit ? 1 : 0}`;             // update - 11

    if (this.lastKey === key && this.lastSnapshot) {                            // update - 12
      return this.lastSnapshot;                                                 // update - 12
    }                                                                           
    const snap: AccessSnapshot = { mode, status: this.status, docId };          // update - 12
    this.lastKey = key;                                                         // update - 12
    this.lastSnapshot = snap;                                                   // update - 12
    return snap;                                                                // update - 12
  };

  /**
   * @function emit
   * @description
   *   Schedules a **microtask-coalesced** notification to subscribers. If multiple DAM
   *   mutations occur inside the same turn, React will receive **one** consolidated event.
   *   Complexity: O(1) to schedule, O(L) to notify. Contains a concise log for observability.
   */
  private emit(): void {
    if (this.notifyScheduled) return;
    this.notifyScheduled = true;
    queueMicrotask(() => {
      this.notifyScheduled = false;
      console.log('[DocumentAccessManager.ts][1201] › notifying subscribers');
      this.listeners.forEach((ln) => {
        try { ln(); } catch (_e) { /* never throw */ }
      });
    });
  }

  /**
   * @method getInstance
   * @description
   *   Returns the singleton instance of DocumentAccessManager, creating it if necessary.
   *   This ensures only one access manager exists throughout the application lifecycle
   *   and provides consistent access state management across all components.
   */
  static getInstance(): DocumentAccessManager {
    if (!this.instance) {
      this.instance = new DocumentAccessManager();
      console.log('[DocumentAccessManager.ts][1001] › Singleton instance created');
    }
    return this.instance;
  }

  /**
   * @method syncFileList
   * @description
   *   Synchronizes access records with file metadata from the server, updating the
   *   singleton's state with the latest access information for all user files. This
   *   method processes both owned and shared files, extracting role and access flags
   *   to build comprehensive access records for subsequent canEdit decisions.
   */
  syncFileList(files: UserFileMetadata[]): void {
    console.log('[DocumentAccessManager.ts][1002] › Syncing file list', { count: files.length });

    let affectedCurrent = false;
    // Step 1: Process each file and create/update access records
    files.forEach(file => {
      const record: AccessRecord = {
        docId: file.fileId,
        canEdit: this.computeCanEdit(file.role, file.publicEdit),
        role: file.role || 'Viewer',
        publicEdit: file.publicEdit,
        publicView: file.publicView,
        timestamp: Date.now(),
        source: 'list'
      };

      // Step 2: Store record with timestamp-based conflict resolution
      const changed = this.updateRecord(file.fileId, record);                   // update - 6
      if (changed && file.fileId === this.currentDocId) {                       // update - 6
        affectedCurrent = true;                                                 // update - 6
      }
    });

    console.log('[DocumentAccessManager.ts][1003] › File list sync complete', {
      totalRecords: this.accessRecords.size
    });
    if (affectedCurrent) this.emit();
  }

  /**
   * @method canEdit
   * @description
   *   Returns the definitive edit capability for the specified document based on
   *   the most recent access information. This method provides the authoritative
   *   answer for canvas rendering decisions and is immune to React state timing
   *   issues since it reads from the singleton's synchronized state.
   */
  canEdit(docId: string): boolean {
    const record = this.accessRecords.get(docId);
    const result = record?.canEdit || false;

    console.log('[DocumentAccessManager.ts][1004] › canEdit query', {
      docId,
      result,
      hasRecord: !!record,
      role: record?.role,
      publicEdit: record?.publicEdit,
      time: Date.now()
    });

    return result;
  }

  /**
   * @method waitForDocumentReady
   * @description
   *   Returns a promise that resolves when the specified document's access state
   *   has been definitively resolved and the status is READY. This enables canvas
   *   rendering to wait for complete access resolution, eliminating race conditions
   *   between document loading and UI rendering decisions.
   */
  async waitForDocumentReady(docId: string): Promise<void> {
    console.log('[DocumentAccessManager.ts][1005] › Waiting for document ready', {
      docId,
      currentStatus: this.status,
      currentDocId: this.currentDocId
    });

    // Step 1: If already ready and this is the current doc, return immediately
    if (this.status === 'READY' && this.currentDocId === docId) {
      console.log('[DocumentAccessManager.ts][1006] › Document already ready');
      return;
    }

    // Step 2: If there's a pending promise for this document, wait for it
    if (this.readyPromise && this.currentDocId === docId) {
      console.log('[DocumentAccessManager.ts][1007] › Waiting for existing ready promise');
      await this.readyPromise;
      return;
    }

    // Step 3: Document is ready but different from current, consider it ready
    if (this.status === 'READY') {
      console.log('[DocumentAccessManager.ts][1008] › Different document, assuming ready');
      return;
    }

    // Step 4: Wait for the current pending operation to complete
    if (this.readyPromise) {
      await this.readyPromise;
    }
  }

  /**
   * @method selectDocument
   * @description
   *   Initiates document selection workflow by setting status to PENDING and creating
   *   a promise that will resolve when access resolution is complete. This method
   *   should be called at the start of any document loading operation to signal that
   *   access state is being resolved and canvas rendering should wait.
   *
   *   Phase-3 refinement ( update - 2 ):
   *   If an access record for this doc already exists (seeded via syncFileList), we flip
   *   to READY immediately and resolve any waiter synchronously. This matches the intended
   *   no-network behavior for picker opens, making waitForDocumentReady() effectively O(1).
   */
  selectDocument(docId: string): void {
    console.log('[DocumentAccessManager.ts][1009] › Selecting document', {
      docId,
      previousStatus: this.status,
      previousDocId: this.currentDocId
    });

    const prevKey = this.lastKey;                                               // update - 13
    this.currentDocId = docId;

    // Fast-path: record is already known from file tiles (no backend dependency).
    const known = this.accessRecords.get(docId);
    if (known) {
      this.status = 'READY';
      // Resolve any previous waiter immediately (idempotent)
      if (this.readyResolve) {
        this.readyResolve();
        this.readyResolve = null;
      }
      this.readyPromise = null;
      console.log('[DocumentAccessManager.ts][1040] › selectDocument fast-path READY', {
        docId,
        role: known.role,
        canEdit: known.canEdit
      });

      // Emit if the effective snapshot changed (docId or status or canEdit)     // update - 13
      if (prevKey !== this.getSnapshotKey()) { this.emit(); }                   // update - 13
      return;
    }

    // Standard path: create a new pending promise to be completed later.
    this.status = 'PENDING';
    this.readyPromise = new Promise<void>((resolve) => {
      this.readyResolve = resolve;
    });

    console.log('[DocumentAccessManager.ts][1010] › Document selection initiated', {
      docId,
      status: this.status
    });

    // Emit because status/docId changed and consumers must reflect loading       // update - 14
    this.emit();                                                                 // update - 14
  }

  /**
   * @method confirmDocumentReady
   * @description
   *   Completes document selection workflow by setting status to READY and resolving
   *   any pending promises. This signals that access resolution is complete and canvas
   *   rendering can proceed with confidence in the access state. Should be called after
   *   all access information has been captured and processed.
   */
  confirmDocumentReady(docId: string): void {
    console.log('[DocumentAccessManager.ts][1011] › Confirming document ready', {
      docId,
      currentDocId: this.currentDocId,
      currentStatus: this.status
    });

    // Step 1: Verify this is for the current document
    if (this.currentDocId !== docId) {
      console.warn('[DocumentAccessManager.ts][1012] › Ready confirmation for different document', {
        requested: docId,
        current: this.currentDocId
      });
      return;
    }

    // Step 2: Set status to READY and resolve promise
    this.status = 'READY';
    if (this.readyResolve) {
      this.readyResolve();
      this.readyResolve = null;
    }
    this.readyPromise = null;

    console.log('[DocumentAccessManager.ts][1013] › Document confirmed ready', {
      docId,
      status: this.status
    });

    this.emit();                                                                 // update - 15
  }

  /**
   * @method recordNewDocument
   * @description
   *   Records access information for a newly created document with Owner role and
   *   full edit capabilities. This method immediately sets the document as ready
   *   since new document creation provides definitive access state without requiring
   *   server-side resolution workflows.
   */
  recordNewDocument(docId: string, role: 'Owner'): void {
    console.log('[DocumentAccessManager.ts][1014] › Recording new document', { docId, role });

    // Step 1: Create access record for new document
    const record: AccessRecord = {
      docId,
      canEdit: true,
      role,
      publicEdit: false,
      publicView: false,
      timestamp: Date.now(),
      source: 'create'
    };

    // Step 2: Store record and set as current
    this.updateRecord(docId, record);
    this.currentDocId = docId;
    this.status = 'READY';

    console.log('[DocumentAccessManager.ts][1015] › New document recorded', {
      docId,
      canEdit: record.canEdit
    });

    this.emit();                                                                 // update - 16
  }

  /**
   * @method interceptLoad
   * @description
   *   Captures access information from document loading operations, particularly from
   *   download URL responses that include server-computed access envelopes. This method
   *   processes the access envelope to extract role and public flags, then updates the
   *   access record with definitive server-side access decisions.
   */
  interceptLoad(docId: string, accessEnvelope: AccessEnvelope): void {
    console.log('[DocumentAccessManager.ts][1016] › Intercepting load access', {
      docId,
      role: accessEnvelope.role,
      publicEdit: accessEnvelope.publicEdit,
      source: accessEnvelope.source
    });

    // Step 1: Extract access information from envelope
    const record: AccessRecord = {
      docId,
      canEdit: this.computeCanEdit(accessEnvelope.role, accessEnvelope.publicEdit),
      role: accessEnvelope.role || 'Viewer',
      publicEdit: accessEnvelope.publicEdit,
      publicView: accessEnvelope.publicView,
      timestamp: Date.parse(accessEnvelope.at) || Date.now(),
      source: 'load'
    };

    // Step 2: Update record with timestamp-based resolution
    const changed = this.updateRecord(docId, record);                            // update - 17
    console.log('[DocumentAccessManager.ts][1017] › Load access intercepted', {
      docId,
      canEdit: record.canEdit,
      role: record.role
    });

    if (changed && this.currentDocId === docId) { this.emit(); }                 // update - 17
  }

  /**
   * @method interceptSave
   * @description
   *   Captures access information from document save operations, updating access
   *   records when save responses include access envelopes. This ensures that access
   *   state remains synchronized when permissions change during document operations
   *   such as sharing modifications or ownership transfers.
   */
  interceptSave(docId: string, accessEnvelope?: AccessEnvelope): void {
    if (!accessEnvelope) return;

    console.log('[DocumentAccessManager.ts][1018] › Intercepting save access', {
      docId,
      role: accessEnvelope.role,
      source: accessEnvelope.source
    });

    // Step 1: Create record from save envelope
    const record: AccessRecord = {
      docId,
      canEdit: this.computeCanEdit(accessEnvelope.role, accessEnvelope.publicEdit),
      role: accessEnvelope.role || 'Viewer',
      publicEdit: accessEnvelope.publicEdit,
      publicView: accessEnvelope.publicView,
      timestamp: Date.parse(accessEnvelope.at) || Date.now(),
      source: 'save'
    };

    // Step 2: Update with conflict resolution
    const changed = this.updateRecord(docId, record);                            // update - 18

    console.log('[DocumentAccessManager.ts][1019] › Save access intercepted', {
      docId,
      canEdit: record.canEdit
    });

    if (changed && this.currentDocId === docId) { this.emit(); }                 // update - 18
  }

  /**
   * @method getStatus
   * @description
   *   Returns the current workflow status indicating whether access resolution is
   *   pending or ready. This status is used by canvas rendering logic to determine
   *   whether to show loading states or proceed with definitive canvas mode decisions.
   */
  getStatus(): AccessStatus {
    return this.status;
  }

  /**
   * @method getCurrentDocId
   * @description
   *   Returns the identifier of the currently selected document, or null if no
   *   document is selected. This provides context for status queries and helps
   *   coordinate access resolution across multiple document operations.
   */
  getCurrentDocId(): string | null {
    return this.currentDocId;
  }

  /**
   * @method hasRecord
   * @description
   *   Checks whether an access record exists for the specified document. This method
   *   helps determine if access information is available for canEdit decisions or if
   *   additional resolution steps are needed before canvas rendering.
   */
  hasRecord(docId: string): boolean {
    return this.accessRecords.has(docId);
  }

  /**
   * @method updateRecord
   * @description
   *   Updates or creates an access record using timestamp-based conflict resolution.
   *   Only updates the record if the new information is more recent than existing
   *   data, ensuring that the most current access state is maintained across
   *   overlapping operations and rapid file switching scenarios.
   *
   *   Returns:
   *     true if the stored effective record changed (useful to decide whether to emit),
   *     false otherwise.
   */
  private updateRecord(docId: string, newRecord: AccessRecord): boolean {
    const existing = this.accessRecords.get(docId);

    // Step 1: Apply timestamp-based conflict resolution
    if (existing && existing.timestamp > newRecord.timestamp) {
      console.log('[DocumentAccessManager.ts][1020] › Ignoring stale access record', {
        docId,
        existingTimestamp: existing.timestamp,
        newTimestamp: newRecord.timestamp
      });
      return false;
    }

    // Detect effective change that matters to subscribers (mode flips)
    const beforeCanEdit = existing?.canEdit ?? false;

    // Step 2: Update record with newer information
    this.accessRecords.set(docId, newRecord);

    console.log('[DocumentAccessManager.ts][1021] › Access record updated', {
      docId,
      canEdit: newRecord.canEdit,
      role: newRecord.role,
      source: newRecord.source,
      timestamp: newRecord.timestamp
    });

    return beforeCanEdit !== newRecord.canEdit || !existing;
  }

  /**
   * @method computeCanEdit
   * @description
   *   Computes the definitive edit capability based on user role and public access
   *   flags. This centralized logic ensures consistent canEdit decisions across all
   *   access record creation and update operations, implementing the core access
   *   control business logic in a single location.
   */
  private computeCanEdit(role?: string, publicEdit?: boolean): boolean {
    // Step 1: Owner and Editor roles always have edit access
    if (role === 'Owner' || role === 'Editor') {
      return true;
    }

    // Step 2: Public edit flag grants edit access regardless of role
    if (publicEdit === true) {
      return true;
    }

    // Step 3: All other cases result in read-only access
    return false;
  }

  /**
   * @method getSnapshotKey
   * @description
   *   Internal helper that computes the current effective snapshot key without mutating
   *   cache, enabling call sites to decide whether to emit before/after transitions.
   *   This function performs O(1) work and does not allocate large objects.
   */
  private getSnapshotKey(): string {                                             // update - 19
    const docId = this.currentDocId;                                             // update - 19
    const record = docId ? this.accessRecords.get(docId) : undefined;            // update - 19
    const canEdit = !!record?.canEdit;                                           // update - 19
    return `${this.status}|${docId ?? ''}|${canEdit ? 1 : 0}`;                   // update - 19
  }
}

export default DocumentAccessManager;
