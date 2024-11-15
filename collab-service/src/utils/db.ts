/**
 * @file db.ts
 * @description This file contains the MongoDB connection logic for the collaborative service.
 * It establishes and manages the connection to the MongoDB database using Mongoose.
 * The connection logic includes a retry mechanism to handle temporary connection issues.
 *
 * @usage
 * Import and call `connectDB()` to initiate the database connection when starting the application.
 *
 * @dependencies
 * - mongoose: A MongoDB object modeling library for Node.js.
 * - dotenv: (Optional) Used for loading environment variables (e.g., MONGODB_URI).
 *
 * @environment variables
 * - MONGODB_URI: The URI for the MongoDB database. Defaults to 'mongodb://localhost:27017/collabservice' if not provided.
 *
 * @error handling
 * - Attempts to connect up to a maximum number of retries (`maxRetries`).
 * - Logs connection errors and exits the process if the maximum retries are reached.
 */

import mongoose from 'mongoose';

/**
 * Establishes a connection to the MongoDB database.
 * Retries the connection on failure up to a defined maximum number of attempts.
 */
const connectDB = async (): Promise<void> => {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/collabservice';
  const maxRetries = 5;
  let attempts = 0;

  while (attempts < maxRetries) {
    try {
      // Attempt to connect to the MongoDB database
      await mongoose.connect(mongoURI);
      console.log('MongoDB connected successfully');
      break; // Exit the loop on a successful connection
    } catch (error) {
      attempts += 1;
      console.error(`MongoDB connection error (Attempt ${attempts}):`, error);

      // Exit the process if the maximum number of retries is reached
      if (attempts >= maxRetries) {
        console.error('Max retries reached. Exiting.');
        process.exit(1);
      }

      console.log('Retrying connection in 5 seconds...');
      // Wait for 5 seconds before retrying
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
};

export default connectDB;
