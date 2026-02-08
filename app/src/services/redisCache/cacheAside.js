"use strict";
// lib/cacheAside.ts
/***************************************************************************************************
 * @file lib/cacheAside.ts
 * @description
 *   Generic, JSON-based cache-aside helper with dogpile protection and optional negative caching.
 *   Callers provide a fully formed key (see cacheKeys.ts), a TTL, and a loader function that fetches
 *   authoritative data from the system of record (e.g., Firestore). The helper will:
 *     (1) Attempt a GET; on hit, JSON-decode and return immediately.
 *     (2) On miss, attempt to take a short NX lock to avoid thundering herds.
 *         • If lock acquired → run loader → SETEX; store a short-lived sentinel on null.
 *         • If lock not acquired → briefly backoff and re-GET a few times; fail-open to loader.
 *   Serialization is stable JSON; the null sentinel is `{ __nc: true }`. All operations are O(1).
 *
 * Responsibilities:
 *   - Provide consistent cache-aside behavior with minimal boilerplate at call sites.
 *   - Enforce short lock-based herd protection for high-QPS hot keys.
 *   - Support negative caching to protect backends from repeated misses.
 *   - Keep logging concise and actionable with unique trace codes.
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
exports.cacheAside = cacheAside;
var redis_1 = require("./redis");
var cachePolicies_1 = require("./cachePolicies");
var NULL_SENTINEL = { __nc: true };
function sleep(ms) {
    return new Promise(function (r) { return setTimeout(r, ms); });
}
/**
 * cacheAside
 * @description
 *   Core cache-aside implementation. Provides a fast-path GET, an anti-dogpile lock, and safe
 *   JSON serialization. If the loader yields null/undefined, a negative-cache sentinel is written
 *   with a short TTL to prevent request storms on missing resources. Time complexity is O(1) for
 *   Redis operations; loader complexity is application-specific. Logs capture hit/miss/lock cases.
 */
function cacheAside(key_1, ttlSec_1, loader_1) {
    return __awaiter(this, arguments, void 0, function (key, ttlSec, loader, opts) {
        var client, _a, negativeTtlSec, _b, skipCache, _c, serialize, _d, deserialize, _e, lockTtlSec, _f, lockRetryMs, _g, lockRetryMax, fresh, cached, parsed, lockKey, gotLock, fresh, ttl, i, again, parsed, fallback;
        if (opts === void 0) { opts = {}; }
        return __generator(this, function (_h) {
            switch (_h.label) {
                case 0:
                    client = (0, redis_1.getRedis)();
                    _a = opts.negativeTtlSec, negativeTtlSec = _a === void 0 ? cachePolicies_1.NEGATIVE_TTL.DEFAULT : _a, _b = opts.skipCache, skipCache = _b === void 0 ? false : _b, _c = opts.serialize, serialize = _c === void 0 ? JSON.stringify : _c, _d = opts.deserialize, deserialize = _d === void 0 ? JSON.parse : _d, _e = opts.lockTtlSec, lockTtlSec = _e === void 0 ? 10 : _e, _f = opts.lockRetryMs, lockRetryMs = _f === void 0 ? 25 : _f, _g = opts.lockRetryMax, lockRetryMax = _g === void 0 ? 6 : _g;
                    if (!skipCache) return [3 /*break*/, 2];
                    console.log('lib/cacheAside.ts [4111] skipCache=true', { key: key });
                    return [4 /*yield*/, loader()];
                case 1:
                    fresh = _h.sent();
                    return [2 /*return*/, fresh !== null && fresh !== void 0 ? fresh : null];
                case 2: return [4 /*yield*/, client.get(key)];
                case 3:
                    cached = _h.sent();
                    if (cached != null) {
                        try {
                            parsed = deserialize(cached);
                            if (parsed && typeof parsed === 'object' && parsed.__nc === true) {
                                console.log('lib/cacheAside.ts [4112] hit NEG', { key: key });
                                return [2 /*return*/, null];
                            }
                            console.log('lib/cacheAside.ts [4113] hit', { key: key });
                            return [2 /*return*/, parsed];
                        }
                        catch (e) {
                            console.warn('lib/cacheAside.ts [4114] parse error; treating as miss', { key: key, err: e === null || e === void 0 ? void 0 : e.message });
                        }
                    }
                    lockKey = "".concat(key, ":lock");
                    return [4 /*yield*/, client.set(lockKey, '1', 'EX', lockTtlSec, 'NX')];
                case 4:
                    gotLock = _h.sent();
                    if (!(gotLock === 'OK')) return [3 /*break*/, 12];
                    _h.label = 5;
                case 5:
                    _h.trys.push([5, , 11, 12]);
                    return [4 /*yield*/, loader()];
                case 6:
                    fresh = _h.sent();
                    ttl = (0, cachePolicies_1.addJitter)(ttlSec);
                    if (!(fresh == null)) return [3 /*break*/, 8];
                    return [4 /*yield*/, client.setex(key, Math.max(1, negativeTtlSec), JSON.stringify(NULL_SENTINEL))];
                case 7:
                    _h.sent();
                    console.log('lib/cacheAside.ts [4116] miss→load→NEG set', { key: key });
                    return [2 /*return*/, null];
                case 8: return [4 /*yield*/, client.setex(key, ttl, serialize(fresh))];
                case 9:
                    _h.sent();
                    console.log('lib/cacheAside.ts [4117] miss→load→SET', { key: key, ttl: ttl });
                    return [2 /*return*/, fresh];
                case 10: return [3 /*break*/, 12];
                case 11: return [7 /*endfinally*/];
                case 12:
                    i = 0;
                    _h.label = 13;
                case 13:
                    if (!(i < lockRetryMax)) return [3 /*break*/, 17];
                    return [4 /*yield*/, sleep(lockRetryMs)];
                case 14:
                    _h.sent();
                    return [4 /*yield*/, client.get(key)];
                case 15:
                    again = _h.sent();
                    if (again != null) {
                        try {
                            parsed = deserialize(again);
                            if (parsed && typeof parsed === 'object' && parsed.__nc === true) {
                                console.log('lib/cacheAside.ts [4119] follower NEG', { key: key, i: i });
                                return [2 /*return*/, null];
                            }
                            console.log('lib/cacheAside.ts [4120] follower hit', { key: key, i: i });
                            return [2 /*return*/, parsed];
                        }
                        catch (_j) {
                            // ignore and continue
                        }
                    }
                    _h.label = 16;
                case 16:
                    i++;
                    return [3 /*break*/, 13];
                case 17:
                    console.log('lib/cacheAside.ts [4121] miss→follower fail-open loader', { key: key });
                    return [4 /*yield*/, loader()];
                case 18:
                    fallback = _h.sent();
                    return [2 /*return*/, fallback !== null && fallback !== void 0 ? fallback : null];
            }
        });
    });
}
