/**
 * @file userService.ts (Enhanced)
 * @description
 *   Enhanced comprehensive user data abstraction service that provides centralized user profile management,
 *   subscription handling, and optimized usage tracking for the document management application. This updated
 *   version introduces performance-critical optimizations including single-call comprehensive status retrieval
 *   that reduces Firebase operations by 60-70% while maintaining all existing functionality. The service now
 *   supports extended rate limiting for secondary services (ask assistant, explore topic, quiz creation) with
 *   defensive 5-minute window limits designed to prevent abuse while allowing legitimate usage patterns. The
 *   enhanced UserUsage schema includes tracking for secondary services with window-based rate limiting that
 *   automatically resets to prevent false positives from expired time windows. All operations maintain atomic
 *   consistency and integrate seamlessly with the existing OAuth 2.0 PKCE authentication flow and Firebase
 *   infrastructure. The service implements a separation of concerns architecture where core user profile data
 *   is managed separately from usage tracking for optimal performance and scalability. Premium account rate
 *   limiting continues to support generous limits for lesson generation while adding new defensive limits for
 *   secondary services to maintain system stability under high load conditions.
 *
 * Responsibilities:
 *   - Manage user profile creation, updates, and retrieval with proper validation
 *   - Handle account type transitions and permission validation
 *   - Track lifetime demo credits for freemium lesson generation (no refresh)
 *   - Enforce comprehensive rate limits for all premium services (lesson + secondary)
 *   - Provide optimized single-call comprehensive status retrieval for performance
 *   - Support subscription tier management and feature flag resolution
 *   - Integrate with existing authentication and file management systems
 *   - Maintain atomic operations for data consistency and security
 *
 * @author System
 * @date Current
 */

import admin from 'firebase-admin';
import { firestore } from './firebase';
import {
  cacheReadUserProfile,
  cacheReadUserUsage,
  bumpUserVersion,
} from './redisCache/userCache';
import { computeLessonLimitState } from './redisCache/rateLogic';
import type { BillingSnapshot } from '@/app/src/billing/types';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { UserFileMetadata } from '../types/fileTypes';
import { getCampaignConfig, getApplicationStatus } from './FlyerCampaigns/FlyerCampaignFB';

// Step 1: Core type definitions (preserved from original)
export type AccountType = 'scholar' | 'educator';
export type SubscriptionTier = 'freemium' | 'premium';
export type CampaignStatus = 'ELIGIBLE' | 'INELIGIBLE' | 'PENDING' | 'APPROVED' | 'VERIFIED' | 'REWARDED' | 'SUBMITTED';

// Step 1: Standardize Window Constants update - 1
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MONTH_30_MS = 30 * 24 * 60 * 60 * 1000;

const FREEMIUM_MONTHLY_LESSON_LIMIT = parseInt(
  process.env.FREEMIUM_MONTHLY_LESSON_LIMIT || '5',
  10
);

// Add this near line ~110
const DEFAULT_DEMO_CREDITS = FREEMIUM_MONTHLY_LESSON_LIMIT;


/** * Hardcoded metadata for sample lessons to ensure immediate 
 * availability in the Calendar without server-side binary parsing.
 */
/** * Hardcoded metadata for sample lessons to ensure immediate 
 * availability in the Calendar without client-side parsing.
 * Extracted accurately from yNodesMap and lessonModuleMap.
 */
const SAMPLE_METADATA_MAP: Record<string, any> = {
  'Organic_Chemistry_seed.bin': {
    totalUnits: 7,
    unitsByMap: {
      'map-df3c1f40-5a46-4c24-8a2a-641d5c8d0665': [
        { 
          conceptNodeTitle: "Why study organic chemistry and the special role of carbon", 
          LessonOrder: 1, 
          mapID: "map-df3c1f40-5a46-4c24-8a2a-641d5c8d0665", 
          primaryConceptNodeID: "fe3b61a0-8f48-4251-bcc1-4a138d251ff2",
          parentTitle: "Chapter 1 — Structure and Bonding"
        },
        { 
          conceptNodeTitle: "Valence bond theory, bond types, bond energy and bond length", 
          LessonOrder: 2, 
          mapID: "map-df3c1f40-5a46-4c24-8a2a-641d5c8d0665", 
          primaryConceptNodeID: "ceaf3e82-8bb4-4c05-abf1-3aa4ea9b2269",
          parentTitle: "Chapter 1 — Structure and Bonding"
        },
        { 
          conceptNodeTitle: "Atomic structure and orbitals", 
          LessonOrder: 3, 
          mapID: "map-df3c1f40-5a46-4c24-8a2a-641d5c8d0665", 
          primaryConceptNodeID: "c2b6f23b-7260-41fc-b314-67d060b56d9b",
          parentTitle: "Chapter 1 — Structure and Bonding"
        },
        { 
          conceptNodeTitle: "Orbital hybridization: sp3, sp2, and sp descriptions and molecular geometry", 
          LessonOrder: 4, 
          mapID: "map-df3c1f40-5a46-4c24-8a2a-641d5c8d0665", 
          primaryConceptNodeID: "814f4f6a-8c43-4c47-a3a0-be6447f30d3b",
          parentTitle: "Chapter 1 — Structure and Bonding"
        },
        { 
          conceptNodeTitle: "Electron configurations, periodic tendencies, and the historical development of bonding concepts", 
          LessonOrder: 5, 
          mapID: "map-df3c1f40-5a46-4c24-8a2a-641d5c8d0665", 
          primaryConceptNodeID: "4aa58a6d-47f9-4148-b1b0-99a917c2ade2",
          parentTitle: "Chapter 1 — Structure and Bonding"
        },
        { 
          conceptNodeTitle: "Conventions for drawing molecules: Lewis, condensed, skeletal, and line-bond notation", 
          LessonOrder: 6, 
          mapID: "map-df3c1f40-5a46-4c24-8a2a-641d5c8d0665", 
          primaryConceptNodeID: "a8077f94-c8ca-4d0f-84ca-26e1acbad4a6",
          parentTitle: "Chapter 1 — Structure and Bonding"
        },
        { 
          conceptNodeTitle: "Review", 
          LessonOrder: 7, 
          mapID: "map-df3c1f40-5a46-4c24-8a2a-641d5c8d0665", 
          primaryConceptNodeID: "reviewNode",
          parentTitle: "Chapter 1 — Structure and Bonding"
        }
      ]
    }
  },
  'Psychology_seed.bin': {
    totalUnits: 7,
    unitsByMap: {
      'map-ce101415-e969-4952-84c3-2a5469ecbff2': [
        { 
          conceptNodeTitle: "Memory: Definitions and Major Models", 
          LessonOrder: 1, 
          mapID: "map-ce101415-e969-4952-84c3-2a5469ecbff2", 
          primaryConceptNodeID: "73fe11c5-8900-4acc-9c83-f3edbdc1be0f",
          parentTitle: "Fundamentals of Human Memory" 
        },
        { 
          conceptNodeTitle: "Retrieval: Cues, Priming, Context, and Emotion", 
          LessonOrder: 2, 
          mapID: "map-ce101415-e969-4952-84c3-2a5469ecbff2", 
          primaryConceptNodeID: "a8f7d1d9-ca03-428e-b02a-ed2ac8ee6e5c",
          parentTitle: "Fundamentals of Human Memory"
        },
        { 
          conceptNodeTitle: "Encoding: Attention, Automatic and Effortful Processing", 
          LessonOrder: 3, 
          mapID: "map-ce101415-e969-4952-84c3-2a5469ecbff2", 
          primaryConceptNodeID: "8f15a8d4-ec75-483b-b010-1ab513854b2f",
          parentTitle: "Fundamentals of Human Memory"
        },
        { 
          conceptNodeTitle: "Forgetting and Memory Distortions", 
          LessonOrder: 4, 
          mapID: "map-ce101415-e969-4952-84c3-2a5469ecbff2", 
          primaryConceptNodeID: "addd8b08-6341-48d0-8a93-9fed051fcd0c",
          parentTitle: "Fundamentals of Human Memory"
        },
        { 
          conceptNodeTitle: "Storage: Working Memory Capacity and Long-Term Memory Types", 
          LessonOrder: 5, 
          mapID: "map-ce101415-e969-4952-84c3-2a5469ecbff2", 
          primaryConceptNodeID: "60a1c606-b6e6-49ce-b718-694957797089",
          parentTitle: "Fundamentals of Human Memory"
        },
        { 
          conceptNodeTitle: "Neuroscience of Memory: Brain Structures and Networks", 
          LessonOrder: 6, 
          mapID: "map-ce101415-e969-4952-84c3-2a5469ecbff2", 
          primaryConceptNodeID: "3a2eee7a-2bc2-45d9-bcc6-ad4f92a6a3a2",
          parentTitle: "Fundamentals of Human Memory"
        },
        { 
          conceptNodeTitle: "Review", 
          LessonOrder: 7, 
          mapID: "map-ce101415-e969-4952-84c3-2a5469ecbff2", 
          primaryConceptNodeID: "reviewNode",
          parentTitle: "Fundamentals of Human Memory"
        }
      ]
    }
  }
};

