/**
 * @file    services/aiService.ts
 * @summary AIService wraps OpenAI chat completions for both batch JSON-schema parsing
 *          and token-level streaming, validating against provided JSON Schemas.
 *
 * Responsibilities:
 *  - Send requests to OpenAI for structured JSON outputs or streaming deltas.
 *  - Validate and parse JSON outputs according to a strict JSON Schema.
 *  - Return either a fully parsed object (batch mode) or a streaming response.
 *
 * Usage:
 *  const service = new AIService(openaiClient);
 *  // Batch:
 *  const result = await service.generateStructuredOutput(schema, userInput, systemPrompt);
 *  // Streaming:
 *  const stream = await service.generateStructuredOutput(schema, userInput, systemPrompt, { stream: true });
 */

import OpenAI from "openai";

export interface JSONSchemaValidation {
  /** Name to associate with the schema/tool */
  name: string;
  /** Core JSON Schema definition */
  schema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
    additionalProperties?: boolean;
  };
  /** Enforce strict mode */
  strict: boolean;
}

/**
 * Options for structured output generation.
 * @property stream When true, returns a token-level stream instead of batch JSON.
 */
export interface GenerateOptions {
  stream?: boolean;
}

class AIService {
  private openai: OpenAI;

  /**
   * @param openai An initialized OpenAI client (e.g. OpenAIClient.getClient()).
   */
  constructor(openai: OpenAI) {
    this.openai = openai;
    console.log("[AIService] Initialized with OpenAI client");
  }

  /**
   * Generate structured output according to a JSON Schema, either in batch or streaming mode.
   *
   * @param jsonSchema   The JSON Schema to validate against.
   * @param userInput    Combined system + user input string.
   * @param systemPrompt System‐level prompt guiding the model.
   * @param options      Optional flags (e.g. streaming).
   *
   * @returns 
   *  - If `options.stream` is **false** or omitted: a fully‐parsed JSON object.
   *  - If `options.stream` is **true**: the raw streaming response for token-level consumption.
   *
   * @throws Any errors from the OpenAI API or validation step.
   */
  public async generateStructuredOutput(
    jsonSchema: JSONSchemaValidation,
    userInput: string,
    systemPrompt: string,
    options: GenerateOptions = {}
  ): Promise<any> {
    console.log("[AIService] generateStructuredOutput:", {
      schema: jsonSchema.name,
      prompt: systemPrompt,
      stream: options.stream === true,
    });

    if (options.stream) {
      // --- Streaming Mode ---
      // Returns a ReadableStream of tokens conforming to the JSON‐schema tool format.
      return this.openai.chat.completions.create({
        model: "gpt-4o-mini",         // Latency‐optimized model for streaming
        stream: true,                 // Enable token streaming
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userInput },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: jsonSchema.name,
            schema: jsonSchema.schema,
            strict: jsonSchema.strict,
          },
        },
      });
    } else {
      // --- Batch Mode ---
      // Waits for the full response, parses JSON, and returns the validated object.
      const response = await this.openai.beta.chat.completions.parse({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: userInput ,
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

      // Extract and return the validated payload
      const parsed = response.choices?.[0]?.message?.parsed;
      if (!parsed) {
        throw new Error("AIService: no parsed output received");
      }
      return parsed;
    }
  }
}

export default AIService;
