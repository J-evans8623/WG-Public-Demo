/**
 * File: /server/services/firebase.ts
 * Responsibility: Provide functions for managing user tier data and storing refresh tokens as a fallback.
 * Dependencies:
 *   - firebase-admin for Firebase operations.
 */

import admin from 'firebase-admin';

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is not set.');
}

if (!process.env.FIREBASE_DATABASE_URL) {
  throw new Error('FIREBASE_DATABASE_URL environment variable is not set.');
}

// Parse the FIREBASE_SERVICE_ACCOUNT JSON string
let serviceAccount: admin.ServiceAccount;
try {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!);
} catch (error) {
  throw new Error('FIREBASE_SERVICE_ACCOUNT is not a valid JSON string.');
}

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
    console.log('Firebase initialized successfully');
  } catch (error) {
    console.error('Firebase initialization error:', error);
    throw error;
  }
}

const firestore = admin.firestore();

/**
 * FirebaseService interface defines methods for user data management.
 */
export interface FirebaseService {
  storeUserTier(userId: string, tier: string): Promise<void>;
  getUserTier(userId: string): Promise<string>;
  storeRefreshToken(userId: string, refreshToken: string): Promise<void>;
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
    try {
      // Check if document exists first
      const docRef = firestore.collection('users').doc(userId);
      const doc = await docRef.get();
      
      if (!doc.exists) {
        // Create document with initial data
        await docRef.set({
          refreshToken,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        // Update existing document
        await docRef.update({
          refreshToken,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    } catch (error) {
      console.error('Error storing refresh token:', error);
      throw error;
    }
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
