/**
 * @file yjs-server/authorizeCollab.js
 * @responsibility
 *   • Verify JWT from Sec-WebSocket-Protocol header.
 *   • Confirm token’s "doc" claim matches the requested docId.
 *   • Confirm token’s "roles" array contains "editor".
 *   • Check in Firestore that the userId (sub) is listed under documents/{docId}/editors.
 *   • Return the authenticated userId for use in WebSocket context.
 */

const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');
const config = require('./config');

// Ensure Firebase Admin initialized elsewhere (e.g. in your server.js)
const firestore = admin.firestore();

/**
 * Validate and authorize a Yjs WebSocket JWT.
 *
 * @param {string} token  The raw JWT string from Sec-WebSocket-Protocol.
 * @param {string} docId  The Yjs document ID extracted from the URL.
 * @returns {Promise<string>}  Resolves to the authenticated userId.
 * @throws on any JWT or ACL failure.
 */
async function authorizeCollab(token, docId) {
  let payload;
  try {
    payload = jwt.verify(token, config.authPublicKey, {
      algorithms: ['RS256'],
      issuer: config.authIssuer
    });
  } catch (err) {
    throw new Error(`JWT verification failed: ${err.message}`);
  }

  if (payload.doc !== docId) {
    throw new Error(`Document mismatch: token for ${payload.doc}, requested ${docId}`);
  }

  const roles = Array.isArray(payload.roles) ? payload.roles : [];
  if (!roles.includes('editor')) {
    throw new Error('Missing required role: editor');
  }

  const editorSnap = await firestore
    .doc(`documents/${docId}/editors/${payload.sub}`)
    .get();
  if (!editorSnap.exists) {
    throw new Error(`User ${payload.sub} is not an editor for doc ${docId}`);
  }

  return payload.sub;
}

module.exports = { authorizeCollab };
