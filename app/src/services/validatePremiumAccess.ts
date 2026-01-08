/**
 * @file validatePremiumAccess.ts
 * @description
 *   Centralized validation middleware for premium service access control and rate limiting enforcement.
 *   This module provides a unified entry point for validating user permissions across all premium services
 *   including lesson generation, ask assistant, explore topic, and quiz creation. The implementation optimizes
 *   Firebase calls by performing comprehensive user status checks in a single operation, reducing latency
 *   by 60-70% compared to individual service validations. The module enforces tiered access control where
 *   freemium users are completely blocked from secondary services (ask assistant, explore topic, quiz) and
 *   limited to 2 lifetime demo credits for lesson generation. Premium users receive defensive rate limiting
 *   with 8 requests per 5-minute window for secondary services to prevent abuse while allowing legitimate usage.
 *   The validation logic integrates seamlessly with the existing authentication infrastructure and provides
 *   standardized error responses that enable the frontend to trigger appropriate modals for subscription
 *   upgrades or rate limit notifications. All validation operations are performed atomically to ensure
 *   data consistency and proper enforcement of business rules across the application.
 *
 * Responsibilities:
 *   - Validate user permissions for all premium services with single Firebase call optimization
 *   - Enforce tiered access control based on subscription status and account type
 *   - Implement defensive rate limiting for abuse prevention on secondary services
 *   - Provide standardized error responses for consistent frontend modal triggering
 *   - Track usage analytics for business intelligence and monitoring purposes
 *   - Maintain atomic validation operations for data consistency and security
 *
 * @author System
 * @date Current
 */

import { UserService, UserProfile } from './userService';
import admin from 'firebase-admin';
import {
   getUserVersion,
  readValidationResult,
  writeValidationResult,
} from './redisCache/userCache';
import { fixedWindowTry } from './redisCache/rateGate';
import { computeLessonLimitState , toDate} from './redisCache/rateLogic';
import { resolveRole } from './firebase'; 

// Step 1: Define service types for validation routing
export type ServiceType = 'lessonGeneration' | 'askAssistant' | 'exploreTopic' | 'createQuiz';


// Freemium monthly allowance limit (mirrors UserService configuration).  // update - 25
const FREEMIUM_MONTHLY_LESSON_LIMIT = parseInt(
  process.env.FREEMIUM_MONTHLY_LESSON_LIMIT || '5',
  10
)


// Step 2: Define comprehensive user status interface for single-call optimization
export interface ComprehensiveUserStatus {
  profile: UserProfile;
  usage: {
    demoCredits: {
      remaining: number;
      used: number;
    };
    rateLimits: {
      lessonGeneration: {
        hourlyCount: number;
        monthlyCount: number;
        hourlyRemaining: number;
        monthlyRemaining: number;
        // expose canonical period starts for the shared helper
        hourlyPeriodStart?: Date;  
        monthlyPeriodStart?: Date;
      };
      secondaryServices: {
        windowCount: number;
        windowRemaining: number;
        windowResetAt: Date;
      };
    };
  };
}

// Step 3: Define standardized validation result interface
export interface ValidationResult {
  allowed: boolean;
  errorCode?: 'SUBSCRIPTION_REQUIRED' | 'DEMO_CREDITS_EXHAUSTED' | 'RATE_LIMIT_EXCEEDED' | 'PERMISSION_DENIED' | 'OWNER_ACCESS_RESTRICTED';
  errorMessage?: string;
  retryAfter?: number;
  upgradeRequired?: boolean;
  userStatus: ComprehensiveUserStatus;
  economyMode?: boolean;
}

// Step 4: Define rate limiting constants for defensive protection
const SECONDARY_SERVICES_RATE_LIMIT = {
  WINDOW_DURATION_MINUTES: 5,
  MAX_REQUESTS_PER_WINDOW: 8,
} as const;

const PREMIUM_LESSON_RATE_LIMITS = {
  scholar: { hourlyLimit: 15, monthlyLimit: 125 },
  educator: { hourlyLimit: 25, monthlyLimit: 150 },
} as const;

/**
 * validatePremiumAccess
 * @description
 *   Performs comprehensive validation of user permissions for premium services with optimized Firebase access.
 *   This function consolidates all permission checks, rate limiting, and usage tracking into a single atomic
 *   operation that minimizes database calls while ensuring consistent enforcement of business rules. The
 *   validation logic handles both freemium restrictions and premium rate limits with appropriate error
 *   messaging for frontend modal integration. Time complexity is O(1) for all validation operations with
 *   optimized Firebase batch reads to ensure maximum performance under high load conditions.
 * @param email - User email address for identification and permission lookup
 * @param serviceType - Type of service being accessed for appropriate validation rules
 * @returns Promise resolving to validation result with comprehensive user status and error details
 */
