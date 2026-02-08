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
exports.FirestoreFirebaseService = exports.auth = exports.firestore = void 0;
exports.storeDocumentFile = storeDocumentFile;
exports.getObjectGeneration = getObjectGeneration;
exports.loadDocumentFile = loadDocumentFile;
exports.storeFileMetadata = storeFileMetadata;
exports.updateFileMetadata = updateFileMetadata;
exports.addEditor = addEditor;
exports.removeEditor = removeEditor;
exports.listEditors = listEditors;
exports.listUserFiles = listUserFiles;
exports.deleteDocumentFile = deleteDocumentFile;
exports.deleteFileMetadata = deleteFileMetadata;
exports.addToSharedWith = addToSharedWith;
exports.generateUploadUrl = generateUploadUrl;
exports.generateDownloadUrl = generateDownloadUrl;
exports.setPublicEdit = setPublicEdit;
exports.setPublicView = setPublicView;
exports.getAclSnapshotFresh = getAclSnapshotFresh;
exports.getAclSnapshot = getAclSnapshot;
exports.resolveRole = resolveRole;
exports.resolvePaths = resolvePaths;
exports.getLatestFileIdentifiers = getLatestFileIdentifiers;
exports.readDocBytesById = readDocBytesById;
/***************************************************************************************
 * @file firebase.ts
 * @description
 *   Provides functions for managing user data and file storage in Firebase.
 *   This file now includes methods to store, load, and delete document files using
 *   Firebase Storage, as well as functions for managing file metadata in Firestore.
 *
 *   New functions added:
 *     - deleteDocumentFile: Deletes a document file from Firebase Storage.
 *     - deleteUserFileMetadatadata: Deletes the file metadata from Firestore.
 *
 * Responsibilities:
 *   - Initialize Firebase Admin SDK.
 *   - Provide Firestore-based services for user data.
 *   - Provide file storage services to persist, retrieve, and delete document files.
 *   - Provide functions to store, list, and delete file metadata.
 *
 * @author
 * @date
 ***************************************************************************************/
var firebase_admin_1 = require("firebase-admin");
var revocationBus_1 = require("../utils/revocationBus");
var fs = require("fs");
var aclCache_1 = require("./redisCache/aclCache");
if (!process.env.FIREBASE_DATABASE_URL) {
    throw new Error('FIREBASE_DATABASE_URL environment variable is not set.');
}
if (!process.env.FIREBASE_STORAGE_BUCKET) {
    throw new Error('FIREBASE_STORAGE_BUCKET environment variable is not set.');
}
// 2. Validate Service Account Path (Strict Mode)
// We no longer accept the raw JSON string to avoid env var length limits in deployment.
if (!process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_PATH environment variable is not set. Service account must be mounted as a file.');
}
var isBuildPhase = process.env.npm_lifecycle_event === 'build';
// Parse the FIREBASE_SERVICE_ACCOUNT JSON string
var serviceAccount;
try {
    var keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    if (fs.existsSync(keyPath)) {
        // RUNTIME: Volume is mounted, file exists. Load real credentials.
        var rawKey = fs.readFileSync(keyPath, 'utf8');
        serviceAccount = JSON.parse(rawKey);
        console.log('[firebase.ts] Loaded service account from file');
    }
    else if (isBuildPhase) {
        // BUILD TIME: Volume is NOT mounted yet. Use Mock to prevent crash.
        console.warn('[firebase.ts] Build phase detected & key file missing. Using MOCK credentials.');
        serviceAccount = {
            projectId: 'mock-build-project',
            clientEmail: 'build@mock.local',
            privateKey: '-----BEGIN PRIVATE KEY-----\n***REMOVED***\n-----END PRIVATE KEY-----\n',
        };
    }
    else {
        // RUNTIME ERROR: Not building, and file is missing. Crash hard.
        throw new Error("Service account file not found at path: ".concat(keyPath));
    }
}
catch (error) {
    console.error('Failed to load Firebase Service Account:', error);
    throw new Error("Firebase credential error: ".concat(error.message));
}
// Initialize Firebase Admin SDK
if (!firebase_admin_1.default.apps.length) {
    try {
        firebase_admin_1.default.initializeApp({
            credential: firebase_admin_1.default.credential.cert(serviceAccount),
            databaseURL: process.env.FIREBASE_DATABASE_URL,
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        });
        console.log('Firebase initialized successfully');
    }
    catch (error) {
        console.error('Firebase initialization error:', error);
        throw error;
    }
}
exports.firestore = firebase_admin_1.default.firestore();
exports.auth = firebase_admin_1.default.auth();
var bucket = firebase_admin_1.default.storage().bucket(); // Firebase Storage bucket
/**
 * FirestoreFirebaseService implements FirebaseService using Firestore.
 */
