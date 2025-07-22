/**
 * @file invites.d.ts
 * @responsibility
 *   Defines the Firestore schema for share invites:
 *     • A perpetual URL token whose “collab” join power expires after a window.
 *     • Tracks join-window expiry, disabled/revoked state, and usage counts.
 */

import { Timestamp } from 'firebase-admin/firestore';

export interface Invite {
  id: string;                        // Firestore document ID == tokenId
  resourceId: string;                // ID of the shared resource
  ownerId: string;                   // Firebase Auth UID of the owner
  originalMode: 'copy' | 'collab';   // Mode at creation time
  mode: 'copy' | 'collab';           // Current redemption behaviour
  delivery: 'link' | 'email' | 'flyer';
  permission: 'edit' | 'view';   // Only for collab-mode invites
  singleUse: boolean;                // True if one-time only
  uses: number;                      // Incremented on each redeem
  issuedAt: Timestamp;               // When created
  expiresAt: Timestamp;              // Must be set for collab invites
  joinWindowClosed: boolean;         // True once the window elapses
  status: 'active' | 'disabled' | 'archived';
  emailList?: string[];              // Optional whitelist
}
