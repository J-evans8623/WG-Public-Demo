"use strict";
// lib/aclCache.ts
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
exports.getAclVersion = getAclVersion;
exports.bumpAclVersion = bumpAclVersion;
exports.readAclSnapshot = readAclSnapshot;
exports.readRole = readRole;
var redis_1 = require("./redis");
var cacheAside_1 = require("./cacheAside");
var cachePolicies_1 = require("./cachePolicies");
var cacheKeys_1 = require("./cacheKeys");
/**
 * getAclVersion
 * @description
 *   Returns the current ACL version for a document. If no version exists yet, falls back to 0 so
 *   the first bump moves 0→1. This read is O(1) and cheap; the value is inserted into cache keys
 *   for precise invalidation. On Redis errors, the function logs a warning and returns 0, ensuring
 *   that version resolution never causes ACL checks to fail and instead gracefully degrades caching.
 */
function getAclVersion(docId) {
    return __awaiter(this, void 0, void 0, function () {
        var client, v, ver, safe, e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    client = (0, redis_1.getRedis)();
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, client.get((0, cacheKeys_1.aclVersionKey)(docId))];
                case 2:
                    v = _a.sent();
                    ver = v ? Number(v) : 0;
                    safe = Number.isFinite(ver) && ver >= 0 ? ver : 0;
                    // (3) Log the resolved version for observability, then return the safe value.
                    console.log('lib/aclCache.ts [6401] getAclVersion', { docId: docId, ver: safe });
                    return [2 /*return*/, safe];
                case 3:
                    e_1 = _a.sent();
                    // (4) Fail-open: log the error and return 0 so ACL consumers keep working without versioning.
                    console.warn('lib/aclCache.ts [6400] getAclVersion fail-open', {
                        docId: docId,
                        err: e_1 === null || e_1 === void 0 ? void 0 : e_1.message,
                    });
                    return [2 /*return*/, 0];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * bumpAclVersion
 * @description
 *   Atomically increments the ACL version for a document. Writers call this **after** a successful
 *   Firestore mutation that changes public flags or editor lists. Readers automatically shift to
 *   fresh keys on their next request since the version is embedded in cache key names. Increments
 *   remain O(1) operations against Redis; any errors propagate so callers can decide whether failed
 *   version bumps should influence their own error handling or be treated as non-fatal conditions.
 */
function bumpAclVersion(docId) {
    return __awaiter(this, void 0, void 0, function () {
        var client, key, ver;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    client = (0, redis_1.getRedis)();
                    key = (0, cacheKeys_1.aclVersionKey)(docId);
                    return [4 /*yield*/, client.incr(key)];
                case 1:
                    ver = _a.sent();
                    console.log('lib/aclCache.ts [6402] bumpAclVersion', { docId: docId, key: key, ver: ver });
                    return [2 /*return*/, ver];
            }
        });
    });
}
/**
 * readAclSnapshot
 * @description
 *   Returns a normalized ACL snapshot for a document via a cache-aside flow. Callers must supply
 *   a loader that reads Firestore and returns the canonical shape. Negative caching is applied on
 *   “missing doc” responses to suppress storms; TTLs are defined in cachePolicies. If the cache
 *   path fails (for example, due to Redis outages or serialization errors), this helper logs the
 *   failure and **fails open** by invoking the Firestore loader directly, ensuring ACL checks still
 *   operate correctly even when the cache is unavailable or intermittently misbehaving.
 */
