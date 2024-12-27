/**
 * Tests for models/aiRequestLog.ts
 * 
 * Validates the schema and model for AI request logging.
 */

import mongoose from 'mongoose';
import AIRequestLog from '../aiRequestLog';

describe('AIRequestLog Model', () => {
    beforeAll(async () => {
        const dbUri = process.env.TEST_DB_URI || 'mongodb://localhost:27017/test-db';
        await mongoose.connect(dbUri); // Simplified without additional options
      });
      

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  });

  test('should create and save a valid AI request log', async () => {
    const log = new AIRequestLog({
      userId: 'user123',
      inputText: 'What is the capital of France?',
      parameters: { promptType: 'quiz' },
      moderationFlag: false,
    });

    const savedLog = await log.save();
    expect(savedLog._id).toBeDefined();
    expect(savedLog.userId).toBe('user123');
    expect(savedLog.inputText).toBe('What is the capital of France?');
    expect(savedLog.parameters.promptType).toBe('quiz');
    expect(savedLog.moderationFlag).toBe(false);
  });

  test('should fail if required fields are missing', async () => {
    const log = new AIRequestLog({}); // Missing required fields

    let error: unknown;
    try {
      await log.save();
    } catch (err) {
      error = err;
    }

    // Type guard to ensure error is an instance of mongoose.Error.ValidationError
    if (error instanceof mongoose.Error.ValidationError) {
      expect(error).toBeDefined();
      expect(error.errors['userId']).toBeDefined();
      expect(error.errors['inputText']).toBeDefined();
      expect(error.errors['parameters']).toBeDefined();
    } else {
      throw new Error('Expected a mongoose.ValidationError');
    }
  });
});
