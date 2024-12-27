/**
 * Tests for controllers/aiController.ts
 * 
 * Validates the handling of AI content generation requests.
 */

import { Request, Response } from 'express';
import AIController from '../aiController';
import AIService from '../../services/aiService';

jest.mock('../../services/aiService'); // Mock the AI Service

describe('AI Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;

  beforeEach(() => {
    statusMock = jest.fn().mockReturnThis();
    jsonMock = jest.fn();

    mockResponse = {
      status: statusMock,
      json: jsonMock,
    };
  });

  test('should return AI-generated content for valid input', async () => {
    (AIService.prototype.processUserInput as jest.Mock).mockResolvedValue('Generated AI content.');

    mockRequest = {
      body: {
        text: 'Explain photosynthesis.',
        predefinedPrompt: 'Explain the concept of:',
      },
    };

    await AIController.generateAI(mockRequest as Request, mockResponse as Response);

    expect(AIService.prototype.processUserInput).toHaveBeenCalledWith(
      'Explain photosynthesis.',
      'Explain the concept of:'
    );
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({ content: 'Generated AI content.' });
  });

  test('should handle errors gracefully', async () => {
    (AIService.prototype.processUserInput as jest.Mock).mockRejectedValue(new Error('Service Error'));

    mockRequest = {
      body: {
        text: 'Explain photosynthesis.',
        predefinedPrompt: 'Explain the concept of:',
      },
    };

    await AIController.generateAI(mockRequest as Request, mockResponse as Response);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({ error: 'Failed to generate AI content.' });
  });
});
