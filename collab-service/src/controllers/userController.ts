/**
 * @file userController.ts
 * @description
 * Contains controller functions for handling user-related operations.
 * Interfaces with the User model to perform registration, authentication, and profile retrieval.
 * Ensures proper validation, password hashing, and token generation.
 * **Changes Made**:
 * - Updated `loginUser` to use `user.comparePassword` method for password validation.
 * - Included version numbers (`__v`) in responses where applicable.
 */

import { Request, Response } from 'express';
import User, { IUser } from '../models/User';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

/**
 * Registers a new user.
 *
 * @param req - Express Request object containing user registration data.
 * @param res - Express Response object.
 */
export const registerUser = async (req: Request, res: Response): Promise<void> => {
    const { username, email, password, role } = req.body;

    if (!username || typeof username !== 'string') {
        res.status(400).json({ message: 'Username is required and must be a string.' });
        return;
    }

    if (!email || typeof email !== 'string') {
        res.status(400).json({ message: 'Email is required and must be a string.' });
        return;
    }

    if (!password || typeof password !== 'string') {
        res.status(400).json({ message: 'Password is required and must be a string.' });
        return;
    }

    try {
        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            res.status(409).json({ message: 'User with this email already exists.' });
            return;
        }

        // Create new user
        const newUser = new User({
            username,
            email,
            password, // Password will be hashed by middleware
            role: role || 'user', // Default role is 'user'
        });

        await newUser.save();

        res.status(201).json({
            message: 'User registered successfully.',
            user: {
                _id: newUser._id,
                username: newUser.username,
                email: newUser.email,
                role: newUser.role,
                __v: newUser.__v, // Include version number
            },
        });
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

/**
 * Authenticates a user and provides a JWT.
 *
 * @param req - Express Request object containing login credentials.
 * @param res - Express Response object.
 */
export const loginUser = async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body;

    if (!email || typeof email !== 'string') {
        res.status(400).json({ message: 'Email is required and must be a string.' });
        return;
    }

    if (!password || typeof password !== 'string') {
        res.status(400).json({ message: 'Password is required and must be a string.' });
        return;
    }

    try {
        // Find user by email
        const user = await User.findOne({ email }) as IUser;
        if (!user) {
            res.status(401).json({ message: 'Invalid email or password.' });
            return;
        }

        // Compare passwords using the model's method
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            res.status(401).json({ message: 'Invalid email or password.' });
            return;
        }

        // Generate JWT
        const token = jwt.sign(
            { userId: user._id, email: user.email, role: user.role },
            process.env.JWT_SECRET as string,
            { expiresIn: '1h' }
        );

        res.status(200).json({ token });
    } catch (error) {
        console.error('Error logging in user:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

/**
 * Retrieves a user's profile information.
 *
 * @param req - Express Request object containing userId.
 * @param res - Express Response object.
 */
export const getUserProfile = async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        res.status(400).json({ message: 'Invalid user ID.' });
        return;
    }

    try {
        const user = await User.findById(userId).select('-password'); // Exclude password

        if (!user) {
            res.status(404).json({ message: 'User not found.' });
            return;
        }

        res.status(200).json(user); // Mongoose includes __v by default
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};
