/**
 * @file app/api/health/route.ts
 * @description
 * The infrastructure heartbeat endpoint, rewritten for the Next.js App Router.
 * This endpoint verifies that the Next.js server is running and accepting requests.
 *
 * Responsibilities:
 * - Return 200 OK to Docker Healthchecks.
 * - Bypass all authentication and middleware logic (handled via middleware matcher).
 * - Utilize the lightweight Edge Runtime or Standard Node runtime to reply instantly.
 *
 * @author System
 * @date Current
 */

import { NextResponse } from 'next/server';

export async function GET() {
  // We return a simple JSON object.
  // The process.uptime() helps you debug if the container effectively restarted.
  return NextResponse.json(
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
    { status: 200 }
  );
}