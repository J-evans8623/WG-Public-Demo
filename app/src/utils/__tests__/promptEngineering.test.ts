/**
 * Tests for utils/promptEngineering.ts
 * 
 * Validates prompt sanitization and construction logic.
 */

import PromptEngineering from '../promptEngineering';

describe('Prompt Engineering Utility', () => {
  let promptEngineering: PromptEngineering;

  beforeEach(() => {
    promptEngineering = new PromptEngineering();
  });

  test('should sanitize input to remove HTML tags and unsafe content', () => {
    const rawInput = '<script>alert("hack");</script> This is a test.';
    const sanitizedInput = promptEngineering.sanitizeInput(rawInput);

    expect(sanitizedInput).not.toContain('<script>');
    expect(sanitizedInput).toBe('This is a test.');
  });

  test('should construct a structured prompt with sanitized input and a predefined backend prompt', () => {
    const sanitizedInput = 'What is the capital of France?';
    const predefinedPrompt = 'Extract each concept from the text, and give a definition of each concept.';

    const prompt = promptEngineering.createPrompt(sanitizedInput, predefinedPrompt);

    expect(prompt).toContain(predefinedPrompt);
    expect(prompt).toContain('What is the capital of France?');
  });

  test('should handle empty sanitized input gracefully', () => {
    const sanitizedInput = '';
    const predefinedPrompt = 'Summarize the key points from the provided text.';

    const prompt = promptEngineering.createPrompt(sanitizedInput, predefinedPrompt);

    expect(prompt).toContain(predefinedPrompt);
    expect(prompt).toContain('Input Text:\n');
  });
});
