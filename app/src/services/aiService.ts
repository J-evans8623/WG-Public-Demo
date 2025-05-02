/**
 * services/aiService.ts
 *
 * Handles AI-related operations, including:
 * - Interacting with OpenAI API for structured content generation.
 * - Validating and parsing API responses based on predefined schemas using JSON Schema
 *
 * Responsibilities:
 * - Sends requests to OpenAI API using the `gpt-4o-mini` model with structured JSON outputs.
 * - Validates responses against Zod schemas to ensure consistency and adherence to predefined formats.
 *
 * Dependencies:
 * - OpenAI client for API communication.
 */
import OpenAI from "openai";

interface JSONSchema {
  name: string;
  schema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
    additionalProperties?: boolean;
  };
  strict: boolean;
}

interface JSONSchemaValidation {
  name: string;
  schema: JSONSchema['schema'];
  strict: boolean;
}

class AIService {
  private openai: OpenAI;

  constructor(openai: OpenAI) {
    this.openai = openai;
    console.log("AIService initialized with OpenAI client");
  }

  public async generateStructuredOutput(
    jsonSchema: JSONSchemaValidation,
    input: string,
    systemPrompt: string
  ): Promise<any> {
    try {
      console.log("aiService.ts input systemPrompt", systemPrompt)
      console.log("aiService.ts input ", input);

      const response = await this.openai.beta.chat.completions.parse({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: input,
          },
        ],
        max_tokens: 15000,
        response_format: { 
          type: "json_schema",
          json_schema: {
            name: jsonSchema.name,
            schema: jsonSchema.schema,
            strict: jsonSchema.strict
          }
        }
      });

      console.log("aiService.ts output: ", JSON.stringify(response, null, 2));

      return response.choices[0].message.parsed;
    } catch (error) {
      console.error("Error in generateStructuredOutput:", error);
      throw error;
    }
  }
}

export default AIService;