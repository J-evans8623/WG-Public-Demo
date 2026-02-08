"use strict";
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
exports.getRedis = getRedis;
exports.pingRedis = pingRedis;
// bloom-maps/app/src/services/redisCache/redis.ts
var ioredis_1 = require("ioredis");
// -----------------------------------------------------------------------------
// GLOBAL SINGLETON PATTERN
// This prevents Next.js from creating multiple connections during
// hot-reloading or serverless function warm-ups.
// -----------------------------------------------------------------------------
var globalForRedis = global;
function getRedis() {
    // 1. Check Global Scope first
    if (globalForRedis.bloomRedis) {
        return globalForRedis.bloomRedis;
    }
    // 2. Safe Configuration Extraction (Prevents NaN)
    var _a = process.env, REDIS_URL = _a.REDIS_URL, _b = _a.REDIS_HOST, REDIS_HOST = _b === void 0 ? '127.0.0.1' : _b, _c = _a.REDIS_PORT, REDIS_PORT = _c === void 0 ? '6379' : _c, REDIS_PASSWORD = _a.REDIS_PASSWORD, REDIS_TLS = _a.REDIS_TLS, REDIS_CONNECT_TIMEOUT_MS = _a.REDIS_CONNECT_TIMEOUT_MS, REDIS_COMMAND_TIMEOUT_MS = _a.REDIS_COMMAND_TIMEOUT_MS;
    // Use explicit fallbacks so we never pass NaN
    var connectTimeout = REDIS_CONNECT_TIMEOUT_MS ? Number(REDIS_CONNECT_TIMEOUT_MS) : 10000; // 10s
    var commandTimeout = REDIS_COMMAND_TIMEOUT_MS ? Number(REDIS_COMMAND_TIMEOUT_MS) : 5000; // 5s
    // 3. Define Options
    var commonOpts = {
        // FORCE IPv4: This matches your docker-compose fix and ensures
        // the internal client options are aligned.
        family: 4,
        lazyConnect: false,
        enableReadyCheck: true,
        connectTimeout: connectTimeout,
        commandTimeout: commandTimeout,
        // CRITICAL: Keep commands in memory if Redis is briefly down (e.g. BGSAVE)
        // failing immediately causes the "Command Timed Out" errors you saw.
        enableOfflineQueue: true,
        // CRITICAL: Retry Strategy
        // We NEVER return null (which kills the client). We just back off.
        maxRetriesPerRequest: null, // Let retryStrategy handle it
        retryStrategy: function (times) {
            // Exponential backoff: 50, 100, 200... capped at 3 seconds
            // We keep retrying forever because a server needs its DB.
            var delay = Math.min(times * 50, 3000);
            return delay;
        },
    };
    var client;
    if (REDIS_URL) {
        // Note: Since you added ?family=4 to your connection string in Docker,
        // that will take precedence, but we merge options just in case.
        var isTls = REDIS_URL.startsWith('rediss://');
        client = new ioredis_1.default(REDIS_URL, __assign(__assign({}, commonOpts), { tls: isTls ? {} : undefined }));
    }
    else {
        client = new ioredis_1.default(__assign(__assign({}, commonOpts), { host: REDIS_HOST, port: Number(REDIS_PORT), password: REDIS_PASSWORD || undefined, tls: REDIS_TLS === 'true' ? {} : undefined }));
    }
    // 4. Lifecycle Logs
    client.on('connect', function () { return console.log('✅ [Redis] Connection initializing...'); });
    client.on('ready', function () { return console.log('🚀 [Redis] Client Ready (IPv4)'); });
    client.on('close', function () { return console.warn('⚠️ [Redis] Connection Closed'); });
    client.on('reconnecting', function (t) { return console.log("\uD83D\uDD04 [Redis] Reconnecting in ".concat(t, "ms...")); });
    // Handling the "error" event is mandatory to prevent node process exit
    client.on('error', function (err) {
        // Suppress the "ECONNREFUSED" spam logs slightly, but log critical failures
        console.error('❌ [Redis] Error:', err.message);
    });
    // 5. Save to Global
    if (process.env.NODE_ENV !== 'production') {
        globalForRedis.bloomRedis = client;
    }
    else {
        // In production, we also want to cache it, but usually the process 
        // management is more stable. We assign it here too to be safe 
        // against multiple imports.
        globalForRedis.bloomRedis = client;
    }
    return client;
}
/**
 * Health Check
 */
function pingRedis() {
    return __awaiter(this, void 0, void 0, function () {
        var client, res, e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    client = getRedis();
                    return [4 /*yield*/, Promise.race([
                            client.ping(),
                            new Promise(function (_, reject) { return setTimeout(function () { return reject(new Error('Ping timeout')); }, 1000); })
                        ])];
                case 1:
                    res = _a.sent();
                    return [2 /*return*/, res === 'PONG'];
                case 2:
                    e_1 = _a.sent();
                    console.warn('⚠️ [Redis] Ping Failed:', e_1);
                    return [2 /*return*/, false];
                case 3: return [2 /*return*/];
            }
        });
    });
}
