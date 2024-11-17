// tests/concepts.test.ts

/**
 * @file concepts.test.ts
 * @description 
 * Tests for Concept Routes including GET, POST, PATCH, DELETE operations.
 */

import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../server'; // Ensure server.ts exports the Express app
import Concept from '../models/Concept';
import User from '../models/User';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

describe('Concept Routes', () => {
    let authToken: string;
    let adminToken: string;
    let conceptId: mongoose.Types.ObjectId;

    beforeAll(async () => {
        // Connect to the test database
        const mongoURI = process.env.MONGO_URI_TEST || 'mongodb://localhost:27017/test_db';
        await mongoose.connect(mongoURI); // Simplified connection options

        // Create a regular user and generate a JWT
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

        // Create an admin user and generate a JWT
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

        // Create a concept to be used in tests
        const concept = await Concept.create({ title: 'Initial Concept', isRoot: true });
        conceptId = concept._id as mongoose.Types.ObjectId;
    });

    afterAll(async () => {
        await Concept.deleteMany({});
        await User.deleteMany({});
        await mongoose.connection.close(); // Ensure the database connection is closed
    });

    test('GET /api/concepts should retrieve all concepts', async () => {
        const response = await request(app)
            .get('/api/concepts') // Added leading '/'
            .set('x-test-client', 'bypass'); // Add header to bypass rate limiting
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThanOrEqual(1);
    });

    test('POST /api/concepts should create a new concept when authenticated', async () => {
        const newConcept = {
            title: 'New Concept',
            isRoot: false,
        };

        const response = await request(app)
            .post('/api/concepts') // Added leading '/'
            .set('Authorization', `Bearer ${authToken}`)
            .set('x-test-client', 'bypass') // Add header to bypass rate limiting
            .send(newConcept);

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('_id');
        expect(response.body.title).toBe(newConcept.title);
        expect(response.body.isRoot).toBe(newConcept.isRoot);
    });

    test('POST /api/concepts should return 401 Unauthorized when not authenticated', async () => {
        const newConcept = {
            title: 'Unauthorized Concept',
            isRoot: false,
        };

        const response = await request(app)
            .post('/api/concepts') // Added leading '/'
            .set('x-test-client', 'bypass') // Add header to bypass rate limiting
            .send(newConcept);
        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('message', 'Authentication token is missing or malformed.');
    });

    test('PATCH /api/concepts/:conceptId should update a concept when authenticated', async () => {
        const updates = { title: 'Updated Concept Title' };

        const response = await request(app)
            .patch(`/api/concepts/${conceptId}`) // Added leading '/'
            .set('Authorization', `Bearer ${authToken}`)
            .set('x-test-client', 'bypass') // Add header to bypass rate limiting
            .send(updates);

        expect(response.status).toBe(200);
        expect(response.body.title).toBe(updates.title);
    });

    test('PATCH /api/concepts/:conceptId should return 401 Unauthorized when not authenticated', async () => {
        const updates = { title: 'Should Not Update' };

        const response = await request(app)
            .patch(`/api/concepts/${conceptId}`) // Added leading '/'
            .set('x-test-client', 'bypass') // Add header to bypass rate limiting
            .send(updates);
        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('message', 'Authentication token is missing or malformed.');
    });

    test('DELETE /api/concepts/:conceptId should delete a concept when authenticated as admin', async () => {
        const newConcept = await Concept.create({ title: 'Concept to Delete', isRoot: false });

        const response = await request(app)
            .delete(`/api/concepts/${newConcept._id}`) // Added leading '/'
            .set('Authorization', `Bearer ${adminToken}`)
            .set('x-test-client', 'bypass'); // Add header to bypass rate limiting

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('message', 'Concept deleted successfully.');

        const deleted = await Concept.findById(newConcept._id);
        expect(deleted).toBeNull();
    });

    test('DELETE /api/concepts/:conceptId should return 403 Forbidden when authenticated as non-admin', async () => {
        const newConcept = await Concept.create({ title: 'Concept Not to Delete', isRoot: false });

        const response = await request(app)
            .delete(`/api/concepts/${newConcept._id}`) // Added leading '/'
            .set('Authorization', `Bearer ${authToken}`) // Regular user token
            .set('x-test-client', 'bypass'); // Add header to bypass rate limiting

        expect(response.status).toBe(403);
        expect(response.body).toHaveProperty('message', 'Access denied. Admins only.');

        const notDeleted = await Concept.findById(newConcept._id);
        expect(notDeleted).not.toBeNull();
    });
});
