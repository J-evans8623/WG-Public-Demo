// src/__tests__/jest.setup.ts

import dotenv from 'dotenv';

// Load environment variables from .env.test
dotenv.config({ path: '.env.test' });

// Mock the initializeDBConnection to prevent actual DB connections during tests
jest.mock('./src/utils/db', () => ({
  initializeDBConnection: jest.fn().mockResolvedValue(true),
}));

// Mock process.exit to prevent Jest from exiting during tests
jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
  throw new Error(`process.exit: ${code}`);
});
