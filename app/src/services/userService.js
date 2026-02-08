"use strict";
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
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
var firebase_admin_1 = require("firebase-admin");
var firebase_1 = require("./firebase");
var userCache_1 = require("./redisCache/userCache");
var rateLogic_1 = require("./redisCache/rateLogic");
var fs = require("fs");
var path = require("path");
var uuid_1 = require("uuid");
var FlyerCampaignFB_1 = require("./FlyerCampaigns/FlyerCampaignFB");
// Step 1: Standardize Window Constants update - 1
var HOUR_MS = 60 * 60 * 1000;
var DAY_MS = 24 * 60 * 60 * 1000;
var MONTH_30_MS = 30 * 24 * 60 * 60 * 1000;
var FREEMIUM_MONTHLY_LESSON_LIMIT = parseInt(process.env.FREEMIUM_MONTHLY_LESSON_LIMIT || '5', 10);
// Add this near line ~110
var DEFAULT_DEMO_CREDITS = FREEMIUM_MONTHLY_LESSON_LIMIT;
/** * Hardcoded metadata for sample lessons to ensure immediate
 * availability in the Calendar without server-side binary parsing.
 */
/** * Hardcoded metadata for sample lessons to ensure immediate
 * availability in the Calendar without client-side parsing.
 * Extracted accurately from yNodesMap and lessonModuleMap.
 */
