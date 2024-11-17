/**
 * @file resources.test.ts
 * @description Tests for Resource Routes including GET, POST, PATCH, DELETE operations.
 */

import request from 'supertest';
import { Server } from 'http';
import mongoose from 'mongoose';
import { app } from '../server'; // Ensure server.ts exports the Express app
import Resource from '../models/Resource';
import Concept from '../models/Concept';
import User from '../models/User';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

describe('Resource Routes', () => {
    let server: Server;
    let authToken: string;
    let adminToken: string;
    let resourceId: mongoose.Types.ObjectId;
    let conceptId: mongoose.Types.ObjectId;

    const RATE_LIMIT_BYPASS_HEADER = { 'x-test-client': 'bypass' };

    beforeAll(async () => {
        // Connect to the test database
        const mongoURI = process.env.MONGO_URI_TEST || 'mongodb://localhost:27017/test_db';
        await mongoose.connect(mongoURI);

        // Start the server on a random available port
        server = app.listen(0);

        // Create test users and JWTs
        const user = new User({
            username: 'regularuser',
            email: 'user@example.com',
            password: await bcrypt.hash('password123', 10),
            role: 'user',
        });
        await user.save();

        authToken = jwt.sign(
            { userId: user._id, email: user.email, role: user.role },
            process.env.JWT_SECRET as string,
            { expiresIn: '1h' }
        );

        const admin = new User({
            username: 'adminuser',
            email: 'admin@example.com',
            password: await bcrypt.hash('adminpassword', 10),
            role: 'admin',
        });
        await admin.save();

        adminToken = jwt.sign(
            { userId: admin._id, email: admin.email, role: admin.role },
            process.env.JWT_SECRET as string,
            { expiresIn: '1h' }
        );

        // Create test concept and resource
        const concept = await Concept.create({ title: 'Resource Concept', isRoot: true });
        conceptId = concept._id as mongoose.Types.ObjectId;

        const resource = await Resource.create({
            title: 'Initial Resource',
            type: 'cueCard',
            nodeId: conceptId,
            content: 'Initial content',
        });
        resourceId = resource._id as mongoose.Types.ObjectId;
    });

    afterAll(async () => {
        await Resource.deleteMany({});
        await Concept.deleteMany({});
        await User.deleteMany({});
        await mongoose.connection.close();
        await new Promise((resolve) => server.close(resolve));
    });

    test('GET /resources/:resourceId should retrieve a specific resource', async () => {
        const response = await request(server)
            .get(`/api/resources/${resourceId}`)
            .set(RATE_LIMIT_BYPASS_HEADER); // Add header to bypass rate limiting
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('_id', resourceId.toString());
    });

    test('GET /resources/:resourceId should return 400 for invalid ID', async () => {
        const response = await request(server)
            .get('/api/resources/invalidid')
            .set(RATE_LIMIT_BYPASS_HEADER); // Add header to bypass rate limiting
        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('message', 'Invalid resource ID.');
    });

    test('GET /resources/:resourceId should return 404 for non-existent resource', async () => {
        const fakeResourceId = new mongoose.Types.ObjectId();
        const response = await request(server)
            .get(`/api/resources/${fakeResourceId}`)
            .set(RATE_LIMIT_BYPASS_HEADER); // Add header to bypass rate limiting
        expect(response.status).toBe(404);
        expect(response.body).toHaveProperty('message', 'Resource not found.');
    });

    test('POST /resources should create a new resource when authenticated', async () => {
        const newResource = {
            title: 'New Resource',
            type: 'picture',
            nodeId: conceptId.toString(),
        };

        const response = await request(server)
            .post('/api/resources')
            .set('Authorization', `Bearer ${authToken}`)
            .set(RATE_LIMIT_BYPASS_HEADER) // Add header to bypass rate limiting
            .send(newResource);

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('_id');
        expect(response.body.title).toBe(newResource.title);
    });

    test('POST /resources should return 401 Unauthorized when not authenticated', async () => {
        const newResource = {
            title: 'Unauthorized Resource',
            type: 'cueCard',
            nodeId: conceptId.toString(),
        };

        const response = await request(server)
            .post('/api/resources')
            .set(RATE_LIMIT_BYPASS_HEADER) // Add header to bypass rate limiting
            .send(newResource);
        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('message', 'Authentication token is missing or malformed.');
    });

    test('PATCH /resources/:resourceId should update a resource when authenticated', async () => {
        const updates = { title: 'Updated Resource Title', content: 'Updated content' };

        const response = await request(server)
            .patch(`/api/resources/${resourceId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .set(RATE_LIMIT_BYPASS_HEADER) // Add header to bypass rate limiting
            .send(updates);

        expect(response.status).toBe(200);
        expect(response.body.title).toBe(updates.title);
    });

    test('DELETE /resources/:resourceId should delete a resource when authenticated as admin', async () => {
        const newResource = await Resource.create({
            title: 'Resource to Delete',
            type: 'practiceSheet',
            nodeId: conceptId,
        });

        const response = await request(server)
            .delete(`/api/resources/${newResource._id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .set('x-test-client', 'bypass'); // Add header to bypass rate limiting

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('message', 'Resource deleted successfully.');
    });

    test('DELETE /resources/:resourceId should return 403 Forbidden when authenticated as non-admin', async () => {
        const newResource = await Resource.create({
            title: 'Resource Not to Delete',
            type: 'cueCard',
            nodeId: conceptId,
        });

        const response = await request(server)
            .delete(`/api/resources/${newResource._id}`)
            .set('Authorization', `Bearer ${authToken}`)
            .set('x-test-client', 'bypass'); // Add header to bypass rate limiting

        expect(response.status).toBe(403);
        expect(response.body).toHaveProperty('message', 'Access denied. Admins only.');
    });
});
