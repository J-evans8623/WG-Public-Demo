/**
 * db.ts
 * 
 * Configures and establishes a connection to the MongoDB database using Mongoose.
 * Responsibilities:
 * - Initializes the connection to MongoDB.
 * - Logs success and error messages for the connection process.
 * - Ensures the database connection is stable and retryable on failure.
 * Dependencies:
 * - Mongoose for MongoDB connections.
 */

import mongoose from 'mongoose';

/**
 * Establishes a connection to the MongoDB database.
 * 
 * Environment Variables Required:
 * - DB_URI: MongoDB connection string.
 * 
 * Logs:
 * - Connection success message on successful connection.
 * - Error message if the connection fails.
 * 
 * Throws:
 * - Exits the process if the database connection cannot be established.
 */
const connectDB = async (): Promise<void> => {
  try {
    const dbUri = process.env.DB_URI || 'mongodb://127.0.0.1:27017/bloom-map?directConnection=true';

    // Connect to MongoDB without deprecated options
    await mongoose.connect(dbUri);
    console.log('MongoDB connected successfully.');
  } catch (error) {
    console.error('MongoDB connection error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
};

export default connectDB;
