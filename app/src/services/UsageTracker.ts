/**
 * @file services/UsageTracker.ts
 * @description
 * Request-scoped, multi-model token & cost accumulator.
 * Refactored to support "Buckets" for mixing different models in a single trace.
 *
 * Responsibilities:
 * - Accumulate tokens (Prompt, Candidates, Thoughts) per model.
 * - Handle vendor-specific response shapes (OpenAI 'prompt_tokens' vs Gemini 'promptTokenCount').
 * - Apply per-model pricing logic (Paid Tier rates).
 * - Generate a consolidated cost summary for logs.
 *
 * Pricing Config (Per 1K tokens):
 * - GPT-5 Mini:        Input $0.00025 | Output $0.00200
 * - GPT-5 Nano:        Input $0.00005 | Output $0.00040
 * - Gemini Flash:      Input $0.00010 | Output $0.00040 (Approximate Paid Tier)
 * - Gemini Flash-Lite: Input $0.00005 | Output $0.00020 (Approximate Paid Tier)
 */

export type ModalityKey = 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'OTHER';

export interface PricePerModel {
  inputPer1k: number;
  outputPer1k: number;
  cachedInputPer1k?: number; 
}

export type PriceTable = Record<string, PricePerModel>;

interface Totals {
  prompt: number;
  candidates: number;
  total: number;
  thoughts: number; 
  billableOutput: number;
  cachedPrompt: number;
}

interface Bucket {
  model: string;
  calls: number;
  retries: number;
  totals: Totals;
}

function makeEmptyTotals(): Totals {
  return {
    prompt: 0,
    candidates: 0,
    total: 0,
    thoughts: 0,
    billableOutput: 0,
    cachedPrompt: 0,
  };
}

export class UsageTracker {
  private sessionId: string;
  private defaultModelName: string;
  
  // Storage: Keyed by model name (e.g., "gpt-5-nano", "gemini-2.5-flash")
  private buckets: Record<string, Bucket> = {};

  private defaultPriceTable: PriceTable = {
    // OpenAI Paid Tier
    'gpt-5-mini':         { inputPer1k: 0.00025, outputPer1k: 0.00200 },
    'gpt-5-nano':         { inputPer1k: 0.00005, outputPer1k: 0.00040, cachedInputPer1k: 0.000005 },
    
    // Gemini Paid Tier
    'gemini-2.5-flash':      { inputPer1k: 0.00010, outputPer1k: 0.00040 },
    'gemini-2.5-flash-lite': { inputPer1k: 0.00005, outputPer1k: 0.00020 },
  };

  constructor(sessionId: string, defaultModelName: string = 'unknown') {
    this.sessionId = sessionId;
    this.defaultModelName = defaultModelName;
  }

  private ensureBucket(modelName: string): Bucket {
    const key = modelName || this.defaultModelName;
    if (!this.buckets[key]) {
      this.buckets[key] = {
        model: key,
        calls: 0,
        retries: 0,
        totals: makeEmptyTotals()
      };
      console.log(`[UsageTracker.ts] Created bucket for model=${key}`);
    }
    return this.buckets[key];
  }

  /**
   * Record a retry attempt.
   */
  public addRetry(modelName?: string): void {
    const b = this.ensureBucket(modelName || this.defaultModelName);
    b.retries++;
  }

  /**
   * Ingest OpenAI Usage.
   * Handles both `input_tokens` (streaming) and `prompt_tokens` (standard).
   */
  public addCallUsageOpenAIForModel(modelName: string, usage: any): void {
    if (!usage) return;
    const bucket = this.ensureBucket(modelName);
    bucket.calls++;

    // Normalize fields
    const p = Number(usage.prompt_tokens ?? usage.input_tokens ?? 0);
    const c = Number(usage.completion_tokens ?? usage.output_tokens ?? 0);
    const t = Number(usage.total_tokens ?? (p + c));

    // Cache details (OpenAI specific)
    const inputDetails = usage.prompt_tokens_details || usage.input_tokens_details || {};
    const cachedIn = Number(inputDetails.cached_tokens ?? 0);

    bucket.totals.prompt += p;
    bucket.totals.candidates += c;
    bucket.totals.total += t;
    bucket.totals.cachedPrompt += cachedIn;
    bucket.totals.billableOutput += c;

    console.log(`[UsageTracker] Added OpenAI usage for ${modelName}: In=${p} Out=${c} Cached=${cachedIn}`);
  }

  /**
   * Ingest Gemini Usage.
   */
  public addCallUsageGeminiForModel(modelName: string, usageMetadata: any): void {
    if (!usageMetadata) return;
    const bucket = this.ensureBucket(modelName);
    bucket.calls++;

    const p = Number(usageMetadata.promptTokenCount || 0);
    const c = Number(usageMetadata.candidatesTokenCount || 0);
    const th = Number(usageMetadata.thoughtsTokenCount || 0); // Explicit thoughts
    const t = Number(usageMetadata.totalTokenCount || (p + c));

    bucket.totals.prompt += p;
    bucket.totals.candidates += c;
    bucket.totals.thoughts += th;
    bucket.totals.total += t;

    // Gemini billing: Output usually includes thoughts
    // If thoughts are explicit, billable = candidates + thoughts
    const billableOut = th > 0 ? (c + th) : c; 
    bucket.totals.billableOutput += billableOut;

    console.log(`[UsageTracker] Added Gemini usage for ${modelName}: In=${p} Out=${billableOut} (Thoughts=${th})`);
  }

  /**
   * Generates a consolidated cost report.
   */
  public toConsoleSummaryMulti(): void {
    let grandInput = 0;
    let grandOutput = 0;
    let grandCost = 0;

    console.log(`\n─── Cost Summary [${this.sessionId}] ───`);

    for (const key in this.buckets) {
      const b = this.buckets[key];
      const pricing = this.defaultPriceTable[key];
      const t = b.totals;

      const freshInput = Math.max(0, t.prompt - t.cachedPrompt);
      
      let costIn = 0;
      let costOut = 0;

      if (pricing) {
        // Calculate Input Cost
        if (pricing.cachedInputPer1k && t.cachedPrompt > 0) {
           costIn = (freshInput / 1000 * pricing.inputPer1k) + 
                    (t.cachedPrompt / 1000 * pricing.cachedInputPer1k);
        } else {
           costIn = (t.prompt / 1000 * pricing.inputPer1k);
        }

        // Calculate Output Cost
        costOut = (t.billableOutput / 1000 * pricing.outputPer1k);
      }

      const totalModelCost = costIn + costOut;
      grandInput += t.prompt;
      grandOutput += t.billableOutput;
      grandCost += totalModelCost;

      console.log(
        `• [${key}] Calls: ${b.calls} | Input: ${t.prompt} (${t.cachedPrompt} cached) | ` +
        `Output: ${t.billableOutput} | Est: $${totalModelCost.toFixed(5)}`
      );
    }

    console.log(`════════════════════════════════════════`);
    console.log(`GRAND TOTAL: In=${grandInput} Out=${grandOutput} | COST: $${grandCost.toFixed(5)}\n`);
  }
}

export default UsageTracker;