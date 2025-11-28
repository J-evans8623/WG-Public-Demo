// middleware.ts
/**
 * @file middleware.ts
 * @description
 * The Global Edge Middleware for WiseGraph. This file executes before every single request
 * to the application, making it the ideal location for high-level traffic control.
 *
 * This implementation introduces the "Maintenance Mode" logic prepared in Phase 1.
 * It checks the `MAINTENANCE_MODE` environment variable and, if active, rewrites
 * incoming requests to the `/maintenance` page.
 *
 * CRITICAL LOGIC:
 * To prevents infinite redirect loops and server crashes, strict whitelisting is applied.
 * 1. `_next/static` & `_next/image`: Must be allowed so the maintenance page itself can load styles.
 * 2. `/api/health`: Must be allowed so Docker/Coolify sees the container as "Healthy"
 * even during maintenance (Phase 1 requirement).
 * 3. `/maintenance`: Must be allowed to prevent a redirect loop.
 *
 * @author System
 * @date Current
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * @function middleware
 * @description
 * Intercepts requests to enforce Maintenance Mode when enabled.
 * Returns a URL rewrite to display the maintenance UI without changing the browser URL,
 * or allows the request to proceed normally if maintenance is off.
 */
export function middleware(request: NextRequest) {
  // Step 1: Check if Maintenance Mode is active via Env Var
  // We compare explicitly to the string 'true' because env vars are always strings.
  const isMaintenanceMode = process.env.MAINTENANCE_MODE === 'true';

  // Step 2: Define the Whitelist
  // These paths must function normally even during maintenance.
  const { pathname } = request.nextUrl;
  
  const isWhitelisted = 
    pathname.startsWith('/_next') ||    // Next.js internal assets (JS/CSS)
    pathname.startsWith('/static') ||   // Public static folder
    pathname.startsWith('/api/health') || // Docker Healthcheck (CRITICAL)
    pathname === '/maintenance' ||      // The maintenance page itself
    pathname === '/favicon.ico';        // Browser icon

  // Step 3: Enforce Maintenance Logic
  if (isMaintenanceMode && !isWhitelisted) {
    // We use rewrite() instead of redirect() so the user stays on their original URL
    // (e.g., wise-graph.com/dashboard) but sees the maintenance content.
    // This is better for UX (refreshing works later) and SEO.
    const url = request.nextUrl.clone();
    url.pathname = '/maintenance';
    return NextResponse.rewrite(url);
  }

  // Step 4: Proceed normally if maintenance is off or path is whitelisted
  return NextResponse.next();
}

/**
 * @constant config
 * @description
 * Optimization: Filter which paths invoke the middleware to reduce Edge function usage.
 * We exclude standard static files that generally don't need logic, though
 * our code above handles them safely.
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/health (Explicitly skipped in matcher to save execution time, double safety)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api/health|_next/static|_next/image|favicon.ico).*)',
  ],
};