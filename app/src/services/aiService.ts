/**
 * services/aiService.ts
 *
 * Handles AI-related operations, including:
 * - Interacting with OpenAI API for structured content generation.
 * - Validating and parsing API responses based on predefined schemas using `zodResponseFormat`.
 *
 * Responsibilities:
 * - Sends requests to OpenAI API using the `gpt-4o-mini` model with structured JSON outputs.
 * - Validates responses against Zod schemas to ensure consistency and adherence to predefined formats.
 *
 * Dependencies:
 * - OpenAI client for API communication.
 * - Zod for schema validation.
 * - zodResponseFormat helper for OpenAI schema handling.
 */

import { z } from "zod";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { IStructuredLessonResponse, IStructuredQuizResponse } from "../ai-definitions/Definitions";

class AIService {
  private openai: OpenAI;

  constructor(openai: OpenAI) {
    this.openai = openai;
    console.log("AIService initialized with OpenAI client");
  }

  public async generateStructuredOutput(
    schema: z.ZodSchema,
    input: string,
    schemaName: string
  ): Promise<IStructuredLessonResponse | IStructuredQuizResponse> {
    try {
      console.log("Sending structured output request with input:", input);

      const response = await this.openai.beta.chat.completions.parse({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant that generates structured JSON adhering to a specific schema.",
          },
          {
            role: "user",
            content: input,
          },
        ],
        max_tokens: 2000,
        response_format: zodResponseFormat(schema, schemaName),
      });

      console.log("Structured lesson response received:", JSON.stringify(response, null, 2));

      return response.choices[0].message.parsed;
    } catch (error) {
      console.error("Error in generateStructuredOutput:", error);
      throw error;
    }
  }
}

export default AIService;
