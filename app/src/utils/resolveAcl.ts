/***************************************************************************************
 * @file server/acl/resolveAcl.ts
 * @description
 *   Centralized ACL resolver for Bloom-Maps. This module reads Firestore using the
 *   Admin SDK (via the existing `firebase.ts` singleton) to decide a user’s effective
 *   rights for a given document. It supports the “owner fast-path” and evaluates
 *   three sharing modes from our PRD: read-only, editor-list, and anyone-can-edit.
 *   Membership is keyed by **email** under `documents/{docId}/members/{email}` and,
 *   for backward compatibility, falls back to legacy `documents/{docId}/editors/{email}`
 *   if the new subcollection is absent. The resolver returns a compact snapshot:
 *   `{ isOwner, role, canRead, canEdit, publicView, publicEdit }`. This snapshot is
 *   deliberately stable so all endpoints (bootstrap, URL issuance, collab/start) can
 *   reuse it consistently, preventing duplicated logic and subtle divergences.
 ***************************************************************************************/

import { firestore } from "../services/firebase";
import { ErrorCode} from "@/app/src/types/errorCodes"

export type AclRole = 'owner' | 'editor' | 'viewer';
export interface AclSnapshot {
  isOwner: boolean;
  role: AclRole | null;                 // null when the caller has no read access
  canRead: boolean;
  canEdit: boolean;
  publicView: boolean;
  publicEdit: boolean;
  ownerId?: string;
  docExists: boolean;
}

/**
 * @function resolveAcl
 * @description
 *   Computes the effective ACL snapshot for a given `docId` and optional `userEmail`.
 *   The evaluation adheres to the PRD:
 *     1) Owners always have full read/write and are never downgraded.
 *     2) Non-owners can read if publicView=true OR publicEdit=true OR they are a member
 *        (viewer/editor/owner). They can edit if they are an editor/owner member OR if
 *        publicEdit=true (and signed-in) — sign-in is implied by the presence of email.
 *     3) Role is null when the caller cannot read; otherwise it reflects owner/editor/viewer.
 *   The function never throws for “not found”; it returns `docExists=false` with a deny.
 */
export async function resolveAcl(docId: string, userEmail?: string | null): Promise<AclSnapshot> {
  // 1) Load document core (owner & public flags)
  const docRef = firestore.collection('documents').doc(docId);
  let ownerId = '';
  let publicView = false;
  let publicEdit = false;

  try {
    const snap = await docRef.get();
    if (!snap.exists) {
      console.log('[resolveAcl.ts][8101] › doc not found', { docId });
      return {
        isOwner: false,
        role: null,
        canRead: false,
        canEdit: false,
        publicView: false,
        publicEdit: false,
        ownerId: undefined,
        docExists: false,
      };
    }

    const data = snap.data() || {};
    ownerId = (data.ownerId as string) || '';
    publicView = Boolean(data.publicView);
    publicEdit = Boolean(data.publicEdit);
    console.log('[resolveAcl.ts][8102] › doc core loaded', { docId, ownerId, publicView, publicEdit });
  } catch (err) {
    // Unexpected Firestore error; fail closed but indicate docExists unknown (treat as false)
    console.error('[resolveAcl.ts][8199] › Firestore error loading document', { docId, err });
    return {
      isOwner: false,
      role: null,
      canRead: false,
      canEdit: false,
      publicView: false,
      publicEdit: false,
      ownerId: undefined,
      docExists: false,
    };
  }

  // 2) Owner fast-path
  const email = (userEmail || '').trim().toLowerCase();
  const isOwner = !!email && email === (ownerId || '').toLowerCase();
  if (isOwner) {
    console.log('[resolveAcl.ts][8103] › owner fast-path', { docId, email });
    return {
      isOwner: true,
      role: 'owner',
      canRead: true,
      canEdit: true,
      publicView,
      publicEdit,
      ownerId,
      docExists: true,
    };
  }

  // 3) Membership lookup (members/* preferred; editors/* as legacy fallback)
  let memberRole: AclRole | null = null;
  if (email) {
    try {
      const memberRef = docRef.collection('members').doc(email);
      const memberSnap = await memberRef.get();

      if (memberSnap.exists) {
        const m = memberSnap.data() || {};
        const role = (m.role as string) || 'viewer';
        memberRole = role === 'owner' ? 'owner' : role === 'editor' ? 'editor' : 'viewer';
        console.log('[resolveAcl.ts][8104] › member role (members/*)', { docId, email, memberRole });
      } else {
        // Legacy fallback: documents/{docId}/editors/{email} implies editor
        const legacyRef = docRef.collection('editors').doc(email);
        const legacySnap = await legacyRef.get();
        if (legacySnap.exists) {
          memberRole = 'editor';
          console.log('[resolveAcl.ts][8105] › legacy editor detected (editors/*)', { docId, email });
        }
      }
    } catch (err) {
      console.error('[resolveAcl.ts][8198] › membership lookup failed', { docId, email, err });
      // continue with memberRole = null
    }
  }

  // 4) Compute rights for non-owners
  const hasIdentity = !!email; // implies signed-in
  const canRead =
    publicView ||
    publicEdit ||
    memberRole === 'viewer' ||
    memberRole === 'editor' ||
    memberRole === 'owner';

  const canEdit =
    (memberRole === 'editor' || memberRole === 'owner') ||
    (publicEdit && hasIdentity); // anyone-can-edit requires sign-in

  // 5) Effective role (null when cannot read)
  let role: AclRole | null = null;
  if (canRead) {
    if (memberRole === 'owner') role = 'owner'; // rare for non-owner path but supported
    else if (memberRole === 'editor') role = 'editor';
    else role = 'viewer';
  }

  console.log('[resolveAcl.ts][8106] › computed snapshot', {
    docId, email, canRead, canEdit, role, publicView, publicEdit,
  });

  return {
    isOwner: false,
    role,
    canRead,
    canEdit,
    publicView,
    publicEdit,
    ownerId,
    docExists: true,
  };
}

/**
 * @function assertCanRead
 * @description
 *   Convenience guard that throws a typed object with `code` for callers that prefer
 *   exception flow. It relies on `resolveAcl` and uses the same logic. Route handlers
 *   can catch and translate `code` via `statusForError` for consistent responses.
 */
export async function assertCanRead(docId: string, userEmail?: string | null): Promise<AclSnapshot> {
  const acl = await resolveAcl(docId, userEmail);
  if (!acl.docExists) {
    const err: any = new Error('Document not found');
    err.code = ErrorCode.DOC_NOT_FOUND;
    throw err;
  }
  if (!acl.canRead) {
    const err: any = new Error('Read not permitted');
    err.code = ErrorCode.ACL_DENIED_READ;
    throw err;
  }
  return acl;
}

/**
 * @function assertCanEdit
 * @description
 *   Similar guard for write permission. Owners always pass; non-owners must have edit
 *   rights per membership or `publicEdit`. When denied this throws with `code` that
 *   callers can map to HTTP status and structured JSON for clients.
 */
export async function assertCanEdit(docId: string, userEmail?: string | null): Promise<AclSnapshot> {
  const acl = await resolveAcl(docId, userEmail);
  if (!acl.docExists) {
    const err: any = new Error('Document not found');
    err.code = ErrorCode.DOC_NOT_FOUND;
    throw err;
  }
  if (!acl.canEdit) {
    const err: any = new Error('Edit not permitted');
    err.code = ErrorCode.ACL_DENIED_EDIT;
    throw err;
  }
  return acl;
}
