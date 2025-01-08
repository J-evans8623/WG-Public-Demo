/**
 * File: /server/services/firebase.ts
 * Responsibility: Provide functions for managing user tier data and storing refresh tokens as a fallback.
 * Dependencies:
 *   - firebase-admin for Firebase operations.
 */

import admin from 'firebase-admin';
import { SessionData } from '../auth/types';

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!)),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
}

const firestore = admin.firestore();

/**
 * FirebaseService interface defines methods for user data management.
 */
export interface FirebaseService {
  /**
   * Stores a user's subscription tier (e.g., free or premium).
   * @param userId - Unique identifier for the user.
   * @param tier - Subscription tier ('free' or 'premium').
   * @returns Promise<void>
   */
  storeUserTier(userId: string, tier: string): Promise<void>;

  /**
   * Checks a user's subscription tier.
   * @param userId - Unique identifier for the user.
   * @returns Promise<string> - The user's subscription tier.
   */
  getUserTier(userId: string): Promise<string>;

  /**
   * Stores a user's refresh token as a fallback.
   * @param userId - Unique identifier for the user.
   * @param refreshToken - The refresh token to store.
   * @returns Promise<void>
   */
  storeRefreshToken(userId: string, refreshToken: string): Promise<void>;

  /**
   * Retrieves a user's refresh token.
   * @param userId - Unique identifier for the user.
   * @returns Promise<string | null> - The stored refresh token or null if not found.
   */
  getRefreshToken(userId: string): Promise<string | null>;
}

/**
 * FirebaseService implementation using Firestore.
 */
export class FirestoreFirebaseService implements FirebaseService {
  /**
   * Stores a user's subscription tier.
   * @param userId - Unique identifier for the user.
   * @param tier - Subscription tier ('free' or 'premium').
   */
  async storeUserTier(userId: string, tier: string): Promise<void> {
    await firestore.collection('users').doc(userId).set(
      { tier },
      { merge: true } // Update existing data without overwriting
    );
  }

  /**
   * Retrieves a user's subscription tier.
   * @param userId - Unique identifier for the user.
   * @returns The user's subscription tier.
   */
  async getUserTier(userId: string): Promise<string> {
    const doc = await firestore.collection('users').doc(userId).get();
    return doc.exists ? (doc.data()?.tier as string) : 'free'; // Default to 'free' if no tier is found
  }

  /**
   * Stores a user's refresh token as a fallback.
   * @param userId - Unique identifier for the user.
   * @param refreshToken - The refresh token to store.
   */
  async storeRefreshToken(userId: string, refreshToken: string): Promise<void> {
    await firestore.collection('users').doc(userId).set(
      { refreshToken },
      { merge: true } // Update existing data without overwriting
    );
  }

  /**
   * Retrieves a user's refresh token.
   * @param userId - Unique identifier for the user.
   * @returns The stored refresh token or null if not found.
   */
  async getRefreshToken(userId: string): Promise<string | null> {
    const doc = await firestore.collection('users').doc(userId).get();
    return doc.exists ? (doc.data()?.refreshToken as string) : null;
  }
}