var FirestoreFirebaseService = /** @class */ (function () {
    function FirestoreFirebaseService() {
    }
    FirestoreFirebaseService.prototype.storeUserTier = function (userId, tier) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, exports.firestore.collection('users').doc(userId).set({ tier: tier }, { merge: true })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    FirestoreFirebaseService.prototype.getUserTier = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var doc;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, exports.firestore.collection('users').doc(userId).get()];
                    case 1:
                        doc = _b.sent();
                        return [2 /*return*/, doc.exists ? (_a = doc.data()) === null || _a === void 0 ? void 0 : _a.tier : 'free'];
                }
            });
        });
    };
    FirestoreFirebaseService.prototype.storeRefreshToken = function (userId, refreshToken) {
        return __awaiter(this, void 0, void 0, function () {
            var docRef, doc, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 6, , 7]);
                        docRef = exports.firestore.collection('users').doc(userId);
                        return [4 /*yield*/, docRef.get()];
                    case 1:
                        doc = _a.sent();
                        if (!!doc.exists) return [3 /*break*/, 3];
                        return [4 /*yield*/, docRef.set({
                                refreshToken: refreshToken,
                                createdAt: firebase_admin_1.default.firestore.FieldValue.serverTimestamp()
                            })];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 5];
                    case 3: return [4 /*yield*/, docRef.update({
                            refreshToken: refreshToken,
                            updatedAt: firebase_admin_1.default.firestore.FieldValue.serverTimestamp()
                        })];
                    case 4:
                        _a.sent();
                        _a.label = 5;
                    case 5: return [3 /*break*/, 7];
                    case 6:
                        error_1 = _a.sent();
                        console.error('Error storing refresh token:', error_1);
                        throw error_1;
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    FirestoreFirebaseService.prototype.getRefreshToken = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var doc;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, exports.firestore.collection('users').doc(userId).get()];
                    case 1:
                        doc = _b.sent();
                        return [2 /*return*/, doc.exists ? (_a = doc.data()) === null || _a === void 0 ? void 0 : _a.refreshToken : null];
                }
            });
        });
    };
    return FirestoreFirebaseService;
}());
exports.FirestoreFirebaseService = FirestoreFirebaseService;
/**
 * Stores a document file into Firebase Storage.
 * @param fileId - Unique identifier for the file.
 * @param content - Buffer containing the file content.
 * @param metadata - Object containing file metadata (e.g., fileName, docFileID).
 * @returns The file storage identifier (path) upon successful upload.
 */
function storeDocumentFile(fileId, content, metadata) {
    return __awaiter(this, void 0, void 0, function () {
        var destination, file, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    destination = "documents/".concat(fileId, ".bloomdocx");
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    file = bucket.file(destination);
                    return [4 /*yield*/, file.save(content, {
                            metadata: {
                                contentType: 'application/octet-stream',
                                metadata: __assign({ fileName: metadata.fileName, docFileID: metadata.docFileID }, (metadata.version !== undefined ? { version: String(metadata.version) } : {})),
                            },
                        })];
                case 2:
                    _a.sent();
                    console.log("File uploaded successfully to ".concat(destination));
                    return [2 /*return*/, destination];
                case 3:
                    error_2 = _a.sent();
                    console.error('Error storing document file:', error_2);
                    throw error_2;
                case 4: return [2 /*return*/];
            }
        });
    });
}
// app/src/services/firebase.ts  (singleton Admin file; excerpt shows only the new helper)
/**
 *
 * @function getObjectGeneration
 * @description
 *   Reads the current Firebase Storage object metadata for a given path and returns the
 *   object’s generation as a string, or null if it cannot be determined. This helper
 *   centralizes all Storage metadata access behind our Admin singleton to preserve the
 *   project’s initialization pattern and make future backend caching straightforward:
 *   higher layers call one function whose implementation we can later cache or batch.
 *   Time complexity is O(1) for the lookup; network latency dominates in practice.
 */
