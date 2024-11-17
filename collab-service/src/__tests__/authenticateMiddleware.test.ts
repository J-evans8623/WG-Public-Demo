// tests/middleware/authenticateMiddleware.test.ts

/**
 * @file authenticateMiddleware.test.ts
 * @description 
 * Tests that the authenticate middleware is exported correctly and functions as intended.
 */

import { authenticate } from '../middleware/authenticate';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

jest.mock('jsonwebtoken');

describe('Authenticate Middleware', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let next: NextFunction;
    let mockJson: jest.Mock;
    let mockStatus: jest.Mock;

    beforeEach(() => {
        req = {};
        mockJson = jest.fn();
        mockStatus = jest.fn().mockReturnValue({ json: mockJson });
        res = { status: mockStatus };
        next = jest.fn();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should attach user to req and call next() if token is valid', () => {
        const token = 'valid.token.here';
        req.headers = { authorization: `Bearer ${token}` };
        const decodedUser = { userId: '123', email: 'test@example.com', role: 'user' };
        (jwt.verify as jest.Mock).mockReturnValue(decodedUser);

        authenticate(req as Request, res as Response, next);

        expect(jwt.verify).toHaveBeenCalledWith(token, process.env.JWT_SECRET);
        expect((req as any).user).toEqual(decodedUser);
        expect(next).toHaveBeenCalled();
    });

    test('should respond with 401 if token is missing', () => {
        authenticate(req as Request, res as Response, next);

        expect(mockStatus).toHaveBeenCalledWith(401);
        expect(mockJson).toHaveBeenCalledWith({ message: 'Authentication token is missing or malformed.' });
        expect(next).not.toHaveBeenCalled();
    });

    test('should respond with 401 if token is invalid', () => {
        const token = 'invalid.token.here';
        req.headers = { authorization: `Bearer ${token}` };
        (jwt.verify as jest.Mock).mockImplementation(() => { throw new Error('Invalid token'); });

        authenticate(req as Request, res as Response, next);

        expect(jwt.verify).toHaveBeenCalledWith(token, process.env.JWT_SECRET);
        expect(mockStatus).toHaveBeenCalledWith(401);
        expect(mockJson).toHaveBeenCalledWith({ message: 'Invalid authentication token.' });
        expect(next).not.toHaveBeenCalled();
    });

    test('should respond with 401 if authorization header is malformed', () => {
        req.headers = { authorization: 'BadFormat' };

        authenticate(req as Request, res as Response, next);

        expect(mockStatus).toHaveBeenCalledWith(401);
        expect(mockJson).toHaveBeenCalledWith({ message: 'Authentication token is missing or malformed.' });
        expect(next).not.toHaveBeenCalled();
    });
});
