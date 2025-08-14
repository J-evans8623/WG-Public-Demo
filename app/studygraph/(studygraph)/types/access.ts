/**
 * @file app/src/types/access.ts
 * @description
 * Shared TypeScript types for the access control layer that enable deterministic role resolution
 * across the entire application. These types form the contract between backend API responses and
 * frontend access state management. The vocabulary here ensures that all producers (API endpoints,
 * Yjs WebSocket events, document operations) and consumers (UI components, autosave logic) speak
 * the same language about permissions. Role represents the user's access level, AccessSignal
 * captures permission state changes, AccessSource identifies where signals originate, and
 * AccessEnvelope provides the standard response format from API endpoints. This unified type
 * system eliminates ambiguity and makes permission flows traceable and debuggable throughout
 * the application lifecycle.
 * 
 * Responsibilities:
 * - Define the three-tier role hierarchy (Owner > Editor > Viewer)
 * - Enumerate all possible access state transition signals
 * - Identify all sources that can produce access signals
 * - Standardize the API response envelope format for access information
 */

/**
 * @enum Role
 * @description
 * The three-tier permission hierarchy for document access. Owner has full control including
 * ACL management, Editor can modify document content, and Viewer has read-only access.
 * The hierarchy is strictly ordered: Owner > Editor > Viewer.
 */
export type Role = 'Owner' | 'Editor' | 'Viewer'|'None';

/**
 * @enum AccessSignal
 * @description
 * Signals that indicate access state transitions. GRANT_EDIT indicates promotion to edit
 * permissions, EDIT_REVOKED indicates demotion to view-only, and null represents no change
 * in access state. These signals drive UI mode switches and trigger necessary cleanup.
 */
export type AccessSignal = 'GRANT_EDIT' | 'EDIT_REVOKED' | null;

/**
 * @enum AccessSource
 * @description
 * Identifies the origin of access signals to help with debugging and determining signal
 * priority. 'save' comes from document save operations, 'upload' from upload URL generation,
 * 'download' from download URL generation, 'yjs' from WebSocket collaboration events,
 * and 'bootstrap' from initial document creation or loading.
 */
export type AccessSource = 'save' | 'upload' | 'download' | 'yjs' | 'bootstrap';

/**
 * @interface AccessEnvelope
 * @description
 * Standard envelope returned by API endpoints containing access control information.
 * This ensures consistent access data across all API responses, making client-side
 * access resolution predictable and reliable.
 */
export interface AccessEnvelope {
  docId: string;
  role: Role;
  signal: AccessSignal;
  source: AccessSource;
  at: string; // Unix timestamp in milliseconds
}

/**
 * @interface AccessEvent
 * @description
 * Internal representation of an access event within the AccessLayerContext. Extends
 * the envelope with optional fields for tracking state transitions and debugging.
 */
export interface AccessEvent extends Partial<AccessEnvelope> {
  docId?: string;
  role?: Role;
  signal?: AccessSignal;
  source?: AccessSource;
  at?: string;
}

/**
 * @interface AccessSnapshot
 * @description
 * Complete ACL snapshot for a document, used by backend helpers to compute user-specific
 * roles. This represents the document's permission posture independent of any specific user.
 */
export interface AccessSnapshot {
  ownerId: string;
  editors: string[];
  publicEdit?: boolean;
  publicView?: boolean;
}