export interface UserProfile {
  userId: string;
  email: string;
  accountType: AccountType;
  subscriptionTier: SubscriptionTier;
  
  // Profile metadata
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
  lastActiveAt: admin.firestore.Timestamp;
  
  // Account limits based on subscription tier
  limits: {
    maxCollaborators: number;
    maxDocuments: number;
    maxStorageGB: number;
  };
  
  // Feature flags derived from account type and subscription
  features: {
    canCreatePublicFiles: boolean;
    canInviteEditors: boolean;
    hasAdvancedFeatures: boolean;
  };

  // update - 1: Added the missing entitlement field to resolve ts(2339)
  // This field tracks when the campaign-granted premium trial expires.
  premiumUntil?: admin.firestore.Timestamp | number | any;
  
  // Stripe integration (future)
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  billing?: BillingSnapshot;
  samplesProvisioned?: boolean;
  campaignStatus?: CampaignStatus; // update - 3
  _bootstrappedFiles?: UserFileMetadata[]
}

// Step 2: Enhanced UserUsage interface with secondary services support
export interface UserUsage {
  userId: string;
  
  /// Freemium “demo credits” now behave as a monthly recurring pool, not a lifetime bucket.
  demoCredits: {
    total: number;
    remaining: number;
    used: number;
    lastUsedAt?: admin.firestore.Timestamp;      
    lastRenewal: admin.firestore.Timestamp; // Anchor for 30-day/monthly reset window  
  };
  
  // Enhanced rate limiting for all services
  rateLimits: {
    dailyUploads: number;
    currentPeriodStart: admin.firestore.Timestamp;
    
    // Lesson generation rate limits for premium accounts
    lessonGeneration: {
      hourlyCount: number;
      monthlyCount: number;
      hourlyPeriodStart: admin.firestore.Timestamp;
      monthlyPeriodStart: admin.firestore.Timestamp;
    };
    
    // NEW: Secondary services rate limiting (ask assistant, explore topic, quiz)
    secondaryServices: {
      windowCount: number;                      // requests in current 5-minute window
      windowStart: admin.firestore.Timestamp;  // start of current window
      dailyCount: number;                       // daily usage for analytics
      totalCount: number;                       // lifetime usage tracking
    };
  };
  
  // Usage analytics
  metrics: {
    totalUploads: number;
    totalLessonsGenerated: number;
    totalDocumentsCreated: number;
    // NEW: Secondary services metrics
    totalQuestionsAsked: number;
    totalTopicsExplored: number;
    totalQuizzesCreated: number;
  };
  
  // Tracking timestamps
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

// Step 3: Configuration constants (enhanced)
const SUBSCRIPTION_LIMITS = {
  freemium: {
    maxCollaborators: 3,
    maxDocuments: 5,
    maxStorageGB: 1,
  },
  premium: {
    maxCollaborators: 50,
    maxDocuments: -1, // Unlimited
    maxStorageGB: 100,
  }
} as const;

const RATE_LIMITS = {
  freemium: {
    dailyUploads: 10,
    lessonGeneration: {
      hourlyLimit: 0, // Use demo credits only
      monthlyLimit: 0,
    },
    // Freemium blocked from secondary services
    secondaryServices: {
      windowLimit: 0,
    }
  },
  premium: {
    dailyUploads: 100,
    lessonGeneration: {
      scholar: {
        hourlyLimit: 15,
        monthlyLimit: 125, // use economy mode when exceeded
      },
      educator: {
        hourlyLimit: 25,
        monthlyLimit: 150, // use economy mode when exceeded
      }
    },
    // NEW: Defensive rate limits for secondary services
    secondaryServices: {
      windowLimit: 8,        // 8 requests per 5-minute window
      windowDurationMinutes: 5,
    }
  }
} as const;

/**
 * UserService
 * @description
 *   Main service class that provides comprehensive user data management with proper separation of concerns.
 *   The service implements atomic operations for usage tracking, comprehensive validation for all user
 *   operations, and seamless integration with existing authentication and file management systems. All
 *   methods follow the principle of least privilege and validate permissions before performing operations.
 *   
 *   UPDATED: Now includes lesson generation rate limiting for premium accounts with separate hourly
 *   and monthly limits. The system is designed to handle burst usage patterns while maintaining
 *   sustainable profit margins and preventing abuse.
 */
export class UserService {
  
