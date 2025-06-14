// pages/api/collab/ws.ts

/**
 * @file pages/api/collab/ws.ts
 * @responsibility
 *   • Handle WebSocket “upgrade” on /api/collab/ws.
 *   • Enforce session auth and Firestore ACL (editors/{uid} in documents/{docId}).
 *   • Mint a 30-second JWT: { sub, doc, roles:['editor'] }.
 *   • Proxy the upgrade to the Yjs server, injecting Sec-WebSocket-Protocol.
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { IncomingMessage, Server as HTTPServer } from 'http';
import { Socket } from 'net';
import httpProxy from 'http-proxy';
import jwt from 'jsonwebtoken';
import admin from 'firebase-admin';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';

if (!admin.apps.length) admin.initializeApp();
const firestore = admin.firestore();

export const config = {
  api: { bodyParser: false, externalResolver: true },
};

const proxy = httpProxy.createProxyServer({
  target: 'http://yjs-server:1234',
  ws: true,
  changeOrigin: true,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const socket = (res.socket as any);
  if (!socket?.server) {
    res.status(500).end('Server socket unavailable');
    return;
  }
  const server = socket.server as HTTPServer & { hasWsProxy?: boolean };

  if (!server.hasWsProxy) {
    server.hasWsProxy = true;
    server.on('upgrade', async (request: IncomingMessage, sock: Socket, head: Buffer) => {
      if (!request.url?.startsWith('/api/collab/ws')) {
        sock.destroy();
        return;
      }

      // 1) Session authentication
      const session = await authenticateRequest(request as any, res as any);
      if (!session) {
        sock.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        sock.destroy();
        return;
      }
      const uid = session.user.email;

      // 2) Extract and validate docId
      const url = new URL(request.url, 'http://localhost');
      const docId = url.searchParams.get('doc');
      if (!docId) {
        sock.write('HTTP/1.1 400 Bad Request\r\n\r\n');
        sock.destroy();
        return;
      }

      // 3) ACL check: must have an editor doc
      const editorSnap = await firestore
        .collection('documents')
        .doc(docId)
        .collection('editors')
        .doc(uid)
        .get();
      if (!editorSnap.exists) {
        sock.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        sock.destroy();
        return;
      }

      // 4) Mint short-lived JWT for Yjs server
      const token = jwt.sign(
        { sub: uid, doc: docId, roles: ['editor'] },
        process.env.AUTH_PRIVATE_KEY!,
        { algorithm: 'RS256', expiresIn: '30s' }
      );

      // 5) Rewrite headers & path, then proxy WS
      request.headers['sec-websocket-protocol'] = token;
      request.url = `/yjs/${docId}`;
      proxy.ws(request as any, sock, head);
    });
  }

  res.status(200).end();
}
