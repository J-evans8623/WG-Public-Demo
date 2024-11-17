/**
 * @file authenticate.test.ts
 * @description 
 * Tests for Authentication Middleware, ensuring it validates JWT tokens,
 * attaches user information to req.user, and returns 401 Unauthorized for invalid or missing tokens.
 */

import { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import User from '../models/User';
import mongoose from 'mongoose';

jest.mock('jsonwebtoken');

describe('Authentication Middleware', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let next: NextFunction;
    let mockJson: jest.Mock;
    let mockStatus: jest.Mock;

    beforeEach(() => {
        req = {};
        mockJson = jest.fn();
        mockStatus = jest.fn().mockReturnValue({ json: mockJson }); // Fixed: Added missing semicolon
        res = { status: mockStatus };
        next = jest.fn();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should call next() and attach user to req if token is valid', () => {
        const token = 'valid.token.here';
        req.headers = { authorization: `Bearer ${token}` };
        const decodedUser = { userId: '123', email: 'test@example.com', role: 'user' };
        (jwt.verify as jest.Mock).mockReturnValue(decodedUser);

        authenticate(req as Request, res as Response, next);

        expect(jwt.verify).toHaveBeenCalledWith(token, process.env.JWT_SECRET);
        expect((req as any).user).toEqual(decodedUser);
        expect(next).toHaveBeenCalled();
    });

    test('should return 401 if token is missing', async () => {
        const req = { headers: {} }; // Mock request with no authorization header
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        const next = jest.fn();
    
        authenticate(req as any, res as any, next);
    
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
            message: 'Authentication token is missing or malformed.',
        });
        expect(next).not.toHaveBeenCalled();
    });
    

    test('should return 401 if token is invalid', () => {
        const token = 'invalid.token.here';
        req.headers = { authorization: `Bearer ${token}` };
        (jwt.verify as jest.Mock).mockImplementation(() => { throw new Error('Invalid token'); });

        authenticate(req as Request, res as Response, next);

        expect(jwt.verify).toHaveBeenCalledWith(token, process.env.JWT_SECRET);
        expect(mockStatus).toHaveBeenCalledWith(401);
        expect(mockJson).toHaveBeenCalledWith({ message: 'Invalid authentication token.' });
        expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 if authorization header is malformed', () => {
        req.headers = { authorization: 'InvalidHeaderFormat' };

        authenticate(req as Request, res as Response, next);

        expect(mockStatus).toHaveBeenCalledWith(401);
        expect(mockJson).toHaveBeenCalledWith({ message: 'Authentication token is missing or malformed.' });
        expect(next).not.toHaveBeenCalled();
    });
});