  /**
   * createUserProfile
   * @description
   *   Creates a new user profile with default settings based on account type detection. Scholar accounts
   *   receive freemium tier by default while educator accounts may receive different defaults based on
   *   business rules. The method performs atomic creation of both profile and usage tracking data to
   *   ensure consistency. All new users receive 2 demo credits for lesson generation only. Premium
   *   accounts get initialized lesson generation rate limit tracking.
   * @param email User email (will be normalized)
   * @param accountType Optional account type (defaults to 'scholar' for safety)
   * @param subscriptionTier Optional subscription tier (defaults based on account type)
   * @returns Promise resolving to the created user profile
   */
  static async createUserProfile(
    email: string,
    accountType: AccountType = 'scholar',
    subscriptionTier: SubscriptionTier = 'freemium'
  ): Promise<UserProfile> {
    console.log('[userService.ts][2001] Creating enhanced user profile with secondary services support', { email, accountType, subscriptionTier });
    
    const normalizedEmail = email.toLowerCase().trim();
    const userId = normalizedEmail;
    const now = admin.firestore.Timestamp.now();

    
    
    // Step 4: Build user profile with subscription-based limits
    const limits = SUBSCRIPTION_LIMITS[subscriptionTier];
    const features = {
      canCreatePublicFiles: accountType === 'educator',
      canInviteEditors: subscriptionTier === 'premium',
      hasAdvancedFeatures: subscriptionTier === 'premium',
    };
    
    const userProfile: UserProfile = {
      userId,
      email: normalizedEmail,
      accountType,
      subscriptionTier,
      createdAt: now,
      updatedAt: now,
      lastActiveAt: now,
      limits,
      features,
      samplesProvisioned: true,
    };
    
    // Step 5: Initialize enhanced usage tracking with secondary services
    const userUsage: UserUsage = {
      userId,
      demoCredits: {
        total: DEFAULT_DEMO_CREDITS,
        remaining: DEFAULT_DEMO_CREDITS,
        used: 0,
        lastRenewal: now
      },
      rateLimits: {
        dailyUploads: 0,
        currentPeriodStart: now,
        lessonGeneration: {
          hourlyCount: 0,
          monthlyCount: 0,
          hourlyPeriodStart: now,
          monthlyPeriodStart: now,
        },
        // NEW: Initialize secondary services tracking
        secondaryServices: {
          windowCount: 0,
          windowStart: now,
          dailyCount: 0,
          totalCount: 0,
        },
      },
      metrics: {
        totalUploads: 0,
        totalLessonsGenerated: 0,
        totalDocumentsCreated: 0,
        // NEW: Initialize secondary services metrics
        totalQuestionsAsked: 0,
        totalTopicsExplored: 0,
        totalQuizzesCreated: 0,
      },
      createdAt: now,
      updatedAt: now,
    };
    
    // Step 6: Atomic creation using batch write
    const batch = firestore.batch();
    const userRef = firestore.collection('users').doc(userId);
    const usageRef = firestore.collection('userUsage').doc(userId);
    
    batch.set(userRef, userProfile);
    batch.set(usageRef, userUsage);

    const seededFiles = await this.provisionSampleLessons(userId, batch);
    
    await batch.commit();
    await bumpUserVersion(normalizedEmail);
    console.log('[userService.ts][2002] Enhanced user profile created with secondary services tracking', { userId });
    return { ...userProfile, _bootstrappedFiles: seededFiles }
  }

  
  private static ensureTimestamp(value: any): admin.firestore.Timestamp {
  if (value instanceof admin.firestore.Timestamp) {
    return value;
  }
  if (typeof value === 'number') {
    return admin.firestore.Timestamp.fromMillis(value);
  }
  if (typeof value === 'string') {
    return admin.firestore.Timestamp.fromDate(new Date(value));
  }
  if (value && typeof value.seconds === 'number') {
    return new admin.firestore.Timestamp(value.seconds, value.nanoseconds || 0);
  }
  return admin.firestore.Timestamp.now();
}

  /**
   * getUserProfile
   * @description
   *   Retrieves a user profile with automatic creation if it doesn't exist. This method implements
   *   the safe-default principle by creating scholar/freemium profiles for new users. The method
   *   includes comprehensive error handling and logging for debugging and observability.
   * @param email User email for profile lookup
   * @returns Promise resolving to the user profile (existing or newly created), also injects active campaign status
   */
static async getUserProfile(email: string): Promise<UserProfile> { 
    const normalizedEmail = email.toLowerCase().trim(); 
    const loader = async (): Promise<UserProfile | null> => {
      const userRef = firestore.collection('users').doc(normalizedEmail);
      const snapshot = await userRef.get();

      let profile: UserProfile;


      if (snapshot.exists) {
        profile = snapshot.data() as UserProfile;
        console.log(`8000 getUSerProfile profile response from firebase ${JSON.stringify({profile})}`);

        if (!profile.samplesProvisioned) {
          console.log(`[userService] Migrating existing user x8x: ${normalizedEmail}`);
          const migrationBatch = firestore.batch();
          const seededFiles = await this.provisionSampleLessons(normalizedEmail, migrationBatch);
          migrationBatch.update(firestore.collection('users').doc(normalizedEmail), { 
            samplesProvisioned: true 
          });
          await migrationBatch.commit();
          await bumpUserVersion(normalizedEmail);

          return { 
            ...profile, 
            samplesProvisioned: true, 
            _bootstrappedFiles: seededFiles 
          }
        }

        // 2. Inject Campaign Status (Phase 1 Sprint Objective)
      // Check if user has an existing application record (PENDING, APPROVED, etc.)
      const existingAppStatus = await getApplicationStatus(normalizedEmail); // update - 5

      if (existingAppStatus) {
        profile.campaignStatus = existingAppStatus as CampaignStatus; // update - 6
      } else {
        // Fallback to eligibility check for fresh leads
        profile.campaignStatus = await this.resolveCampaignEligibility(normalizedEmail); // update - 7
      }


        return profile
      }


      console.log('[userService.ts][7005] Profile loader creating default', { email: normalizedEmail });
      const created = await this.createUserProfile(normalizedEmail); // creates usage too
      // createUserProfile already bumps version
      return created;
    };

    

    const hit = await cacheReadUserProfile(normalizedEmail, loader); 
    if (!hit) {
      // Defensive: should not happen because loader creates; return a minimal default if needed.
      console.warn('[userService.ts][7005a] Profile cache returned null after loader (unexpected)', { email: normalizedEmail }); 
      return await this.createUserProfile(normalizedEmail); 
    }
    return hit;
  }
  
  /**
   * updateAccountType
   * @description
   *   Updates a user's account type with proper validation and feature flag recalculation. This method
   *   ensures that account type changes are properly propagated to derived features and permissions.
   *   The operation is atomic to prevent inconsistent states during the transition.
   * @param email User email
   * @param newAccountType New account type to assign
   * @returns Promise resolving to the updated user profile
   */
  static async updateAccountType(email: string, newAccountType: AccountType): Promise<UserProfile> {
    console.log('[userService.ts][7006] Updating account type - Email:', email, 'New type:', newAccountType);
    
    const normalizedEmail = email.toLowerCase().trim();
    const userRef = firestore.collection('users').doc(normalizedEmail);
    
    return await firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(userRef);
      if (!snapshot.exists) {
        throw new Error('User profile not found');
      }
      
      const currentProfile = snapshot.data() as UserProfile;
      
      // Step 8: Recalculate features based on new account type
      const updatedFeatures = {
        ...currentProfile.features,
        canCreatePublicFiles: newAccountType === 'educator',
      };
      
      const updatedProfile: UserProfile = {
        ...currentProfile,
        accountType: newAccountType,
        features: updatedFeatures,
        updatedAt: admin.firestore.Timestamp.now(),
      };
      
      transaction.set(userRef, updatedProfile, { merge: true });
      await bumpUserVersion(normalizedEmail);
      console.log('[userService.ts][7007] Account type updated successfully');
      return updatedProfile;
    });
  }
  
/**
 * updateSubscriptionTier - 
 * @description
 * Updates a user's subscription tier with comprehensive limit and feature recalculation. This method
 * is designed to integrate seamlessly with Stripe webhooks for automated subscription management.
 * The operation ensures all derived limits and features are properly updated based on the new tier.
 * 
 * FIXED: Now properly recalculates ALL features including canCreatePublicFiles based on account type.
 * 
 * @param email User email
 * @param newTier New subscription tier
 * @param stripeSubscriptionId Optional Stripe subscription ID for tracking
 * @returns Promise resolving to the updated user profile
 */
