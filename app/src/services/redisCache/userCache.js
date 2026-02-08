"use strict";
/***************************************************************************************************
 * @file redisCache/userCache.ts
 * @description
 *   Production-ready, user-centric caching utilities that provide versioned, read-through access to
 *   user profile data, usage snapshots, and composite validation results. This module isolates all
 *   Redis key construction, TTL policy, and version bump semantics so application services can just
 *   import a tiny API. The central idea mirrors ACL caching: every user (by email) has a monotonic
 *   version counter in Redis (`user:v:{email}`), and all cached reads embed that version in their
 *   keys. Writers simply `INCR` the version after a successful Firestore mutation. That makes
 *   invalidation O(1): readers shift to new keys automatically without SCAN/DEL. We also include a
 *   compact “validation result” micro-cache for expensive premium checks.
 *
 *   The module exposes:
 *     1) `getUserVersion(email)` and `bumpUserVersion(email)` for versioning,
 *     2) `cacheReadUserProfile(email, loader)` and `cacheReadUserUsage(email, loader)` for data,
 *     3) `readValidationResult(service,email,ver)` / `writeValidationResult(...)` micro-cache helpers.
 *
 *   Design principles:
 *     - Firestore remains the source of truth; Redis is an accelerator that must never block reads.
 *     - Fail-open posture: if Redis is down or misbehaving, we still call loaders and return fresh
 *       data so that user-facing endpoints (including authenticated Next.js handlers that rely on
 *       `authenticateRequest.ts`) degrade gracefully rather than throwing 500s. Redis outages should
 *       increase latency, not break core functionality or subscription flows. All Redis operations
 *       remain O(1) with respect to algorithmic complexity; loader complexity is external and tied
 *       to Firestore or other backing services. Logging is intentionally structured and location-
 *       tagged, making it easy to understand whether a read came from cache, negative cache, or a
 *       direct loader fallback when debugging production incidents or analyzing performance trends.
 ***************************************************************************************************/
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
exports.getUserVersion = getUserVersion;
exports.bumpUserVersion = bumpUserVersion;
exports.cacheReadUserProfile = cacheReadUserProfile;
exports.cacheReadUserUsage = cacheReadUserUsage;
exports.readValidationResult = readValidationResult;
exports.writeValidationResult = writeValidationResult;
var redis_1 = require("./redis");
var cacheAside_1 = require("./cacheAside");
var cachePolicies_1 = require("./cachePolicies");
var cacheKeys_1 = require("./cacheKeys");
/**
 * getUserVersion
 * @description
 *   Read the current user version from Redis; defaults to 1 if missing or on error. Callers include
 *   this value in cache keys to tie reads to the latest write. Time complexity is O(1) for Redis
 *   operations, and failures in this function deliberately fall back to version 0 so that version
 *   resolution is never a reason to fail user-visible endpoints or subscription gating flows.
 */