function getObjectGeneration(path) {
    return __awaiter(this, void 0, void 0, function () {
        var file, meta, gen, e_1;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    file = bucket.file(path);
                    return [4 /*yield*/, file.getMetadata()];
                case 1:
                    meta = (_b.sent())[0];
                    gen = ((_a = meta === null || meta === void 0 ? void 0 : meta.generation) !== null && _a !== void 0 ? _a : null);
                    console.log('firebase.ts [8211] › getObjectGeneration', { path: path, generation: gen });
                    return [2 /*return*/, gen];
                case 2:
                    e_1 = _b.sent();
                    console.warn('firebase.ts [8212] › getObjectGeneration failed (non-fatal)', { path: path, err: e_1 });
                    return [2 /*return*/, null];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Loads a document file from Firebase Storage.
 * @param fileId - The file storage identifier (path) to retrieve.
 * @returns A Buffer containing the file content.
 */
function loadDocumentFile(fileId) {
    return __awaiter(this, void 0, void 0, function () {
        var file, data, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    file = bucket.file(fileId);
                    return [4 /*yield*/, file.download()];
                case 1:
                    data = _a.sent();
                    console.log("File downloaded successfully from ".concat(fileId));
                    return [2 /*return*/, data[0]];
                case 2:
                    error_3 = _a.sent();
                    console.error('Error loading document file:', error_3);
                    throw error_3;
                case 3: return [2 /*return*/];
            }
        });
    });
}
// firebase.ts - Updated storeFileMetadata function
function storeFileMetadata(metadata) {
    return __awaiter(this, void 0, void 0, function () {
        var error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    console.log("[firebase.ts] Storing metadata for file ".concat(metadata.fileId));
                    // Add debug logging to verify lessonUnitsMeta is included
                    if (metadata.lessonUnitsMeta) {
                        console.log("[firebase.ts] Including lesson units metadata with ".concat(metadata.lessonUnitsMeta.totalUnits, " units"));
                        console.log("[firebase.ts] Units by map keys:", Object.keys(metadata.lessonUnitsMeta.unitsByMap));
                    }
                    else {
                        console.log("[firebase.ts] No lesson units metadata to store");
                    }
                    return [4 /*yield*/, exports.firestore.collection('userFiles').doc(metadata.fileId).set(metadata)];
                case 1:
                    _a.sent();
                    console.log("Metadata for file ".concat(metadata.fileId, " stored successfully."));
                    return [3 /*break*/, 3];
                case 2:
                    error_4 = _a.sent();
                    console.error('Error storing file metadata:', error_4);
                    throw error_4;
                case 3: return [2 /*return*/];
            }
        });
    });
}
// firebase.ts - Updated updateFileMetadata function
function updateFileMetadata(params) {
    return __awaiter(this, void 0, void 0, function () {
        var updates;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('firebase.ts 0009 › updateFileMetadata', params);
                    updates = {};
                    if (params.fileName)
                        updates.fileName = params.fileName;
                    if (params.colorCode)
                        updates.colorCode = params.colorCode;
                    if (params.fileStoragePath)
                        updates.fileStoragePath = params.fileStoragePath;
                    if (params.timestamp)
                        updates.timestamp = params.timestamp;
                    if (params.fileSize != null)
                        updates.fileSize = params.fileSize;
                    if (params.contentType)
                        updates.contentType = params.contentType;
                    if (params.isEducatorWorkspace !== undefined)
                        updates.isEducatorWorkspace = params.isEducatorWorkspace;
                    // Add lessonUnitsMeta to updates if provided
                    if (params.lessonUnitsMeta) {
                        updates.lessonUnitsMeta = params.lessonUnitsMeta;
                        console.log('firebase.ts › Including lesson units metadata update with', params.lessonUnitsMeta.totalUnits, 'units');
                    }
                    if (typeof params.version === 'number' && Number.isFinite(params.version)) {
                        updates.version = params.version;
                        console.log('firebase.ts › Including version update:', params.version);
                    }
                    // update - 22: Map new count fields to the Firestore updates object
                    if (typeof params.lessonCount === 'number')
                        updates.lessonCount = params.lessonCount;
                    if (typeof params.cardCount === 'number')
                        updates.cardCount = params.cardCount;
                    if (typeof params.quizCount === 'number')
                        updates.quizCount = params.quizCount;
                    return [4 /*yield*/, exports.firestore
                            .collection('userFiles')
                            .doc(params.fileId)
                            .update(updates)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
// helpers (keep near top of file)
function normEmail(e) {
    return String(e || '').trim().toLowerCase();
}
/**
 * Promote a user to editor.
 * - SSoT: update userFiles/{docId}.editors & .sharedWith
 * - Mirror: upsert documents/{docId}/editors/{email}
 */
function addEditor(docId, userEmail) {
    return __awaiter(this, void 0, void 0, function () {
        var email, ufRef, ver, e_2;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    email = normEmail(userEmail);
                    console.log('firebase.ts › addEditor', { docId: docId, email: email });
                    ufRef = exports.firestore.collection('userFiles').doc(docId);
                    return [4 /*yield*/, exports.firestore.runTransaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                            var snap, data, editors, shared;
                            var _a, _b;
                            return __generator(this, function (_c) {
                                switch (_c.label) {
                                    case 0: return [4 /*yield*/, tx.get(ufRef)];
                                    case 1:
                                        snap = _c.sent();
                                        if (!snap.exists)
                                            throw new Error("userFiles/".concat(docId, " not found"));
                                        data = snap.data();
                                        editors = new Set(((_a = data === null || data === void 0 ? void 0 : data.editors) !== null && _a !== void 0 ? _a : []).map(normEmail));
                                        shared = new Set(((_b = data === null || data === void 0 ? void 0 : data.sharedWith) !== null && _b !== void 0 ? _b : []).map(normEmail));
                                        editors.add(email); // write access
                                        shared.add(email); // all shares superset
                                        tx.update(ufRef, {
                                            editors: Array.from(editors),
                                            sharedWith: Array.from(shared),
                                            updatedAt: firebase_admin_1.default.firestore.FieldValue.serverTimestamp(),
                                            updatedBy: email, // optional: who triggered the change
                                        });
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _a.sent();
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, (0, aclCache_1.bumpAclVersion)(docId)];
                case 3:
                    ver = _a.sent();
                    console.log('firebase.ts [8411] › addEditor bumped ACL version', { docId: docId, ver: ver }); // update - 11
                    return [3 /*break*/, 5];
                case 4:
                    e_2 = _a.sent();
                    console.warn('firebase.ts [8412] › addEditor bumpAclVersion failed (non-fatal)', { docId: docId, err: e_2 }); // update - 11
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    });
}
/**
 * Remove a user's editor rights.
 * - Default: demote to read-only (keeps sharedWith)
 * - If opts.revoke === true: remove entirely from sharedWith too
 * - SSoT: mutate only userFiles/{docId}
 * - Mirror: delete documents/{docId}/editors/{email}
 * - Always publish a targeted revoke to force downgrade of live sockets.
 */
function removeEditor(docId_1, userEmail_1) {
    return __awaiter(this, arguments, void 0, function (docId, userEmail, opts) {
        var email, revoke, ufRef, ver, e_3, e_4;
        var _this = this;
        if (opts === void 0) { opts = {}; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    email = normEmail(userEmail);
                    revoke = Boolean(opts.revoke);
                    console.log('firebase.ts › removeEditor', { docId: docId, email: email, revoke: revoke });
                    ufRef = exports.firestore.collection('userFiles').doc(docId);
                    return [4 /*yield*/, exports.firestore.runTransaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                            var snap, data, owner, editors, shared, update;
                            var _a, _b;
                            return __generator(this, function (_c) {
                                switch (_c.label) {
                                    case 0: return [4 /*yield*/, tx.get(ufRef)];
                                    case 1:
                                        snap = _c.sent();
                                        if (!snap.exists)
                                            return [2 /*return*/];
                                        data = snap.data();
                                        owner = normEmail(data === null || data === void 0 ? void 0 : data.ownerId);
                                        if (email === owner)
                                            throw new Error('Cannot change owner editor status');
                                        editors = new Set(((_a = data === null || data === void 0 ? void 0 : data.editors) !== null && _a !== void 0 ? _a : []).map(normEmail));
                                        shared = new Set(((_b = data === null || data === void 0 ? void 0 : data.sharedWith) !== null && _b !== void 0 ? _b : []).map(normEmail));
                                        editors.delete(email); // remove write
                                        if (revoke)
                                            shared.delete(email); // optionally remove read
                                        update = {
                                            editors: Array.from(editors),
                                            updatedAt: firebase_admin_1.default.firestore.FieldValue.serverTimestamp(),
                                            updatedBy: email,
                                        };
                                        if (revoke)
                                            update.sharedWith = Array.from(shared);
                                        tx.update(ufRef, update);
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _a.sent();
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, (0, aclCache_1.bumpAclVersion)(docId)];
                case 3:
                    ver = _a.sent();
                    console.log('firebase.ts [8421] › removeEditor bumped ACL version', { docId: docId, ver: ver }); // update - 12
                    return [3 /*break*/, 5];
                case 4:
                    e_3 = _a.sent();
                    console.warn('firebase.ts [8422] › removeEditor bumpAclVersion failed (non-fatal)', { docId: docId, err: e_3 }); // update - 12
                    return [3 /*break*/, 5];
                case 5:
                    _a.trys.push([5, 7, , 8]);
                    return [4 /*yield*/, (0, revocationBus_1.publishRevokeUser)(docId, email)];
                case 6:
                    _a.sent(); // this bullshit doesn't work sorry ...
                    return [3 /*break*/, 8];
                case 7:
                    e_4 = _a.sent();
                    console.warn('firebase.ts › publishRevokeUser failed (non-fatal)', e_4);
                    return [3 /*break*/, 8];
                case 8: return [2 /*return*/];
            }
        });
    });
}
/**
 * Return editor list from the SSoT (userFiles).
 * `documents/{docId}/editors` is only a mirror; do not read it here.
 */
function listEditors(docId) {
    return __awaiter(this, void 0, void 0, function () {
        var snap, data, owner, editors;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, exports.firestore.collection('userFiles').doc(docId).get()];
                case 1:
                    snap = _b.sent();
                    data = snap.data();
                    owner = normEmail(data === null || data === void 0 ? void 0 : data.ownerId);
                    editors = ((_a = data === null || data === void 0 ? void 0 : data.editors) !== null && _a !== void 0 ? _a : []).map(normEmail);
                    return [2 /*return*/, { owner: owner, editors: editors }];
            }
        });
    });
}
/**
 * Lists file metadata for a given user.
 * Returns separate arrays for owned and shared files, each ordered by timestamp desc.
 */
function listUserFiles(userEmail) {
    return __awaiter(this, void 0, void 0, function () {
        var normalizedEmail, ownedSnap, sharedSnap, ownedFiles, sharedFiles, filesWithLessonMeta;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('firebase.ts 7001 › listUserFiles called for', userEmail);
                    normalizedEmail = normEmail(userEmail);
                    return [4 /*yield*/, exports.firestore
                            .collection('userFiles')
                            .where('ownerId', '==', userEmail)
                            .orderBy('timestamp', 'desc')
                            .get()];
                case 1:
                    ownedSnap = _a.sent();
                    return [4 /*yield*/, exports.firestore
                            .collection('userFiles')
                            .where('sharedWith', 'array-contains', normalizedEmail)
                            .where('ownerId', '!=', userEmail)
                            .orderBy('ownerId')
                            .orderBy('timestamp', 'desc')
                            .get()];
                case 2:
                    sharedSnap = _a.sent();
                    ownedFiles = ownedSnap.docs.map(function (doc) {
                        var _a, _b;
                        var data = doc.data();
                        return {
                            fileId: doc.id,
                            colorCode: data.colorCode,
                            ownerId: data.ownerId || '',
                            fileName: data.fileName || 'Untitled',
                            fileStoragePath: data.fileStoragePath || '',
                            timestamp: data.timestamp || firebase_admin_1.default.firestore.Timestamp.now(),
                            fileSize: data.fileSize || 0,
                            contentType: data.contentType || 'application/octet-stream',
                            editors: data.editors || [],
                            sharedWith: data.sharedWith || [],
                            publicEdit: data.publicEdit || false,
                            publicView: data.publicView || false,
                            lessonUnitsMeta: data.lessonUnitsMeta || undefined,
                            version: data.version,
                            isEducatorWorkspace: data.isEducatorWorkspace || false,
                            // Computed fields
                            role: 'Owner',
                            updatedAt: data.timestamp
                                ? ((_b = (_a = data.timestamp).toDate) === null || _b === void 0 ? void 0 : _b.call(_a))
                                    ? data.timestamp.toDate().toISOString()
                                    : new Date(data.timestamp).toISOString()
                                : new Date().toISOString()
                        };
                    });
                    sharedFiles = sharedSnap.docs.map(function (doc) {
                        var _a, _b;
                        var data = doc.data();
                        var editors = (data.editors || []).map(function (e) { return normEmail(e); });
                        var isEditor = editors.includes(normalizedEmail);
                        return {
                            fileId: doc.id,
                            ownerId: data.ownerId || '',
                            colorCode: data.colorCode,
                            fileName: data.fileName || 'Untitled',
                            fileStoragePath: data.fileStoragePath || '',
                            timestamp: data.timestamp || firebase_admin_1.default.firestore.Timestamp.now(),
                            fileSize: data.fileSize || 0,
                            contentType: data.contentType || 'application/octet-stream',
                            editors: data.editors || [],
                            sharedWith: data.sharedWith || [],
                            publicEdit: data.publicEdit || false,
                            publicView: data.publicView || false,
                            lessonUnitsMeta: data.lessonUnitsMeta || undefined,
                            version: data.version,
                            isEducatorWorkspace: data.isEducatorWorkspace || false,
                            role: isEditor ? 'Editor' : 'Viewer',
                            updatedAt: data.timestamp
                                ? ((_b = (_a = data.timestamp).toDate) === null || _b === void 0 ? void 0 : _b.call(_a))
                                    ? data.timestamp.toDate().toISOString()
                                    : new Date(data.timestamp).toISOString()
                                : new Date().toISOString()
                        };
                    });
                    filesWithLessonMeta = ownedFiles.filter(function (f) { return f.lessonUnitsMeta; }).length;
                    console.log('firebase.ts 7002 › ownedFiles count', ownedFiles.length);
                    console.log('firebase.ts 7003 › sharedFiles count', sharedFiles.length);
                    console.log('firebase.ts 7002.5 › ownedFiles with lesson metadata', filesWithLessonMeta);
                    return [2 /*return*/, { ownedFiles: ownedFiles, sharedFiles: sharedFiles }];
            }
        });
    });
}
/**
 * Deletes a document file from Firebase Storage.
 * @param fileStorageId - The storage path of the file to be deleted.
 */
function deleteDocumentFile(fileStorageId) {
    return __awaiter(this, void 0, void 0, function () {
        var file, error_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    file = bucket.file(fileStorageId);
                    return [4 /*yield*/, file.delete()];
                case 1:
                    _a.sent();
                    console.log("File ".concat(fileStorageId, " deleted successfully from Firebase Storage."));
                    return [3 /*break*/, 3];
                case 2:
                    error_5 = _a.sent();
                    console.error('Error deleting document file:', error_5);
                    throw error_5;
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Deletes file metadata from Firestore.
 * @param fileId - The file's unique identifier (document id in Firestore).
 */
function deleteFileMetadata(fileId) {
    return __awaiter(this, void 0, void 0, function () {
        var ver, e_5, error_6;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 6, , 7]);
                    return [4 /*yield*/, exports.firestore.collection('userFiles').doc(fileId).delete()];
                case 1:
                    _a.sent();
                    console.log("File metadata for ".concat(fileId, " deleted successfully from Firestore."));
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, (0, aclCache_1.bumpAclVersion)(fileId)];
                case 3:
                    ver = _a.sent();
                    console.log('firebase.ts [8431] › deleteFileMetadata bumped ACL version', { fileId: fileId, ver: ver }); // update - 13
                    return [3 /*break*/, 5];
                case 4:
                    e_5 = _a.sent();
                    console.warn('firebase.ts [8432] › deleteFileMetadata bumpAclVersion failed (non-fatal)', { fileId: fileId, err: e_5 }); // update - 13
                    return [3 /*break*/, 5];
                case 5: return [3 /*break*/, 7];
                case 6:
                    error_6 = _a.sent();
                    console.error('Error deleting file metadata:', error_6);
                    throw error_6;
                case 7: return [2 /*return*/];
            }
        });
    });
}
function addToSharedWith(docId, userEmail) {
    return __awaiter(this, void 0, void 0, function () {
        var email, docRef, ver, e_6;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    email = normEmail(userEmail);
                    docRef = exports.firestore.collection('userFiles').doc(docId);
                    return [4 /*yield*/, docRef.update({
                            sharedWith: firebase_admin_1.default.firestore.FieldValue.arrayUnion(email),
                            updatedAt: firebase_admin_1.default.firestore.FieldValue.serverTimestamp(),
                        })];
                case 1:
                    _a.sent();
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, (0, aclCache_1.bumpAclVersion)(docId)];
                case 3:
                    ver = _a.sent();
                    console.log('firebase.ts [8441] › addToSharedWith bumped ACL version', { docId: docId, ver: ver });
                    return [3 /*break*/, 5];
                case 4:
                    e_6 = _a.sent();
                    console.warn('firebase.ts [8442] › addToSharedWith bumpAclVersion failed (non-fatal)', { docId: docId, err: e_6 });
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    });
}
/**
 * update - 6
 * @function generateUploadUrl
 * @description
 *   Extends the existing upload helper to enforce Phase-3 preconditions for **doc** uploads.
 *   Backward compatible:
 *     - Chat: unchanged behavior.
 *     - Doc without opts: unchanged behavior (just returns a signed PUT URL).
 *     - Doc with `opts.expect*`: compares expectations to the latest identifiers.
 *       • Match  → mints URL and returns `{ ok:true, uploadUrl, path }`
 *       • Mismatch → returns `{ ok:false, conflict:{ path, storageGeneration, versionNumber } }`
 *
 *   Workflow:
 *   1) Compute canonical path via resolvePaths(docId, type, userId).
 *   2) If type==='chat': mint v4 write URL (return legacy shape `{ uploadUrl, path }`).
 *   3) If type==='doc' and no opts provided: mint v4 write URL (legacy behavior).
 *   4) If type==='doc' and opts provided:
 *      4.1) Read latest identifiers via getLatestFileIdentifiers(docId).
 *      4.2) Compare expectations vs latest; on mismatch → return conflict payload.
 *      4.3) On match → mint v4 write URL and return `{ ok:true, uploadUrl, path }`.
 */