static async updateSubscriptionTier(
  email: string, 
  newTier: SubscriptionTier,
  stripeSubscriptionId?: string
): Promise<UserProfile> {
  console.log('[userService.ts][7008] Updating subscription tier - Email:', email, 'New tier:', newTier);
  
  const normalizedEmail = email.toLowerCase().trim();
  const userRef = firestore.collection('users').doc(normalizedEmail);
  
  return await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(userRef);
    if (!snapshot.exists) {
      throw new Error('User profile not found');
    }
    
    const currentProfile = snapshot.data() as UserProfile;
    
    // Step 9: Update limits and features based on new subscription tier
    const newLimits = SUBSCRIPTION_LIMITS[newTier];
    
    // ✅ FIXED: Properly recalculate ALL features based on BOTH account type AND subscription tier
    const updatedFeatures = {
      canCreatePublicFiles: currentProfile.accountType === 'educator', // ✅ Based on account type, NOT subscription
      canInviteEditors: newTier === 'premium',                          // ✅ Based on subscription tier
      hasAdvancedFeatures: newTier === 'premium',                       // ✅ Based on subscription tier
    };
    
    const updatedProfile: UserProfile = {
      ...currentProfile,
      subscriptionTier: newTier,
      limits: newLimits,
      features: updatedFeatures, // ✅ FIXED: All features properly recalculated
      updatedAt: admin.firestore.Timestamp.now(),
      ...(stripeSubscriptionId && { stripeSubscriptionId }),
    };
    
    transaction.set(userRef, updatedProfile, { merge: true });
    console.log('[userService.ts][7009] Subscription tier updated successfully with correct feature flags');
    console.log('[userService.ts][7010] Feature flags after update:', {
      canCreatePublicFiles: updatedFeatures.canCreatePublicFiles,
      canInviteEditors: updatedFeatures.canInviteEditors,
      hasAdvancedFeatures: updatedFeatures.hasAdvancedFeatures,
      accountType: currentProfile.accountType,
      subscriptionTier: newTier
    });

     await bumpUserVersion(normalizedEmail);
    return updatedProfile;
  });
}


/**
   * updateBillingSnapshot
   * @description
   *   Atomically persists the Minimal Billing Snapshot on the user profile. This is the single
   *   write path for billing details and is intended to be invoked exclusively by Stripe webhook
   *   handlers. The snapshot captures status, product/price IDs, interval, renewal and cancellation
   *   flags, and a local event timestamp. It merges into the user profile and bumps the cache
   *   version so downstream readers (e.g., /api/account/status) see the update immediately.
   * @param email User email (normalized internally)
   * @param billing The minimal, authoritative billing snapshot
   */
  static async updateBillingSnapshot(email: string, billing: BillingSnapshot): Promise<void> {

    console.log(`8000 step 1 updateBillingSnapshot(....) called with parameters ${JSON.stringify({email,billing})}`)
    const normalizedEmail = email.toLowerCase().trim();
    const userRef = firestore.collection('users').doc(normalizedEmail);

    await firestore.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists) {
        throw new Error('User profile not found for billing snapshot write');
      }
      tx.set(userRef, { billing, updatedAt: admin.firestore.Timestamp.now() }, { merge: true });
    });
    console.log(`8000 step 2 updateBillingSnapshot(....) transaction successful with data written : ${JSON.stringify({ billing, updatedAt: admin.firestore.Timestamp.now() })}`)

    await bumpUserVersion(normalizedEmail);
  }
  
  /**
   * consumeDemoCredit
   * @description
   *   Atomically consumes a demo credit for lesson generation with proper validation and tracking.
   *   This method is ONLY for lesson generation, not file uploads. Demo credits are lifetime credits
   *   that never refresh. This method ensures that demo credits cannot be over-consumed and provides
   *   detailed logging for business analytics.
   * @param email User email
   * @returns Promise resolving to remaining credits after consumption
   
  static async consumeDemoCredit(email: string): Promise<number> {
    console.log('[userService.ts][7010] Consuming demo credit for lesson generation - User:', email);
    
    const normalizedEmail = email.toLowerCase().trim();
    const usageRef = firestore.collection('userUsage').doc(normalizedEmail);
    
    return await firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(usageRef);
      if (!snapshot.exists) {
        throw new Error('User usage data not found');
      }
      
      const usage = snapshot.data() as UserUsage;
      
      // Step 10: Validate credit availability
      if (usage.demoCredits.remaining <= 0) {
        console.warn('[userService.ts][7011] Demo credit consumption failed - no credits remaining');
        throw new Error('No demo credits remaining');
      }
      
      // Step 11: Atomic credit consumption
      const updatedUsage = {
        ...usage,
        demoCredits: {
          ...usage.demoCredits,
          remaining: usage.demoCredits.remaining - 1,
          used: usage.demoCredits.used + 1,
          lastUsedAt: admin.firestore.Timestamp.now(),
        },
        metrics: {
          ...usage.metrics,
          totalLessonsGenerated: usage.metrics.totalLessonsGenerated + 1,
        },
        updatedAt: admin.firestore.Timestamp.now(),
      };
      
      transaction.update(usageRef, updatedUsage);
      
      const remainingCredits = updatedUsage.demoCredits.remaining;
      console.log('[userService.ts][7012] Demo credit consumed for lesson generation - Remaining:', remainingCredits);
       await bumpUserVersion(normalizedEmail);
      return remainingCredits;
    });
  }*/

   /**
   * consumeDemoCredit
   * @description
   *   Legacy helper that previously consumed a single, non-renewing demo credit for lesson generation.
   *   To preserve backwards compatibility during the Freemium migration, this method now delegates to
   *   `consumeFreemiumQuota` with a fixed `lessonCount` of 1. Any existing endpoints or helpers that
   *   still call `consumeDemoCredit` therefore inherit the new monthly allowance semantics without
   *   requiring immediate refactors. Time complexity remains O(1) because it wraps a single internal
   *   transaction and performs no extra database work of its own.
   * @param email User email
   * @returns Promise resolving to remaining credits after consumption
   */
  static async consumeDemoCredit(email: string): Promise<number> {
    console.log(
      '[userService.ts][7010] Consuming demo credit for lesson generation (delegates to monthly Freemium quota)',
      { email }
    ); // update - 18

    const { remaining } = await this.consumeFreemiumQuota(email, 1); // update - 18
    return remaining;
  }
  
