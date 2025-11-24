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
 *  const service = new AIService();
 *  // Batch:
 *  const result = await service.generateStructuredOutput(schema, userInput, systemPrompt);
 *  // Streaming:
 *  const stream = await service.generateStructuredOutput(schema, userInput, systemPrompt, { stream: true });
 */

import OpenAI from "openai";
import UsageTracker from "../services/UsageTracker";

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
  tracker?: UsageTracker;
  model?:"gpt-5-mini" | "gpt-5-nano",
  modeleffort?: "low" | "medium",
}

class AIService {
  private openai!: OpenAI; // update - 3
  private readonly maxRetries = 5;
  private readonly initialBackoffMs = 500;

  /**
   * Zero-arg constructor. Internally initializes the OpenAI client using
   * process.env.OPENAI_API_KEY for consistency with aiServiceV2.ts. // update - 3
   */
  constructor() { // update - 3
    this.ensureClient(); // update - 3
    console.log("[AIService] Initialized with OpenAI client (gpt-5-nano)"); // update - 3
  }

  /**
   * Lazily ensures an OpenAI client exists, throwing a clear error if the key is missing. // update - 3
   */
  private ensureClient(): void { // update - 3
    if ((this as any)._clientReady) return;
    const key = process.env.OPENAI_API_KEY;
    if (!key || key.trim().length === 0) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }
    this.openai = new OpenAI({ apiKey: key });
    (this as any)._clientReady = true;
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



    const defaultmodel = "gpt-5-mini";
    const deafult_effort = "low";

    let modelName = options.model? options.model : defaultmodel;
    let model_r_effort = options.modeleffort? options.modeleffort : deafult_effort;

    console.log("[AIService] generateStructuredOutput:", {
      schema: jsonSchema.name,
      prompt: systemPrompt,
      stream: options.stream === true,
    });

    this.ensureClient(); // update - 3

    return this.retryWithBackoff(async () => {

      // --- Batch Mode ---
      const response = await this.openai.beta.chat.completions.parse({
        model: modelName,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userInput },
        ],
        reasoning_effort: model_r_effort,
        response_format: { 
          type: "json_schema",
          json_schema: {
            name: jsonSchema.name,
            schema: jsonSchema.schema,
            strict: jsonSchema.strict
          }
        }
      });

      const usageMeta = (response as any).usage;
      console.log(`Openai model usage summary tak67 \n :${JSON.stringify(usageMeta)}`);
      if (options.tracker) {
        try {
          options.tracker.addCallUsageOpenAIForModel(modelName, usageMeta);
        } catch (e) {
          console.warn("[aiService.ts][1002] Failed to record usage in tracker:", e); // update - 3
        }
      }

      const parsed = response.choices?.[0]?.message?.parsed;

      //console.log(`Inspecting response: aiService.ts 7x7x : \n ${JSON.stringify(parsed)}`)
      if (!parsed) {
        throw new Error("AIService: no parsed output received");
      }
      return parsed;
    }, options.tracker); 
  }

  /**
   * retryWithBackoff
   * @description
   *   Generic retry for transient 503. Records retry attempts in UsageTracker
   *   if provided so the final console summary shows them.
   */
  private async retryWithBackoff<T>(fn: () => Promise<T>, tracker?: UsageTracker): Promise<T> { // update - 3
    let attempt = 0;
    let delay = this.initialBackoffMs;

    while (true) {
      try {
        return await fn();
      } catch (err: any) {
        const isOverload = err?.status === 503 || err?.error?.code === 503;
        if (isOverload && attempt < this.maxRetries) {
          attempt++;
          if (tracker) { try { tracker.addRetry(); } catch {} }
          console.warn("[AIService][openai] 503 overloaded.", `Retry ${attempt}/${this.maxRetries} in ${delay}ms.`);
          await new Promise(r => setTimeout(r, delay));
          delay *= 2;
          continue;
        }
        console.error("[AIService][openai] Non-recoverable error", {
          status: err?.status,
          code: err?.error?.code,
          message: err?.message,
          details: err?.error?.details,
        });
        console.error("[AIService][openai] Full error object:", err);
        throw err;
      }
    }
  }
}

export default AIService;