function generateUploadUrl(docId, type, opts, userId) {
    return __awaiter(this, void 0, void 0, function () {
        var destination, file_1, uploadUrl_1, latest, sgLatest, vnLatest, sgOk, vnOk, file, uploadUrl;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    destination = resolvePaths(docId, type, userId);
                    if (!(type === 'chat')) return [3 /*break*/, 2];
                    file_1 = bucket.file(destination);
                    return [4 /*yield*/, file_1.getSignedUrl({
                            version: 'v4',
                            action: 'write',
                            expires: Date.now() + 5 * 60 * 1000,
                            contentType: 'application/json',
                        })];
                case 1:
                    uploadUrl_1 = (_a.sent())[0];
                    console.log('firebase.ts [upd-6] › chat uploadUrl generated', { destination: destination });
                    return [2 /*return*/, { uploadUrl: uploadUrl_1, path: destination }];
                case 2: return [4 /*yield*/, getLatestFileIdentifiers(docId)];
                case 3:
                    latest = _a.sent();
                    sgLatest = latest.storageGeneration;
                    vnLatest = latest.versionNumber;
                    sgOk = opts.expectStorageGeneration == null || opts.expectStorageGeneration === sgLatest;
                    vnOk = opts.expectVersionNumber == null || opts.expectVersionNumber === vnLatest;
                    if (!(sgOk && vnOk)) {
                        console.log('firebase.ts [upd-6] › precondition mismatch → conflict', {
                            docId: docId,
                            expected: { sg: opts.expectStorageGeneration, vn: opts.expectVersionNumber },
                            latest: latest,
                        });
                        return [2 /*return*/, {
                                ok: false,
                                conflict: {
                                    path: latest.path,
                                    storageGeneration: sgLatest,
                                    versionNumber: vnLatest,
                                },
                            }];
                    }
                    file = bucket.file(latest.path);
                    return [4 /*yield*/, file.getSignedUrl({
                            version: 'v4',
                            action: 'write',
                            expires: Date.now() + 5 * 60 * 1000,
                            contentType: 'application/octet-stream',
                        })];
                case 4:
                    uploadUrl = (_a.sent())[0];
                    console.log('firebase.ts [upd-6] › preconditions ok → doc uploadUrl minted', {
                        docId: docId,
                        path: latest.path,
                        sgLatest: sgLatest,
                        vnLatest: vnLatest,
                    });
                    return [2 /*return*/, { ok: true, uploadUrl: uploadUrl, path: latest.path }];
            }
        });
    });
}
/**
 * update - 7
 * @function generateDownloadUrl
 * @description
 *   Extends the existing download helper to optionally return identifiers for **doc**
 *   so the client can seed `metadata.persist.*` on open. Backward compatible:
 *     - Without opts or for 'chat' → legacy `{ downloadUrl, path }`.
 *     - With `opts.includeIdentifiers===true` and type==='doc' → also includes
 *       `{ storageGeneration, versionNumber }` in the response.
 *
 *   Workflow:
 *   1) If includeIdentifiers+doc → call getLatestFileIdentifiers(docId) for {path, sg, vn}.
 *   2) Else compute canonical path via resolvePaths(docId, type, userId).
 *   3) Mint v4 read URL for chosen path.
 *   4) Return legacy shape or the extended shape (for doc+identifiers).
 */
