/**
 * @file services/UnifiedAIService.ts
 * @summary UnifiedAIService acts as a resilient facade over individual AI providers 
 * (OpenAI and Google Gemini). It implements a "Persistent Loop" strategy with 
 * "Dual-Schema" support.
 *
 * Responsibilities:
 * - Serve as the single entry point for AI generation requests.
 * - Accept a DualSchemaValidation object containing optimized schemas for BOTH providers.
 * - Orchestrate a failover loop: Prioritize OpenAI, switch to Gemini on failure.
 * - Dynamically inject the correct schema (OpenAI vs Gemini) into the request 
 * depending on which provider is currently active in the loop.
 * - Handle "Transient" errors (HTTP 429, 503) by swallowing the error, waiting, 
 * and retrying with the alternative provider.
 */

import AIService, { 
    JSONSchemaValidation as OpenAIJSONSchema, 
    GenerateOptions as OpenAIGenerateOptions 
} from './aiService';
import GeminiAIService, { 
    JSONSchemaValidation as GeminiJSONSchema 
} from './aiServiceV2';
import UsageTracker from './UsageTracker';

// The new contract: We must provide a schema for both to ensure safety.
export interface DualSchemaValidation {
  openai: OpenAIJSONSchema;
  gemini: GeminiJSONSchema;
}

export interface UnifiedGenerateOptions {
  stream?: boolean;
  tracker?: UsageTracker;
  // Hints for model selection, mapped dynamically inside the service
  model?: "gpt-5-mini" | "gpt-5-nano"; 
  modeleffort?: "low" | "medium";
}

type AIProvider = 'openai' | 'gemini';

class UnifiedAIService {
  private openAIService: AIService;
  private geminiService: GeminiAIService;

  // Configuration for the persistent loop
  private readonly MAX_ATTEMPTS = 20; 
  private readonly BASE_DELAY_MS = 1000;
  private readonly MAX_DELAY_MS = 30000; // Cap backoff at 30 seconds

  constructor() {
    this.openAIService = new AIService();
    this.geminiService = new GeminiAIService();
    console.log("[UnifiedAIService] Initialized with Dual-Schema strategy.");
  }

  /**
   * generateStructuredOutput
   * @description
   * The core method that guarantees structured output generation. 
   * It takes a `DualSchemaValidation` object. Depending on the `currentProvider` 
   * in the retry loop, it extracts the matching schema ensuring the AI 
   * always receives its native format.
   * * @param schemas - Object containing { openai: ..., gemini: ... }
   * @param userInput - The prompt or data context from the user.
   * @param systemPrompt - The system-level instructions.
   * @param options - Configuration options.
   */
  public async generateStructuredOutput(
    schemas: DualSchemaValidation,
    userInput: string,
    systemPrompt: string,
    options: UnifiedGenerateOptions = {}
  ): Promise<any> {
    
    let attempt = 1;
    let currentProvider: AIProvider = 'openai'; // Prioritize OpenAI
    let currentDelay = this.BASE_DELAY_MS;

    console.log(`[UnifiedAIService] Starting loop. Primary Schema: ${schemas.openai.name}`);

    while (attempt <= this.MAX_ATTEMPTS) {
      try {
        
        // Dynamic Dispatch based on provider
        if (currentProvider === 'openai') {
          return await this.callOpenAI(schemas.openai, userInput, systemPrompt, options);
        } else {
          return await this.callGemini(schemas.gemini, userInput, systemPrompt, options);
        }

      } catch (error: any) {
        // Step 1: Classify Error
        const isTransient = this.isTransientError(error);

        // Step 2: Handle Fatal Errors
        if (!isTransient) {
          console.error(`[UnifiedAIService] Fatal error on attempt ${attempt} (${currentProvider}).`, error);
          throw error;
        }

        // Step 3: Handle Transient Errors
        console.warn(
            `[UnifiedAIService] Transient error on attempt ${attempt} (${currentProvider}). ` +
            `Error: ${error.message || 'Unknown'}. Switching providers...`
        );

        // Toggle provider
        currentProvider = currentProvider === 'openai' ? 'gemini' : 'openai';

        // Apply Backoff
        if (attempt < this.MAX_ATTEMPTS) {
            console.log(`[UnifiedAIService] Waiting ${currentDelay}ms before retry...`);
            await this.delay(currentDelay);
            
            // Exponential Backoff with Jitter
            currentDelay = Math.min(
                this.MAX_DELAY_MS, 
                currentDelay * 2 + Math.floor(Math.random() * 500)
            );
        }
        
        attempt++;
      }
    }

    throw new Error(`UnifiedAIService: Failed to generate output after ${this.MAX_ATTEMPTS} attempts.`);
  }

  /**
   * Helper to execute OpenAI call
   */
  private async callOpenAI(
    schema: OpenAIJSONSchema, 
    input: string, 
    sysPrompt: string, 
    options: UnifiedGenerateOptions
  ) {
    const openAIOpts: OpenAIGenerateOptions = {
        stream: options.stream,
        tracker: options.tracker,
        model: options.model,
        modeleffort: options.modeleffort
    };
    return await this.openAIService.generateStructuredOutput(schema, input, sysPrompt, openAIOpts);
  }

  /**
   * Helper to execute Gemini call
   * Update - 1: Correctly passing 'model' and 'modeleffort' down to Gemini Service
   */
  private async callGemini(
    schema: GeminiJSONSchema, 
    input: string, 
    sysPrompt: string, 
    options: UnifiedGenerateOptions
  ) {
    return await this.geminiService.generateStructuredOutput(
        schema,
        input,
        sysPrompt,
        {
            stream: options.stream,
            tracker: options.tracker,
            model: options.model,
            modeleffort: options.modeleffort
        }
    );
  }

  /**
   * Determines if error is recoverable (429, 503) or fatal (400).
   */
  private isTransientError(error: any): boolean {
    const status = error?.status || error?.response?.status;
    const code = error?.error?.code || error?.code;
    const msg = (error?.message || '').toLowerCase();

    if (status === 429 || status >= 500) return true;
    if (code === 'rate_limit_exceeded' || code === 503 || code === 'unavailable') return true;
    if (msg.includes('fetch failed') || msg.includes('network') || msg.includes('timeout')) return true;

    // 400s are fatal (Bad Request, Invalid Schema)
    if (status >= 400 && status < 500) return false;

    return false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default UnifiedAIService;