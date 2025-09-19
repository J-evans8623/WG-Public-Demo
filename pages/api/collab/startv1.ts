/***********************************************************************************************
 * @file pages/api/collab/startv1.ts
 * @description
 *   Role-aware collaboration token issuer for Bloom-Maps that provides secure JWT authentication
 *   for real-time Yjs collaboration sessions. This endpoint authenticates users via NextAuth,
 *   resolves their effective document permissions through the centralized access control system,
 *   and mints short-lived RS256 JWT tokens containing role information for the Yjs WebSocket server.
 *   The system supports all three sharing modes defined in the PRD: private editor lists, public
 *   view-only access, and public collaborative editing. The endpoint enforces proper access control
 *   by checking document ownership, explicit editor permissions, and public access flags to determine
 *   the appropriate collaboration role. Users without at least viewer permissions are denied access
 *   with machine-readable error codes, while editors and owners receive tokens that enable real-time
 *   document collaboration through the Yjs server infrastructure.
 *
 * Responsibilities:
 *   - Authenticate requests using NextAuth session validation
 *   - Validate document ID parameters and ensure proper input sanitization
 *   - Resolve user permissions using the unified access control system including public flags
 *   - Generate RS256 JWT tokens with appropriate role claims for Yjs server authentication
 *   - Handle ownership privilege escalation and auto-editor assignment for document owners
 *   - Provide detailed logging for debugging collaboration access issues
 *   - Return standardized error responses for unauthorized or malformed requests
 ***********************************************************************************************/

import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { resolveRole, addEditor } from '@/app/src/services/firebase';

