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

import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  googleId: string;
  email: string;
  accountType: 'free' | 'premium';
  refreshToken?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    googleId: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    accountType: { type: String, enum: ['free', 'premium'], default: 'free' },
    refreshToken: { type: String },
  },
  { timestamps: true }
);

const UserModel = mongoose.model<IUser>('User', UserSchema);
export default UserModel;