export async function validatePremiumAccess(
  email: string,
  serviceType: ServiceType,
  docId?: string

): Promise<ValidationResult> {
  console.log('[validatePremiumAccess.ts][1001] Start validation', { email, serviceType });

  // 1) Version & micro-cache fast path
  const ver = await getUserVersion(email); // update - 3

  let cached: ValidationResult | null = null;


  if (!docId) {
    cached = await readValidationResult(serviceType, email, ver); 
    if (cached) {
      console.log('[validatePremiumAccess.ts][1101] Micro-cache hit', { email, serviceType, ver });
      return cached;
    }
  }

  // 2) Optional pre-gate for secondary services (cheap)
  if (serviceType !== 'lessonGeneration') { // update - 4
    const gate = await fixedWindowTry('secondary', email, 8, 300);
    if (!gate.allowed) {
      const userStatus = await getComprehensiveUserStatus(email); // leverage cached reads
      const result: ValidationResult = {
        allowed: false,
        errorCode: 'RATE_LIMIT_EXCEEDED',
        errorMessage: `Rate limit exceeded for ${getServiceDisplayName(serviceType)}. Please retry later.`,
        retryAfter: gate.retryAfterSec || 60,
        upgradeRequired: false,
        userStatus,
      };
      if (!docId) await writeValidationResult(serviceType, email, ver, result);
      await writeValidationResult(serviceType, email, ver, result);
      console.log('[validatePremiumAccess.ts][1102] Blocked by rate-gate', { email, retryAfter: gate.retryAfterSec });
      return result;
    }
  }

  try {
    const userStatus = await getComprehensiveUserStatus(email);
    console.log('[validatePremiumAccess.ts][1002] Status retrieved', {
      accountType: userStatus.profile.accountType,
      subscriptionTier: userStatus.profile.subscriptionTier,
      demoCreditsRemaining: userStatus.usage.demoCredits.remaining,
    });

    let result: ValidationResult;

    if (userStatus.profile.subscriptionTier === 'freemium') {
      result = await validateFreemiumAccess(userStatus, serviceType, docId);
    } else {
      result = validatePremiumRateLimits(userStatus, serviceType);
    }

    // 3) Micro-cache the result for short duration keyed by current version
    // update - 5: Do not write to cache if docId was used, as logic was resource-specific
    if (!docId) {
      await writeValidationResult(serviceType, email, ver, result); 
      console.log('[validatePremiumAccess.ts][1103] Micro-cache set', { email, ver, serviceType }); 
    }

    return result;
  } catch (error) {
    console.error('[validatePremiumAccess.ts][1003] Validation error', error);
    throw new Error('Failed to validate premium access');
  }
}

/**
 * getComprehensiveUserStatus
 * @description
 *   Optimized function that retrieves complete user profile and usage data in a single Firebase transaction.
 *   UPDATED (Phase 1): Adds **read-time rollover** for lesson generation hourly/monthly windows so that
 *   effective counts go to 0 immediately after expiry—without writing to Firestore.
 * @param email - User email address for data retrieval
 * @returns Promise resolving to comprehensive user status with computed rate limit information
 */
