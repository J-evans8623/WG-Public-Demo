// app/src/utils/share/shareToken.ts

/**
 * @file shareToken.ts
 * @responsibility
 *   • Generate cryptographically-secure 128-bit share tokens.
 *   • Atomically redeem tokens in Firestore:
 *       – Validate status === 'active'.
 *       – If a collab invite has expired, “downgrade” it to copy mode.
 *       – Always increment `uses`, and disable if `singleUse`.
 *       – Persist exactly one set of writes in a transaction.
 *   • Return the up-to-date Invite object (data merged with updates).
 */

import crypto from 'crypto';
import admin from 'firebase-admin';
import { Invite } from '../../schemas/invites';

if (!admin.apps.length) {
  admin.initializeApp();
}

const firestore = admin.firestore();
const INVITES_COLLECTION = 'invites';

/**
 * Generate a 128-bit, URL-safe token.
 */
export function generateToken(): string {
  return crypto.randomBytes(16).toString('base64url');
}

/**
 * Redeem a share token:
 *  • Ensures the invite exists and is active.
 *  • If collab & expired: flips mode → 'copy' and marks joinWindowClosed.
 *  • Increments uses; if singleUse, sets status → 'disabled'.
 *  • Applies _one_ transaction with all reads first, then writes.
 *  • Returns the merged Invite object (original data + updates).
 */
export async function redeemToken(tokenId: string): Promise<Invite> {
  const ref = firestore.collection(INVITES_COLLECTION).doc(tokenId);

  return await firestore.runTransaction(async (tx) => {
    // 1) Read the invite
    const snap = await tx.get(ref);
    if (!snap.exists) {
      throw new Error('Invite not found');
    }

    const data = snap.data() as Invite;

    if (data.status !== 'active') {
      throw new Error('Invite is not active');
    }

    const now = admin.firestore.Timestamp.now();
    const updates: Partial<Invite> = {};

    // 2) Auto-downgrade collab → copy if past expiry
    if (data.mode === 'collab' && now.toMillis() > data.expiresAt.toMillis()) {
      updates.mode = 'copy';
      updates.joinWindowClosed = true;
    }

    // 3) Increment uses
    updates.uses = (data.uses || 0) + 1;

    // 4) If singleUse, disable it
    if (data.singleUse) {
      updates.status = 'disabled';
    }

    // 5) If there are any updates, write them
    if (Object.keys(updates).length > 0) {
      tx.update(ref, updates);
    }

    // 6) Return the merged Invite object (no second read)
    return {
      ...data,
      ...updates,
    } as Invite;
  });
}