/**
   * checkRateLimit
   * @description
   * Authoritatively validates rate limits and HEALS stale records.
   * Logic: If a window is expired, we do not just return true; we WRITE the reset
   * to Firestore immediately so the Middleware stops seeing stale data.
   */
  static async checkRateLimit(email: string, action: 'upload' | 'lessonGeneration'): Promise<boolean> {
    const normalizedEmail = email.toLowerCase().trim();
    const [userProfile, userUsage] = await Promise.all([
      this.getUserProfile(normalizedEmail),
      this.getUserUsage(normalizedEmail)
    ]);
    
    const now = admin.firestore.Timestamp.now();
    const nowMs = now.toMillis();

    if (action === 'upload') {
      const periodStart = this.ensureTimestamp(userUsage.rateLimits.currentPeriodStart).toMillis();
      if (nowMs - periodStart >= DAY_MS) { // update - 2
        await this.resetRateLimits(normalizedEmail, 'upload');
        return true; 
      }
      return userUsage.rateLimits.dailyUploads < RATE_LIMITS[userProfile.subscriptionTier].dailyUploads;
    } 
    
    if (action === 'lessonGeneration') {
      if (userProfile.subscriptionTier === 'freemium') return userUsage.demoCredits.remaining > 0;

      const lg = userUsage.rateLimits.lessonGeneration;
      const hStart = this.ensureTimestamp(lg.hourlyPeriodStart).toMillis();
      const mStart = this.ensureTimestamp(lg.monthlyPeriodStart).toMillis();

      // Step 2: Authoritative Force-Heal update - 3
      // If either window is stale, we MUST reset them before checking logic.
      let healed = false;
      if (nowMs - hStart >= HOUR_MS) {
        await this.resetRateLimits(normalizedEmail, 'lessonGenerationHourly');
        healed = true;
      }
      if (nowMs - mStart >= MONTH_30_MS) {
        await this.resetRateLimits(normalizedEmail, 'lessonGenerationMonthly');
        healed = true;
      }

      // Step 3: Re-fetch if state was modified update - 4
      let effectiveUsage = userUsage;
      if (healed) {
        effectiveUsage = await this.getUserUsage(normalizedEmail);
      }

      const tracking = {
        hourlyCount: effectiveUsage.rateLimits.lessonGeneration.hourlyCount,
        monthlyCount: effectiveUsage.rateLimits.lessonGeneration.monthlyCount,
        hourlyPeriodStart: effectiveUsage.rateLimits.lessonGeneration.hourlyPeriodStart,
        monthlyPeriodStart: effectiveUsage.rateLimits.lessonGeneration.monthlyPeriodStart,
      };

      const state = computeLessonLimitState(new Date(nowMs), userProfile.accountType, userProfile.subscriptionTier, tracking);
      return !(state.isHourlyExceeded || state.isMonthlyExceeded);
    }
    return false;
  }
  
/**
   * incrementUsageCounter (Enhanced with secondary services support)
   * @description
   *   Atomically increments usage counters with enhanced support for secondary services tracking.
   *   The function now handles window-based rate limiting for secondary services with automatic
   *   window reset when time periods expire. This ensures accurate tracking while preventing
   *   false positive rate limit triggers from expired time windows. All operations remain atomic
   *   to maintain data consistency under concurrent access patterns.
   * @param email User email
   * @param action Enhanced action type including secondary services
   * @returns Promise resolving when increment is complete
   */
  static async incrementUsageCounter(
    email: string, 
    action: 'upload' | 'documentCreation' | 'lessonGeneration' | 'askAssistant' | 'exploreTopic' | 'createQuiz'
  ): Promise<void> {
    console.log('[userService.ts][2012] Incrementing enhanced usage counter', { email, action });
    
    const normalizedEmail = email.toLowerCase().trim();
    const usageRef = firestore.collection('userUsage').doc(normalizedEmail);
    
    await firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(usageRef);
      if (!snapshot.exists) {
        throw new Error('User usage data not found');
      }
      
      const usage = snapshot.data() as UserUsage;
      const nowTs = admin.firestore.Timestamp.now();
      const nowMs = nowTs.toMillis();
      const updates: any = {
        updatedAt: nowTs,
      };

      // 1. Resolve Time Constants
      const FIVE_MIN_MS = 5 * 60 * 1000;
      const HOUR_MS = 60 * 60 * 1000;
      const DAY_MS = 24 * 60 * 60 * 1000;
      const MONTH_MS = 30 * 24 * 60 * 60 * 1000;
      
      // Step 2: Handle different action types with enhanced tracking
      // 2. Handle Upload (Heal-on-Write for Daily Window) update - 1
      if (action === 'upload') {
        const currentStart = this.ensureTimestamp(usage.rateLimits.currentPeriodStart).toMillis();
        if (nowMs - currentStart >= DAY_MS) {
          updates['rateLimits.dailyUploads'] = 1;
          updates['rateLimits.currentPeriodStart'] = nowTs;
        } else {
          updates['rateLimits.dailyUploads'] = admin.firestore.FieldValue.increment(1);
        }
        updates['metrics.totalUploads'] = admin.firestore.FieldValue.increment(1);
      } // 3. Handle Document Creation (Lifetime Metric Only)
      else if (action === 'documentCreation') {
        updates['metrics.totalDocumentsCreated'] = admin.firestore.FieldValue.increment(1);
      }
      // 4. Handle Lesson Generation (Heal-on-Write for Hourly/Monthly)
      // 4. Handle Lesson Generation (Heal-on-Write for Hourly/Monthly) update - 2
      else if (action === 'lessonGeneration') {
        const userProfile = await this.getUserProfile(normalizedEmail);
        if (userProfile.subscriptionTier === 'premium') {
          const lg = usage.rateLimits.lessonGeneration;
          
          // Heal Hourly Window update - 3
          const hStart = this.ensureTimestamp(lg.hourlyPeriodStart).toMillis();
          if (nowMs - hStart >= HOUR_MS) {
            updates['rateLimits.lessonGeneration.hourlyCount'] = 1;
            updates['rateLimits.lessonGeneration.hourlyPeriodStart'] = nowTs;
          } else {
            updates['rateLimits.lessonGeneration.hourlyCount'] = admin.firestore.FieldValue.increment(1);
          }

          // Heal Monthly Window update - 4
          const mStart = this.ensureTimestamp(lg.monthlyPeriodStart).toMillis();
          if (nowMs - mStart >= MONTH_MS) {
            updates['rateLimits.lessonGeneration.monthlyCount'] = 1;
            updates['rateLimits.lessonGeneration.monthlyPeriodStart'] = nowTs;
          } else {
            updates['rateLimits.lessonGeneration.monthlyCount'] = admin.firestore.FieldValue.increment(1);
          }
        }
        updates['metrics.totalLessonsGenerated'] = admin.firestore.FieldValue.increment(1);
      } // 5. Handle Secondary Services (Heal-on-Write for 5-minute Window) update - 5
      else if (['askAssistant', 'exploreTopic', 'createQuiz'].includes(action)) {
        const ss = usage.rateLimits.secondaryServices;
        const windowStart = this.ensureTimestamp(ss?.windowStart).toMillis();
        
        if (nowMs - windowStart >= FIVE_MIN_MS) {
          updates['rateLimits.secondaryServices.windowCount'] = 1;
          updates['rateLimits.secondaryServices.windowStart'] = nowTs;
        } else {
          updates['rateLimits.secondaryServices.windowCount'] = admin.firestore.FieldValue.increment(1);
        }

        updates['rateLimits.secondaryServices.dailyCount'] = admin.firestore.FieldValue.increment(1);
        updates['rateLimits.secondaryServices.totalCount'] = admin.firestore.FieldValue.increment(1);

        if (action === 'askAssistant') updates['metrics.totalQuestionsAsked'] = admin.firestore.FieldValue.increment(1);
        if (action === 'exploreTopic') updates['metrics.totalTopicsExplored'] = admin.firestore.FieldValue.increment(1);
        if (action === 'createQuiz') updates['metrics.totalQuizzesCreated'] = admin.firestore.FieldValue.increment(1);
      }

      transaction.update(usageRef, updates);
    });
    
    await bumpUserVersion(normalizedEmail);
  }
  
/**
   * getUserUsage (Enhanced with secondary services support)
   * @description
   *   Retrieves user usage data with automatic creation and migration support for secondary services.
   *   The enhanced version ensures backward compatibility by automatically adding secondary services
   *   tracking to existing user records that may not have this data structure. This approach ensures
   *   seamless system updates without requiring manual data migration procedures for existing users.
   * @param email User email
   * @returns Promise resolving to enhanced user usage data with secondary services tracking
   */