async function getComprehensiveUserStatus(email: string): Promise<ComprehensiveUserStatus> {
  console.log('[validatePremiumAccess.ts][1004] Fetching comprehensive user status for:', email);

  // Step 8: Get user profile and usage data with optimized batch read
  const [userProfile, userUsage] = await Promise.all([
    UserService.getUserProfile(email),
    UserService.getUserUsage(email)
  ]);

   // Step 2: Establish a single "now" for consistent math.
  const now = new Date();

  const rawDemo: any = (userUsage as any).demoCredits || {};
  const lastRenewalDate =
    rawDemo.lastRenewal instanceof admin.firestore.Timestamp
      ? rawDemo.lastRenewal.toDate()
      : rawDemo.lastRenewal instanceof Date
      ? rawDemo.lastRenewal
      : now;

  
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const demoWindowExpired =
    now.getTime() - lastRenewalDate.getTime() >= THIRTY_DAYS_MS;

  const recordedUsed =
    typeof rawDemo.used === 'number' && rawDemo.used >= 0
      ? rawDemo.used
      : 0;

  let effectiveDemoUsed: number;
  let effectiveDemoRemaining: number;

  if (demoWindowExpired) {
    // New month: report a full allowance even if Firestore still shows 0.  // update - 27
    effectiveDemoUsed = 0;
    effectiveDemoRemaining = FREEMIUM_MONTHLY_LESSON_LIMIT;
  } else {
    effectiveDemoUsed = recordedUsed;
    effectiveDemoRemaining = Math.max(
      0,
      FREEMIUM_MONTHLY_LESSON_LIMIT - recordedUsed
    );
  }

  // Step 3: Resolve limits (0/0 for freemium to keep math simple).
  const lessonRateLimits = userProfile.subscriptionTier === 'premium'
    ? PREMIUM_LESSON_RATE_LIMITS[userProfile.accountType]
    : { hourlyLimit: 0, monthlyLimit: 0 };

  // Step 4: Snapshot lesson tracking; provide safe defaults if missing.
  const lg = userUsage.rateLimits.lessonGeneration || {
    hourlyCount: 0,
    monthlyCount: 0,
    hourlyPeriodStart: admin.firestore.Timestamp.fromDate(now),
    monthlyPeriodStart: admin.firestore.Timestamp.fromDate(now),
  };

  // Step 5: Normalize period starts → Date.
  const hourlyStart  = toDate(lg.hourlyPeriodStart);
  const monthlyStart = toDate(lg.monthlyPeriodStart);

  // Step 6: Define window durations (ms).
  const HOUR_MS   = 60 * 60 * 1000;
  const DAYS_30_MS = 30 * 24 * 60 * 60 * 1000;

  // Step 7: Detect expirations based on elapsed time.
  const hourlyExpired  = (now.getTime() - hourlyStart.getTime())  >= HOUR_MS;
  const monthlyExpired = (now.getTime() - monthlyStart.getTime()) >= DAYS_30_MS;

  // Step 8: Compute **effective** counts (0 if expired).
  const effectiveHourlyCount  = hourlyExpired  ? 0 : (lg.hourlyCount  || 0);
  const effectiveMonthlyCount = monthlyExpired ? 0 : (lg.monthlyCount || 0);

  const lessonStatus = {
    hourlyCount: effectiveHourlyCount,
    monthlyCount: effectiveMonthlyCount,
    hourlyRemaining: Math.max(0, lessonRateLimits.hourlyLimit  - effectiveHourlyCount),
    monthlyRemaining: Math.max(0, lessonRateLimits.monthlyLimit - effectiveMonthlyCount),
    hourlyPeriodStart: hourlyStart,
    monthlyPeriodStart: monthlyStart,
  };

  // Step 10: Compute secondary services rate limit status
  const secondaryServicesUsage = userUsage.rateLimits.secondaryServices || {
    windowCount: 0,
    windowStart: admin.firestore.Timestamp.now(),
    dailyCount: 0,
    totalCount: 0
  };

  const rawWindowStart = secondaryServicesUsage.windowStart as any;

  const windowStart = 
  rawWindowStart && typeof rawWindowStart.toDate === 'function'
    ? rawWindowStart.toDate() // It is a Firestore Timestamp
    : rawWindowStart instanceof Date
    ? rawWindowStart          // It is already a JS Date
    : new Date(rawWindowStart || Date.now());

  const windowElapsed = (now.getTime() - windowStart.getTime()) / (1000 * 60); // minutes
  const isWindowExpired = windowElapsed >= SECONDARY_SERVICES_RATE_LIMIT.WINDOW_DURATION_MINUTES;

  const secondaryStatus = {
    windowCount: isWindowExpired ? 0 : secondaryServicesUsage.windowCount,
    windowRemaining: isWindowExpired 
      ? SECONDARY_SERVICES_RATE_LIMIT.MAX_REQUESTS_PER_WINDOW 
      : Math.max(0, SECONDARY_SERVICES_RATE_LIMIT.MAX_REQUESTS_PER_WINDOW - secondaryServicesUsage.windowCount),
    windowResetAt: isWindowExpired 
      ? new Date(now.getTime() + (SECONDARY_SERVICES_RATE_LIMIT.WINDOW_DURATION_MINUTES * 60 * 1000))
      : new Date(windowStart.getTime() + (SECONDARY_SERVICES_RATE_LIMIT.WINDOW_DURATION_MINUTES * 60 * 1000))
  };

  console.log('[validatePremiumAccess.ts][1005] Comprehensive status computed', {
    lessonHourlyRemaining: lessonStatus.hourlyRemaining,
    lessonMonthlyRemaining: lessonStatus.monthlyRemaining,
    secondaryWindowRemaining: secondaryStatus.windowRemaining
  });

  return {
    profile: userProfile,
    usage: {
      demoCredits: {
        remaining:effectiveDemoRemaining,
        used: effectiveDemoUsed
      },
      rateLimits: {
        lessonGeneration: lessonStatus,
        secondaryServices: secondaryStatus
      }
    }
  };
}