function generateDownloadUrl(docId, type, opts, userId) {
    return __awaiter(this, void 0, void 0, function () {
        var path, storageGeneration, versionNumber, latest, file, downloadUrl;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(type === 'doc' && (opts === null || opts === void 0 ? void 0 : opts.includeIdentifiers))) return [3 /*break*/, 2];
                    return [4 /*yield*/, getLatestFileIdentifiers(docId)];
                case 1:
                    latest = _a.sent();
                    path = latest.path;
                    storageGeneration = latest.storageGeneration;
                    versionNumber = latest.versionNumber;
                    return [3 /*break*/, 3];
                case 2:
                    // 2) Canonical path (legacy)
                    path = resolvePaths(docId, type, userId); // update - 7
                    _a.label = 3;
                case 3:
                    file = bucket.file(path);
                    return [4 /*yield*/, file.getSignedUrl({
                            version: 'v4',
                            action: 'read',
                            expires: Date.now() + 5 * 60 * 1000,
                        })];
                case 4:
                    downloadUrl = (_a.sent())[0];
                    // 4) Return appropriate shape
                    if (type === 'doc' && (opts === null || opts === void 0 ? void 0 : opts.includeIdentifiers)) {
                        console.log('firebase.ts [upd-7] › doc downloadUrl+ids generated', {
                            docId: docId,
                            path: path,
                            storageGeneration: storageGeneration,
                            versionNumber: versionNumber,
                        });
                        return [2 /*return*/, { downloadUrl: downloadUrl, path: path, storageGeneration: storageGeneration !== null && storageGeneration !== void 0 ? storageGeneration : null, versionNumber: versionNumber !== null && versionNumber !== void 0 ? versionNumber : null }];
                    }
                    console.log('firebase.ts [upd-7] › downloadUrl generated', { type: type, docId: docId, path: path });
                    return [2 /*return*/, { downloadUrl: downloadUrl, path: path }];
            }
        });
    });
}
/**
 * @function setPublicEdit
 * @description
 *   Sets the `publicEdit` flag on the document root under `documents/{docId}`. If the
 *   value transitions from `true` to `false`, we immediately publish a **revoke all
 *   non-owner** message so the Yjs server disconnects every non-owner with close code
 *   4003. This enables “instant revoke” semantics when owners turn off anyone-can-edit.
 *   Reads the prior flag to detect transitions, writes the new value, and logs both
 *   sides for observability without emitting noisy, redundant logs.
 */
