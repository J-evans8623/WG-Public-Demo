// app/src/rate-np/types.ts

/**
 * @file app/src/rate-np/types.ts
 * @responsibility
 *   Define stable, dependency-free type contracts for the non-premium (NP) rate limiting layer.
 *   These types are consumed by the policy registry, the gate runner, and the Next.js route wrapper.
 *   Keeping this file logic-free avoids cycles and makes the limiter easy to reason about and test.
 */

//
// IdentityMode
// Intent: declare the supported ways to key a caller when enforcing limits.
// - 'user'    → the preferred mode for your stack (session userId/email)
// - 'ip'      → optional mode for infra-level gating (not used by current policies)
// - 'user+ip' → optional mode for stricter per-user per-ip gating
//
export type IdentityMode = 'ip' | 'user' | 'user+ip';

//
// FixedWindow
// Intent: describe a single fixed window with a request cap.
//
export type FixedWindow = Readonly<{
  windowSeconds: number;
  maxRequests: number;
}>;

//
// RatePolicy
// Intent: bind a scope (named route group) to an identity mode and a set of windows.
//
export type RatePolicy = Readonly<{
  scope: string;
  identity: IdentityMode;
  windows: ReadonlyArray<FixedWindow>;
}>;

//
// GateDecision
// Intent: normalized result from the gate runner that the wrapper can act on.
// - allowed=false → set Retry-After and return 429
// - allowed=true  → continue to handler
//
export type GateDecision = Readonly<{
  allowed: boolean;
  retryAfterSec: number; // 0 if allowed
  reason?: 'LIMIT_EXCEEDED' | 'REDIS_ERROR';
}>;

//
// SubjectExtract
// Intent: internal helper shape while building the subject key from the request.
//
export type SubjectExtract = Readonly<{
  ip?: string;
  user?: string; // userId/uid/email (whatever is cheaply available)
}>;

//
// SubjectBuilder
// Intent: function contract for converting a request into SubjectExtract.
//
export type SubjectBuilder = (req: any) => SubjectExtract;