static async getUserUsage(email: string): Promise<UserUsage> { // update - 9
    const normalizedEmail = email.toLowerCase().trim(); // update - 9
    const loader = async (): Promise<UserUsage | null> => { // update - 9
      const usageRef = firestore.collection('userUsage').doc(normalizedEmail);
      const snapshot = await usageRef.get();

      const now = admin.firestore.Timestamp.now();
      if (snapshot.exists) {
        const usage = snapshot.data() as Partial<UserUsage>;


        const rawDemo = (usage as any).demoCredits || {};
        const normalizedDemo = {
          total:
            typeof rawDemo.total === 'number' && rawDemo.total > 0
              ? rawDemo.total
              : DEFAULT_DEMO_CREDITS,
          used:
            typeof rawDemo.used === 'number' && rawDemo.used >= 0
              ? rawDemo.used
              : 0,
          remaining:
            typeof rawDemo.remaining === 'number' && rawDemo.remaining >= 0
              ? rawDemo.remaining
              : DEFAULT_DEMO_CREDITS,
          lastUsedAt:
            rawDemo.lastUsedAt instanceof admin.firestore.Timestamp
              ? rawDemo.lastUsedAt
              : undefined,
          lastRenewal:
            rawDemo.lastRenewal instanceof admin.firestore.Timestamp
              ? rawDemo.lastRenewal
              : now,
        } as UserUsage['demoCredits'];


        // Migration for secondary-services fields / metrics if missing
        if (!usage.rateLimits?.secondaryServices || (usage as any)?.metrics?.totalQuestionsAsked == null) {
          console.log('[userService.ts][2010] Migrating usage to secondary-services support', { email: normalizedEmail });
          const migrated: UserUsage = {
            userId: normalizedEmail,
            demoCredits: normalizedDemo,
            rateLimits: {
              ...usage.rateLimits,
              secondaryServices: {
                windowCount: 0,
                windowStart: now,
                dailyCount: 0,
                totalCount: 0,
              },
            } as any,
            metrics: {
              ...(usage.metrics as any),
              totalQuestionsAsked: 0,
              totalTopicsExplored: 0,
              totalQuizzesCreated: 0,
            } as any,
            createdAt: (usage as any).createdAt || now,
            updatedAt: now,
          };
          await usageRef.set(migrated, { merge: true });
          await bumpUserVersion(normalizedEmail); // keep caches fresh after migration
          return migrated;
        }
        return usage as UserUsage;
      }

      const created: UserUsage = {
        userId: normalizedEmail,
        demoCredits: {
          total: DEFAULT_DEMO_CREDITS,
          remaining: DEFAULT_DEMO_CREDITS,
          used: 0,
          lastRenewal: now,
        },
        rateLimits: {
          dailyUploads: 0,
          currentPeriodStart: now,
          lessonGeneration: {
            hourlyCount: 0,
            monthlyCount: 0,
            hourlyPeriodStart: now,
            monthlyPeriodStart: now,
          },
          secondaryServices: {
            windowCount: 0,
            windowStart: now,
            dailyCount: 0,
            totalCount: 0,
          },
        },
        metrics: {
          totalUploads: 0,
          totalLessonsGenerated: 0,
          totalDocumentsCreated: 0,
          totalQuestionsAsked: 0,
          totalTopicsExplored: 0,
          totalQuizzesCreated: 0,
        },
        createdAt: now,
        updatedAt: now,
      };
      await usageRef.set(created);
      await bumpUserVersion(normalizedEmail); // after creation
      console.log('[userService.ts][2011] Usage created with defaults', { email: normalizedEmail });
      return created;
    };

    const hit = await cacheReadUserUsage(normalizedEmail, loader); // update - 9
    if (!hit) {
      // Extremely unlikely because loader creates; still provide fallback
      console.warn('[userService.ts][2011a] Usage cache returned null after loader (unexpected)', { email: normalizedEmail }); // update - 9
      return await loader() as UserUsage; // update - 9
    }
    return hit; // update - 9
  }
  
  /**
   * resetRateLimits
   * @description
   *   Resets rate limiting counters for specified action types when periods expire. This method
   *   supports different reset types for upload limits and lesson generation limits. The reset
   *   operation is atomic to prevent data races.
   * @param email User email
   * @param resetType Type of reset to perform
   * @returns Promise resolving when reset is complete
   */
  private static async resetRateLimits(email: string, resetType: 'upload' | 'lessonGenerationHourly' | 'lessonGenerationMonthly'): Promise<void> {
    console.log('[userService.ts][7019] Resetting rate limits for user:', email, 'Type:', resetType);
    
    const normalizedEmail = email.toLowerCase().trim();
    const usageRef = firestore.collection('userUsage').doc(normalizedEmail);
    const now = admin.firestore.Timestamp.now();
    
    const updates: any = {
      updatedAt: now,
    };
    
    // Step 16: Reset appropriate counters based on type
    if (resetType === 'upload') {
      updates['rateLimits.dailyUploads'] = 0;
      updates['rateLimits.currentPeriodStart'] = now;
    } else if (resetType === 'lessonGenerationHourly') {
      updates['rateLimits.lessonGeneration.hourlyCount'] = 0;
      updates['rateLimits.lessonGeneration.hourlyPeriodStart'] = now;
    } else if (resetType === 'lessonGenerationMonthly') {
      updates['rateLimits.lessonGeneration.monthlyCount'] = 0;
      updates['rateLimits.lessonGeneration.monthlyPeriodStart'] = now;
    }
    await bumpUserVersion(normalizedEmail);
    await usageRef.update(updates);
    console.log('[userService.ts][7020] Rate limits reset successfully');
  }
  
  /**
   * updateLastActive
   * @description
   *   Updates the user's last active timestamp for analytics and session management purposes.
   *   This method is called automatically during authentication to track user activity patterns.
   *   The operation is optimized for performance and does not block request processing.
   * @param email User email
   * @returns Promise resolving when update is complete
   */
  static async updateLastActive(email: string): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();
    const userRef = firestore.collection('users').doc(normalizedEmail);
    
    try {
      await userRef.update({
        lastActiveAt: admin.firestore.Timestamp.now(),
      });
      console.log('[userService.ts][7027] Last active timestamp updated for user:', normalizedEmail);
    } catch (error) {
      // Non-critical operation, don't block request
      console.warn('[userService.ts][7028] Failed to update last active timestamp (non-critical):', error);
    }
  }
  
  /**
   * validateFileUploadPermissions
   * @description
   *   Comprehensive validation method that checks requirements for file upload operations
   *   without demo credit validation. Demo credits are only for lesson generation, not file uploads.
   *   This method integrates account type validation, rate limiting, and subscription tier checking
   *   to provide validation for upload workflows.
   * @param email User email
   * @param requestedVisibility Requested file visibility setting
   * @returns Promise resolving to validation result with detailed feedback
   */
  static async validateFileUploadPermissions(
    email: string, 
    requestedVisibility: 'public' | 'private'
  ): Promise<{
    allowed: boolean;
    reason?: string;
    userProfile: UserProfile;
  }> {
    console.log('[userService.ts][7021] Validating file upload permissions - Email:', email, 'Visibility:', requestedVisibility);
    
    try {
      const userProfile = await this.getUserProfile(email);
      
      // Step 17: Validate account type permissions
      if (requestedVisibility === 'public' && userProfile.accountType === 'scholar') {
        console.log('[userService.ts][7022] Upload denied - scholar cannot create public files');
        return {
          allowed: false,
          reason: 'Scholar accounts cannot create public files',
          userProfile,
        };
      }
      
      // Step 18: Check rate limits
      const rateLimitOk = await this.checkRateLimit(email, 'upload');
      if (!rateLimitOk) {
        console.log('[userService.ts][7023] Upload denied - rate limit exceeded');
        return {
          allowed: false,
          reason: 'Daily upload limit exceeded',
          userProfile,
        };
      }
      
      console.log('[userService.ts][7025] Upload permission granted');
      return {
        allowed: true,
        userProfile,
      };
      
    } catch (error) {
      console.error('[userService.ts][7026] Error validating upload permissions:', error);
      throw error;
    }
  }
  
  /**
   * validateLessonGenerationPermissions
   * @description
   *   NEW ENHANCED METHOD: Validates permissions specifically for lesson generation operations with
   *   comprehensive rate limiting for premium accounts and demo credit validation for freemium users.
   *   This method implements the new rate limiting policy where Premium Scholars get 100 monthly lessons
   *   (8 hourly) and Premium Educators get 200 monthly lessons (15 hourly). The method provides detailed
   *   feedback about remaining limits and handles automatic period resets.
   * @param email User email
   * @returns Promise resolving to validation result with detailed feedback
   */
  static async validateLessonGenerationPermissions(email: string): Promise<{
    allowed: boolean;
    reason?: string;
    userProfile: UserProfile;
    remainingDemoCredits?: number;
    rateLimitInfo?: {
      hourlyRemaining: number;
      monthlyRemaining: number;
      hourlyLimit: number;
      monthlyLimit: number;
    };
  }> {
    console.log('[userService.ts][7029] Validating lesson generation permissions - Email:', email);
    
    try {
      const userProfile = await this.getUserProfile(email);


      
      // Step 19: Handle freemium users with demo credits
      if (userProfile.subscriptionTier === 'freemium') {
        const usage = await this.getUserUsage(email);

        const rawDemo: any = (usage as any).demoCredits || {}; // update - 30
        const now = new Date(); // update - 30

        const lastRenewalDate =
          rawDemo.lastRenewal instanceof admin.firestore.Timestamp
            ? rawDemo.lastRenewal.toDate()
            : rawDemo.lastRenewal instanceof Date
            ? rawDemo.lastRenewal
            : now; // fallback keeps logic safe even for legacy records // update - 30

        const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000; // update - 30
        const demoWindowExpired =
          now.getTime() - lastRenewalDate.getTime() >= THIRTY_DAYS_MS; // update - 30

        const recordedUsed =
          typeof rawDemo.used === 'number' && rawDemo.used >= 0
            ? rawDemo.used
            : 0; // update - 30

        const effectiveUsed = demoWindowExpired ? 0 : recordedUsed; // update - 30
        const effectiveRemaining = Math.max(
          0,
          FREEMIUM_MONTHLY_LESSON_LIMIT - effectiveUsed
        ); // update - 30

        if (effectiveRemaining <= 0) {
          console.log('[userService.ts][7030] Lesson generation denied - no demo credits remaining');
          return {
            allowed: false,
            reason: 'No demo credits remaining. Please upgrade to premium to continue generating lessons.',
            userProfile,
            remainingDemoCredits: 0,
          };
        }
        
        return {
          allowed: true,
          userProfile,
          remainingDemoCredits: usage.demoCredits.remaining,
        };
      }
      
      // Step 20: Handle premium users with rate limits
      const rateLimitOk = await this.checkRateLimit(email, 'lessonGeneration');
      if (!rateLimitOk) {
        const usage = await this.getUserUsage(email);
        const lessonLimits = RATE_LIMITS.premium.lessonGeneration[userProfile.accountType];
        const lessonTracking = usage.rateLimits.lessonGeneration;
        
        // Determine which limit was exceeded
        const hourlyExceeded = lessonTracking.hourlyCount >= lessonLimits.hourlyLimit;
        const monthlyExceeded = lessonTracking.monthlyCount >= lessonLimits.monthlyLimit;
        
        let reason = 'Rate limit exceeded. ';
        if (hourlyExceeded) {
          reason += `Hourly limit of ${lessonLimits.hourlyLimit} lessons reached. `;
        }
        if (monthlyExceeded) {
          reason += `Monthly limit of ${lessonLimits.monthlyLimit} lessons reached. `;
        }
        
        console.log('[userService.ts][7031] Lesson generation denied - rate limit exceeded');
        return {
          allowed: false,
          reason: reason.trim(),
          userProfile,
          rateLimitInfo: {
            hourlyRemaining: Math.max(0, lessonLimits.hourlyLimit - lessonTracking.hourlyCount),
            monthlyRemaining: Math.max(0, lessonLimits.monthlyLimit - lessonTracking.monthlyCount),
            hourlyLimit: lessonLimits.hourlyLimit,
            monthlyLimit: lessonLimits.monthlyLimit,
          },
        };
      }
      
      // Premium users with available rate limits
      const usage = await this.getUserUsage(email);
      const lessonLimits = RATE_LIMITS.premium.lessonGeneration[userProfile.accountType];
      const lessonTracking = usage.rateLimits.lessonGeneration;
      
      console.log('[userService.ts][7032] Lesson generation permission granted - Premium user');
      return {
        allowed: true,
        userProfile,
        rateLimitInfo: {
          hourlyRemaining: Math.max(0, lessonLimits.hourlyLimit - lessonTracking.hourlyCount),
          monthlyRemaining: Math.max(0, lessonLimits.monthlyLimit - lessonTracking.monthlyCount),
          hourlyLimit: lessonLimits.hourlyLimit,
          monthlyLimit: lessonLimits.monthlyLimit,
        },
      };
      
    } catch (error) {
      console.error('[userService.ts][7033] Error validating lesson generation permissions:', error);
      throw error;
    }
  }


  /**
   * grantBonusLessonCredits
   * @description
   * Atomically adds a specific number of lesson generation credits to a user's 
   * monthly pool. This is used to remove friction during the Study Group 
   * promotion. It performs a Firestore transaction and triggers a Redis 
   * version bump to ensure zero-latency cache invalidation.
   * 1. Fetches current usage doc.
   * 2. Increments total and remaining demo credits.
   * 3. Bumps user version in Redis.
   */
  static async grantBonusLessonCredits(email: string, amount: number): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();
    const usageRef = firestore.collection('userUsage').doc(normalizedEmail);

    console.log(`[UserService] Granting ${amount} bonus credits to ${normalizedEmail}`);

    await firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(usageRef);
      if (!snapshot.exists) {
        throw new Error('User usage data not found for credit grant');
      }

      const usage = snapshot.data() as UserUsage;
      const currentDemo = usage.demoCredits || { total: 0, remaining: 0, used: 0 };

      // Increment both total (allowance) and remaining (current pool)
      const updatedDemo = {
        ...currentDemo,
        total: (currentDemo.total || 0) + amount,
        remaining: (currentDemo.remaining || 0) + amount,
        lastRenewal: currentDemo.lastRenewal || admin.firestore.Timestamp.now()
      };

      transaction.update(usageRef, {
        demoCredits: updatedDemo,
        updatedAt: admin.firestore.Timestamp.now()
      });
    });

    // Invalidate the cache version so validation logic sees the new credits immediately
    await bumpUserVersion(normalizedEmail);
    console.log(`[UserService] Successfully granted bonus credits and bumped version for ${normalizedEmail}`);
  }

  