function setPublicEdit(docId, enabled) {
    return __awaiter(this, void 0, void 0, function () {
        var docRef, snap, was, ver, e_7, e_8;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log('firebase.ts [8037] › setPublicEdit start', { docId: docId, enabled: enabled });
                    docRef = exports.firestore.collection('userFiles').doc(docId);
                    return [4 /*yield*/, docRef.get()];
                case 1:
                    snap = _b.sent();
                    was = Boolean((_a = snap.data()) === null || _a === void 0 ? void 0 : _a.publicEdit);
                    return [4 /*yield*/, docRef.set({ publicEdit: enabled }, { merge: true })];
                case 2:
                    _b.sent();
                    console.log('firebase.ts [8038] › setPublicEdit write ok', { docId: docId, was: was, now: enabled });
                    _b.label = 3;
                case 3:
                    _b.trys.push([3, 5, , 6]);
                    return [4 /*yield*/, (0, aclCache_1.bumpAclVersion)(docId)];
                case 4:
                    ver = _b.sent();
                    console.log('firebase.ts [8451] › setPublicEdit bumped ACL version', { docId: docId, ver: ver }); // update - 15
                    return [3 /*break*/, 6];
                case 5:
                    e_7 = _b.sent();
                    console.warn('firebase.ts [8452] › setPublicEdit bumpAclVersion failed (non-fatal)', { docId: docId, err: e_7 }); // update - 15
                    return [3 /*break*/, 6];
                case 6:
                    if (!(was && !enabled)) return [3 /*break*/, 10];
                    _b.label = 7;
                case 7:
                    _b.trys.push([7, 9, , 10]);
                    return [4 /*yield*/, (0, revocationBus_1.publishRevokeAllNonOwner)(docId)];
                case 8:
                    _b.sent();
                    console.log('firebase.ts [8039] › publishRevokeAllNonOwner done', { docId: docId });
                    return [3 /*break*/, 10];
                case 9:
                    e_8 = _b.sent();
                    // Non-fatal: new sockets will be denied, existing ones will be dropped on token refresh.
                    console.warn('firebase.ts [8097] › publishRevokeAllNonOwner failed (non-fatal)', e_8);
                    return [3 /*break*/, 10];
                case 10: return [2 /*return*/];
            }
        });
    });
}
/**
 * @function setPublicView
 * @description
 *   Sets the `publicView` flag on the document root under `documents/{docId}`. This does
 *   not trigger revocations because read-only sockets remain safe and do not mutate the
 *   shared state. We still log the old and new values for debugging and change tracking.
 */
