"use strict";
// lib/cachePolicies.ts
/***************************************************************************************************
 * @file lib/cachePolicies.ts
 * @description
 *   Single source of truth for TTL (time-to-live) and SWR (stale-while-revalidate) values used by the
 *   caching layer. Centralizing these values prevents "magic numbers" scattered across the codebase
 *   and enables fast tuning via a single module. The values here are intentionally conservative, with
 *   short TTLs for authorization-sensitive data (ACL posture and roles) and slightly longer TTLs for
 *   slower-moving user profile details. Negative-cache TTLs are deliberately brief to avoid masking
 *   recently created data. All units are seconds. Changing these values is a non-breaking operation.
 *
 * Responsibilities:
 *   - Export cache TTLs and SWR durations per data class (ACL, roles, user profile, usage).
 *   - Provide negative-cache TTLs used when loaders return null/missing.
 *   - Offer tiny jitter helpers to avoid cache stampedes from synchronized expirations.
 ***************************************************************************************************/
Object.defineProperty(exports, "__esModule", { value: true });
exports.NEGATIVE_TTL = exports.SWR_TTL = exports.CACHE_TTL = void 0;
exports.addJitter = addJitter;
exports.CACHE_TTL = {
    ACL_SNAPSHOT: 1800, // seconds
    ROLE_RESULT: 1800, // seconds
    USER_PROFILE: 1800, // seconds
    USER_USAGE: 3600, // seconds
    VALIDATION_RESULT: 1800, // seconds (optional composite micro-cache)
    DOC_BYTES: 7200, // update - 1 › 2 hours for Y.Doc bytes (generation-aware)
};
exports.SWR_TTL = {
    ACL_SNAPSHOT: 15,
    ROLE_RESULT: 10,
    USER_PROFILE: 30,
    USER_USAGE: 10,
    VALIDATION_RESULT: 10,
};
exports.NEGATIVE_TTL = {
    DEFAULT: 15, // short-lived "not found" protection
};
/**
 * addJitter
 * @description
 *   Adds a small, bounded jitter (±10%) to a TTL to reduce synchronized expirations across requests
 *   that start at the same time. The function is O(1). Callers typically use this when setting keys.
 */
function addJitter(ttlSec) {
    var span = Math.max(1, Math.floor(ttlSec * 0.1));
    var delta = Math.floor(Math.random() * (span * 2 + 1)) - span;
    return Math.max(1, ttlSec + delta);
}
