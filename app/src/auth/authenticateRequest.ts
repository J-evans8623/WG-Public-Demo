/**
 * @file authenticateRequest.ts
 * @description
 *   This utility function validates incoming API requests by retrieving the session
 *   from NextAuth.js using the server-side helper. It ensures that only authenticated
 *   requests are processed.
 *
 * Responsibilities:
 *   - Retrieve the session from the request using NextAuth.js.
 *   - Return the session if it exists, or send a 401 response if not.
 *
 * @author 
 * @date 
 */

import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";

export async function authenticateRequest(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Retrieve the session using NextAuth.js helper
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    res.status(401).json({ error: "Unauthorized: No session found" });
    return null;
  }
  return session;
}