function setPublicView(docId, enabled) {
    return __awaiter(this, void 0, void 0, function () {
        var docRef, snap, was, ver, e_9;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log('firebase.ts [8040] › setPublicView start', { docId: docId, enabled: enabled });
                    docRef = exports.firestore.collection('userFiles').doc(docId);
                    return [4 /*yield*/, docRef.get()];
                case 1:
                    snap = _b.sent();
                    was = Boolean((_a = snap.data()) === null || _a === void 0 ? void 0 : _a.publicView);
                    return [4 /*yield*/, docRef.set({ publicView: enabled }, { merge: true })];
                case 2:
                    _b.sent();
                    console.log('firebase.ts [8041] › setPublicView write ok', { docId: docId, was: was, now: enabled });
                    _b.label = 3;
                case 3:
                    _b.trys.push([3, 5, , 6]);
                    return [4 /*yield*/, (0, aclCache_1.bumpAclVersion)(docId)];
                case 4:
                    ver = _b.sent();
                    console.log('firebase.ts [8461] › setPublicView bumped ACL version', { docId: docId, ver: ver }); // update - 16
                    return [3 /*break*/, 6];
                case 5:
                    e_9 = _b.sent();
                    console.warn('firebase.ts [8462] › setPublicView bumpAclVersion failed (non-fatal)', { docId: docId, err: e_9 }); // update - 16
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/];
            }
        });
    });
}
/**
 * update - 9
 * @function _loadAclSnapshotFromFirestore
 * @description
 *   Internal helper that performs the authoritative Firestore read and normalization for the ACL
 *   snapshot shape. This is passed to the cache layer as the loader function. It never touches
 *   Redis directly to avoid circular dependencies and keep read logic testable in isolation.
 */
function _loadAclSnapshotFromFirestore(docId) {
    return __awaiter(this, void 0, void 0, function () {
        var ref, snap, data, ownerId, editors, sharedWith, publicEdit, publicView;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    ref = exports.firestore.collection('userFiles').doc(docId);
                    return [4 /*yield*/, ref.get()];
                case 1:
                    snap = _c.sent();
                    if (!snap.exists) {
                        console.log('firebase.ts [4101] › _loadAclSnapshotFromFirestore: doc not found', { docId: docId }); // update - 9
                        return [2 /*return*/, {
                                docExists: false,
                                ownerId: '',
                                editors: [],
                                sharedWith: [],
                                publicEdit: false,
                                publicView: false,
                            }];
                    }
                    data = snap.data();
                    ownerId = normEmail(data === null || data === void 0 ? void 0 : data.ownerId);
                    editors = ((_a = data === null || data === void 0 ? void 0 : data.editors) !== null && _a !== void 0 ? _a : []).map(normEmail);
                    sharedWith = ((_b = data === null || data === void 0 ? void 0 : data.sharedWith) !== null && _b !== void 0 ? _b : []).map(normEmail);
                    publicEdit = Boolean(data === null || data === void 0 ? void 0 : data.publicEdit);
                    publicView = Boolean(data === null || data === void 0 ? void 0 : data.publicView);
                    console.log('firebase.ts [4102] › _loadAclSnapshotFromFirestore ok', {
                        docId: docId,
                        ownerId: ownerId,
                        editorsCount: editors.length,
                        sharedCount: sharedWith.length,
                        publicEdit: publicEdit,
                        publicView: publicView
                    });
                    return [2 /*return*/, { docExists: true, ownerId: ownerId, editors: editors, sharedWith: sharedWith, publicEdit: publicEdit, publicView: publicView }];
            }
        });
    });
}
function getAclSnapshotFresh(docId) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            // Call the authoritative Firestore loader directly, bypassing Redis.
            return [2 /*return*/, _loadAclSnapshotFromFirestore(docId)];
        });
    });
}
/**
 * update - 10
 * @function getAclSnapshot
 * @description
 *   Returns a normalized ACL snapshot using a versioned, Redis-backed cache-aside flow. The loader
 *   is the authoritative Firestore read `_loadAclSnapshotFromFirestore`. Negative results (“doc not
 *   found”) are short-lived to avoid storms. Firestore remains the source of truth.
 */
function getAclSnapshot(docId) {
    return __awaiter(this, void 0, void 0, function () {
        var snap;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, aclCache_1.readAclSnapshot)(docId, function () { return _loadAclSnapshotFromFirestore(docId); })];
                case 1:
                    snap = _a.sent();
                    return [2 /*return*/, (snap !== null && snap !== void 0 ? snap : {
                            docExists: false, ownerId: '', editors: [], sharedWith: [], publicEdit: false, publicView: false
                        })];
            }
        });
    });
}
/**
 * @function resolveRole
 * @description
 *   Convert an ACL snapshot + caller’s email into an effective role. If the doc
 *   doesn’t exist, returns 'None'. If `publicEdit` is true, treat all users as
 *   'Editor'. Otherwise: owner → 'Owner'; listed editor → 'Editor'; publicView or
 *   sharedWith → 'Viewer'; else 'None'. Routes may then decide read/write policy.
 */