function getUserVersion(email) {
    return __awaiter(this, void 0, void 0, function () {
        var client, raw, ver, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    client = (0, redis_1.getRedis)();
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, client.get((0, cacheKeys_1.userVersionKey)(email))];
                case 2:
                    raw = _b.sent();
                    ver = raw ? Number(raw) : 0;
                    return [2 /*return*/, Number.isFinite(ver) && ver >= 0 ? ver : 0];
                case 3:
                    _a = _b.sent();
                    return [2 /*return*/, 0];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * bumpUserVersion
 * @description
 *   Increment the per-user version counter. Call this immediately after successful Firestore writes
 *   that affect profile/usage/validation semantics. Readers will automatically shift to fresh keys.
 *   Returns the new version for observability. Time complexity is O(1). A failure here is logged
 *   but does not throw, because inability to bump the cache version must not break user flows.
 */
function bumpUserVersion(email) {
    return __awaiter(this, void 0, void 0, function () {
        var client, ver, e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    client = (0, redis_1.getRedis)();
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, client.incr((0, cacheKeys_1.userVersionKey)(email))];
                case 2:
                    ver = _a.sent();
                    console.log('lib/userCache.ts [6603] bumpUserVersion', { email: email, ver: ver });
                    return [2 /*return*/, ver];
                case 3:
                    e_1 = _a.sent();
                    console.warn('lib/userCache.ts [6604] bumpUserVersion failed', { email: email, err: e_1 === null || e_1 === void 0 ? void 0 : e_1.message });
                    return [2 /*return*/, -1];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * cacheReadUserProfile
 * @description
 *   Versioned, read-through cache for a user profile. The caller provides a loader that fetches the
 *   authoritative data (e.g., Firestore read/create). This helper constructs the versioned key and
 *   applies cache-aside with negative-cache protection for nulls. If the cache path fails (for
 *   example due to Redis connectivity issues), the function fails open by invoking the loader
 *   directly, ensuring user profile reads never return 500 purely because the cache is unhealthy.
 */
function cacheReadUserProfile(email, loader) {
    return __awaiter(this, void 0, void 0, function () {
        var ver, key, wrapped, hit, e_2, msg, fresh;
        var _this = this;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, getUserVersion(email)];
                case 1:
                    ver = _b.sent();
                    key = (0, cacheKeys_1.userProfileKey)(ver, email);
                    wrapped = function () { return __awaiter(_this, void 0, void 0, function () {
                        var p;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, loader()];
                                case 1:
                                    p = _a.sent();
                                    // (1.2) On a nullish result, log and propagate a normalized null used for negative caching.
                                    if (!p) {
                                        console.log('lib/userCache.ts [6605] profile loader→NEG', { email: email, ver: ver });
                                        return [2 /*return*/, null];
                                    }
                                    // (1.3) On a successful profile read, log key attributes for observability.
                                    console.log('lib/userCache.ts [6606] profile loader→OK', {
                                        email: email,
                                        ver: ver,
                                        tier: p.subscriptionTier,
                                        acct: p.accountType,
                                    });
                                    // (1.4) Return the strongly typed profile object.
                                    return [2 /*return*/, p];
                            }
                        });
                    }); };
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 4, , 6]);
                    return [4 /*yield*/, (0, cacheAside_1.cacheAside)(key, cachePolicies_1.CACHE_TTL.USER_PROFILE, wrapped, { negativeTtlSec: cachePolicies_1.NEGATIVE_TTL.DEFAULT })];
                case 3:
                    hit = _b.sent();
                    // (2.1) Distinguish between a negative cache hit and a concrete profile.
                    if (hit == null) {
                        console.log('lib/userCache.ts [6607] profile NEG hit', { email: email, ver: ver, key: key });
                    }
                    else {
                        console.log('lib/userCache.ts [6608] profile HIT/SET', { email: email, ver: ver, key: key });
                    }
                    // (2.2) Return the cached or just-loaded value to the caller.
                    return [2 /*return*/, hit];
                case 4:
                    e_2 = _b.sent();
                    msg = (_a = e_2 === null || e_2 === void 0 ? void 0 : e_2.message) !== null && _a !== void 0 ? _a : String(e_2);
                    console.warn('lib/userCache.ts [6609] profile cache path failed, falling back to loader', {
                        email: email,
                        ver: ver,
                        key: key,
                        err: msg,
                    });
                    return [4 /*yield*/, wrapped()];
                case 5:
                    fresh = _b.sent();
                    // (3.2) Return the fresh profile (or null) back to the caller without additional cache attempts.
                    return [2 /*return*/, fresh];
                case 6: return [2 /*return*/];
            }
        });
    });
}
/**
 * cacheReadUserUsage
 * @description
 *   Versioned, read-through cache for a user’s usage snapshot. The caller provides a loader that
 *   reads or creates/migrates the usage document. The function mirrors `cacheReadUserProfile` by
 *   first attempting a cache-aside read and then, on any cache-layer failure (such as Redis timeouts
 *   or network errors), falling back to invoking the loader directly. This guarantees that usage-
 *   dependent flows, including subscription checks and rate limits, continue to function even if
 *   the cache is degraded, while retaining O(1) Redis-time complexity when the cache is healthy.
 */
function cacheReadUserUsage(email, loader) {
    return __awaiter(this, void 0, void 0, function () {
        var ver, key, wrapped, hit, e_3, msg, fresh;
        var _this = this;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, getUserVersion(email)];
                case 1:
                    ver = _b.sent();
                    key = (0, cacheKeys_1.userUsageKey)(ver, email);
                    wrapped = function () { return __awaiter(_this, void 0, void 0, function () {
                        var u;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, loader()];
                                case 1:
                                    u = _a.sent();
                                    // (1.2) When usage is absent, log a negative outcome and propagate null for negative caching.
                                    if (!u) {
                                        console.log('lib/userCache.ts [6611] usage loader→NEG', { email: email, ver: ver });
                                        return [2 /*return*/, null];
                                    }
                                    // (1.3) On a successful usage read, log a concise success event.
                                    console.log('lib/userCache.ts [6612] usage loader→OK', { email: email, ver: ver });
                                    return [2 /*return*/, u];
                            }
                        });
                    }); };
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 4, , 6]);
                    return [4 /*yield*/, (0, cacheAside_1.cacheAside)(key, cachePolicies_1.CACHE_TTL.USER_USAGE, wrapped, { negativeTtlSec: cachePolicies_1.NEGATIVE_TTL.DEFAULT })];
                case 3:
                    hit = _b.sent();
                    // (2.1) Log whether the result came from a negative sentinel or a concrete cached value.
                    if (hit == null) {
                        console.log('lib/userCache.ts [6613] usage NEG hit', { email: email, ver: ver, key: key });
                    }
                    else {
                        console.log('lib/userCache.ts [6614] usage HIT/SET', { email: email, ver: ver, key: key });
                    }
                    // (2.2) Return the cached or just-loaded usage snapshot to the caller.
                    return [2 /*return*/, hit];
                case 4:
                    e_3 = _b.sent();
                    msg = (_a = e_3 === null || e_3 === void 0 ? void 0 : e_3.message) !== null && _a !== void 0 ? _a : String(e_3);
                    console.warn('lib/userCache.ts [6615] usage cache path failed, falling back to loader', {
                        email: email,
                        ver: ver,
                        key: key,
                        err: msg,
                    });
                    return [4 /*yield*/, wrapped()];
                case 5:
                    fresh = _b.sent();
                    // (3.2) Return the freshly loaded usage snapshot (or null) back to the caller.
                    return [2 /*return*/, fresh];
                case 6: return [2 /*return*/];
            }
        });
    });
}
/**
 * readValidationResult
 * @description
 *   Reads a short-lived, composite validation result from Redis for (service,email,ver). This is an
 *   optional micro-cache that helps when multiple requests ask the same question within seconds.
 *   Time complexity is O(1). Any Redis or JSON errors are caught and logged, and the function returns
 *   null so the caller can recompute validation instead of failing, preserving fail-open semantics.
 */
