/**
 * @file app/src/rate-np/withRateLimitNP.ts
 * @responsibility
 *   Next.js wrapper that enforces NP limits using user-centric identity by default.
 *   This version proactively resolves the authenticated user **before** running the
 *   rate gate by decoding the NextAuth JWT (no DB calls), preventing accidental
 *   scoping to "user:anon". If a policy ever selects 'ip' or 'user+ip', the IP
 *   is read from standard reverse-proxy headers; current policies use **'user'** only.
 *
 * Implementation notes (step-by-step):
 *   1) Extract client IP in a proxy-aware manner (getIp).
 *   2) Resolve a stable user ID/email without touching databases (resolveUserId):
 *      2.1) Try NextAuth's getToken() to decode the JWT from cookies/headers.
 *      2.2) Fallback to explicit headers (x-user-id/x-user-email) for S2S calls.
 *      2.3) Fallback to any pre-attached req.session.user if the app set it earlier.
 *   3) Build the "subject" key for Redis based on the policy identity mode
 *      (buildSubjectWithProvidedUser).
 *   4) Run the multi-window rate gate; if blocked, respond 429 with Retry-After.
 *   5) If allowed, invoke the wrapped handler.
 */

import type { NextApiHandler, NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { getPolicy } from './policies';
import { runGate } from './rateGuardNP';
import type { IdentityMode } from './types';

/**
 * @function getIp
 * @purpose
 *   Resolve client IP in a proxy-aware way (not used by current policies).
 * @steps
 *   1) Read X-Forwarded-For and take the first IP.
 *   2) Fallback to socket.remoteAddress.
 *   3) Default to "0.0.0.0" if missing (diagnostic).
 */
function getIp(req: NextApiRequest): string {
  const xf = (req.headers['x-forwarded-for'] as string) || '';
  const ip = xf.split(',')[0]?.trim() || (req.socket as any)?.remoteAddress || '0.0.0.0';
  return ip;
}

/**
 * @function resolveUserId
 * @purpose
 *   Resolve a stable user identity (email or subject) **before** rate limiting,
 *   avoiding "user:anon" when the wrapper runs prior to auth handlers.
 * @steps
 *   1) Attempt to decode the NextAuth JWT using getToken() (no DB call).
 *   2) If present, prefer token.email; fallback to token.sub.
 *   3) If no token, check explicit headers (x-user-id / x-user-email).
 *   4) As a last resort, check any pre-attached req.session.user.
 *   5) Always normalize to lowercase and trim.
 */
async function resolveUserId(req: NextApiRequest, res: NextApiResponse): Promise<string | undefined> {
  // 1) Try NextAuth JWT decode (cheap, cookie + crypto only)
  try {
    // Detect whether cookies are secure; in production behind HTTPS this should be true.
    const xfProto = (req.headers['x-forwarded-proto'] as string) || 'http';
    const secureCookie = process.env.NODE_ENV === 'production' ? (xfProto === 'https') : false;

    // Use secret from authOptions (if set) or NEXTAUTH_SECRET env var
    const secret = (authOptions as any)?.secret || process.env.NEXTAUTH_SECRET;

    const token = await getToken({ req, secureCookie, secret });
    const fromToken = ((token?.email as string) || (token?.sub as string) || '').trim().toLowerCase();
    if (fromToken) return fromToken;
  } catch (e) {
    // Deliberately swallow to allow fallbacks below; logging here would be noisy per request.
  }

  // 2) Headers fallback (S2S and testing convenience)
  const fromHeader =
    ((req.headers['x-user-id'] as string) || (req.headers['x-user-email'] as string) || '').trim().toLowerCase();
  if (fromHeader) return fromHeader;

  // 3) Optional: if upstream attached a session object on the request
  const sessUser: any = (req as any)?.session?.user || {};
  const fromSession = ((sessUser.id || sessUser.uid || sessUser.email || '') as string).trim().toLowerCase();
  if (fromSession) return fromSession;

  // 4) Nothing resolved
  return undefined;
}

/**
 * @function buildSubjectWithProvidedUser
 * @purpose
 *   Build the Redis subject key according to the chosen identity mode, using the
 *   resolved user ID when available.
 * @steps
 *   1) For identity 'user' → "user:<idOrEmail>" (fallback "user:anon").
 *   2) For identity 'ip' → "ip:<ip>".
 *   3) For identity 'user+ip' → "user:<idOrEmail>|ip:<ip>" (fallback to "user:anon").
 */
function buildSubjectWithProvidedUser(req: NextApiRequest, mode: IdentityMode, user?: string): string {
  const ip = getIp(req);
  if (mode === 'user') return `user:${user || 'anon'}`;
  if (mode === 'ip') return `ip:${ip}`;
  const who = user ? `user:${user}` : 'user:anon';
  return `${who}|ip:${ip}`;
}

/**
 * @function withRateLimitNP
 * @purpose
 *   Wrap a Next.js API handler with NP rate limiting for the given scope.
 * @steps
 *   1) Resolve the policy (throws if unknown).
 *   2) Resolve the user ID via JWT/header/session **pre-handler**.
 *   3) Build a subject using the policy’s identity mode.
 *   4) Run the gate; on deny → set Retry-After and return 429 JSON.
 *   5) On allow → invoke the wrapped handler.
 */
export function withRateLimitNP(scope: string) {
  const policy = getPolicy(scope);
  if (!policy) {
    throw new Error(`withRateLimitNP: unknown scope "${scope}"`);
  }

  return function wrap(handler: NextApiHandler): NextApiHandler {
    return async function limited(req: NextApiRequest, res: NextApiResponse) {
      // Step 2: resolve user identity (JWT → headers → attached session)
      const userId = await resolveUserId(req, res);

      // Step 3: build composite subject key from policy identity mode
      const subject = buildSubjectWithProvidedUser(req, policy.identity, userId);

      // Step 4: run the multi-window rate gate
      const decision = await runGate(policy, subject);

      if (!decision.allowed) {
        res.setHeader('Retry-After', String(decision.retryAfterSec || 1));
        console.log('[withRateLimitNP.ts][4401] deny', { scope, subject, retryAfterSec: decision.retryAfterSec });
        return res
          .status(429)
          .json({ error: 'RATE_LIMIT_EXCEEDED', scope, retryAfter: decision.retryAfterSec });
      }

      // Step 5: allowed → continue to the underlying handler
      console.log('[withRateLimitNP.ts][4402] allow', { scope, subject });
      return handler(req, res);
    };
  };
}
