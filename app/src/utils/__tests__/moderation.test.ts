/**
 * Tests for utils/moderation.ts
 * 
 * Validates moderation logic using OpenAI's Moderation API.
 */

import OpenAI from 'openai';
import Moderation from '../moderation';

describe('Moderation Utility', () => {
  let mockOpenAIClient: Partial<OpenAI>;
  let moderation: Moderation;

  beforeEach(() => {
    mockOpenAIClient = {
      moderations: {
        create: jest.fn().mockImplementation((request) => {
          const flagged = request.input.includes('unsafe');
          return Promise.resolve({
            results: [{ flagged }],
          });
        }),
        _client: {}, // Include _client to match expected type structure
      } as unknown as OpenAI.Moderations,
    };

    moderation = new Moderation(mockOpenAIClient as OpenAI);
  });

  test('should return true for unsafe content', async () => {
    const result = await moderation.moderateContent('This is unsafe content');
    expect(result).toBe(true);
  });

  test('should return false for safe content', async () => {
    const result = await moderation.moderateContent('This is safe content');
    expect(result).toBe(false);
  });

  test('should throw an error if the Moderation API fails', async () => {
    (mockOpenAIClient.moderations!.create as jest.Mock).mockRejectedValueOnce(new Error('API Error'));
  
    await expect(moderation.moderateContent('Any content')).rejects.toThrow(
      'Failed to moderate content. Please try again.'
    );
  });
  
});
