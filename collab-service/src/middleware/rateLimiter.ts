/**
 * @file rateLimiter.ts
 * @description 
 * Middleware to limit the rate of incoming requests.
 * Uses express-rate-limit to prevent abuse and ensure performance.
 * Configures limits based on IP addresses and predefined thresholds.
 * Allows bypassing during tests using specific headers.
 */

import rateLimit from 'express-rate-limit';
import { Request } from 'express';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Custom rate limiter with test bypass logic.
 */
export const rateLimiter = rateLimit({
    windowMs: process.env.RATE_LIMIT_WINDOW_MS
        ? parseInt(process.env.RATE_LIMIT_WINDOW_MS)
        : 15 * 60 * 1000, // Default to 15 minutes
    max: process.env.RATE_LIMIT_MAX
        ? parseInt(process.env.RATE_LIMIT_MAX)
        : 100, // Default to 100 requests per windowMs
    message: {
        message: 'Too many requests from this IP, please try again later.',
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    skip: (req: Request) => {
        // Skip rate limiting if `x-test-client` header is present
        return req.headers['x-test-client'] === 'bypass';
    },
    handler: (req, res) => {
        res.status(429).json({
            message: 'Too many requests from this IP, please try again later.',
        });
    },
});
