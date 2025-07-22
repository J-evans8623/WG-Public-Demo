/**
 * @file pages/api/collab/ws/[docId].ts
 * @description
 *   • Handle WebSocket “upgrade” on /api/collab/ws/<docId>.
 *   • Authenticate via NextAuth session OR fallback to share-link JWT (bm_collab cookie).
 *   • Enforce Firestore ACL: documents/{docId}/editors/{uid}.
 *   • Mint a 30-second RS256 JWT for Yjs server.
 *   • Proxy the WS connection to the Yjs server at /yjs/<docId>.
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { IncomingMessage, Server as HTTPServer } from 'http';
import { Socket } from 'net';
import httpProxy from 'http-proxy';
import jwt from 'jsonwebtoken';
import admin from 'firebase-admin';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { parse } from 'cookie';

if (!admin.apps.length) {
  console.log(' 3443 ws.ts Initializing Firebase Admin');
  admin.initializeApp();
}
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
  console.log(' 3443 ws.ts handler called for URL:', req.url);

  const sockWrapper = (res.socket as any);
  if (!sockWrapper?.server) {
    console.log(' 3443 ws.ts No socket.server available');
    res.status(500).end('Server socket unavailable');
    return;
  }
  const server = sockWrapper.server as HTTPServer & { hasWsProxy?: boolean };

  if (!server.hasWsProxy) {
    console.log(' 3443 ws.ts Setting up upgrade handler');
    server.hasWsProxy = true;

    server.on('upgrade', async (request: IncomingMessage, sock: Socket, head: Buffer) => {
      console.log(' 3443 ws.ts upgrade event:', request.url);

      // Matches /api/collab/ws/<docId>
      const match = request.url?.match(/^\/api\/collab\/ws\/([^\/\?]+)/);
      if (!match) {
        console.log(' 3443 ws.ts Not our route, destroying socket');
        sock.destroy();
        return;
      }
      const docId = decodeURIComponent(match[1]);
      console.log(' 3443 ws.ts docId =', docId);

      let uid: string | null = null;

      // 1) NextAuth
      const session = await authenticateRequest(request as any, res as any);
      if (session) {
        uid = session.user.email!;
        console.log(' 3443 ws.ts Authenticated (NextAuth) as', uid);
      } else {
        // 2) bm_collab cookie
        const cookies = parse(request.headers.cookie || '');
        const shareToken = cookies['bm_collab'];
        if (!shareToken) {
          console.log(' 3443 ws.ts Missing bm_collab, 401');
          sock.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          sock.destroy();
          return;
        }
        let payload: any;
        try {
          payload = jwt.verify(shareToken, process.env.SHARE_TOKEN_SECRET!, { algorithms: ['HS256'] });
        } catch {
          console.log(' 3443 ws.ts Invalid shareToken, 401');
          sock.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          sock.destroy();
          return;
        }
        if (payload.doc !== docId || !Array.isArray(payload.roles) || !payload.roles.includes('editor')) {
          console.log(' 3443 ws.ts ACL mismatch, 403', payload);
          sock.write('HTTP/1.1 403 Forbidden\r\n\r\n');
          sock.destroy();
          return;
        }
        uid = payload.sub;
        console.log(' 3443 ws.ts Authenticated (shareToken) as', uid);
      }

      // 3) Firestore ACL
      const editorDoc = await firestore
        .collection('documents')
        .doc(docId)
        .collection('editors')
        .doc(uid || 'guest')
        .get();
      if (!editorDoc.exists) {
        console.log(' 3443 ws.ts Firestore ACL reject, 403');
        sock.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        sock.destroy();
        return;
      }

      // 4) Mint RS256 for Yjs
      const yjsJwt = jwt.sign(
        { sub: uid, doc: docId, roles: ['editor'] },
        process.env.AUTH_PRIVATE_KEY!,
        { algorithm: 'RS256', expiresIn: '30s' }
      );
      console.log(' 3443 ws.ts Minted Yjs JWT');

      // 5) Inject and rewrite
      request.headers['sec-websocket-protocol'] = yjsJwt as any;
      request.url = `/yjs/${encodeURIComponent(docId)}`;
      console.log(' 3443 ws.ts Proxied path =', request.url);

      // 6) Proxy to Yjs server
      proxy.ws(request as any, sock, head);
    });
  }

  // Non-upgrade HTTP GET/POST
  console.log(' 3443 ws.ts Regular HTTP, 200');
  res.status(200).end();
}