var SAMPLE_METADATA_MAP = {
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
// Step 3: Configuration constants (enhanced)
var SUBSCRIPTION_LIMITS = {
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
};
var RATE_LIMITS = {
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
            windowLimit: 8, // 8 requests per 5-minute window
            windowDurationMinutes: 5,
        }
    }
};
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
var UserService = /** @class */ (function () {
    function UserService() {
    }
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
    UserService.createUserProfile = function (email_1) {
        return __awaiter(this, arguments, void 0, function (email, accountType, subscriptionTier) {
            var normalizedEmail, userId, now, limits, features, userProfile, userUsage, batch, userRef, usageRef, seededFiles;
            if (accountType === void 0) { accountType = 'scholar'; }
            if (subscriptionTier === void 0) { subscriptionTier = 'freemium'; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log('[userService.ts][2001] Creating enhanced user profile with secondary services support', { email: email, accountType: accountType, subscriptionTier: subscriptionTier });
                        normalizedEmail = email.toLowerCase().trim();
                        userId = normalizedEmail;
                        now = firebase_admin_1.default.firestore.Timestamp.now();
                        limits = SUBSCRIPTION_LIMITS[subscriptionTier];
                        features = {
                            canCreatePublicFiles: accountType === 'educator',
                            canInviteEditors: subscriptionTier === 'premium',
                            hasAdvancedFeatures: subscriptionTier === 'premium',
                        };
                        userProfile = {
                            userId: userId,
                            email: normalizedEmail,
                            accountType: accountType,
                            subscriptionTier: subscriptionTier,
                            createdAt: now,
                            updatedAt: now,
                            lastActiveAt: now,
                            limits: limits,
                            features: features,
                            samplesProvisioned: true,
                            isFirstSessionFlyerTracking: true,
                        };
                        userUsage = {
                            userId: userId,
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
                        batch = firebase_1.firestore.batch();
                        userRef = firebase_1.firestore.collection('users').doc(userId);
                        usageRef = firebase_1.firestore.collection('userUsage').doc(userId);
                        batch.set(userRef, userProfile);
                        batch.set(usageRef, userUsage);
                        return [4 /*yield*/, this.provisionSampleLessons(userId, batch)];
                    case 1:
                        seededFiles = _a.sent();
                        return [4 /*yield*/, batch.commit()];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, (0, userCache_1.bumpUserVersion)(normalizedEmail)];
                    case 3:
                        _a.sent();
                        console.log('[userService.ts][2002] Enhanced user profile created with secondary services tracking', { userId: userId });
                        return [2 /*return*/, __assign(__assign({}, userProfile), { _bootstrappedFiles: seededFiles })];
                }
            });
        });
    };
    UserService.ensureTimestamp = function (value) {
        if (value instanceof firebase_admin_1.default.firestore.Timestamp) {
            return value;
        }
        if (typeof value === 'number') {
            return firebase_admin_1.default.firestore.Timestamp.fromMillis(value);
        }
        if (typeof value === 'string') {
            return firebase_admin_1.default.firestore.Timestamp.fromDate(new Date(value));
        }
        if (value && typeof value.seconds === 'number') {
            return new firebase_admin_1.default.firestore.Timestamp(value.seconds, value.nanoseconds || 0);
        }
        return firebase_admin_1.default.firestore.Timestamp.now();
    };
    /**
     * getUserProfile
     * @description
     *   Retrieves a user profile with automatic creation if it doesn't exist. This method implements
     *   the safe-default principle by creating scholar/freemium profiles for new users. The method
     *   includes comprehensive error handling and logging for debugging and observability.
     * @param email User email for profile lookup
     * @returns Promise resolving to the user profile (existing or newly created), also injects active campaign status
     */
    UserService.getUserProfile = function (email) {
        return __awaiter(this, void 0, void 0, function () {
            var normalizedEmail, loader, hit;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        normalizedEmail = email.toLowerCase().trim();
                        loader = function () { return __awaiter(_this, void 0, void 0, function () {
                            var userRef, snapshot, profile, migrationBatch, seededFiles, appRecord, _a, created;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        userRef = firebase_1.firestore.collection('users').doc(normalizedEmail);
                                        return [4 /*yield*/, userRef.get()];
                                    case 1:
                                        snapshot = _b.sent();
                                        if (!snapshot.exists) return [3 /*break*/, 10];
                                        profile = snapshot.data();
                                        console.log("8000 getUSerProfile profile response from firebase ".concat(JSON.stringify({ profile: profile })));
                                        if (!!profile.samplesProvisioned) return [3 /*break*/, 5];
                                        console.log("[userService] Migrating existing user x8x: ".concat(normalizedEmail));
                                        migrationBatch = firebase_1.firestore.batch();
                                        return [4 /*yield*/, this.provisionSampleLessons(normalizedEmail, migrationBatch)];
                                    case 2:
                                        seededFiles = _b.sent();
                                        migrationBatch.update(firebase_1.firestore.collection('users').doc(normalizedEmail), {
                                            samplesProvisioned: true
                                        });
                                        return [4 /*yield*/, migrationBatch.commit()];
                                    case 3:
                                        _b.sent();
                                        return [4 /*yield*/, (0, userCache_1.bumpUserVersion)(normalizedEmail)];
                                    case 4:
                                        _b.sent();
                                        return [2 /*return*/, __assign(__assign({}, profile), { samplesProvisioned: true, _bootstrappedFiles: seededFiles })];
                                    case 5: return [4 /*yield*/, (0, FlyerCampaignFB_1.getApplicationStatus)(normalizedEmail)];
                                    case 6:
                                        appRecord = _b.sent();
                                        if (!appRecord) return [3 /*break*/, 7];
                                        profile.campaignStatus = appRecord.status; // update - 6
                                        return [3 /*break*/, 9];
                                    case 7:
                                        // Fallback to eligibility check for fresh leads
                                        _a = profile;
                                        return [4 /*yield*/, this.resolveCampaignEligibility(normalizedEmail)];
                                    case 8:
                                        // Fallback to eligibility check for fresh leads
                                        _a.campaignStatus = _b.sent(); // update - 7
                                        _b.label = 9;
                                    case 9: return [2 /*return*/, profile];
                                    case 10:
                                        console.log('[userService.ts][7005] Profile loader creating default', { email: normalizedEmail });
                                        return [4 /*yield*/, this.createUserProfile(normalizedEmail)];
                                    case 11:
                                        created = _b.sent();
                                        // createUserProfile already bumps version
                                        return [2 /*return*/, created];
                                }
                            });
                        }); };
                        return [4 /*yield*/, (0, userCache_1.cacheReadUserProfile)(normalizedEmail, loader)];
                    case 1:
                        hit = _a.sent();
                        if (!!hit) return [3 /*break*/, 3];
                        // Defensive: should not happen because loader creates; return a minimal default if needed.
                        console.warn('[userService.ts][7005a] Profile cache returned null after loader (unexpected)', { email: normalizedEmail });
                        return [4 /*yield*/, this.createUserProfile(normalizedEmail)];
                    case 2: return [2 /*return*/, _a.sent()];
                    case 3: return [2 /*return*/, hit];
                }
            });
        });
    };
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
    UserService.updateAccountType = function (email, newAccountType) {
        return __awaiter(this, void 0, void 0, function () {
            var normalizedEmail, userRef;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log('[userService.ts][7006] Updating account type - Email:', email, 'New type:', newAccountType);
                        normalizedEmail = email.toLowerCase().trim();
                        userRef = firebase_1.firestore.collection('users').doc(normalizedEmail);
                        return [4 /*yield*/, firebase_1.firestore.runTransaction(function (transaction) { return __awaiter(_this, void 0, void 0, function () {
                                var snapshot, currentProfile, updatedFeatures, updatedProfile;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, transaction.get(userRef)];
                                        case 1:
                                            snapshot = _a.sent();
                                            if (!snapshot.exists) {
                                                throw new Error('User profile not found');
                                            }
                                            currentProfile = snapshot.data();
                                            updatedFeatures = __assign(__assign({}, currentProfile.features), { canCreatePublicFiles: newAccountType === 'educator' });
                                            updatedProfile = __assign(__assign({}, currentProfile), { accountType: newAccountType, features: updatedFeatures, updatedAt: firebase_admin_1.default.firestore.Timestamp.now() });
                                            transaction.set(userRef, updatedProfile, { merge: true });
                                            return [4 /*yield*/, (0, userCache_1.bumpUserVersion)(normalizedEmail)];
                                        case 2:
                                            _a.sent();
                                            console.log('[userService.ts][7007] Account type updated successfully');
                                            return [2 /*return*/, updatedProfile];
                                    }
                                });
                            }); })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
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
    UserService.updateSubscriptionTier = function (email, newTier, stripeSubscriptionId) {
        return __awaiter(this, void 0, void 0, function () {
            var normalizedEmail, userRef;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log('[userService.ts][7008] Updating subscription tier - Email:', email, 'New tier:', newTier);
                        normalizedEmail = email.toLowerCase().trim();
                        userRef = firebase_1.firestore.collection('users').doc(normalizedEmail);
                        return [4 /*yield*/, firebase_1.firestore.runTransaction(function (transaction) { return __awaiter(_this, void 0, void 0, function () {
                                var snapshot, currentProfile, newLimits, updatedFeatures, updatedProfile;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, transaction.get(userRef)];
                                        case 1:
                                            snapshot = _a.sent();
                                            if (!snapshot.exists) {
                                                throw new Error('User profile not found');
                                            }
                                            currentProfile = snapshot.data();
                                            newLimits = SUBSCRIPTION_LIMITS[newTier];
                                            updatedFeatures = {
                                                canCreatePublicFiles: currentProfile.accountType === 'educator', // ✅ Based on account type, NOT subscription
                                                canInviteEditors: newTier === 'premium', // ✅ Based on subscription tier
                                                hasAdvancedFeatures: newTier === 'premium', // ✅ Based on subscription tier
                                            };
                                            updatedProfile = __assign(__assign(__assign({}, currentProfile), { subscriptionTier: newTier, limits: newLimits, features: updatedFeatures, updatedAt: firebase_admin_1.default.firestore.Timestamp.now() }), (stripeSubscriptionId && { stripeSubscriptionId: stripeSubscriptionId }));
                                            transaction.set(userRef, updatedProfile, { merge: true });
                                            console.log('[userService.ts][7009] Subscription tier updated successfully with correct feature flags');
                                            console.log('[userService.ts][7010] Feature flags after update:', {
                                                canCreatePublicFiles: updatedFeatures.canCreatePublicFiles,
                                                canInviteEditors: updatedFeatures.canInviteEditors,
                                                hasAdvancedFeatures: updatedFeatures.hasAdvancedFeatures,
                                                accountType: currentProfile.accountType,
                                                subscriptionTier: newTier
                                            });
                                            return [4 /*yield*/, (0, userCache_1.bumpUserVersion)(normalizedEmail)];
                                        case 2:
                                            _a.sent();
                                            return [2 /*return*/, updatedProfile];
                                    }
                                });
                            }); })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
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
    UserService.updateBillingSnapshot = function (email, billing) {
        return __awaiter(this, void 0, void 0, function () {
            var normalizedEmail, userRef;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log("8000 step 1 updateBillingSnapshot(....) called with parameters ".concat(JSON.stringify({ email: email, billing: billing })));
                        normalizedEmail = email.toLowerCase().trim();
                        userRef = firebase_1.firestore.collection('users').doc(normalizedEmail);
                        return [4 /*yield*/, firebase_1.firestore.runTransaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                                var snap;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, tx.get(userRef)];
                                        case 1:
                                            snap = _a.sent();
                                            if (!snap.exists) {
                                                throw new Error('User profile not found for billing snapshot write');
                                            }
                                            tx.set(userRef, { billing: billing, updatedAt: firebase_admin_1.default.firestore.Timestamp.now() }, { merge: true });
                                            return [2 /*return*/];
                                    }
                                });
                            }); })];
                    case 1:
                        _a.sent();
                        console.log("8000 step 2 updateBillingSnapshot(....) transaction successful with data written : ".concat(JSON.stringify({ billing: billing, updatedAt: firebase_admin_1.default.firestore.Timestamp.now() })));
                        return [4 /*yield*/, (0, userCache_1.bumpUserVersion)(normalizedEmail)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
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
    UserService.consumeDemoCredit = function (email) {
        return __awaiter(this, void 0, void 0, function () {
            var remaining;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log('[userService.ts][7010] Consuming demo credit for lesson generation (delegates to monthly Freemium quota)', { email: email }); // update - 18
                        return [4 /*yield*/, this.consumeFreemiumQuota(email, 1)];
                    case 1:
                        remaining = (_a.sent()).remaining;
                        return [2 /*return*/, remaining];
                }
            });
        });
    };
    /**
       * checkRateLimit
       * @description
       * Authoritatively validates rate limits and HEALS stale records.
       * Logic: If a window is expired, we do not just return true; we WRITE the reset
       * to Firestore immediately so the Middleware stops seeing stale data.
       */
    UserService.checkRateLimit = function (email, action) {
        return __awaiter(this, void 0, void 0, function () {
            var normalizedEmail, _a, userProfile, userUsage, now, nowMs, periodStart, lg, hStart, mStart, healed, effectiveUsage, tracking, state;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        normalizedEmail = email.toLowerCase().trim();
                        return [4 /*yield*/, Promise.all([
                                this.getUserProfile(normalizedEmail),
                                this.getUserUsage(normalizedEmail)
                            ])];
                    case 1:
                        _a = _b.sent(), userProfile = _a[0], userUsage = _a[1];
                        now = firebase_admin_1.default.firestore.Timestamp.now();
                        nowMs = now.toMillis();
                        if (!(action === 'upload')) return [3 /*break*/, 4];
                        periodStart = this.ensureTimestamp(userUsage.rateLimits.currentPeriodStart).toMillis();
                        if (!(nowMs - periodStart >= DAY_MS)) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.resetRateLimits(normalizedEmail, 'upload')];
                    case 2:
                        _b.sent();
                        return [2 /*return*/, true];
                    case 3: return [2 /*return*/, userUsage.rateLimits.dailyUploads < RATE_LIMITS[userProfile.subscriptionTier].dailyUploads];
                    case 4:
                        if (!(action === 'lessonGeneration')) return [3 /*break*/, 11];
                        if (userProfile.subscriptionTier === 'freemium')
                            return [2 /*return*/, userUsage.demoCredits.remaining > 0];
                        lg = userUsage.rateLimits.lessonGeneration;
                        hStart = this.ensureTimestamp(lg.hourlyPeriodStart).toMillis();
                        mStart = this.ensureTimestamp(lg.monthlyPeriodStart).toMillis();
                        healed = false;
                        if (!(nowMs - hStart >= HOUR_MS)) return [3 /*break*/, 6];
                        return [4 /*yield*/, this.resetRateLimits(normalizedEmail, 'lessonGenerationHourly')];
                    case 5:
                        _b.sent();
                        healed = true;
                        _b.label = 6;
                    case 6:
                        if (!(nowMs - mStart >= MONTH_30_MS)) return [3 /*break*/, 8];
                        return [4 /*yield*/, this.resetRateLimits(normalizedEmail, 'lessonGenerationMonthly')];
                    case 7:
                        _b.sent();
                        healed = true;
                        _b.label = 8;
                    case 8:
                        effectiveUsage = userUsage;
                        if (!healed) return [3 /*break*/, 10];
                        return [4 /*yield*/, this.getUserUsage(normalizedEmail)];
                    case 9:
                        effectiveUsage = _b.sent();
                        _b.label = 10;
                    case 10:
                        tracking = {
                            hourlyCount: effectiveUsage.rateLimits.lessonGeneration.hourlyCount,
                            monthlyCount: effectiveUsage.rateLimits.lessonGeneration.monthlyCount,
                            hourlyPeriodStart: effectiveUsage.rateLimits.lessonGeneration.hourlyPeriodStart,
                            monthlyPeriodStart: effectiveUsage.rateLimits.lessonGeneration.monthlyPeriodStart,
                        };
                        state = (0, rateLogic_1.computeLessonLimitState)(new Date(nowMs), userProfile.accountType, userProfile.subscriptionTier, tracking);
                        return [2 /*return*/, !(state.isHourlyExceeded || state.isMonthlyExceeded)];
                    case 11: return [2 /*return*/, false];
                }
            });
        });
    };
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
    UserService.incrementUsageCounter = function (email, action) {
        return __awaiter(this, void 0, void 0, function () {
            var normalizedEmail, usageRef;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log('[userService.ts][2012] Incrementing enhanced usage counter', { email: email, action: action });
                        normalizedEmail = email.toLowerCase().trim();
                        usageRef = firebase_1.firestore.collection('userUsage').doc(normalizedEmail);
                        return [4 /*yield*/, firebase_1.firestore.runTransaction(function (transaction) { return __awaiter(_this, void 0, void 0, function () {
                                var snapshot, usage, nowTs, nowMs, updates, FIVE_MIN_MS, HOUR_MS, DAY_MS, MONTH_MS, currentStart, userProfile, lg, hStart, mStart, ss, windowStart;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, transaction.get(usageRef)];
                                        case 1:
                                            snapshot = _a.sent();
                                            if (!snapshot.exists) {
                                                throw new Error('User usage data not found');
                                            }
                                            usage = snapshot.data();
                                            nowTs = firebase_admin_1.default.firestore.Timestamp.now();
                                            nowMs = nowTs.toMillis();
                                            updates = {
                                                updatedAt: nowTs,
                                            };
                                            FIVE_MIN_MS = 5 * 60 * 1000;
                                            HOUR_MS = 60 * 60 * 1000;
                                            DAY_MS = 24 * 60 * 60 * 1000;
                                            MONTH_MS = 30 * 24 * 60 * 60 * 1000;
                                            if (!(action === 'upload')) return [3 /*break*/, 2];
                                            currentStart = this.ensureTimestamp(usage.rateLimits.currentPeriodStart).toMillis();
                                            if (nowMs - currentStart >= DAY_MS) {
                                                updates['rateLimits.dailyUploads'] = 1;
                                                updates['rateLimits.currentPeriodStart'] = nowTs;
                                            }
                                            else {
                                                updates['rateLimits.dailyUploads'] = firebase_admin_1.default.firestore.FieldValue.increment(1);
                                            }
                                            updates['metrics.totalUploads'] = firebase_admin_1.default.firestore.FieldValue.increment(1);
                                            return [3 /*break*/, 6];
                                        case 2:
                                            if (!(action === 'documentCreation')) return [3 /*break*/, 3];
                                            updates['metrics.totalDocumentsCreated'] = firebase_admin_1.default.firestore.FieldValue.increment(1);
                                            return [3 /*break*/, 6];
                                        case 3:
                                            if (!(action === 'lessonGeneration')) return [3 /*break*/, 5];
                                            return [4 /*yield*/, this.getUserProfile(normalizedEmail)];
                                        case 4:
                                            userProfile = _a.sent();
                                            if (userProfile.subscriptionTier === 'premium') {
                                                lg = usage.rateLimits.lessonGeneration;
                                                hStart = this.ensureTimestamp(lg.hourlyPeriodStart).toMillis();
                                                if (nowMs - hStart >= HOUR_MS) {
                                                    updates['rateLimits.lessonGeneration.hourlyCount'] = 1;
                                                    updates['rateLimits.lessonGeneration.hourlyPeriodStart'] = nowTs;
                                                }
                                                else {
                                                    updates['rateLimits.lessonGeneration.hourlyCount'] = firebase_admin_1.default.firestore.FieldValue.increment(1);
                                                }
                                                mStart = this.ensureTimestamp(lg.monthlyPeriodStart).toMillis();
                                                if (nowMs - mStart >= MONTH_MS) {
                                                    updates['rateLimits.lessonGeneration.monthlyCount'] = 1;
                                                    updates['rateLimits.lessonGeneration.monthlyPeriodStart'] = nowTs;
                                                }
                                                else {
                                                    updates['rateLimits.lessonGeneration.monthlyCount'] = firebase_admin_1.default.firestore.FieldValue.increment(1);
                                                }
                                            }
                                            updates['metrics.totalLessonsGenerated'] = firebase_admin_1.default.firestore.FieldValue.increment(1);
                                            return [3 /*break*/, 6];
                                        case 5:
                                            if (['askAssistant', 'exploreTopic', 'createQuiz'].includes(action)) {
                                                ss = usage.rateLimits.secondaryServices;
                                                windowStart = this.ensureTimestamp(ss === null || ss === void 0 ? void 0 : ss.windowStart).toMillis();
                                                if (nowMs - windowStart >= FIVE_MIN_MS) {
                                                    updates['rateLimits.secondaryServices.windowCount'] = 1;
                                                    updates['rateLimits.secondaryServices.windowStart'] = nowTs;
                                                }
                                                else {
                                                    updates['rateLimits.secondaryServices.windowCount'] = firebase_admin_1.default.firestore.FieldValue.increment(1);
                                                }
                                                updates['rateLimits.secondaryServices.dailyCount'] = firebase_admin_1.default.firestore.FieldValue.increment(1);
                                                updates['rateLimits.secondaryServices.totalCount'] = firebase_admin_1.default.firestore.FieldValue.increment(1);
                                                if (action === 'askAssistant')
                                                    updates['metrics.totalQuestionsAsked'] = firebase_admin_1.default.firestore.FieldValue.increment(1);
                                                if (action === 'exploreTopic')
                                                    updates['metrics.totalTopicsExplored'] = firebase_admin_1.default.firestore.FieldValue.increment(1);
                                                if (action === 'createQuiz')
                                                    updates['metrics.totalQuizzesCreated'] = firebase_admin_1.default.firestore.FieldValue.increment(1);
                                            }
                                            _a.label = 6;
                                        case 6:
                                            transaction.update(usageRef, updates);
                                            return [2 /*return*/];
                                    }
                                });
                            }); })];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, (0, userCache_1.bumpUserVersion)(normalizedEmail)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
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
    UserService.getUserUsage = function (email) {
        return __awaiter(this, void 0, void 0, function () {
            var normalizedEmail, loader, hit;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        normalizedEmail = email.toLowerCase().trim();
                        loader = function () { return __awaiter(_this, void 0, void 0, function () {
                            var usageRef, snapshot, now, usage, rawDemo, normalizedDemo, migrated, created;
                            var _a, _b;
                            return __generator(this, function (_c) {
                                switch (_c.label) {
                                    case 0:
                                        usageRef = firebase_1.firestore.collection('userUsage').doc(normalizedEmail);
                                        return [4 /*yield*/, usageRef.get()];
                                    case 1:
                                        snapshot = _c.sent();
                                        now = firebase_admin_1.default.firestore.Timestamp.now();
                                        if (!snapshot.exists) return [3 /*break*/, 5];
                                        usage = snapshot.data();
                                        rawDemo = usage.demoCredits || {};
                                        normalizedDemo = {
                                            total: typeof rawDemo.total === 'number' && rawDemo.total > 0
                                                ? rawDemo.total
                                                : DEFAULT_DEMO_CREDITS,
                                            used: typeof rawDemo.used === 'number' && rawDemo.used >= 0
                                                ? rawDemo.used
                                                : 0,
                                            remaining: typeof rawDemo.remaining === 'number' && rawDemo.remaining >= 0
                                                ? rawDemo.remaining
                                                : DEFAULT_DEMO_CREDITS,
                                            lastUsedAt: rawDemo.lastUsedAt instanceof firebase_admin_1.default.firestore.Timestamp
                                                ? rawDemo.lastUsedAt
                                                : undefined,
                                            lastRenewal: rawDemo.lastRenewal instanceof firebase_admin_1.default.firestore.Timestamp
                                                ? rawDemo.lastRenewal
                                                : now,
                                        };
                                        if (!(!((_a = usage.rateLimits) === null || _a === void 0 ? void 0 : _a.secondaryServices) || ((_b = usage === null || usage === void 0 ? void 0 : usage.metrics) === null || _b === void 0 ? void 0 : _b.totalQuestionsAsked) == null)) return [3 /*break*/, 4];
                                        console.log('[userService.ts][2010] Migrating usage to secondary-services support', { email: normalizedEmail });
                                        migrated = {
                                            userId: normalizedEmail,
                                            demoCredits: normalizedDemo,
                                            rateLimits: __assign(__assign({}, usage.rateLimits), { secondaryServices: {
                                                    windowCount: 0,
                                                    windowStart: now,
                                                    dailyCount: 0,
                                                    totalCount: 0,
                                                } }),
                                            metrics: __assign(__assign({}, usage.metrics), { totalQuestionsAsked: 0, totalTopicsExplored: 0, totalQuizzesCreated: 0 }),
                                            createdAt: usage.createdAt || now,
                                            updatedAt: now,
                                        };
                                        return [4 /*yield*/, usageRef.set(migrated, { merge: true })];
                                    case 2:
                                        _c.sent();
                                        return [4 /*yield*/, (0, userCache_1.bumpUserVersion)(normalizedEmail)];
                                    case 3:
                                        _c.sent(); // keep caches fresh after migration
                                        return [2 /*return*/, migrated];
                                    case 4: return [2 /*return*/, usage];
                                    case 5:
                                        created = {
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
                                        return [4 /*yield*/, usageRef.set(created)];
                                    case 6:
                                        _c.sent();
                                        return [4 /*yield*/, (0, userCache_1.bumpUserVersion)(normalizedEmail)];
                                    case 7:
                                        _c.sent(); // after creation
                                        console.log('[userService.ts][2011] Usage created with defaults', { email: normalizedEmail });
                                        return [2 /*return*/, created];
                                }
                            });
                        }); };
                        return [4 /*yield*/, (0, userCache_1.cacheReadUserUsage)(normalizedEmail, loader)];
                    case 1:
                        hit = _a.sent();
                        if (!!hit) return [3 /*break*/, 3];
                        // Extremely unlikely because loader creates; still provide fallback
                        console.warn('[userService.ts][2011a] Usage cache returned null after loader (unexpected)', { email: normalizedEmail }); // update - 9
                        return [4 /*yield*/, loader()];
                    case 2: // update - 9
                    return [2 /*return*/, _a.sent()]; // update - 9
                    case 3: return [2 /*return*/, hit]; // update - 9
                }
            });
        });
    };
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
    UserService.resetRateLimits = function (email, resetType) {
        return __awaiter(this, void 0, void 0, function () {
            var normalizedEmail, usageRef, now, updates;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log('[userService.ts][7019] Resetting rate limits for user:', email, 'Type:', resetType);
                        normalizedEmail = email.toLowerCase().trim();
                        usageRef = firebase_1.firestore.collection('userUsage').doc(normalizedEmail);
                        now = firebase_admin_1.default.firestore.Timestamp.now();
                        updates = {
                            updatedAt: now,
                        };
                        // Step 16: Reset appropriate counters based on type
                        if (resetType === 'upload') {
                            updates['rateLimits.dailyUploads'] = 0;
                            updates['rateLimits.currentPeriodStart'] = now;
                        }
                        else if (resetType === 'lessonGenerationHourly') {
                            updates['rateLimits.lessonGeneration.hourlyCount'] = 0;
                            updates['rateLimits.lessonGeneration.hourlyPeriodStart'] = now;
                        }
                        else if (resetType === 'lessonGenerationMonthly') {
                            updates['rateLimits.lessonGeneration.monthlyCount'] = 0;
                            updates['rateLimits.lessonGeneration.monthlyPeriodStart'] = now;
                        }
                        return [4 /*yield*/, (0, userCache_1.bumpUserVersion)(normalizedEmail)];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, usageRef.update(updates)];
                    case 2:
                        _a.sent();
                        console.log('[userService.ts][7020] Rate limits reset successfully');
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * updateLastActive
     * @description
     *   Updates the user's last active timestamp for analytics and session management purposes.
     *   This method is called automatically during authentication to track user activity patterns.
     *   The operation is optimized for performance and does not block request processing.
     * @param email User email
     * @returns Promise resolving when update is complete
     */
    UserService.updateLastActive = function (email) {
        return __awaiter(this, void 0, void 0, function () {
            var normalizedEmail, userRef, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        normalizedEmail = email.toLowerCase().trim();
                        userRef = firebase_1.firestore.collection('users').doc(normalizedEmail);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, userRef.update({
                                lastActiveAt: firebase_admin_1.default.firestore.Timestamp.now(),
                            })];
                    case 2:
                        _a.sent();
                        console.log('[userService.ts][7027] Last active timestamp updated for user:', normalizedEmail);
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _a.sent();
                        // Non-critical operation, don't block request
                        console.warn('[userService.ts][7028] Failed to update last active timestamp (non-critical):', error_1);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
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
    UserService.validateFileUploadPermissions = function (email, requestedVisibility) {
        return __awaiter(this, void 0, void 0, function () {
            var userProfile, rateLimitOk, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log('[userService.ts][7021] Validating file upload permissions - Email:', email, 'Visibility:', requestedVisibility);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, this.getUserProfile(email)];
                    case 2:
                        userProfile = _a.sent();
                        // Step 17: Validate account type permissions
                        if (requestedVisibility === 'public' && userProfile.accountType === 'scholar') {
                            console.log('[userService.ts][7022] Upload denied - scholar cannot create public files');
                            return [2 /*return*/, {
                                    allowed: false,
                                    reason: 'Scholar accounts cannot create public files',
                                    userProfile: userProfile,
                                }];
                        }
                        return [4 /*yield*/, this.checkRateLimit(email, 'upload')];
                    case 3:
                        rateLimitOk = _a.sent();
                        if (!rateLimitOk) {
                            console.log('[userService.ts][7023] Upload denied - rate limit exceeded');
                            return [2 /*return*/, {
                                    allowed: false,
                                    reason: 'Daily upload limit exceeded',
                                    userProfile: userProfile,
                                }];
                        }
                        console.log('[userService.ts][7025] Upload permission granted');
                        return [2 /*return*/, {
                                allowed: true,
                                userProfile: userProfile,
                            }];
                    case 4:
                        error_2 = _a.sent();
                        console.error('[userService.ts][7026] Error validating upload permissions:', error_2);
                        throw error_2;
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
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
    UserService.validateLessonGenerationPermissions = function (email) {
        return __awaiter(this, void 0, void 0, function () {
            var userProfile, usage_1, rawDemo, now, lastRenewalDate, THIRTY_DAYS_MS, demoWindowExpired, recordedUsed, effectiveUsed, effectiveRemaining, rateLimitOk, usage_2, lessonLimits_1, lessonTracking_1, hourlyExceeded, monthlyExceeded, reason, usage, lessonLimits, lessonTracking, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log('[userService.ts][7029] Validating lesson generation permissions - Email:', email);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 9, , 10]);
                        return [4 /*yield*/, this.getUserProfile(email)];
                    case 2:
                        userProfile = _a.sent();
                        if (!(userProfile.subscriptionTier === 'freemium')) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.getUserUsage(email)];
                    case 3:
                        usage_1 = _a.sent();
                        rawDemo = usage_1.demoCredits || {};
                        now = new Date();
                        lastRenewalDate = rawDemo.lastRenewal instanceof firebase_admin_1.default.firestore.Timestamp
                            ? rawDemo.lastRenewal.toDate()
                            : rawDemo.lastRenewal instanceof Date
                                ? rawDemo.lastRenewal
                                : now;
                        THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
                        demoWindowExpired = now.getTime() - lastRenewalDate.getTime() >= THIRTY_DAYS_MS;
                        recordedUsed = typeof rawDemo.used === 'number' && rawDemo.used >= 0
                            ? rawDemo.used
                            : 0;
                        effectiveUsed = demoWindowExpired ? 0 : recordedUsed;
                        effectiveRemaining = Math.max(0, FREEMIUM_MONTHLY_LESSON_LIMIT - effectiveUsed);
                        if (effectiveRemaining <= 0) {
                            console.log('[userService.ts][7030] Lesson generation denied - no demo credits remaining');
                            return [2 /*return*/, {
                                    allowed: false,
                                    reason: 'No demo credits remaining. Please upgrade to premium to continue generating lessons.',
                                    userProfile: userProfile,
                                    remainingDemoCredits: 0,
                                }];
                        }
                        return [2 /*return*/, {
                                allowed: true,
                                userProfile: userProfile,
                                remainingDemoCredits: usage_1.demoCredits.remaining,
                            }];
                    case 4: return [4 /*yield*/, this.checkRateLimit(email, 'lessonGeneration')];
                    case 5:
                        rateLimitOk = _a.sent();
                        if (!!rateLimitOk) return [3 /*break*/, 7];
                        return [4 /*yield*/, this.getUserUsage(email)];
                    case 6:
                        usage_2 = _a.sent();
                        lessonLimits_1 = RATE_LIMITS.premium.lessonGeneration[userProfile.accountType];
                        lessonTracking_1 = usage_2.rateLimits.lessonGeneration;
                        hourlyExceeded = lessonTracking_1.hourlyCount >= lessonLimits_1.hourlyLimit;
                        monthlyExceeded = lessonTracking_1.monthlyCount >= lessonLimits_1.monthlyLimit;
                        reason = 'Rate limit exceeded. ';
                        if (hourlyExceeded) {
                            reason += "Hourly limit of ".concat(lessonLimits_1.hourlyLimit, " lessons reached. ");
                        }
                        if (monthlyExceeded) {
                            reason += "Monthly limit of ".concat(lessonLimits_1.monthlyLimit, " lessons reached. ");
                        }
                        console.log('[userService.ts][7031] Lesson generation denied - rate limit exceeded');
                        return [2 /*return*/, {
                                allowed: false,
                                reason: reason.trim(),
                                userProfile: userProfile,
                                rateLimitInfo: {
                                    hourlyRemaining: Math.max(0, lessonLimits_1.hourlyLimit - lessonTracking_1.hourlyCount),
                                    monthlyRemaining: Math.max(0, lessonLimits_1.monthlyLimit - lessonTracking_1.monthlyCount),
                                    hourlyLimit: lessonLimits_1.hourlyLimit,
                                    monthlyLimit: lessonLimits_1.monthlyLimit,
                                },
                            }];
                    case 7: return [4 /*yield*/, this.getUserUsage(email)];
                    case 8:
                        usage = _a.sent();
                        lessonLimits = RATE_LIMITS.premium.lessonGeneration[userProfile.accountType];
                        lessonTracking = usage.rateLimits.lessonGeneration;
                        console.log('[userService.ts][7032] Lesson generation permission granted - Premium user');
                        return [2 /*return*/, {
                                allowed: true,
                                userProfile: userProfile,
                                rateLimitInfo: {
                                    hourlyRemaining: Math.max(0, lessonLimits.hourlyLimit - lessonTracking.hourlyCount),
                                    monthlyRemaining: Math.max(0, lessonLimits.monthlyLimit - lessonTracking.monthlyCount),
                                    hourlyLimit: lessonLimits.hourlyLimit,
                                    monthlyLimit: lessonLimits.monthlyLimit,
                                },
                            }];
                    case 9:
                        error_3 = _a.sent();
                        console.error('[userService.ts][7033] Error validating lesson generation permissions:', error_3);
                        throw error_3;
                    case 10: return [2 /*return*/];
                }
            });
        });
    };
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
    UserService.grantBonusLessonCredits = function (email, amount) {
        return __awaiter(this, void 0, void 0, function () {
            var normalizedEmail, usageRef;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        normalizedEmail = email.toLowerCase().trim();
                        usageRef = firebase_1.firestore.collection('userUsage').doc(normalizedEmail);
                        console.log("[UserService] Granting ".concat(amount, " bonus credits to ").concat(normalizedEmail));
                        return [4 /*yield*/, firebase_1.firestore.runTransaction(function (transaction) { return __awaiter(_this, void 0, void 0, function () {
                                var snapshot, usage, currentDemo, updatedDemo;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, transaction.get(usageRef)];
                                        case 1:
                                            snapshot = _a.sent();
                                            if (!snapshot.exists) {
                                                throw new Error('User usage data not found for credit grant');
                                            }
                                            usage = snapshot.data();
                                            currentDemo = usage.demoCredits || { total: 0, remaining: 0, used: 0 };
                                            updatedDemo = __assign(__assign({}, currentDemo), { total: (currentDemo.total || 0) + amount, remaining: (currentDemo.remaining || 0) + amount, lastRenewal: currentDemo.lastRenewal || firebase_admin_1.default.firestore.Timestamp.now() });
                                            transaction.update(usageRef, {
                                                demoCredits: updatedDemo,
                                                updatedAt: firebase_admin_1.default.firestore.Timestamp.now()
                                            });
                                            return [2 /*return*/];
                                    }
                                });
                            }); })];
                    case 1:
                        _a.sent();
                        // Invalidate the cache version so validation logic sees the new credits immediately
                        return [4 /*yield*/, (0, userCache_1.bumpUserVersion)(normalizedEmail)];
                    case 2:
                        // Invalidate the cache version so validation logic sees the new credits immediately
                        _a.sent();
                        console.log("[UserService] Successfully granted bonus credits and bumped version for ".concat(normalizedEmail));
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
       * provisionSampleLessons
       * @description
       * Reads local .bin seeds and clones them... (existing description)
       * UPDATED: Returns the list of UserFileMetadata objects created during provisioning.
       */
    UserService.provisionSampleLessons = function (userId, batch) {
        return __awaiter(this, void 0, void 0, function () {
            var bucket, SEED_DIR, sampleConfigs, seededFiles, _i, sampleConfigs_1, config, seedPath, bytes, newDocId, destination, hardcodedMeta, fileMeta, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        bucket = firebase_admin_1.default.storage().bucket();
                        SEED_DIR = path.join(process.cwd(), 'app', 'src', 'services', 'sampleSeeds');
                        sampleConfigs = [
                            { file: 'Organic_Chemistry_seed.bin', name: 'Sample: Organic Chemistry lesson', color: '#FFB703' },
                            { file: 'Psychology_seed.bin', name: 'Sample: Psychology lesson', color: '#4F46E5' }
                        ];
                        seededFiles = [];
                        _i = 0, sampleConfigs_1 = sampleConfigs;
                        _a.label = 1;
                    case 1:
                        if (!(_i < sampleConfigs_1.length)) return [3 /*break*/, 6];
                        config = sampleConfigs_1[_i];
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 5]);
                        seedPath = path.join(SEED_DIR, config.file);
                        if (!fs.existsSync(seedPath)) {
                            console.warn("[userService] Skipping seed: ".concat(config.file, " not found"));
                            return [3 /*break*/, 5];
                        }
                        bytes = fs.readFileSync(seedPath);
                        newDocId = (0, uuid_1.v4)();
                        destination = "documents/".concat(newDocId, ".bloomdocx");
                        hardcodedMeta = SAMPLE_METADATA_MAP[config.file];
                        // 1. Storage Upload
                        return [4 /*yield*/, bucket.file(destination).save(bytes, {
                                metadata: { contentType: 'application/octet-stream' }
                            })];
                    case 3:
                        // 1. Storage Upload
                        _a.sent();
                        fileMeta = {
                            fileId: newDocId,
                            ownerId: userId,
                            fileName: config.name,
                            fileStoragePath: destination,
                            timestamp: firebase_admin_1.default.firestore.Timestamp.now(),
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
                                lastUpdated: firebase_admin_1.default.firestore.Timestamp.now().toDate()
                            }
                        };
                        batch.set(firebase_1.firestore.collection('userFiles').doc(newDocId), fileMeta);
                        // Add to collection
                        seededFiles.push(fileMeta);
                        return [3 /*break*/, 5];
                    case 4:
                        err_1 = _a.sent();
                        console.warn("[userService] Provisioning failed for ".concat(config.file, ":"), err_1);
                        return [3 /*break*/, 5];
                    case 5:
                        _i++;
                        return [3 /*break*/, 1];
                    case 6: return [2 /*return*/, seededFiles];
                }
            });
        });
    };
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
    UserService.resolveCampaignEligibility = function (email) {
        return __awaiter(this, void 0, void 0, function () {
            var config, domain;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, (0, FlyerCampaignFB_1.getCampaignConfig)()];
                    case 1:
                        config = _b.sent();
                        // 2. Immediate fail-fast if campaign is toggled off or cap is hit
                        if (!config.isLive || config.activeParticipantCount >= config.maxCap) {
                            return [2 /*return*/, 'INELIGIBLE'];
                        }
                        domain = (_a = email.split('@')[1]) === null || _a === void 0 ? void 0 : _a.toLowerCase();
                        if (!domain || config.denylistDomains.includes(domain)) {
                            console.log("[userService] User ".concat(email, " rejected: Domain ").concat(domain, " is denylisted."));
                            return [2 /*return*/, 'INELIGIBLE'];
                        }
                        return [2 /*return*/, 'ELIGIBLE'];
                }
            });
        });
    };
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
    UserService.consumeFreemiumQuota = function (email, lessonCount) {
        return __awaiter(this, void 0, void 0, function () {
            var normalizedEmail, usageRef, result;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log('[userService.ts][7050] Consuming Freemium monthly quota for lesson generation', { email: email, lessonCount: lessonCount }); // update - 15
                        if (!Number.isFinite(lessonCount) || lessonCount <= 0) {
                            throw new Error('lessonCount must be a positive number');
                        }
                        normalizedEmail = email.toLowerCase().trim();
                        usageRef = firebase_1.firestore.collection('userUsage').doc(normalizedEmail);
                        return [4 /*yield*/, firebase_1.firestore.runTransaction(function (transaction) { return __awaiter(_this, void 0, void 0, function () {
                                var snapshot, usage, now, rawDemo, monthlyLimit, lastRenewalTs, THIRTY_DAYS_MS, elapsedMs, windowExpired, baselineUsed, newUsed, remaining, updatedDemo, updatedMetrics, updatedUsage;
                                var _a;
                                return __generator(this, function (_b) {
                                    switch (_b.label) {
                                        case 0: return [4 /*yield*/, transaction.get(usageRef)];
                                        case 1:
                                            snapshot = _b.sent();
                                            if (!snapshot.exists) {
                                                throw new Error('User usage data not found');
                                            }
                                            usage = snapshot.data();
                                            now = firebase_admin_1.default.firestore.Timestamp.now();
                                            rawDemo = usage.demoCredits || {};
                                            monthlyLimit = FREEMIUM_MONTHLY_LESSON_LIMIT;
                                            lastRenewalTs = rawDemo.lastRenewal instanceof firebase_admin_1.default.firestore.Timestamp
                                                ? rawDemo.lastRenewal
                                                : rawDemo.lastUsedAt instanceof firebase_admin_1.default.firestore.Timestamp
                                                    ? rawDemo.lastUsedAt
                                                    : usage.createdAt instanceof firebase_admin_1.default.firestore.Timestamp
                                                        ? usage.createdAt
                                                        : now;
                                            THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
                                            elapsedMs = now.toMillis() - lastRenewalTs.toMillis();
                                            windowExpired = elapsedMs >= THIRTY_DAYS_MS;
                                            baselineUsed = windowExpired || typeof rawDemo.used !== 'number' || rawDemo.used < 0
                                                ? 0
                                                : rawDemo.used;
                                            newUsed = baselineUsed + lessonCount;
                                            remaining = Math.max(0, monthlyLimit - newUsed);
                                            updatedDemo = {
                                                total: monthlyLimit,
                                                remaining: remaining,
                                                used: newUsed,
                                                lastUsedAt: rawDemo.lastUsedAt instanceof firebase_admin_1.default.firestore.Timestamp
                                                    ? now
                                                    : now,
                                                lastRenewal: windowExpired ? now : lastRenewalTs,
                                            };
                                            updatedMetrics = __assign(__assign({}, (usage.metrics || {})), { totalLessonsGenerated: (((_a = usage.metrics) === null || _a === void 0 ? void 0 : _a.totalLessonsGenerated) || 0) + lessonCount });
                                            updatedUsage = __assign(__assign({}, usage), { demoCredits: updatedDemo, metrics: updatedMetrics, updatedAt: now });
                                            transaction.set(usageRef, updatedUsage, { merge: true });
                                            console.log('[userService.ts][7051] Freemium quota updated', {
                                                email: normalizedEmail,
                                                remaining: remaining,
                                                renewed: windowExpired,
                                            });
                                            return [2 /*return*/, { remaining: remaining, renewed: windowExpired }];
                                    }
                                });
                            }); })];
                    case 1:
                        result = _a.sent();
                        return [4 /*yield*/, (0, userCache_1.bumpUserVersion)(normalizedEmail)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, result];
                }
            });
        });
    };
    /**
     * rewardUserTier
     * @description
     * Authoritative method to grant or extend a promotional trial period within the decoupled sandbox.
     * This function calculates the new trial range using trialStartDate and trialEndDate, ensuring
     * promotional access never overwrites the subscriptionTier. Crucially, this method executes
     * a Redis version bump post-transaction to invalidate stale caches across the BFF layer,
     * ensuring the user gains immediate access to premium features upon reward.
     * @param userId - The normalized ID (email) of the user receiving the trial reward.
     * @param daysToGrant - The number of 24-hour periods to add to the trial sandbox.
     * @returns Promise resolving when the transaction and cache invalidation are complete.
     */
    UserService.rewardUserTrial = function (userId, daysToGrant) {
        return __awaiter(this, void 0, void 0, function () {
            var userRef, appRef, MS_PER_DAY;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        userRef = firebase_1.firestore.collection('users').doc(userId);
                        appRef = firebase_1.firestore.collection('referral_applications').doc(userId);
                        MS_PER_DAY = 24 * 60 * 60 * 1000;
                        // update - 1.1: Execute atomic write for the trial sandbox
                        return [4 /*yield*/, firebase_1.firestore.runTransaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                                var snap, data, nowMs, trialStart, currentTrialExpiry, baseMs, newExpiryMs;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, tx.get(userRef)];
                                        case 1:
                                            snap = _a.sent();
                                            if (!snap.exists)
                                                throw new Error("User profile not found for reward");
                                            data = snap.data();
                                            nowMs = Date.now();
                                            trialStart = data.trialStartDate || firebase_admin_1.default.firestore.Timestamp.now();
                                            currentTrialExpiry = data.trialEndDate instanceof firebase_admin_1.default.firestore.Timestamp
                                                ? data.trialEndDate.toMillis()
                                                : 0;
                                            baseMs = Math.max(nowMs, currentTrialExpiry);
                                            newExpiryMs = baseMs + (daysToGrant * MS_PER_DAY);
                                            // update - 1.4: Persist decoupled data to 'users' collection
                                            tx.update(userRef, {
                                                trialStartDate: trialStart,
                                                trialEndDate: firebase_admin_1.default.firestore.Timestamp.fromMillis(newExpiryMs),
                                                updatedAt: firebase_admin_1.default.firestore.Timestamp.now()
                                            });
                                            // update - 1.5: Synchronize application status
                                            tx.update(appRef, {
                                                status: 'REWARDED',
                                                lastRewardGrant: firebase_admin_1.default.firestore.Timestamp.now()
                                            });
                                            return [2 /*return*/];
                                    }
                                });
                            }); })];
                    case 1:
                        // update - 1.1: Execute atomic write for the trial sandbox
                        _a.sent();
                        // update - 1.6: Immediate Cache Invalidation
                        // This is the critical "Bump" that prevents stale cache from blocking trial access.
                        return [4 /*yield*/, (0, userCache_1.bumpUserVersion)(userId)];
                    case 2:
                        // update - 1.6: Immediate Cache Invalidation
                        // This is the critical "Bump" that prevents stale cache from blocking trial access.
                        _a.sent();
                        console.log("[UserService] Decoupled reward granted and version bumped for: ".concat(userId));
                        return [2 /*return*/];
                }
            });
        });
    };
    return UserService;
}());
exports.UserService = UserService;