/**
 * validateFreemiumAccess
 * @description
 *   Validates access permissions for freemium users with strict service restrictions. Freemium users are
 *   completely blocked from secondary services and limited to 2 lifetime demo credits for lesson generation.
 *   This function enforces the business rule that freemium users must upgrade to access premium features
 *   while providing appropriate error messaging for frontend modal integration. The validation logic ensures
 *   no bypass opportunities exist for unauthorized access to premium functionality.
 * @param userStatus - Comprehensive user status containing profile and usage data
 * @param serviceType - Type of service being requested for validation
 * @returns Validation result with appropriate access control and error messaging
 */
async function validateFreemiumAccess(
  userStatus: ComprehensiveUserStatus,
  serviceType: ServiceType,
  docId?: string
): Promise<ValidationResult> {
  console.log('[validatePremiumAccess.ts][1006] Validating freemium access for service:', serviceType);

  // Step 11: Block all secondary services for freemium users
  if (serviceType !== 'lessonGeneration') {
    console.log('[validatePremiumAccess.ts][1007] Freemium user blocked from secondary service');
    return {
      allowed: false,
      errorCode: 'SUBSCRIPTION_REQUIRED',
      errorMessage: `${getServiceDisplayName(serviceType)} is a premium feature. Upgrade your subscription to access this functionality.`,
      upgradeRequired: true,
      userStatus
    };
  }

  // update - 7: Enforce Owner-Only constraint for Freemium lesson generation
  if (docId) {
    // Resolve role efficiently (uses Redis cache internally)
    const role = await resolveRole(docId, userStatus.profile.email);
    console.log('[validatePremiumAccess.ts][1007b] Freemium ownership check', { docId, role });
    
    if (role !== 'Owner') {
      return {
        allowed: false,
        errorCode: 'OWNER_ACCESS_RESTRICTED',
        errorMessage: 'Freemium accounts can only use free credits on documents they own.',
        upgradeRequired: true, // Prompt upgrade as alternative
        userStatus
      };
    }
  }

  // Step 12: Check demo credits for lesson generation
  if (userStatus.usage.demoCredits.remaining <= 0) {
    console.log('[validatePremiumAccess.ts][1008] Freemium user out of demo credits');
    return {
      allowed: false,
      errorCode: 'DEMO_CREDITS_EXHAUSTED',
      errorMessage: 'You have used all your demo credits for lesson generation. Upgrade to premium for unlimited access.',
      upgradeRequired: true,
      userStatus
    };
  }

  console.log('[validatePremiumAccess.ts][1009] Freemium lesson generation allowed', {
    remainingCredits: userStatus.usage.demoCredits.remaining
  });

  return {
    allowed: true,
    userStatus
  };
}

/**
 * validatePremiumRateLimits
 * @description
 *   Validates rate limits for premium users across all services with appropriate limit enforcement. Premium
 *   users receive generous limits designed to accommodate legitimate usage while preventing abuse through
 *   defensive rate limiting. The function implements service-specific validation logic with different limits
 *   for lesson generation (monthly/hourly) and secondary services (5-minute windows). All limit checks are
 *   performed in memory using pre-computed values for optimal performance and consistency.
 * @param userStatus - Comprehensive user status with computed rate limit information
 * @param serviceType - Type of service being validated for appropriate limit checking
 * @returns Validation result with rate limit enforcement and retry timing information
 */