function readAclSnapshot(// update - 22
docId, loader) {
    return __awaiter(this, void 0, void 0, function () {
        var ver, key, wrapped, hit, e_2, msg, fresh;
        var _this = this;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, getAclVersion(docId)];
                case 1:
                    ver = _b.sent();
                    key = (0, cacheKeys_1.aclSnapshotKey)(ver, docId);
                    wrapped = function () { return __awaiter(_this, void 0, void 0, function () {
                        var snap;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, loader()];
                                case 1:
                                    snap = _a.sent();
                                    // (2.2) When the loader returns null, treat as a negative-cache candidate.
                                    if (!snap) {
                                        console.log('lib/aclCache.ts [6404] snapshot loader→NEG', { docId: docId, ver: ver });
                                        return [2 /*return*/, null];
                                    }
                                    // (2.3) On a concrete snapshot, log high-level ACL posture for observability.
                                    console.log('lib/aclCache.ts [6405] snapshot loader→OK', {
                                        docId: docId,
                                        ver: ver,
                                        ownerId: snap.ownerId,
                                        editorsCount: snap.editors.length,
                                        sharedCount: snap.sharedWith.length,
                                        publicEdit: snap.publicEdit,
                                        publicView: snap.publicView,
                                    });
                                    return [2 /*return*/, snap];
                            }
                        });
                    }); };
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 4, , 6]);
                    return [4 /*yield*/, (0, cacheAside_1.cacheAside)(key, cachePolicies_1.CACHE_TTL.ACL_SNAPSHOT, wrapped, { negativeTtlSec: cachePolicies_1.NEGATIVE_TTL.DEFAULT })];
                case 3:
                    hit = _b.sent();
                    // (3.1) Log whether we hit a negative sentinel or a concrete cached snapshot.
                    if (hit == null) {
                        console.log('lib/aclCache.ts [6406] snapshot NEG hit', { docId: docId, ver: ver, key: key });
                    }
                    else {
                        console.log('lib/aclCache.ts [6407] snapshot HIT/SET', { docId: docId, ver: ver, key: key });
                    }
                    // (3.2) Return the cached/loaded snapshot to the caller.
                    return [2 /*return*/, hit];
                case 4:
                    e_2 = _b.sent();
                    msg = (_a = e_2 === null || e_2 === void 0 ? void 0 : e_2.message) !== null && _a !== void 0 ? _a : String(e_2);
                    console.warn('lib/aclCache.ts [6408] snapshot cache path failed, falling back to loader', {
                        docId: docId,
                        ver: ver,
                        key: key,
                        err: msg,
                    });
                    return [4 /*yield*/, wrapped()];
                case 5:
                    fresh = _b.sent();
                    // (4.2) Return the fresh snapshot (or null) as the best-effort ACL view.
                    return [2 /*return*/, fresh];
                case 6: return [2 /*return*/];
            }
        });
    });
}
/**
 * readRole
 * @description
 *   Returns an effective role (Owner/Editor/Viewer/None) for (docId, email) derived from the
 *   current ACL version. Callers provide a compute function that deterministically maps an
 *   ACL snapshot plus email to a Role. Roles are cached briefly to cut recomputation. If the
 *   cache path fails due to Redis or serialization issues, the helper logs the failure and
 *   falls back to the compute function directly, ensuring ACL-based access decisions remain
 *   correct even when the cache is unhealthy, while keeping Redis operations O(1) when present.
 */
function readRole(// update - 23
docId, email, compute) {
    return __awaiter(this, void 0, void 0, function () {
        var ver, key, wrapped, role, finalRole, e_3, msg, fresh, finalRole;
        var _this = this;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, getAclVersion(docId)];
                case 1:
                    ver = _b.sent();
                    key = (0, cacheKeys_1.roleKey)(ver, docId, email);
                    wrapped = function () { return __awaiter(_this, void 0, void 0, function () {
                        var r;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, compute()];
                                case 1:
                                    r = _a.sent();
                                    // (2.2) Log the computed role for observability.
                                    console.log('lib/aclCache.ts [6409] role compute→OK', { docId: docId, email: email, ver: ver, role: r });
                                    return [2 /*return*/, r];
                            }
                        });
                    }); };
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 4, , 6]);
                    return [4 /*yield*/, (0, cacheAside_1.cacheAside)(key, cachePolicies_1.CACHE_TTL.ROLE_RESULT, wrapped, { negativeTtlSec: cachePolicies_1.NEGATIVE_TTL.DEFAULT })];
                case 3:
                    role = _b.sent();
                    finalRole = (role !== null && role !== void 0 ? role : 'None');
                    console.log('lib/aclCache.ts [6403] readRole', { docId: docId, email: email, role: finalRole, ver: ver });
                    return [2 /*return*/, finalRole];
                case 4:
                    e_3 = _b.sent();
                    msg = (_a = e_3 === null || e_3 === void 0 ? void 0 : e_3.message) !== null && _a !== void 0 ? _a : String(e_3);
                    console.warn('lib/aclCache.ts [6410] role cache path failed, falling back to compute', {
                        docId: docId,
                        email: email,
                        ver: ver,
                        key: key,
                        err: msg,
                    });
                    return [4 /*yield*/, wrapped()];
                case 5:
                    fresh = _b.sent();
                    finalRole = (fresh !== null && fresh !== void 0 ? fresh : 'None');
                    console.log('lib/aclCache.ts [6411] readRole fallback', { docId: docId, email: email, role: finalRole, ver: ver });
                    return [2 /*return*/, finalRole];
                case 6: return [2 /*return*/];
            }
        });
    });
}
