/**
 * @file shareToken.ts
 * @responsibility
 *   Generate cryptographically secure 128-bit share tokens and
 *   provide a helper to redeem them—checking status, join-window,
 *   single-use, and auto-downgrading collab → copy when expired.
 */

import crypto from 'crypto';
import admin from 'firebase-admin';
import { Invite } from '../../schemas/invites';

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
 *  • Validates status === active.
 *  • If collab and past expiresAt, flips mode to 'copy' and sets joinWindowClosed.
 *  • Increments uses; if singleUse, sets status to 'disabled'.
 * Returns the up-to-date Invite doc data.
 */
export async function redeemToken(tokenId: string): Promise<Invite> {
  const ref = firestore.collection(INVITES_COLLECTION).doc(tokenId);
  return await firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('Invite not found');
    const data = snap.data() as Invite;

    if (data.status !== 'active') throw new Error('Invite is not active');
    const now = admin.firestore.Timestamp.now();

    let updated = false;
    const updates: Partial<Invite> = {};

    // Auto-downgrade if join-window closed
    if (data.mode === 'collab' && now.toMillis() > data.expiresAt.toMillis()) {
      updates.mode = 'copy';
      updates.joinWindowClosed = true;
      updated = true;
    }

    // Increment uses and disable if singleUse
    updates.uses = (data.uses || 0) + 1;
    updated = true;
    if (data.singleUse) {
      updates.status = 'disabled';
    }

    if (updated) {
      tx.update(ref, updates);
    }

    const finalSnap = await tx.get(ref);
    return finalSnap.data() as Invite;
  });
}
