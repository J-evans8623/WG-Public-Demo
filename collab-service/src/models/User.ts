/**
 * @file User.ts
 * @description
 * Defines the Mongoose schema and model for User documents.
 * Represents users within the collaborative study service, including roles and authentication details.
 * **Changes Made**:
 * - Added the `comparePassword` method for password validation.
 * - Updated the `IUser` interface to include the `comparePassword` method.
 */

import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcrypt';

/**
 * Interface representing a User document in MongoDB.
 */
export interface IUser extends Document {
    username: string;
    email: string;
    password: string;
    role: 'user' | 'admin';
    comparePassword(candidatePassword: string): Promise<boolean>; // Added method signature
    createdAt: Date;
    updatedAt: Date;
}

const UserSchema: Schema = new Schema(
    {
        username: {
            type: String,
            required: true,
            trim: true,
            minlength: 3,
            maxlength: 30,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
            match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address.'],
        },
        password: {
            type: String,
            required: true,
            minlength: 6,
        },
        role: {
            type: String,
            enum: ['user', 'admin'],
            default: 'user',
        },
    },
    {
        timestamps: true, // Automatically adds createdAt and updatedAt fields
    }
);

/**
 * Middleware to hash the password before saving the user document.
 */
UserSchema.pre<IUser>('save', async function (next) {
    if (!this.isModified('password')) {
        return next();
    }
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error as Error);
    }
});

/**
 * Instance method to compare a candidate password with the hashed password.
 * @param candidatePassword - The plaintext password to compare.
 * @returns A promise that resolves to true if passwords match, or false otherwise.
 */
UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
    return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model<IUser>('User', UserSchema);
