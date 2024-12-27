/**
 * Tests for services/aiService.ts
 * 
 * Validates the processing of user input, OpenAI API interaction, and response generation.
 */

import OpenAI from 'openai';
import AIService from '../aiService';

describe('AI Service', () => {
  let mockOpenAIClient: Partial<OpenAI>;
  let aiService: AIService;

  beforeEach(() => {
    mockOpenAIClient = {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ text: 'Generated response' }],
        }),
        _client: {}, // Mock the internal _client property to match the expected structure
      } as unknown as OpenAI.Completions, // Explicitly cast to the correct type
    };
    aiService = new AIService(mockOpenAIClient as OpenAI);
  });

  test('should process user input and return AI-generated content', async () => {
    const userInput = 'What is photosynthesis?';
    const predefinedPrompt = 'Explain the concept of:';

    const response = await aiService.processUserInput(userInput, predefinedPrompt);

    expect(response).toContain('Generated response');
    expect(mockOpenAIClient.completions!.create).toHaveBeenCalledWith({
      model: 'text-davinci-003',
      prompt: `${predefinedPrompt}\n\n${userInput}`,
      max_tokens: 100,
    });
  });

  test('should throw an error if OpenAI API fails', async () => {
    (mockOpenAIClient.completions!.create as jest.Mock).mockRejectedValueOnce(new Error('API Error'));

    await expect(aiService.processUserInput('Any input', 'Explain:')).rejects.toThrow('API Error');
  });
});
