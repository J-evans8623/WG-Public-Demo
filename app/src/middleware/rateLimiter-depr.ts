/**
 * rateLimiter.ts
 * 
 * Implements rate limiting to prevent abuse of authentication endpoints.
 */

import rateLimit from 'express-rate-limit';

/**
 * RateLimiter
 * 
 * Middleware to limit repeated requests to public APIs.
 */
const RateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: 'Too many requests from this IP, please try again after 15 minutes.',
});

export default RateLimiter;
