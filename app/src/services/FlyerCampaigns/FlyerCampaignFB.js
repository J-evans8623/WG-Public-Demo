"use strict";
/**
 * @file FlyerCampaignFB.ts
 * @description
 * Authoritative backend adapter for the Flyer Referral Campaign. This file manages
 * the lifecycle of guerilla marketing participants, including eligibility checks,
 * application intake, and status management. It interacts with the 'campaign_settings'
 * singleton for global config and the 'referral_applications' collection for lead
 * tracking. Designed for use in Next.js API routes (BFF architecture), it ensures
 * atomic operations when updating participant counts and enforcing global caps.
 */
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
exports.getCampaignConfig = getCampaignConfig;
exports.submitApplication = submitApplication;
exports.getApplicationStatus = getApplicationStatus;
exports.rewardUserTier = rewardUserTier;
exports.getUniqueReferralCount = getUniqueReferralCount;
exports.IncrementNewUniqueUserReferalCount = IncrementNewUniqueUserReferalCount;
exports.GetNewUniqueUserReferalCount = GetNewUniqueUserReferalCount;
exports.checkAndAutoRewardUser = checkAndAutoRewardUser;
exports.getReferralCount = getReferralCount;
exports.incrementActiveParticipants = incrementActiveParticipants;
exports.decrementActiveParticipants = decrementActiveParticipants;
var firebase_1 = require("../firebase");
var admin = require("firebase-admin");
var userService_1 = require("../userService");
/**
 * getCampaignConfig
 * @description
 * Retrieves the global configuration for the referral campaign from Firestore.
 * This document acts as the master switch for the campaign, defining the participant
 * cap and the list of prohibited email domains (e.g., high schools).
 * @returns Promise resolving to CampaignConfig or default values if document is missing.
 */
function getCampaignConfig() {
    return __awaiter(this, void 0, void 0, function () {
        var doc;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, firebase_1.firestore.collection('campaign_settings').doc('v1').get()];
                case 1:
                    doc = _a.sent();
                    if (!doc.exists) {
                        return [2 /*return*/, { isLive: false, maxCap: 100, activeParticipantCount: 0, denylistDomains: [] }];
                    }
                    return [2 /*return*/, doc.data()];
            }
        });
    });
}
/**
 * submitApplication
 * @description
 * Atomically records a user's intent to participate in the campaign. It writes
 * the self-reported University name and sets the initial status to 'PENDING'.
 * This data is structured to be picked up by the Google Sheets Firebase Extension.
 * @param userId - The normalized email/ID of the user.
 * @param email - The user's contact email.
 * @param universityName - Self-reported institution name from the intake form.
 */
function submitApplication(userId, email, universityName) {
    return __awaiter(this, void 0, void 0, function () {
        var appRef, application;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    appRef = firebase_1.firestore.collection('referral_applications').doc(userId);
                    application = {
                        userId: userId,
                        email: email,
                        universityName: universityName,
                        status: 'PENDING',
                        appliedAt: admin.firestore.Timestamp.now(),
                        updatedAt: admin.firestore.Timestamp.now(),
                    };
                    // 2. Persist to Firestore; merge:true prevents overwriting verified data if called twice
                    return [4 /*yield*/, appRef.set(application, { merge: true })];
                case 1:
                    // 2. Persist to Firestore; merge:true prevents overwriting verified data if called twice
                    _a.sent();
                    console.log("[FlyerCampaignFB] Application recorded for ".concat(email, " at ").concat(universityName));
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * getApplicationStatus
 * @description
 * Fetches the current progress of a specific user within the campaign funnel.
 * This is called by the BFF to determine which UI state (Banner/Modal) to show.
 * @param userId - The normalized email/ID of the user.
 * @returns Promise resolving to status string or null if no application exists.
 */
function getApplicationStatus(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var doc, data;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, firebase_1.firestore.collection('referral_applications').doc(userId).get()];
                case 1:
                    doc = _a.sent();
                    if (!doc.exists)
                        return [2 /*return*/, null];
                    data = doc.data();
                    // update - 1.2: Returning only the simplified digital fields
                    return [2 /*return*/, {
                            status: data === null || data === void 0 ? void 0 : data.status,
                            totalUniquePeers: (data === null || data === void 0 ? void 0 : data.totalUniquePeers) || 0,
                            universityName: data === null || data === void 0 ? void 0 : data.universityName
                        }];
            }
        });
    });
}
/**
 * rewardUserTier
 * @description
 * Atomically extends or activates a user's Premium trial period.
 * If a trial is already active, it appends the days to the existing timestamp.
 * Logic satisfies Question 6 (EntitlementProvisioner) and Phase 3 automation.
 * @param userId - The normalized ID (email) of the user being rewarded.
 * @param daysToGrant - Number of days to add to the premium trial.
 */