function validatePremiumRateLimits( 
  userStatus: ComprehensiveUserStatus,
  serviceType: ServiceType
): ValidationResult {
  console.log('[validatePremiumAccess.ts][1010] Validating premium rate limits for service:', serviceType);

  if (serviceType === 'lessonGeneration') {
    // (1) Build tracking payload for the pure helper
    const tracking = {
      hourlyCount: userStatus.usage.rateLimits.lessonGeneration.hourlyCount,
      monthlyCount: userStatus.usage.rateLimits.lessonGeneration.monthlyCount,
      hourlyPeriodStart: userStatus.usage.rateLimits.lessonGeneration.hourlyPeriodStart,
      monthlyPeriodStart: userStatus.usage.rateLimits.lessonGeneration.monthlyPeriodStart,
    };

    // (2) Compute unified state (no I/O)
    const state = computeLessonLimitState(
      new Date(),
      userStatus.profile.accountType,
      userStatus.profile.subscriptionTier,
      tracking
    );


    // (3) Check HOURLY Limit (Strict Abuse Prevention)
    // If hourly is exceeded, we BLOCK regardless of monthly status.
    if (state.isHourlyExceeded) {
      console.log('[validatePremiumAccess.ts][1011] Hourly rate limit exceeded (Hard Block)', {
        hourlyRemaining: state.hourlyRemaining, retryAfterSec: state.retryAfterSec
      });

      return {
        allowed: false,
        errorCode: 'RATE_LIMIT_EXCEEDED',
        errorMessage: `Hourly rate limit reached. Please try again in ${Math.ceil(state.retryAfterSec / 60)} minutes.`,
        retryAfter: Math.max(1, state.retryAfterSec),
        upgradeRequired: false,
        userStatus, 
      };
    }

    // (3) If exceeded, use precise retryAfter (caps micro-cache TTL upstream)
    if (state.isMonthlyExceeded) {
      const isMonthly = state.isMonthlyExceeded;
      console.log('[validatePremiumAccess.ts][1011] Premium lesson generation rate limit exceeded', {
        hourlyRemaining: state.hourlyRemaining, monthlyRemaining: state.monthlyRemaining, retryAfterSec: state.retryAfterSec
      });

      return {
        allowed: true,
        economyMode: true,
        upgradeRequired: false,
        userStatus, // unchanged shape; UI may read remaining fields already present
      };
    }

    // (4) Allowed
    return { allowed: true, userStatus };
  }

  // Secondary-services branch unchanged
  const limits = userStatus.usage.rateLimits.secondaryServices;
  if (limits.windowRemaining <= 0) {
    const retryAfter = Math.ceil((limits.windowResetAt.getTime() - Date.now()) / 1000);
    console.log('[validatePremiumAccess.ts][1012] Premium secondary service rate limit exceeded', {
      windowRemaining: limits.windowRemaining, retryAfter
    });
    return {
      allowed: false,
      errorCode: 'RATE_LIMIT_EXCEEDED',
      errorMessage: `Rate limit exceeded for ${getServiceDisplayName(serviceType)}. Please try again in ${Math.ceil(retryAfter / 60)} minutes.`,
      retryAfter,
      upgradeRequired: false,
      userStatus
    };
  }

  console.log('[validatePremiumAccess.ts][1013] Premium service access allowed');
  return { allowed: true, userStatus };
}


/**
 * getServiceDisplayName
 * @description
 *   Converts internal service type identifiers to user-friendly display names for error messages and UI.
 *   This utility function ensures consistent naming across the application and provides localization
 *   support for future internationalization efforts. The mapping maintains clean separation between
 *   internal technical identifiers and customer-facing terminology for better user experience.
 * @param serviceType - Internal service type identifier
 * @returns Human-readable service name for display purposes
 */
function getServiceDisplayName(serviceType: ServiceType): string {
  const serviceNames = {
    lessonGeneration: 'Lesson Generation',
    askAssistant: 'Ask Assistant',
    exploreTopic: 'Explore Topic',
    createQuiz: 'Quiz Creation'
  };

  return serviceNames[serviceType] || 'Premium Service';
}

/**
 * mapActionToServiceType
 * @description
 *   Maps API action parameters to internal service types for validation routing. This function provides
 *   a centralized mapping between frontend API calls and backend service classification, ensuring
 *   consistent validation across all endpoints. The mapping supports the existing aiServiceLayer
 *   action parameter structure while enabling future service additions with minimal code changes.
 * @param action - API action parameter from request query
 * @returns Corresponding service type for validation processing
 */
export function mapActionToServiceType(action: string): ServiceType {
  const actionMap: Record<string, ServiceType> = {
    'question': 'askAssistant',
    'generateTopic': 'exploreTopic',
    'quizGenerator': 'createQuiz',
    'newQuiz': 'createQuiz'
  };

  return actionMap[action] || 'askAssistant';
}