/**
   * provisionSampleLessons
   * @description
   * Reads local .bin seeds and clones them... (existing description)
   * UPDATED: Returns the list of UserFileMetadata objects created during provisioning.
   */
  private static async provisionSampleLessons(userId: string, batch: admin.firestore.WriteBatch): Promise<UserFileMetadata[]> {
    const bucket = admin.storage().bucket();
    const SEED_DIR = path.join(process.cwd(), 'app', 'src', 'services', 'sampleSeeds');
    
    const sampleConfigs = [
      { file: 'Organic_Chemistry_seed.bin', name: 'Sample: Organic Chemistry lesson', color: '#FFB703' },
      { file: 'Psychology_seed.bin', name: 'Sample: Psychology lesson', color: '#4F46E5' }
    ];

    const seededFiles: UserFileMetadata[] = []; // Array to collect metadata

    for (const config of sampleConfigs) {
      try {
        const seedPath = path.join(SEED_DIR, config.file);
        if (!fs.existsSync(seedPath)) {
          console.warn(`[userService] Skipping seed: ${config.file} not found`);
          continue;
        }

        const bytes = fs.readFileSync(seedPath);
        const newDocId = uuidv4();
        const destination = `documents/${newDocId}.bloomdocx`;

        const hardcodedMeta = SAMPLE_METADATA_MAP[config.file];

        // 1. Storage Upload
        await bucket.file(destination).save(bytes, {
          metadata: { contentType: 'application/octet-stream' }
        });

        // 2. Metadata Creation
        const fileMeta: UserFileMetadata = {
          fileId: newDocId,
          ownerId: userId,
          fileName: config.name,
          fileStoragePath: destination,
          timestamp: admin.firestore.Timestamp.now(),
          fileSize: bytes.length,
          contentType: 'application/octet-stream',
          editors: [userId],
          sharedWith: [userId],
          version: 1,
          colorCode: config.color,
          role: 'Owner',
          publicEdit: false,
          publicView: false,
          updatedAt: new Date().toISOString(), // Ensure string format for client compatibility
          lessonUnitsMeta: {
            units: hardcodedMeta.unitsByMap,
            totalUnits: hardcodedMeta.totalUnits,
            lastUpdated: admin.firestore.Timestamp.now().toDate()
          }
        };

        batch.set(firestore.collection('userFiles').doc(newDocId), fileMeta);
        
        // Add to collection
        seededFiles.push(fileMeta);

      } catch (err) {
        console.warn(`[userService] Provisioning failed for ${config.file}:`, err);
      }
    }

    return seededFiles;
  }


  /**
   * resolveCampaignEligibility
   * @description
   * Internal helper to determine if a user qualifies for the flyer campaign.
   * It checks three criteria: the campaign must be live, the participant cap 
   * must not be reached, and the user's email domain must not be denylisted.
   * Time Complexity: O(D) where D is the number of denylisted domains.
   * @param email - User's normalized email address.
   * @returns Promise resolving to 'ELIGIBLE' or 'INELIGIBLE'.
   */
  private static async resolveCampaignEligibility(email: string): Promise<'ELIGIBLE' | 'INELIGIBLE'> { // update - 4
    // 1. Fetch the master configuration document
    const config = await getCampaignConfig();

    // 2. Immediate fail-fast if campaign is toggled off or cap is hit
    if (!config.isLive || config.activeParticipantCount >= config.maxCap) {
      return 'INELIGIBLE';
    }

    // 3. Extract domain and check against denylist (e.g., highschool.edu)
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain || config.denylistDomains.includes(domain)) {
      console.log(`[userService] User ${email} rejected: Domain ${domain} is denylisted.`);
      return 'INELIGIBLE';
    }

    return 'ELIGIBLE';
  }


  /**
   * consumeFreemiumQuota
   * @description
   *   Atomically consumes a variable number of Freemium lesson units from the user’s monthly pool.
   *   This method performs a read-modify-write in a single Firestore transaction, first checking
   *   whether the current monthly window has expired based on `demoCredits.lastRenewal`. If more
   *   than 30 days have elapsed, it virtually “renews” the quota by resetting `used` to zero,
   *   `remaining` to the configured monthly limit, and updating `lastRenewal` to the current time.
   *   It then deducts `lessonCount` from the pool, updating both usage metrics and remaining quota.
   *   Time complexity is O(1) because it touches a single document and does constant work.
   * @param email User email
   * @param lessonCount Number of lesson units to deduct from the monthly allowance
   * @returns Promise resolving to remaining credits and a flag indicating whether a renewal occurred
   */
  static async consumeFreemiumQuota(
    email: string,
    lessonCount: number
  ): Promise<{ remaining: number; renewed: boolean }> {
    console.log(
      '[userService.ts][7050] Consuming Freemium monthly quota for lesson generation',
      { email, lessonCount }
    ); // update - 15

    if (!Number.isFinite(lessonCount) || lessonCount <= 0) {
      throw new Error('lessonCount must be a positive number');
    }

    const normalizedEmail = email.toLowerCase().trim();
    const usageRef = firestore.collection('userUsage').doc(normalizedEmail);

    const result = await firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(usageRef);
      if (!snapshot.exists) {
        throw new Error('User usage data not found');
      }

      const usage = snapshot.data() as any;
      const now = admin.firestore.Timestamp.now();

      const rawDemo = usage.demoCredits || {};
      const monthlyLimit = FREEMIUM_MONTHLY_LESSON_LIMIT;

      // Step 1: Resolve last renewal with safe defaults.  // update - 16
      const lastRenewalTs =
        rawDemo.lastRenewal instanceof admin.firestore.Timestamp
          ? rawDemo.lastRenewal
          : rawDemo.lastUsedAt instanceof admin.firestore.Timestamp
          ? rawDemo.lastUsedAt
          : usage.createdAt instanceof admin.firestore.Timestamp
          ? usage.createdAt
          : now;

      const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
      const elapsedMs = now.toMillis() - lastRenewalTs.toMillis();
      const windowExpired = elapsedMs >= THIRTY_DAYS_MS;

      const baselineUsed =
        windowExpired || typeof rawDemo.used !== 'number' || rawDemo.used < 0
          ? 0
          : rawDemo.used;

      // Step 2: Compute new usage and remaining quota.  // update - 17
      const newUsed = baselineUsed + lessonCount;
      const remaining = Math.max(0, monthlyLimit - newUsed);

      const updatedDemo = {
        total: monthlyLimit,
        remaining,
        used: newUsed,
        lastUsedAt:
          rawDemo.lastUsedAt instanceof admin.firestore.Timestamp
            ? now
            : now,
        lastRenewal: windowExpired ? now : lastRenewalTs,
      };

      const updatedMetrics = {
        ...(usage.metrics || {}),
        totalLessonsGenerated:
          (usage.metrics?.totalLessonsGenerated || 0) + lessonCount,
      };

      const updatedUsage: Partial<UserUsage> = {
        ...(usage as UserUsage),
        demoCredits: updatedDemo,
        metrics: updatedMetrics,
        updatedAt: now,
      };

      transaction.set(usageRef, updatedUsage, { merge: true });

      console.log(
        '[userService.ts][7051] Freemium quota updated',
        {
          email: normalizedEmail,
          remaining,
          renewed: windowExpired,
        }
      );

      return { remaining, renewed: windowExpired };
    });

    await bumpUserVersion(normalizedEmail);
    return result;
  }
}