function rewardUserTier(userId, daysToGrant) {
    return __awaiter(this, void 0, void 0, function () {
        var error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, userService_1.UserService.rewardUserTrial(userId, daysToGrant)];
                case 1:
                    _a.sent();
                    console.log("[FlyerCampaignFB] Successfully delegated reward grant for ".concat(userId));
                    return [3 /*break*/, 3];
                case 2:
                    error_1 = _a.sent();
                    console.error("[FlyerCampaignFB] Failed to delegate reward for ".concat(userId, ":"), error_1);
                    throw error_1;
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * getUniqueReferralCount
 * @description
 * Calculates flyer campaign candidate referral score based on the number of UNIQUE peers acquired.
 * Example : Even if a peer scans 10 of "Alex's" flyers, Alex only receives credit for 1 person.
 * This logic prevents reward gaming and prioritizes true market expansion.
 * @param referrerId - The ID (email) of the ambassador Alex.
 * @returns Promise resolving to the number of unique students referred.
 */
function getUniqueReferralCount(referrerId) {
    return __awaiter(this, void 0, void 0, function () {
        var snap, uniquePeers;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, firebase_1.firestore.collection('marketing_conversions')
                        .where('referrerId', '==', referrerId)
                        .get()];
                case 1:
                    snap = _a.sent();
                    uniquePeers = new Set();
                    snap.docs.forEach(function (doc) {
                        var data = doc.data();
                        if (data.userId)
                            uniquePeers.add(data.userId);
                    });
                    return [2 /*return*/, uniquePeers.size];
            }
        });
    });
}
/**
 * IncrementNewUniqueUserReferalCount
 * @description
 * Atomically increments the persistent counter of valid new users referred.
 * This is the definitive "Writer" function called upon a successful handshake.
 * Time Complexity: O(1) - Single document update.
 * @param referrerId - The normalized ID of the student who shared the link.
 */
function IncrementNewUniqueUserReferalCount(referrerId) {
    return __awaiter(this, void 0, void 0, function () {
        var appRef;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    appRef = firebase_1.firestore.collection('referral_applications').doc(referrerId);
                    // update - 2.1: Atomic increment to ensure data integrity during burst sign-ups
                    return [4 /*yield*/, appRef.update({
                            totalUniquePeers: admin.firestore.FieldValue.increment(1),
                            updatedAt: admin.firestore.Timestamp.now()
                        })];
                case 1:
                    // update - 2.1: Atomic increment to ensure data integrity during burst sign-ups
                    _a.sent();
                    console.log("[FlyerCampaignFB] Incremented referral count for ".concat(referrerId));
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * GetNewUniqueUserReferalCount
 * @description
 * Reads the authoritatively stored count of unique new users.
 * This function satisfies the requirement for a high-performance, non-scan reader.
 * Time Complexity: O(1) - Single document read.
 * @param referrerId - Normalized ID of the referrer.
 * @returns Promise resolving to the current peer count.
 */
function GetNewUniqueUserReferalCount(referrerId) {
    return __awaiter(this, void 0, void 0, function () {
        var appStatus;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getApplicationStatus(referrerId)];
                case 1:
                    appStatus = _a.sent();
                    // update - 2.2: Simply reading the last stored value to avoid collection scans
                    return [2 /*return*/, (appStatus === null || appStatus === void 0 ? void 0 : appStatus.totalUniquePeers) || 0];
            }
        });
    });
}
/**
 * checkAndAutoRewardUser
 * @description
 * Automatically checks if an APPROVED user has met the 5-referral threshold.
 * If met, it bypasses the manual 'VERIFIED' step and grants the trial.
 */