function readValidationResult(service, email, ver) {
    return __awaiter(this, void 0, void 0, function () {
        var client, key, raw, parsed, e_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    client = (0, redis_1.getRedis)();
                    key = (0, cacheKeys_1.validationResultKey)(ver, service, email);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, client.get(key)];
                case 2:
                    raw = _a.sent();
                    if (!raw)
                        return [2 /*return*/, null];
                    parsed = JSON.parse(raw);
                    console.log('lib/userCache.ts [6621] validation HIT', { service: service, email: email, ver: ver });
                    return [2 /*return*/, parsed];
                case 3:
                    e_4 = _a.sent();
                    console.warn('lib/userCache.ts [6622] validation read fail-open', { service: service, email: email, err: e_4 === null || e_4 === void 0 ? void 0 : e_4.message });
                    return [2 /*return*/, null];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * writeValidationResult
 * @description
 *   Stores a composite validation result for a brief period keyed by (service,email,ver).
 *   UPDATED (Phase 2): If the result is a **denial** and a `retryAfter` (seconds) is provided,
 *   we cap the TTL by that value so the cached denial cannot outlive the real wait window.
 *   "Allow" results continue to use the base TTL for performance.
 *
 * Algorithm (serverless-safe):
 *   1) Determine base TTL from policy (CACHE_TTL.VALIDATION_RESULT).
 *   2) If value.allowed === false and a finite value.retryAfter is present:
 *      2.1) ttl = min(baseTTL, retryAfter)
 *   3) If denial but retryAfter is missing/invalid:
 *      3.1) ttl = min(baseTTL, SHORT_DENIAL_TTL)  // defensive fallback (keeps denials short)
 *   4) If allowed:
 *      4.1) ttl = baseTTL
 *   5) Write with SETEX and log the effective ttl.
 */
function writeValidationResult(// update - 2003
service, email, ver, value) {
    return __awaiter(this, void 0, void 0, function () {
        var client, key, baseTtl, SHORT_DENIAL_TTL, ttl, ra, e_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    client = (0, redis_1.getRedis)();
                    key = (0, cacheKeys_1.validationResultKey)(ver, service, email);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    baseTtl = cachePolicies_1.CACHE_TTL.VALIDATION_RESULT;
                    SHORT_DENIAL_TTL = 120;
                    ttl = baseTtl;
                    if (value && value.allowed === false) {
                        ra = Number(value.retryAfter);
                        if (Number.isFinite(ra) && ra > 0) {
                            // Bound by base to avoid excessively long pins and add a floor of 1 second.
                            ttl = Math.max(1, Math.min(baseTtl, Math.floor(ra)));
                        }
                        else {
                            ttl = Math.max(1, Math.min(baseTtl, SHORT_DENIAL_TTL));
                        }
                    }
                    // (4) Persist to Redis
                    return [4 /*yield*/, client.setex(key, ttl, JSON.stringify(value))];
                case 2:
                    // (4) Persist to Redis
                    _a.sent();
                    console.log('lib/userCache.ts [6623] validation SET (Phase 2)', { service: service, email: email, ver: ver, ttl: ttl, allowed: value === null || value === void 0 ? void 0 : value.allowed });
                    return [3 /*break*/, 4];
                case 3:
                    e_5 = _a.sent();
                    console.warn('lib/userCache.ts [6624] validation write failed (non-fatal)', {
                        service: service,
                        email: email,
                        err: e_5 === null || e_5 === void 0 ? void 0 : e_5.message,
                    });
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
