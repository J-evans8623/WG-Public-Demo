/**
 * @file server.test.ts
 * @description 
 * Tests for server initialization, middleware integration, and route handling.
 */

import request from 'supertest';
import { Server } from 'http';
import mongoose from 'mongoose';
import { app } from '../server'; // Ensure server.ts exports the Express app

describe('Server Initialization', () => {
    let server: Server;

    beforeAll(async () => {
        const mongoURI = process.env.MONGO_URI_TEST || 'mongodb://localhost:27017/test_db';
        await mongoose.connect(mongoURI);

        server = app.listen(0); // Start the server on a random available port
    });

    afterAll(async () => {
        await mongoose.connection.close(); // Close the database connection
        await new Promise<void>((resolve) => server.close(() => resolve())); // Close the server
    });

    test('Express app is defined', () => {
        expect(app).toBeDefined();
    });

    test('GET / should return 200 OK', async () => {
        const response = await request(server)
            .get('/')
            .set('x-test-client', 'bypass'); // Add header to bypass rate limiting
        expect(response.status).toBe(200);
        expect(response.text).toContain('Collaborative Study Service is running...');
    });

    test('GET /api/concepts should return 200 OK', async () => {
        const response = await request(server)
            .get('/api/concepts')
            .set('x-test-client', 'bypass'); // Add header to bypass rate limiting
        expect(response.status).toBe(200);
        // Optionally, you can check if the response body is an array
        expect(Array.isArray(response.body)).toBe(true);
    });

    test('GET /api/resources should return 200 OK', async () => {
        // Seed the database with at least one resource to ensure the route returns data
        const Resource = require('../models/Resource').default;
        const Concept = require('../models/Concept').default;

        // Create a concept if none exists
        let concept = await Concept.findOne({});
        if (!concept) {
            concept = await Concept.create({ title: 'Test Concept', isRoot: true });
        }

        // Create a resource associated with the concept
        await Resource.create({
            title: 'Test Resource',
            type: 'cueCard',
            nodeId: concept._id,
            content: 'Sample content',
        });

        const response = await request(server)
            .get('/api/resources')
            .set('x-test-client', 'bypass'); // Add header to bypass rate limiting
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);
    });

    test('GET /api/users should return 401 Unauthorized when not authenticated', async () => {
        const response = await request(server)
            .get('/api/users/someUserId');
            // Do not set the bypass header to test authentication
        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('message', 'Authentication token is missing or malformed.');
    });
});
