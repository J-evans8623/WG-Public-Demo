/**
 * utils/promptEngineering.ts
 * 
 * Constructs and sanitizes prompts for OpenAI API calls.
 * 
 * Responsibilities:
 * - Receives raw user input (textbook pages, etc.) and predefined backend prompts.
 * - Sanitizes the user input to ensure safety and coherence.
 * - Combines sanitized user input with a predefined backend prompt to create a structured prompt.
 */

import sanitizeHtml from 'sanitize-html';

class PromptEngineering {
  /**
   * Sanitizes the user input to remove potentially unsafe or unintended content.
   * 
   * @param userInput - The raw text input from the user.
   * @returns string - Sanitized input.
   */
  public sanitizeInput(userInput: string): string {
    return sanitizeHtml(userInput, {
      allowedTags: [], // Remove all HTML tags
      allowedAttributes: {}, // Remove all HTML attributes
    }).trim();
  }

  /**
   * Combines a predefined backend prompt with sanitized user input to construct a complete prompt for the OpenAI API.
   * 
   * @param sanitizedInput - The sanitized text input provided by the user.
   * @param predefinedPrompt - A predefined backend prompt describing the task.
   * @returns string - A well-structured prompt for OpenAI API.
   */
  public createPrompt(sanitizedInput: string, predefinedPrompt: string): string {
    return `${predefinedPrompt}\n\nInput Text:\n${sanitizedInput}`;
  }
}

export default PromptEngineering;
