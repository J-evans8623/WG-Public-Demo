/**
 * @file socketEvents.test.ts
 * @description 
 * Tests for Socket.IO event handling, including authentication, event emission, and error handling.
 */

import request from 'supertest';
import { Server } from 'http';
import mongoose from 'mongoose';
import { io as ClientIO, Socket as ClientSocket } from 'socket.io-client';
import { app, httpServer } from '../server'; // Ensure server.ts exports both app and httpServer
import User from '../models/User';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

describe('Socket.IO Event Definitions', () => {
    let server: Server;
    let authToken: string;
    let adminToken: string;
    let testUserId: mongoose.Types.ObjectId;
    let testAdminId: mongoose.Types.ObjectId;

    beforeAll(async () => {
        const mongoURI = process.env.MONGO_URI_TEST || 'mongodb://localhost:27017/test_db';
        await mongoose.connect(mongoURI);
    
        // Start the server
        server = httpServer.listen(0);
    
        // Create a regular user
        const userPassword = await bcrypt.hash('password123', 10);
        const user = new User({
            username: 'testuser',
            email: 'testuser@example.com',
            password: userPassword,
            role: 'user',
        });
        await user.save();
        testUserId = user._id as mongoose.Types.ObjectId;
    
        // Generate JWT for regular user
        authToken = jwt.sign(
            { userId: user._id, email: user.email, role: user.role },
            process.env.JWT_SECRET as string,
            { expiresIn: '1h' }
        );
    
        // Create an admin user
        const adminPassword = await bcrypt.hash('adminpassword123', 10);
        const admin = new User({
            username: 'testadmin',
            email: 'testadmin@example.com',
            password: adminPassword,
            role: 'admin',
        });
        await admin.save();
        testAdminId = admin._id as mongoose.Types.ObjectId;
    
        // Generate JWT for admin user
        adminToken = jwt.sign(
            { userId: admin._id, email: admin.email, role: admin.role },
            process.env.JWT_SECRET as string,
            { expiresIn: '1h' }
        );
    });
    

    afterAll(async () => {
        // Clean up the database
        await User.deleteMany({});
        // Delete other collections if seeded

        // Close the server and database connection
        await mongoose.connection.close();
        await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    /**
     * Utility function to connect a Socket.IO client with optional token.
     * @param token - JWT token for authentication
     * @returns Connected Socket.IO client
     */
    const connectClient = (token?: string): Promise<ClientSocket> => {
        return new Promise((resolve, reject) => {
            const clientSocket = ClientIO(`http://localhost:${(server.address() as any).port}`, {
                auth: {
                    token: token || '',
                },
                transports: ['websocket'], // Use WebSocket transport to avoid polling issues
                forceNew: true,
            });

            clientSocket.on('connect', () => {
                resolve(clientSocket);
            });

            clientSocket.on('connect_error', (err) => {
                reject(err);
            });

            clientSocket.on('error', (err) => {
                reject(err);
            });
        });
    };

    test('should authenticate socket connection', async () => {
        const clientSocket = await connectClient(authToken);

        expect(clientSocket.connected).toBe(true);

        clientSocket.disconnect();
    });

    test('should handle CONCEPT_ADD event correctly', async () => {
        const clientSocket = await connectClient(authToken);

        const testConcept = {
            title: 'New Test Concept',
            parentNodeId: null, // Assuming root concept
            isRoot: true,
        };

        // Listen for 'concept:added' event
        const conceptAddedPromise = new Promise((resolve) => {
            clientSocket.on('concept:added', (data) => {
                resolve(data);
            });
        });

        // Emit 'concept:add' event
        clientSocket.emit('concept:add', testConcept, (response: any) => {
            expect(response.status).toBe('ok');
            expect(response.concept.title).toBe(testConcept.title);
        });

        const addedConcept = await conceptAddedPromise;
        expect((addedConcept as any).title).toBe(testConcept.title);

        clientSocket.disconnect();
    });

    test('should handle RESOURCE_UPDATE event correctly', async () => {
        const clientSocket = await connectClient(authToken);

        // First, create a resource to update
        const Resource = require('../models/Resource').default;
        const Concept = require('../models/Concept').default;

        const concept = await Concept.findOne({ title: 'New Test Concept' });
        expect(concept).toBeDefined();

        const resource = await Resource.create({
            title: 'Resource to Update',
            type: 'cueCard',
            nodeId: concept._id,
            content: 'Original Content',
        });

        const updates = {
            resourceId: resource._id.toString(),
            updates: {
                title: 'Updated Resource Title',
                content: 'Updated Content',
            },
        };

        // Listen for 'resource:updated' event
        const resourceUpdatedPromise = new Promise((resolve) => {
            clientSocket.on('resource:updated', (data) => {
                resolve(data);
            });
        });

        // Emit 'resource:update' event
        clientSocket.emit('resource:update', updates, (response: any) => {
            expect(response.status).toBe('ok');
            expect(response.resource.title).toBe(updates.updates.title);
            expect(response.resource.content).toBe(updates.updates.content);
        });

        const updatedResource = await resourceUpdatedPromise;
        expect((updatedResource as any).title).toBe(updates.updates.title);
        expect((updatedResource as any).content).toBe(updates.updates.content);

        clientSocket.disconnect();
    });

    test('should emit ERROR event for invalid CONCEPT_ADD data', async () => {
        const clientSocket = await connectClient(authToken);

        const invalidConcept = {
            // Missing 'title' field
            parentNodeId: null,
            isRoot: true,
        };

        try {
            // Emit 'concept:add' with invalid data and handle the callback response
            await new Promise<void>((resolve, reject) => {
                clientSocket.emit('concept:add', invalidConcept, (response: any) => {
                    try {
                        expect(response.status).toBe('error');
                        expect(response.message).toBe('Title is required and must be a string.');
                        resolve();
                    } catch (err) {
                        reject(err);
                    }
                });
            });
        } finally {
            clientSocket.disconnect();
        }
    });
});
