"use strict";
/***************************************************************************************
 * @file app/src/infra/revocationBus.ts
 * @description
 *   Lightweight publisher that tells the Yjs server to revoke live collaboration access.
 *   Instead of opening a Redis client from serverless Next.js (which adds cost and cold
 *   starts), we POST to the Yjs container’s `/revoke` endpoint. The Yjs server then
 *   (1) closes local sockets immediately and (2) publishes to Redis (if configured) so
 *   other replicas do the same. This keeps Next.js stateless and cheap.
 *
 *   Required env:
 *     - YJS_REVOKE_URL  (e.g., http://yjs-server:1234 or public URL)
 *     - YJS_REVOKE_KEY  (shared secret; validated by Yjs server)
 *
 *   Use from admin actions after you change ACL in Firestore:
 *     await publishRevokeUser(docId, uid);
 *     await publishRevokeAllNonOwner(docId);
 ***************************************************************************************/
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
exports.publishRevokeUser = publishRevokeUser;
exports.publishRevokeAllNonOwner = publishRevokeAllNonOwner;
var YJS_REVOKE_URL = process.env.YJS_REVOKE_URL;
var YJS_REVOKE_KEY = process.env.YJS_REVOKE_KEY;
/**
 * @function publishRevokeUser
 * @description
 *   Requests the Yjs server to disconnect a specific user from a given document. The
 *   server immediately closes local sockets and (if Redis is configured) fans out the
 *   message to other replicas. This is safe to call from a serverless route handler
 *   right after Firestore ACL writes; no state is kept in Next.js between invocations.
 */
function publishRevokeUser(docId, uid) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('[revocationBus.ts][3501] › publishRevokeUser', { docId: docId, uid: uid });
                    return [4 /*yield*/, callRevoke({ type: 'user', docId: docId, uid: uid })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * @function publishRevokeAllNonOwner
 * @description
 *   Requests the Yjs server to disconnect everyone except owners for a document (used
 *   when publicEdit is turned off or editors are bulk-removed). The Yjs server closes
 *   local sockets and publishes to other replicas if Redis is present.
 */
function publishRevokeAllNonOwner(docId) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('[revocationBus.ts][3502] › publishRevokeAllNonOwner', { docId: docId });
                    return [4 /*yield*/, callRevoke({ type: 'all_non_owner', docId: docId })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function callRevoke(body) {
    return __awaiter(this, void 0, void 0, function () {
        var resp, text;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!YJS_REVOKE_URL || !YJS_REVOKE_KEY) {
                        console.warn('[revocationBus.ts][3590] › revoke disabled (missing env)');
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, fetch("".concat(YJS_REVOKE_URL, "/revoke"), {
                            method: 'POST',
                            headers: {
                                'content-type': 'application/json',
                                'x-api-key': YJS_REVOKE_KEY,
                            },
                            body: JSON.stringify(body),
                        })];
                case 1:
                    resp = _a.sent();
                    if (!!resp.ok) return [3 /*break*/, 3];
                    return [4 /*yield*/, resp.text().catch(function () { return ''; })];
                case 2:
                    text = _a.sent();
                    console.error('[revocationBus.ts][3599] › revoke HTTP error', resp.status, text);
                    _a.label = 3;
                case 3: return [2 /*return*/];
            }
        });
    });
}
