/**
 * db.test.ts
 * 
 * Test file for verifying the behavior of the `db.ts` concrete implementation.
 * This file tests the successful connection to MongoDB.
 */

import connectDB from '../db';
import mongoose from 'mongoose';

describe('Database Connection', () => {
  afterAll(async () => {
    // Ensure the database connection is closed after the tests
    await mongoose.disconnect();
  });

  it('should connect to the database successfully', async () => {
    // Spy on console.log to verify the success message
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    await connectDB();
    expect(consoleLogSpy).toHaveBeenCalledWith('MongoDB connected successfully.');
    consoleLogSpy.mockRestore();
  });

  it('should handle connection errors gracefully', async () => {
    // Temporarily set an invalid DB_URI
    const originalUri = process.env.DB_URI;
    process.env.DB_URI = 'mongodb://invalid:27017';

    // Spy on console.error to verify the error handling
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Expect the process to exit with a connection error
    const processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Process exited due to connection error');
    });

    await expect(connectDB()).rejects.toThrow('Process exited due to connection error');

    // Restore spies and environment variable
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
    process.env.DB_URI = originalUri;
  });
});
