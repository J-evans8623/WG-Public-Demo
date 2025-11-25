/**
 * @file    services/aiServiceV2.ts
 * @summary AIService wraps Google Gemini 2.5 for structured JSON output.
 * * Update Phase 5: Strict Model Mapping.
 * Switches between 'gemini-2.5-flash' and 'gemini-2.5-flash-lite' 
 * based on the explicit 'model' parameter, separating "Reasoning Effort" 
 * from "Base Model Tier".
 */

import { GoogleGenAI, Type } from "@google/genai";
import UsageTracker from "../services/UsageTracker";

export interface JSONSchemaValidation {
  name: string;
  schema: any;
  strict: boolean;
}

export interface GenerateOptions {
  stream?: boolean;
  tracker?: UsageTracker;
  model?: "gpt-5-mini" | "gpt-5-nano"; 
  modeleffort?: "low" | "medium";
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
    console.log("[aiServiceV2.ts] Initialized @google/genai SDK");
  }

  public async generateStructuredOutput(
    jsonSchema: JSONSchemaValidation,
    userInput: string,
    systemPrompt: string,
    options: GenerateOptions = {}
  ): Promise<any> {
    
    // update - 2: Map generic model names to specific Gemini tiers
    // Default to Flash Standard if no hint provided or if "mini" requested
    let modelName = "gemini-2.5-flash-lite";
    
     if (options.model === "gpt-5-mini"){
       modelName = "gemini-2.5-flash"
    }
    
    // update - 3: Reasoning Effort (Budget) is now independent of Model Tier
    const effort = options.modeleffort || "low";
    const thinkingBudget = effort === "medium" ? 4096 : 512; 

    console.log(
      "[aiServiceV2.ts] generateStructuredOutput START",
      { 
        requested: options.model,
        mappedTo: modelName, 
        effort, 
        budget: thinkingBudget 
      }
    );

    const convertedSchema = this.convertSchemaToTypeEnums(jsonSchema.schema);

    return this.retryWithBackoff(async () => {

        const response = await this.ai.models.generateContent({
          model: modelName,
          contents: [{ role: "user", parts: [{ text: userInput }] }],
          config: {
            systemInstruction: [systemPrompt],
            responseMimeType: "application/json",
            responseSchema: convertedSchema,
            
            thinkingConfig: {
                includeThoughts: false,
                thinkingBudget: thinkingBudget
            }
          },
        });

        const usageMeta = (response as any).usageMetadata;
        
        if (options.tracker) {
          try {
            options.tracker.addCallUsageGeminiForModel(modelName, usageMeta);
          } catch (e) {
            console.warn("[aiServiceV2.ts] Failed to record usage in tracker:", e);
          }
        }

        // Log for debugging
        // console.log(`[aiServiceV2.ts] Raw API response text (snippet):`, response.text?.substring(0, 100) + "...");

        const jsonText = response.text;
        if (!jsonText) {
          throw new Error("No content received from the model");
        }

        try {
          return JSON.parse(jsonText);
        } catch (parseError) {
          console.error("[aiServiceV2.ts] Failed to parse JSON response", { rawText: jsonText });
          throw new Error(`Failed to parse structured output: ${parseError instanceof Error ? parseError.message : "Unknown parsing error"}`);
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
          console.warn(`[aiServiceV2.ts] Overloaded (503). Retry ${attempt}/${this.maxRetries}.`);
          await new Promise((r) => setTimeout(r, delay));
          delay *= 2;
          continue;
        }
        throw err;
      }
    }
  }

  private convertSchemaToTypeEnums(schema: any): any {
    if (!schema || typeof schema !== "object") return schema;
    const converted: any = { ...schema };
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
        converted.anyOf = [{ type: "null" }, objectBranch];
        delete converted.type; delete converted.properties; delete converted.required;
        delete converted.additionalProperties; delete converted.items;
      }
    }
    if (converted.type) {
        if (typeof converted.type === "string") { converted.type = this.stringToTypeEnum(converted.type); } 
        else if (Array.isArray(converted.type)) { converted.type = converted.type.map((t: string) => this.stringToTypeEnum(t)); }
    }
    if (converted.properties) { for (const key of Object.keys(converted.properties)) { converted.properties[key] = this.convertSchemaToTypeEnums(converted.properties[key]); } }
    if (converted.items) { converted.items = this.convertSchemaToTypeEnums(converted.items); }
    if (converted.anyOf && Array.isArray(converted.anyOf)) { converted.anyOf = converted.anyOf.map((sub: any) => this.convertSchemaToTypeEnums(sub)); }
    return converted;
  }

  private stringToTypeEnum(type: string): Type {
    switch (type.toLowerCase()) {
      case "object": return Type.OBJECT;
      case "array": return Type.ARRAY;
      case "string": return Type.STRING;
      case "number": return Type.NUMBER;
      case "integer": return Type.INTEGER;
      case "boolean": return Type.BOOLEAN;
      case "null": return Type.NULL;
      default: throw new Error(`Unsupported schema type: ${type}`);
    }
  }
}

export default AIService;