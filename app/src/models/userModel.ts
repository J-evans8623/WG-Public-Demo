/**
 * userModel.ts
 * 
 * Concrete implementation of the User schema and Mongoose model for interacting with the User collection in MongoDB.
 * Responsibilities:
 * - Define the User schema using Mongoose.
 * - Provide a Mongoose model for interacting with the User collection.
 * Dependencies:
 * - Mongoose for schema definition and database operations.
 */

import mongoose, { Document, Schema } from 'mongoose';

/**
 * IUser
 * 
 * Interface representing a user document in MongoDB.
 */
export interface IUser extends Document {
  googleId: string;
  email: string;
  accountType: 'free' | 'premium';
  createdAt: Date;
  updatedAt: Date;
}

/**
 * UserSchema
 * 
 * Mongoose schema for the User model.
 */
const UserSchema: Schema = new Schema(
  {
    googleId: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    accountType: { type: String, enum: ['free', 'premium'], default: 'free' },
  },
  { timestamps: true } // Automatically manage createdAt and updatedAt fields
);

/**
 * UserModel
 * 
 * Mongoose model for the User collection.
 */
const UserModel = mongoose.model<IUser>('User', UserSchema);

export default UserModel;
