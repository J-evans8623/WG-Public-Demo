/**
 * Tests for routes/aiRoutes.ts
 * 
 * Validates that the correct route handlers are associated with the appropriate paths.
 */

import request from 'supertest';
import express from 'express';
import aiRoutes from '../aiRoutes';
import AIController from '../../controllers/aiController';

jest.mock('../../controllers/aiController'); // Mock the AIController

describe('AI Routes', () => {
  const app = express();
  app.use(express.json());
  app.use('/api', aiRoutes);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should route POST /api/generate-ai to AIController.generateAI', async () => {
    (AIController.generateAI as jest.Mock).mockImplementation((req, res) =>
      res.status(200).json({ content: 'Test response' })
    );

    const response = await request(app)
      .post('/api/generate-ai')
      .send({ text: 'What is photosynthesis?', predefinedPrompt: 'Explain:' });

    expect(AIController.generateAI).toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(response.body.content).toBe('Test response');
  });

  test('should return 404 for unknown routes', async () => {
    const response = await request(app).get('/api/unknown-route');

    expect(response.status).toBe(404);
  });
});
