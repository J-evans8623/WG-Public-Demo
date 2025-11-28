/**
 * @file pages/api/health.ts
 * @description
 * This module provides a dedicated, high-availability infrastructure health check endpoint
 * for the WiseGraph application. Unlike standard business logic endpoints, this route is
 * explicitly designed to be publicly accessible (unauthenticated) to allow orchestration
 * tools like Docker, Kubernetes, and Load Balancers to poll the system status without
 * possessing user session credentials.
 *
 * The endpoint performs a lightweight verification of the Node.js event loop and server
 * responsiveness. It returns a standard HTTP 200 OK status with a JSON payload containing
 * uptime and timestamp metrics. This "heartbeat" is critical for Zero-Downtime Deployments,
 * as it allows the orchestration layer to verify that a new container is fully compiled,
 * booted, and listening on the port before switching live user traffic to it. This prevents
 * the "502 Bad Gateway" errors commonly seen during Next.js cold starts.
 *
 * Responsibilities:
 * - Provide a chemically pure "ping" endpoint for orchestration health probes
 * - Bypass standard authentication middleware to prevent 401 errors during system checks
 * - Return accurate system uptime and timestamp data for deployment debugging
 * - Respond with minimal latency to support frequent polling intervals (e.g., every 5s)
 * - Strictly handle GET requests to adhere to HTTP semantic standards
 *
 * @author System
 * @date Current
 */

import { NextApiRequest, NextApiResponse } from 'next';

// Note: We intentionally do NOT import authenticateRequest here.
// This endpoint must remain accessible to the Docker Daemon/Internal Network.

interface HealthResponse {
  status: 'ok' | 'maintenance' | 'error';
  timestamp: string;
  uptime: number;
}

/**
 * @function handler
 * @description
 * The main request handler for system health verification. It processes incoming
 * GET requests from infrastructure probes, calculates the current process uptime,
 * and returns a structured JSON response. It enforces HTTP method validation
 * to ensure protocol compliance but intentionally omits complex logic to guarantee
 * a response even under high load.
 */
export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<HealthResponse>
) {
  // Step 1: Validate HTTP method to ensure semantic correctness
  if (req.method !== 'GET') {
    // We do not log heavily here to avoid polluting logs during frequent polling
    res.setHeader('Allow', ['GET']);
    return res.status(405).end('Method Not Allowed');
  }

  // Step 2: Construct the health payload
  // We capture process.uptime() to help distinguish between new and old containers during rolling updates
  const statusPayload: HealthResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };

  // Step 3: Send the success response
  // Docker considers any 2xx status code as "Healthy".
  res.status(200).json(statusPayload);
}