function resolveRole(docId, email, snapshot) {
    return __awaiter(this, void 0, void 0, function () {
        var who, compute, role;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    who = normEmail(email);
                    compute = function () { return __awaiter(_this, void 0, void 0, function () {
                        var snap, _a;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    if (!(snapshot !== null && snapshot !== void 0)) return [3 /*break*/, 1];
                                    _a = snapshot;
                                    return [3 /*break*/, 3];
                                case 1: return [4 /*yield*/, getAclSnapshot(docId)];
                                case 2:
                                    _a = (_b.sent());
                                    _b.label = 3;
                                case 3:
                                    snap = _a;
                                    if (!snap.docExists)
                                        return [2 /*return*/, 'None'];
                                    if (who === snap.ownerId)
                                        return [2 /*return*/, 'Owner'];
                                    if (snap.publicEdit)
                                        return [2 /*return*/, 'Editor'];
                                    if (snap.editors.includes(who))
                                        return [2 /*return*/, 'Editor'];
                                    if (snap.publicView)
                                        return [2 /*return*/, 'Viewer'];
                                    if (snap.sharedWith.includes(who))
                                        return [2 /*return*/, 'Viewer'];
                                    return [2 /*return*/, 'None'];
                            }
                        });
                    }); };
                    return [4 /*yield*/, (0, aclCache_1.readRole)(docId, who, compute)];
                case 1:
                    role = _a.sent();
                    return [2 /*return*/, role]; // update - 17
            }
        });
    });
}
/**
 * update - 2
 * @function resolvePaths
 * @description
 *   Canonical path resolver for GCS objects.
 *   Returns the exact bucket path for a given doc/chat artifact so every caller
 *   computes paths consistently (eliminates scattered string assembly).
 *
 *   Workflow:
 *   1) Validate inputs (docId always; userId required for 'chat').
 *   2) For 'doc' → return `documents/{docId}.bloomdocx`.
 *   3) For 'chat' → return `documents/{docId}/privateChats/{userId}.chat.json`.
 *   4) Log a single concise line for observability.
 */
function resolvePaths(docId, type, userId) {
    // 1) Validate inputs
    if (!docId || typeof docId !== 'string') {
        throw new Error('resolvePaths: invalid docId');
    }
    if (type === 'chat' && !userId) {
        throw new Error('resolvePaths: userId required for chat path');
    }
    // 2/3) Compute canonical path
    var path = type === 'doc'
        ? "documents/".concat(docId, ".bloomdocx")
        : "documents/".concat(docId, "/privateChats/").concat(userId, ".chat.json");
    // 4) Log (low-noise)
    console.log('firebase.ts [upd-2] › resolvePaths', { type: type, docId: docId, userId: !!userId, path: path });
    return path;
}
/**
 * update - 3
 * @function getLatestFileIdentifiers
 * @description
 *   Single source of truth for persistence identifiers used by Phase 3:
 *   returns the canonical doc path, current Storage generation, and Firestore
 *   logical version in *one* atomic helper (cache-friendly later).
 *
 *   Workflow:
 *   1) Resolve canonical doc path via resolvePaths(docId, 'doc').
 *   2) Read Storage object metadata → extract `generation` (string|null).
 *   3) Read Firestore `userFiles/{docId}.version` → coerce to number|null.
 *   4) Log a concise line and return `{ path, storageGeneration, versionNumber }`.
 */
function getLatestFileIdentifiers(docId) {
    return __awaiter(this, void 0, void 0, function () {
        var path, storageGeneration, meta, e_10, versionNumber, snap, raw, e_11;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    path = resolvePaths(docId, 'doc');
                    storageGeneration = null;
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, bucket.file(path).getMetadata()];
                case 2:
                    meta = (_c.sent())[0];
                    storageGeneration = ((_a = meta === null || meta === void 0 ? void 0 : meta.generation) !== null && _a !== void 0 ? _a : null);
                    return [3 /*break*/, 4];
                case 3:
                    e_10 = _c.sent();
                    console.warn('firebase.ts [upd-3] › storage generation read failed (non-fatal)', { docId: docId, path: path, err: e_10 });
                    return [3 /*break*/, 4];
                case 4:
                    versionNumber = null;
                    _c.label = 5;
                case 5:
                    _c.trys.push([5, 7, , 8]);
                    return [4 /*yield*/, exports.firestore.collection('userFiles').doc(docId).get()];
                case 6:
                    snap = _c.sent();
                    raw = snap.exists ? (_b = snap.data()) === null || _b === void 0 ? void 0 : _b.version : null;
                    if (typeof raw === 'number' && Number.isFinite(raw)) {
                        versionNumber = raw;
                    }
                    else if (typeof raw === 'string' && raw.trim() !== '' && !Number.isNaN(Number(raw))) {
                        versionNumber = Number(raw);
                    }
                    else {
                        versionNumber = null;
                    }
                    return [3 /*break*/, 8];
                case 7:
                    e_11 = _c.sent();
                    console.warn('firebase.ts [upd-3] › version read failed (non-fatal)', { docId: docId, err: e_11 });
                    return [3 /*break*/, 8];
                case 8:
                    // 4) Return identifiers
                    console.log('firebase.ts [upd-3] › getLatestFileIdentifiers', { docId: docId, path: path, storageGeneration: storageGeneration, versionNumber: versionNumber });
                    return [2 /*return*/, { path: path, storageGeneration: storageGeneration, versionNumber: versionNumber }];
            }
        });
    });
}
/**
 * update - 18
 * @function readDocBytesById
 * @description
 *   Resolves the canonical Storage path for a document’s Y.Doc by its persistent id and downloads
 *   the raw bytes using the Admin SDK helper `loadDocumentFile`. This consolidates IO and path
 *   logic in one place so service-layer code (e.g., lesson extraction, AI) can stay pure and testable.
 *   Returns a Uint8Array for zero-copy downstream use. Time complexity is O(1); network dominates.
 */
function readDocBytesById(docId) {
    return __awaiter(this, void 0, void 0, function () {
        var path, buf;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    path = resolvePaths(docId, 'doc');
                    return [4 /*yield*/, loadDocumentFile(path)];
                case 1:
                    buf = _b.sent();
                    console.log('firebase.ts 8511 › readDocBytesById', { docId: docId, path: path, byteLength: (_a = buf === null || buf === void 0 ? void 0 : buf.length) !== null && _a !== void 0 ? _a : 0 }); // update - 18
                    return [2 /*return*/, new Uint8Array(buf)]; // update - 18
            }
        });
    });
}
