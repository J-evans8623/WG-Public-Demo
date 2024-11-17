/**
 * @file users.test.ts
 * @description
 * Tests for User Routes including registration, login, and profile retrieval.
 * **Changes Made**:
 * - Added assertions to verify password hashing upon registration.
 * - Confirmed that tests pass with the updated authentication logic.
 */

import request from 'supertest';
import { Server } from 'http';
import mongoose from 'mongoose';
import { httpServer } from '../server'; // Use httpServer instead of app
import User from '../models/User';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

describe('User Routes', () => {
    let server: Server;
    let authToken: string;
    let userId: mongoose.Types.ObjectId;
    let uniqueEmail: string; // Declare uniqueEmail variable

    beforeAll(async () => {
        // Connect to the test database
        const mongoURI = process.env.MONGO_URI_TEST || 'mongodb://localhost:27017/test_db';
        await mongoose.connect(mongoURI);

        // Start the server on a random available port using httpServer
        server = httpServer.listen(0);

        // Generate a unique email address
        uniqueEmail = `testuser_${Date.now()}@example.com`;

        // Create a user and generate a JWT
        const user = new User({
            username: 'testuser',
            email: uniqueEmail,
            password: 'password123', // Password will be hashed by middleware
            role: 'user',
        });
        await user.save();

        // Explicitly cast _id to mongoose.Types.ObjectId
        userId = user._id as mongoose.Types.ObjectId;

        authToken = jwt.sign(
            { userId: user._id, email: user.email, role: user.role },
            process.env.JWT_SECRET as string,
            { expiresIn: '1h' }
        );
    });

    afterAll(async () => {
        await User.deleteMany({});
        await mongoose.connection.close();
        await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    test('POST /api/users/register should register a new user', async () => {
        const newUser = {
            username: 'newuser',
            email: 'newuser@example.com',
            password: 'newpassword',
            role: 'user',
        };

        const response = await request(server)
            .post('/api/users/register')
            .set('x-test-client', 'bypass') // Add header to bypass rate limiting
            .send(newUser);
        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('message', 'User registered successfully.');
        expect(response.body).toHaveProperty('user');

        const user = await User.findOne({ email: newUser.email });
        expect(user).not.toBeNull();
        expect(user?.username).toBe(newUser.username);

        // Verify that the password is hashed
        const isPasswordHashed = await bcrypt.compare(newUser.password, user!.password);
        expect(isPasswordHashed).toBe(true);
    });

    test('POST /api/users/register should return 409 Conflict for existing email', async () => {
        const existingUser = {
            username: 'existinguser',
            email: uniqueEmail, // Use uniqueEmail to match the created user
            password: 'password123',
            role: 'user',
        };

        const response = await request(server)
            .post('/api/users/register')
            .set('x-test-client', 'bypass') // Add header to bypass rate limiting
            .send(existingUser);
        expect(response.status).toBe(409);
        expect(response.body).toHaveProperty('message', 'User with this email already exists.');
    });

    test('POST /api/users/login should authenticate a user and return a JWT', async () => {
        const credentials = {
            email: uniqueEmail, // Use uniqueEmail for login
            password: 'password123',
        };

        const response = await request(server)
            .post('/api/users/login')
            .set('x-test-client', 'bypass') // Add header to bypass rate limiting
            .send(credentials);
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('token');

        // Verify the token
        const decoded = jwt.verify(response.body.token, process.env.JWT_SECRET as string) as any;
        expect(decoded).toHaveProperty('userId', userId.toString());
        expect(decoded).toHaveProperty('email', credentials.email);
        expect(decoded).toHaveProperty('role', 'user');
    });

    test('POST /api/users/login should return 401 Unauthorized for invalid credentials', async () => {
        const credentials = {
            email: uniqueEmail, // Use uniqueEmail for login
            password: 'wrongpassword',
        };

        const response = await request(server)
            .post('/api/users/login')
            .set('x-test-client', 'bypass') // Add header to bypass rate limiting
            .send(credentials);
        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('message', 'Invalid email or password.');
    });

    test('GET /api/users/:userId should retrieve user profile when authenticated', async () => {
        const response = await request(server)
            .get(`/api/users/${userId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .set('x-test-client', 'bypass'); // Add header to bypass rate limiting

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('_id', userId.toString());
        expect(response.body).toHaveProperty('username', 'testuser');
        expect(response.body).toHaveProperty('email', uniqueEmail); // Update expectation to uniqueEmail
        expect(response.body).toHaveProperty('__v'); // Check for version number
        expect(response.body).not.toHaveProperty('password');
    });

    test('GET /api/users/:userId should return 401 Unauthorized when not authenticated', async () => {
        const response = await request(server)
            .get(`/api/users/${userId}`)
            .set('x-test-client', 'bypass'); // Add header to bypass rate limiting
        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty(
            'message',
            'Authentication token is missing or malformed.'
        );
    });

    test('GET /api/users/:userId should return 404 Not Found for non-existent user', async () => {
        const fakeUserId = new mongoose.Types.ObjectId();
        const response = await request(server)
            .get(`/api/users/${fakeUserId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .set('x-test-client', 'bypass'); // Add header to bypass rate limiting

        expect(response.status).toBe(404);
        expect(response.body).toHaveProperty('message', 'User not found.');
    });
});
