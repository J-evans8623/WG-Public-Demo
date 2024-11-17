/**
 * @file rateLimiter.test.ts
 * @description 
 * Tests for Rate Limiting Middleware to ensure it correctly limits the number of requests.
 * Validates that the middleware allows a specified number of requests and blocks exceeding requests.
 */

import request from 'supertest';
import { Server } from 'http';
import mongoose from 'mongoose';
import { httpServer } from '../server'; // Use httpServer instead of app
import Concept from '../models/Concept';
import dotenv from 'dotenv';

dotenv.config();

describe('Rate Limiting Middleware', () => {
    let server: Server;
    const RATE_LIMIT = parseInt(process.env.RATE_LIMIT_MAX as string) || 100; // Use configured max

    beforeAll(async () => {
        const mongoURI = process.env.MONGO_URI_TEST || 'mongodb://localhost:27017/test_db';
        await mongoose.connect(mongoURI);

        // Seed the database with a test concept
        await Concept.create({ title: 'Test Concept', isRoot: true });

        // Start the server
        server = httpServer.listen(0, () => console.log('Test server started for rate limiting'));
    });

    afterAll(async () => {
        await mongoose.connection.close();
        await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    test(`should allow up to ${RATE_LIMIT} requests`, async () => {
        for (let i = 0; i < RATE_LIMIT; i++) {
            const response = await request(server).get('/api/concepts');
            expect(response.status).toBe(200);
        }
    });

    test('should return 429 Too Many Requests after exceeding the limit', async () => {
        // Exhaust rate limit
        for (let i = 0; i < RATE_LIMIT; i++) {
            await request(server).get('/api/concepts');
        }

        // Verify the next request is blocked
        const response = await request(server).get('/api/concepts');
        console.log('Rate limiter response:', response.status, response.body);
        expect(response.status).toBe(429);
        expect(response.body).toHaveProperty(
            'message',
            'Too many requests from this IP, please try again later.'
        );
    });
});
