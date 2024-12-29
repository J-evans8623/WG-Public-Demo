/**
 * utils/promptEngineering.ts
 * 
 * Constructs and sanitizes prompts for OpenAI API calls.
 * 
 * Responsibilities:
 * - Receives raw user input (textbook pages, etc.) and predefined backend prompts.
 * - Sanitizes the user input to ensure safety and coherence.
 * - Combines sanitized user input with a predefined backend prompt to create structured prompts.
 * - Incorporates schema details to ensure AI responses adhere to predefined structures.
 * 
 * Dependencies:
 * - `sanitize-html` for input sanitization.
 * - `zod` for schema validation and description extraction.
 */

import sanitizeHtml from "sanitize-html";
import { z } from "zod";

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
   * Combines a predefined backend prompt with sanitized user input to construct a structured prompt for the OpenAI API.
   * 
   * @param schema - A Zod schema defining the structure of the expected response.
   * @param input - Sanitized text input provided by the user.
   * @param predefinedPrompt - A predefined backend prompt describing the task.
   * @returns string - A well-structured prompt incorporating the schema and user input.
   */
  public createStructuredPrompt(
    schema: z.ZodSchema,
    input: string,
    predefinedPrompt: string
  ): string {
    return `${predefinedPrompt}\nSchema: ${JSON.stringify(
      schema.describe("Schema description for AI prompt")
    )}\nInput: ${input}`;
  }
}

export default PromptEngineering;
