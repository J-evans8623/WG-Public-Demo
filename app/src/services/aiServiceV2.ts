/**
 * @file    services/aiServiceV2.ts
 * @summary AIService wraps Google Gemini 2.5 Flash for structured JSON output,
 *          with retries and detailed logging of raw responses and error metadata.
 *
 * Responsibilities:
 *  - Initialize a Gemini 2.5 Flash client via @google/genai.
 *  - Generate structured JSON output (batch or streaming) validated against a JSON Schema.
 *  - Retry transient 503 “model overloaded” errors with exponential backoff.
 *  - Convert raw JSONSchemaValidation into Type-enum schema for the SDK.
 *  - Log raw API responses and error details (token usage, failure reasons) for observability.
 */

import { GoogleGenAI, Type } from "@google/genai";
import UsageTracker from "../services/UsageTracker";

export interface JSONSchemaValidation {
  name: string;
  schema: {
    type?: string | string[];
    anyOf?: any[];
    properties?: Record<string, any>;
    required?: string[];
    additionalProperties?: boolean;
    items?: any;
    propertyOrdering?: string[];
    description?: string;
  };
  strict: boolean;
}

export interface GenerateOptions {
  stream?: boolean;
  tracker?: UsageTracker;
}

class AIService {
  private ai: GoogleGenAI;
  private readonly maxRetries = 5;
  private readonly initialBackoffMs = 500;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not set");
    }
    this.ai = new GoogleGenAI({ apiKey });
    console.log("[aiServiceV2.ts][1000] Initialized @google/genai SDK with Gemini 2.5-Flash");
  }

  

  public async generateStructuredOutput(
    jsonSchema: JSONSchemaValidation,
    userInput: string,
    systemPrompt: string,
    options: GenerateOptions = {}
  ): Promise<any> {
    console.log(
      "[aiServiceV2.ts][1001] generateStructuredOutput START",
      { schema: jsonSchema.name, stream: !!options.stream }
    );

    const modelName = "gemini-2.5-flash";

    const convertedSchema = this.convertSchemaToTypeEnums(jsonSchema.schema);

    return this.retryWithBackoff(async () => {

        const response = await this.ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [{ role: "user", parts: [{ text: userInput }] }],
          config: {
            systemInstruction: [systemPrompt],
            responseMimeType: "application/json",
            responseSchema: convertedSchema,
          },
        });

        const usageMeta = (response as any).usageMetadata;
        if (options.tracker) {
          try {
            options.tracker.addCallUsageGeminiForModel(modelName, usageMeta);;
          } catch (e) {
            console.warn("[aiServiceV2.ts][1002] Failed to record usage in tracker:", e);
          }
        }

        // 1002: log raw response for debugging
         console.log("[aiServiceV2.ts][1002] Raw API response:", response);
        console.log("[aiServiceV2.ts][1002] Raw API response:", response.text);

        // If the SDK exposes usageMetadata, you can log it like this:
        console.log(
          "[aiServiceV2.ts][1002] Usage metadata:",
          (response as any).usageMetadata
        );

        const jsonText = response.text;
        if (!jsonText) {
          throw new Error("No content received from the model");
        }

        try {
          return JSON.parse(jsonText);
        } catch (parseError) {
          // 1003: JSON parse failure, include raw and metadata
          console.error(
            "[aiServiceV2.ts][1003] Failed to parse JSON response",
            {
              rawText: jsonText,
              usageMetadata: (response as any).usageMetadata,
            }
          );
          throw new Error(
            `Failed to parse structured output: ${
              parseError instanceof Error ? parseError.message : "Unknown parsing error"
            }`
          );
        }
      
    });
  }

  private async retryWithBackoff<T>(fn: () => Promise<T>): Promise<T> {
    let attempt = 0;
    let delay = this.initialBackoffMs;

    while (true) {
      try {
        return await fn();
      } catch (err: unknown) {
        const e = err as any;
        const isOverload = e.status === 503 || e.error?.code === 503;
        if (isOverload && attempt < this.maxRetries) {
          attempt++;
          console.warn(
            "[aiServiceV2.ts][1005] Overloaded (503).",
            `Retry ${attempt}/${this.maxRetries} in ${delay}ms.`
          );
          await new Promise((r) => setTimeout(r, delay));
          delay *= 2;
          continue;
        }
        // 1006: non-recoverable error—dump full error for root-cause analysis
        console.error(
          "[aiServiceV2.ts][1006] Non-recoverable error",
          {
            status: e.status,
            code: e.error?.code,
            message: e.message,
            details: e.error?.details,
          }
        );
        console.error("[aiServiceV2.ts][1006] Full error object:", e);
        throw err;
      }
    }
  }

  // inside AIService
private convertSchemaToTypeEnums(schema: any): any {
  if (!schema || typeof schema !== "object") return schema;
  const converted: any = { ...schema };

  // --- normalize "nullable object" shapes ---
  // If type includes NULL and OBJECT and we have object-specific keywords at this level,
  // rewrite to anyOf: [ {type: NULL}, {type: OBJECT, ...objectBits} ]
  const toArray = (v: any) => Array.isArray(v) ? v : [v];
  const hasObjBits = (s: any) => !!(s && (s.properties || s.required || s.additionalProperties !== undefined || s.items));

  if (converted.type) {
    const types = toArray(converted.type).map((t: string) => String(t).toLowerCase());
    const isNullableObject = types.includes("null") && types.includes("object") && hasObjBits(converted);

    if (isNullableObject) {
      const objectBranch: any = { type: "object" };
      if (converted.properties) objectBranch.properties = converted.properties;
      if (converted.required) objectBranch.required = converted.required;
      if (converted.additionalProperties !== undefined) objectBranch.additionalProperties = converted.additionalProperties;
      if (converted.items) objectBranch.items = converted.items;

      // Build anyOf and remove the conflicting top-level bits
      converted.anyOf = [{ type: "null" }, objectBranch];
      delete converted.type;
      delete converted.properties;
      delete converted.required;
      delete converted.additionalProperties;
      delete converted.items;
    }
  }

  // now proceed with your existing enum conversion
  if (converted.type) {
    if (typeof converted.type === "string") {
      converted.type = this.stringToTypeEnum(converted.type);
    } else if (Array.isArray(converted.type)) {
      converted.type = converted.type.map((t: string) => this.stringToTypeEnum(t));
    }
  }

  if (converted.properties) {
    for (const key of Object.keys(converted.properties)) {
      converted.properties[key] = this.convertSchemaToTypeEnums(converted.properties[key]);
    }
  }

  if (converted.items) {
    converted.items = this.convertSchemaToTypeEnums(converted.items);
  }

  if (converted.anyOf && Array.isArray(converted.anyOf)) {
    converted.anyOf = converted.anyOf.map((sub: any) => this.convertSchemaToTypeEnums(sub));
  }

  return converted;
}


  private stringToTypeEnum(type: string): Type {
    switch (type.toLowerCase()) {
      case "object":
        return Type.OBJECT;
      case "array":
        return Type.ARRAY;
      case "string":
        return Type.STRING;
      case "number":
        return Type.NUMBER;
      case "integer":
        return Type.INTEGER;
      case "boolean":
        return Type.BOOLEAN;
      case "null":
        return Type.NULL;
      default:
        throw new Error(`Unsupported schema type: ${type}`);
    }
  }
}

export default AIService;