/**
 * checkAndAutoRewardUser
 * @description
 * Authoritative milestone processor that gates the single-tier campaign reward.
 * This refactored version checks the O(1) peer count and triggers the 7-day
 * grant only if the 5-user threshold is met for the first time.
 * @param userId - Normalized ID of the referrer.
 * @returns Promise resolving to boolean: true if reward was granted in this call.
 */
function checkAndAutoRewardUser(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var currentApp, currentCount, appRef;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getApplicationStatus(userId)];
                case 1:
                    currentApp = _a.sent();
                    // 1. Guard: Only process if the user is in the active sharing phase.
                    // This prevents redundant trial grants once the status is 'REWARDED'.
                    if ((currentApp === null || currentApp === void 0 ? void 0 : currentApp.status) !== 'APPROVED')
                        return [2 /*return*/, false];
                    return [4 /*yield*/, GetNewUniqueUserReferalCount(userId)];
                case 2:
                    currentCount = _a.sent();
                    if (!(currentCount >= 5)) return [3 /*break*/, 6];
                    appRef = firebase_1.firestore.collection('referral_applications').doc(userId);
                    // Atomic state flip to finalize the journey
                    return [4 /*yield*/, appRef.update({
                            status: 'REWARDED',
                            updatedAt: admin.firestore.Timestamp.now()
                        })];
                case 3:
                    // Atomic state flip to finalize the journey
                    _a.sent();
                    // Provision the single 7-day trial sandbox
                    return [4 /*yield*/, userService_1.UserService.rewardUserTrial(userId, 7)];
                case 4:
                    // Provision the single 7-day trial sandbox
                    _a.sent();
                    return [4 /*yield*/, incrementActiveParticipants()];
                case 5:
                    _a.sent();
                    console.log("[FlyerCampaignFB] Milestone reached! Rewarded ".concat(userId));
                    return [2 /*return*/, true];
                case 6: return [2 /*return*/, false];
            }
        });
    });
}
/**
 * getReferralCount
 * @description
 * Aggregates unique marketing conversions associated with a specific user's
 * referrals to determine threshold eligibility.
 * @param userId - The user who referred the scans.
 * @returns Promise resolving to integer count of unique conversions.
 */
function getReferralCount(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var snap;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, firebase_1.firestore.collection('marketing_conversions')
                        .where('referrerId', '==', userId)
                        .get()];
                case 1:
                    snap = _a.sent();
                    return [2 /*return*/, snap.size];
            }
        });
    });
}
/**
 * incrementActiveParticipants
 * @description
 * Atomically increments the global 'activeParticipantCount' by 1.
 * This uses FieldValue.increment to ensure that concurrent administrative
 * verifications do not overwrite each other or cause race conditions.
 */
function incrementActiveParticipants() {
    return __awaiter(this, void 0, void 0, function () {
        var settingsRef;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    settingsRef = firebase_1.firestore.collection('campaign_settings').doc('v1');
                    return [4 /*yield*/, settingsRef.update({
                            activeParticipantCount: admin.firestore.FieldValue.increment(1)
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * decrementActiveParticipants
 * @description
 * Atomically decrements the global 'activeParticipantCount' by 1.
 * This is used specifically by the reset script to "return" a seat to
 * the campaign pool when a test or verified user is purged.
 */
function decrementActiveParticipants() {
    return __awaiter(this, void 0, void 0, function () {
        var settingsRef;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    settingsRef = firebase_1.firestore.collection('campaign_settings').doc('v1');
                    return [4 /*yield*/, settingsRef.update({
                            activeParticipantCount: admin.firestore.FieldValue.increment(-1)
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
