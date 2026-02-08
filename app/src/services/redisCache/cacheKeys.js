"use strict";
// lib/cacheKeys.ts
/***************************************************************************************************
 * @file lib/cacheKeys.ts
 * @description
 *   Canonical key-builder utilities for the cache and rate-gate layers. Keys are structured with
 *   human-readable namespaces so operational debugging is straightforward (i.e., being able to
 *   spot families of keys with a simple SCAN-like inspection in dev). Versioned keys are supported
 *   by embedding monotonically increasing version numbers in the name; write operations only need
 *   to increment the version counter, and readers automatically shift to the fresh names. This makes
 *   invalidation O(1) regardless of how many reader keys exist. All functions are O(1) string ops.
 *
 * Responsibilities:
 *   - Provide strongly-typed, collision-resistant key strings for each data class.
 *   - Encode versioned semantics directly into the key structure.
 *   - Include helpers for rate gates (fixed window and token bucket).
 ***************************************************************************************************/
Object.defineProperty(exports, "__esModule", { value: true });
exports.docBytesKey = exports.gateTokenBucketKey = exports.gateFixedWindowKey = exports.validationResultKey = exports.userUsageKey = exports.userProfileKey = exports.userVersionKey = exports.roleKey = exports.aclSnapshotKey = exports.aclVersionKey = void 0;
function normId(s) { return String(s || '').trim().toLowerCase(); }
// 1) ACL version/cached data -----------------------------------------------------------------------
var aclVersionKey = function (docId) { return "acl:v:".concat(normId(docId)); };
exports.aclVersionKey = aclVersionKey;
var aclSnapshotKey = function (ver, docId) {
    return "acl:snap:".concat(ver, ":").concat(normId(docId));
};
exports.aclSnapshotKey = aclSnapshotKey;
var roleKey = function (ver, docId, email) {
    return "role:".concat(ver, ":").concat(normId(docId), ":").concat(normId(email));
};
exports.roleKey = roleKey;
// 2) User version/cached data ----------------------------------------------------------------------
var userVersionKey = function (email) { return "user:v:".concat(normId(email)); };
exports.userVersionKey = userVersionKey;
var userProfileKey = function (ver, email) {
    return "user:profile:".concat(ver, ":").concat(normId(email));
};
exports.userProfileKey = userProfileKey;
var userUsageKey = function (ver, email) {
    return "user:usage:".concat(ver, ":").concat(normId(email));
};
exports.userUsageKey = userUsageKey;
var validationResultKey = function (ver, service, email) {
    return "user:validation:".concat(normId(service), ":").concat(ver, ":").concat(normId(email));
};
exports.validationResultKey = validationResultKey;
// 3) Rate gate keys --------------------------------------------------------------------------------
var gateFixedWindowKey = function (service, subject, windowEpochSec, windowSec) {
    return "gate:fw:".concat(normId(service), ":").concat(normId(subject), ":").concat(windowEpochSec, "-").concat(windowSec);
};
exports.gateFixedWindowKey = gateFixedWindowKey;
var gateTokenBucketKey = function (service, subject) {
    return "gate:tb:".concat(normId(service), ":").concat(normId(subject));
};
exports.gateTokenBucketKey = gateTokenBucketKey;
var docBytesKey = function (docId, gen) {
    // update - 1
    return "doc:bytes:".concat(normId(docId), ":").concat(String(gen));
};
exports.docBytesKey = docBytesKey;