/**
 * @function handler
 * @description
 *   Main request handler for collaboration token generation that authenticates users,
 *   resolves their document access permissions, and issues JWT tokens for Yjs server
 *   authentication. The function validates session credentials, checks document access
 *   rights including public sharing flags, and generates role-appropriate tokens that
 *   enable real-time collaborative editing through the WebSocket infrastructure.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  //console.log('pages/api/collab/startv1.ts [6001] › Request received', { method: req.method, url: req.url });

  // Step 1: Validate HTTP method
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.setHeader('Cache-Control', 'no-store');
    //console.log('pages/api/collab/startv1.ts [6002] › Method not allowed', { method: req.method });
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Step 2: Authenticate user session
  const session = await authenticateRequest(req as any, res as any);
  if (!session) {
    //console.log('pages/api/collab/startv1.ts [6003] › Authentication failed - no session');
    return; // authenticateRequest already responded
  }

  const email = session.user?.email?.toLowerCase() || '';
  if (!email) {
    //console.log('pages/api/collab/startv1.ts [6004] › Authentication failed - no email in session');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(401).json({ error: 'No email in session' });
  }

  // Step 3: Validate document ID parameter
  const docId = Array.isArray(req.query.doc) ? req.query.doc[0] : req.query.doc;
  if (!docId || typeof docId !== 'string') {
    //console.log('pages/api/collab/startv1.ts [6005] › Invalid request - missing doc parameter');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(400).json({ error: 'Missing doc parameter' });
  }

  try {
    // Step 4: Resolve user role using unified access control system
    //console.log('pages/api/collab/startv1.ts [6006] › Resolving user role for collaboration', { docId, email });
    
    const userRole = await resolveRole(docId, email);
    /****console.log('pages/api/collab/startv1.ts [6007] › Role resolution complete', { 
      docId, 
      email,
      resolvedRole: userRole
    });***/

    // Step 5: Block access for users without any document permissions
    if (userRole === 'None') {
      /**console.log('pages/api/collab/startv1.ts [6008] › Access denied - no document permissions', { 
        docId, 
        email, 
        role: userRole 
      });*/
      res.setHeader('Cache-Control', 'no-store');
      return res.status(403).json({ error: 'Access denied' });
    }

    // Step 6: Block collaboration for read-only users
    if (userRole === 'Viewer') {
      /*console.log('pages/api/collab/startv1.ts [6009] › Access denied - read-only permissions', { 
        docId, 
        email, 
        role: userRole 
      });*/
      res.setHeader('Cache-Control', 'no-store');
      return res.status(403).json({ error: 'Read-only access - collaboration not permitted' });
    }

    // Step 7: Auto-add document owners to editors list to prevent lockout
    if (userRole === 'Owner') {
      try {
        await addEditor(docId, email);
        //console.log('pages/api/collab/startv1.ts [6010] › Owner auto-added to editors list', { docId, email });
      } catch (err) {
        console.warn('pages/api/collab/startv1.ts [6011] › Failed to auto-add owner to editors (non-fatal)', { 
          docId, 
          email, 
          error: err instanceof Error ? err.message : 'Unknown error'
        });
      }
    }

    // Step 8: Determine Yjs server role mapping
    const yjsRole: 'owner' | 'editor' = userRole === 'Owner' ? 'owner' : 'editor';

    /*console.log('pages/api/collab/startv1.ts [6012] › Authorization successful for collaboration', {
      docId,
      email,
      accessControlRole: userRole,
      yjsServerRole: yjsRole
    });*/

    // Step 9: Load RSA private key for JWT signing
    const rawPath = process.env.JWT_PRIVATE_PATH;
    if (!rawPath) {
      console.error('pages/api/collab/startv1.ts [6091] › Server misconfiguration - JWT_PRIVATE_PATH not set');
      res.setHeader('Cache-Control', 'no-store');
      return res.status(500).json({ error: 'Server misconfiguration' });
    }

    const keyPath = path.isAbsolute(rawPath) ? rawPath : path.join(process.cwd(), rawPath);
    if (!fs.existsSync(keyPath)) {
      console.error('pages/api/collab/startv1.ts [6092] › Server misconfiguration - private key file missing', { keyPath });
      res.setHeader('Cache-Control', 'no-store');
      return res.status(500).json({ error: 'Server misconfiguration' });
    }

    //console.log('pages/api/collab/startv1.ts [6013] › Loading private key for JWT signing', { keyPath });
    const privateKey = fs.readFileSync(keyPath, 'utf8');
    const privateKeyPreview = privateKey.substring(0, 100);
    //console.log('pages/api/collab/startv1.ts [6014] › Private key loaded successfully', { preview: privateKeyPreview });

    // Step 10: Generate JWT token with role claims for Yjs server
    const expiresIn = 15 * 60; // 15 minutes in seconds
    const roles = [yjsRole]; // Array format for Yjs server compatibility
    
    const token = jwt.sign(
      { 
        sub: email, 
        doc: docId, 
        roles, 
      },
      privateKey,
      { algorithm: 'RS256', expiresIn }
    );

   /***  console.log('pages/api/collab/startv1.ts [6015] › JWT token generated successfully', { 
      docId, 
      email, 
      role: yjsRole, 
      expiresIn,
      tokenLength: token.length
    });*/

    // Step 11: Perform self-verification test of generated token
    try {
      const testPublicKey = fs.readFileSync('./app/src/services/yjs/keys/jwt_2025.pub', 'utf8');
      const testPayload = jwt.verify(token, testPublicKey, { algorithms: ['RS256'] });
      //console.lo('pages/api/collab/startv1.ts [6016] › Token self-verification successful', { payload: testPayload });
    } catch (err) {
      console.error('pages/api/collab/startv1.ts [6093] › Token self-verification failed', { 
        error: err instanceof Error ? err.message : 'Unknown error'
      });
    }

    // Step 12: Return successful response with collaboration token
    res.setHeader('Cache-Control', 'no-store, private, max-age=0');
    //console.lo('pages/api/collab/startv1.ts [6017] › Collaboration token issued successfully', { docId, email, role: yjsRole });
    console.log(`Calling api/collab/startv1.ts 44887 ${Date.now()}`)
    return res.status(200).json({ token, role: yjsRole, expiresIn });

  } catch (err: any) {
    console.error('pages/api/collab/startv1.ts [6099] › Unexpected error during token generation', { 
      docId, 
      email, 
      error: err.message,
      stack: err.stack 
    });
    
    res.setHeader('Cache-Control', 'no-store');
    
    return res.status(500).json({ error: 'Internal server error' });
  }
}