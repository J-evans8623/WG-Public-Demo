/**
 * @file UsageTracker.ts
 * @description
 *   Request-scoped, multi-model token & cost accumulator for AI model calls made during one
 *   logical “lesson generation” run. This tracker aggregates prompt (input), candidates (output),
 *   totals, and—when available—reasoning/“thoughts” tokens across multiple API calls and retries.
 *   It supports **mixing providers and models in a single request** by normalizing each vendor’s
 *   usage metadata into a unified internal shape and storing usage in **per-model buckets**. The
 *   tracker records optional modality breakdowns (TEXT/IMAGE/AUDIO/VIDEO), tool/cache hints (when
 *   exposed by SDKs), and prints a consolidated console summary (plus a compact JSON line) either
 *   as a legacy single-model summary or as a **per-model breakdown with a grand total**. For Gemini
 *   2.5 Flash, the “output” price includes thinking tokens and the tracker prefers
 *   `(candidates + thoughts)` when available; for OpenAI GPT-5 Nano the tracker recognizes cached
 *   input tokens and prices them at the discounted rate when configured. Pricing is stored in a
 *   per-model table (per 1K tokens) with optional cached-input pricing and can be overridden at
 *   print time. All methods are defensive against missing fields and default to zero where needed.
 *   Time complexity is O(1) per call addition and O(M) for final summarization where M is the
 *   number of distinct models used (typically very small), making the tracker suitable for
 *   high-throughput serverless environments.
 *
 *   Pricing (Gemini 2.5 Flash, paid tier; per 1K):
 *     • Input (text/image/video): $0.0003
 *     • Output (incl. thinking):  $0.0025
 *
 *   Pricing (OpenAI GPT-5 Nano, paid tier; per 1K)
 *     • Input (fresh):     $0.00005  (=$0.05 / 1M)
 *     • Input (cached):    $0.000005 (=$0.005 / 1M)
 *     • Output:            $0.00040  (=$0.40 / 1M)
 *
 *   Pricing (OpenAI GPT-5 Mini, paid tier; per 1K)  // update - 6
 *     • Input (fresh):     $0.00025  (=$0.25 / 1M)   // update - 6
 *     • Output:            $0.00200  (=$2.00 / 1M)   // update - 6
 *
 *   Important (Gemini):
 *     • Gemini 2.5 Flash “output price” includes *thinking* tokens.
 *       When the SDK exposes thoughts explicitly (thoughtsTokenCount),
 *       we compute billable output as: candidates + thoughts.
 *       If thoughts are not exposed, we fall back to (total - prompt),
 *       or the conservative max(candidates, total - prompt).
 *
 *   Important (OpenAI):
 *     • When available, we read input_tokens_details to detect cached input
 *       tokens and price them using cached rates for eligible models.
 */

export type ModalityKey = 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'OTHER';

export interface PricePerModel {
  inputPer1k: number;            // price per 1K input (prompt) tokens in USD
  outputPer1k: number;           // price per 1K output (candidate+thinking) tokens in USD
  cachedInputPer1k?: number;     // optional price per 1K cached input tokens (OpenAI)
}

export type PriceTable = Record<string, PricePerModel>;

type ModalityBucket = { prompt: number; candidates: number; total: number };

interface Totals {
  prompt: number;
  candidates: number;
  total: number;
  thoughts: number;       // explicit thinking tokens (Gemini)
  byModality: Record<ModalityKey, ModalityBucket>;
  cache: number;          // SDK-reported cache tokens (Gemini hints)
  tools: number;          // SDK-reported tool-use prompt tokens (Gemini hints)
  billableOutput: number; // candidates + thoughts (preferred) or fallback
  cachedPrompt: number;   // cached input tokens (OpenAI adapter)
}

interface Bucket { // update - 6
  model: string;
  calls: number;
  retries: number;
  totals: Totals;
}

function makeEmptyTotals(): Totals { // update - 6
  return {
    prompt: 0,
    candidates: 0,
    total: 0,
    thoughts: 0,
    byModality: {
      TEXT:  { prompt: 0, candidates: 0, total: 0 },
      IMAGE: { prompt: 0, candidates: 0, total: 0 },
      AUDIO: { prompt: 0, candidates: 0, total: 0 },
      VIDEO: { prompt: 0, candidates: 0, total: 0 },
      OTHER: { prompt: 0, candidates: 0, total: 0 },
    },
    cache: 0,
    tools: 0,
    billableOutput: 0,
    cachedPrompt: 0,
  };
}

export class UsageTracker {
  private sessionId: string;
  private modelName: string; // default bucket model (legacy)
  private calls = 0;         // legacy counters for single-model mode
  private retries = 0;       // legacy counters for single-model mode
  private totals: Totals;    // legacy single-bucket totals

  // New: per-model buckets keyed by model name                           // update - 6
  private buckets: Record<string, Bucket> = {};                          // update - 6

  private defaultPriceTable: PriceTable = {
    // Gemini 2.5 Flash (paid tier)
    'gemini-2.5-flash': { inputPer1k: 0.0003, outputPer1k: 0.0025 },
    // OpenAI GPT-5 Nano (paid tier)
    'gpt-5-nano': { inputPer1k: 0.00005, cachedInputPer1k: 0.000005, outputPer1k: 0.00040 },
    // OpenAI GPT-5 Mini (paid tier)                                       // update - 6
    'gpt-5-mini': { inputPer1k: 0.00025, outputPer1k: 0.00200 },         // update - 6
  };

  /**
   * @function constructor
   * @description
   *   Initialize a tracker for a single run. `modelName` acts as the **default bucket** name
   *   for backwards compatibility with single-model call sites. Mixed-model requests can still
   *   add usage into other model buckets explicitly; otherwise, usage lands in this default.
   */
  constructor(sessionId: string, modelName: string) {
    this.sessionId = sessionId;
    this.modelName = modelName;
    this.totals = makeEmptyTotals();
    // create default bucket immediately for clarity                       // update - 6
    this.ensureBucket(this.modelName);                                    // update - 6
  }

  // ───────────────────────────────
  // Bucket utilities (internal)
  // ───────────────────────────────

  /** Get or create a per-model bucket. O(1). */                           // update - 6
  private ensureBucket(model: string): Bucket {
    if (!this.buckets[model]) {
      this.buckets[model] = {
        model,
        calls: 0,
        retries: 0,
        totals: makeEmptyTotals(),
      };
      // Debug breadcrumb
      console.log(`[UsageTracker.ts][9201] Created bucket for model=${model}`); // update - 6
    }
    return this.buckets[model];
  }

  /** Record a retry; optionally scoped to a model bucket. O(1). */        // update - 6
  public addRetry(modelName?: string): void {
    if (modelName) {
      const b = this.ensureBucket(modelName);
      b.retries += 1;
    } else {
      this.retries += 1; // legacy
      const b = this.ensureBucket(this.modelName);
      b.retries += 1;
    }
  }

  // ───────────────────────────────
  // Gemini adapter(s)
  // ───────────────────────────────

  /**
   * Add usage from SDK usageMetadata for a single successful Gemini call into the **default** bucket.
   * Defensive: missing fields are treated as zero.
   */
  public addCallUsage(usageMetadata: any | null | undefined): void {
    // Legacy path → default bucket
    this.addCallUsageGeminiForModel(this.modelName, usageMetadata); // update - 6
  }

  /**
   * Add usage for Gemini into a specific model bucket (e.g., 'gemini-2.5-flash'). O(1).
   * This is the preferred method for multi-model workflows.
   */
  public addCallUsageGeminiForModel(modelName: string, usageMetadata: any | null | undefined): void { // update - 6
    if (!usageMetadata) return;

    const bucket = this.ensureBucket(modelName);
    bucket.calls += 1;

    const p = Number(usageMetadata.promptTokenCount || 0);
    const c = Number(usageMetadata.candidatesTokenCount || 0);
    const t = Number(
      usageMetadata.totalTokenCount != null
        ? usageMetadata.totalTokenCount
        : p + c
    );
    const th = Number(usageMetadata.thoughtsTokenCount || 0);

    // Accumulate raw fields (bucket)
    bucket.totals.prompt     += p;
    bucket.totals.candidates += c;
    bucket.totals.total      += t;
    bucket.totals.thoughts   += th;

    // Preferred billable output: candidates + thoughts (when thoughts provided)
    const tMinusP = Math.max(0, t - p);
    const billableOutThisCall = th > 0 ? (c + th) : Math.max(c, tMinusP);
    bucket.totals.billableOutput += billableOutThisCall;

    // Modality details (if provided)
    const promptDetails = Array.isArray(usageMetadata.promptTokensDetails) ? usageMetadata.promptTokensDetails : [];
    const candidateDetails = Array.isArray(usageMetadata.candidatesTokensDetails) ? usageMetadata.candidatesTokensDetails : [];

    for (const d of promptDetails) {
      const key = (String(d.modality || 'OTHER').toUpperCase() as ModalityKey) || 'OTHER';
      const amt = Number(d.tokenCount || 0);
      this.bumpModality(bucket, key, 'prompt', amt);
    }
    for (const d of candidateDetails) {
      const key = (String(d.modality || 'OTHER').toUpperCase() as ModalityKey) || 'OTHER';
      const amt = Number(d.tokenCount || 0);
      this.bumpModality(bucket, key, 'candidates', amt);
    }

    bucket.totals.cache += Number(usageMetadata.cachedContentTokenCount || 0);
    bucket.totals.tools += Number(usageMetadata.toolUsePromptTokenCount || 0);

    // Keep legacy single-model counters in sync **only** when writing to default bucket
    if (modelName === this.modelName) {                                     // update - 6
      this.calls += 1;
      this.totals.prompt       += p;
      this.totals.candidates   += c;
      this.totals.total        += t;
      this.totals.thoughts     += th;
      this.totals.billableOutput += billableOutThisCall;
      this.totals.cache        += Number(usageMetadata.cachedContentTokenCount || 0);
      this.totals.tools        += Number(usageMetadata.toolUsePromptTokenCount || 0);

      // Modality mirror
      for (const d of promptDetails) {
        const key = (String(d.modality || 'OTHER').toUpperCase() as ModalityKey) || 'OTHER';
        const amt = Number(d.tokenCount || 0);
        this.bumpModalityLegacy(key, 'prompt', amt);
      }
      for (const d of candidateDetails) {
        const key = (String(d.modality || 'OTHER').toUpperCase() as ModalityKey) || 'OTHER';
        const amt = Number(d.tokenCount || 0);
        this.bumpModalityLegacy(key, 'candidates', amt);
      }
    }

    console.log('[UsageTracker.ts][9202] Gemini usage added', { modelName, p, c, th, t, billableOutThisCall }); // update - 6
  }

  // ───────────────────────────────
  // OpenAI adapter(s)
  // ───────────────────────────────

  /**
   * Legacy OpenAI adapter → default bucket.
   */
  public addCallUsageOpenAI(usage: any | null | undefined): void {
    this.addCallUsageOpenAIForModel(this.modelName, usage); // update - 6
  }

  /**
   * Add usage for OpenAI into a specific model bucket (e.g., 'gpt-5-nano'). O(1).
   * Recognizes cached input tokens when present and tracks them for pricing.
   */
  public addCallUsageOpenAIForModel(modelName: string, usage: any | null | undefined): void { // update - 6
    if (!usage) return;

    const bucket = this.ensureBucket(modelName);
    bucket.calls += 1;

    const p = Number(usage.input_tokens  || 0);
    const c = Number(usage.output_tokens || 0);
    const t = Number(
      usage.total_tokens != null
        ? usage.total_tokens
        : p + c
    );

    // Extract cached input tokens if present
    const inputDetails = usage.input_tokens_details || {};
    const cachedIn = Number(
      inputDetails.cached_tokens ??
      inputDetails.cached_input_tokens ??
      inputDetails.cache_read_tokens ??
      0
    );
    const cachedClamped = Math.min(Math.max(cachedIn, 0), p);

    // Accumulate into bucket
    bucket.totals.prompt       += p;
    bucket.totals.candidates   += c;
    bucket.totals.total        += t;
    bucket.totals.billableOutput += c;
    bucket.totals.cachedPrompt += cachedClamped;

    // Put everything under TEXT for breakdown (OpenAI does not expose modalities here)
    this.bumpModality(bucket, 'TEXT', 'prompt', p);
    this.bumpModality(bucket, 'TEXT', 'candidates', c);

    // Mirror legacy if default bucket
    if (modelName === this.modelName) {                                     // update - 6
      this.calls += 1;
      this.totals.prompt       += p;
      this.totals.candidates   += c;
      this.totals.total        += t;
      this.totals.billableOutput += c;
      this.totals.cachedPrompt += cachedClamped;
      this.bumpModalityLegacy('TEXT', 'prompt', p);
      this.bumpModalityLegacy('TEXT', 'candidates', c);
    }

    console.log('[UsageTracker.ts][9203] OpenAI usage added', { modelName, p, c, cachedClamped, t }); // update - 6
  }

  // ───────────────────────────────
  // Manual count (unchanged)
  // ───────────────────────────────

  /** Fallback when streaming usage is unavailable → default bucket. */
  public addManualCount(promptTokens: number, candidateTokens: number): void {
    const model = this.modelName;
    const bucket = this.ensureBucket(model); // update - 6
    bucket.calls += 1;

    const p = Math.max(0, Number(promptTokens || 0));
    const c = Math.max(0, Number(candidateTokens || 0));

    bucket.totals.prompt     += p;
    bucket.totals.candidates += c;
    bucket.totals.total      += (p + c);
    bucket.totals.billableOutput += c;
    this.bumpModality(bucket, 'TEXT', 'prompt', p);
    this.bumpModality(bucket, 'TEXT', 'candidates', c);

    // legacy mirror
    this.calls += 1;
    this.totals.prompt     += p;
    this.totals.candidates += c;
    this.totals.total      += (p + c);
    this.totals.billableOutput += c;
    this.bumpModalityLegacy('TEXT', 'prompt', p);
    this.bumpModalityLegacy('TEXT', 'candidates', c);

    console.log('[UsageTracker.ts][9204] Manual count added', { model, p, c }); // update - 6
  }

  private bumpModality(
    bucket: Bucket,
    key: ModalityKey,
    kind: 'prompt' | 'candidates',
    amt: number
  ): void {
    const b = bucket.totals.byModality[key] || bucket.totals.byModality.OTHER;
    b[kind] += amt;
    b.total = b.prompt + b.candidates;
  }

  // legacy modality bump for this.totals                                    // update - 6
  private bumpModalityLegacy(
    key: ModalityKey,
    kind: 'prompt' | 'candidates',
    amt: number
  ): void {
    const b = this.totals.byModality[key] || this.totals.byModality.OTHER;
    b[kind] += amt;
    b.total = b.prompt + b.candidates;
  }

  // ───────────────────────────────
  // Summaries
  // ───────────────────────────────

  /**
   * Print a legacy single-model summary. If more than one bucket is present,
   * this method delegates to the multi-model summary for accuracy. O(M).
   */
  public toConsoleSummary(priceTable?: PriceTable): void {
    const bucketNames = Object.keys(this.buckets); // update - 6
    if (bucketNames.length > 1) {                  // update - 6
      console.log('[UsageTracker.ts][9205] Multiple model buckets detected — using multi-model summary'); // update - 6
      this.toConsoleSummaryMulti(priceTable);      // update - 6
      return;                                      // update - 6
    }

    const table = priceTable && Object.keys(priceTable).length > 0 ? priceTable : this.defaultPriceTable;
    const model = this.modelName;
    const price = table[model];

    const inputTokens  = this.totals.prompt;
    const cachedTokens = this.totals.cachedPrompt; // OpenAI adapter only
    const freshTokens  = Math.max(0, inputTokens - cachedTokens);

    let costIn = 0;
    if (price) {
      if (price.cachedInputPer1k != null && cachedTokens > 0) {
        costIn = (freshTokens / 1000) * price.inputPer1k + (cachedTokens / 1000) * price.cachedInputPer1k;
      } else {
        costIn = (inputTokens / 1000) * price.inputPer1k;
      }
    }

    const outputTokens = this.totals.billableOutput;
    const costOut = price ? (outputTokens / 1000) * price.outputPer1k : 0;
    const costAll = costIn + costOut;

    console.log(
      `[aiCost][run=${this.sessionId}] model=${model} calls=${this.calls} retries=${this.retries}\n` +
      `Totals: prompt=${this.totals.prompt} candidates=${this.totals.candidates} thoughts=${this.totals.thoughts} total=${this.totals.total}\n` +
      `Cached input tokens=${cachedTokens} | Fresh input tokens=${freshTokens}\n` +
      `Billable output (cand+thinking)=${outputTokens}\n` +
      `Breakdown (TEXT=${this.totals.byModality.TEXT.total}, IMAGE=${this.totals.byModality.IMAGE.total}, ` +
      `AUDIO=${this.totals.byModality.AUDIO.total}, VIDEO=${this.totals.byModality.VIDEO.total}, OTHER=${this.totals.byModality.OTHER.total})\n` +
      (this.totals.cache > 0 ? `Cache tokens (Gemini hint): ${this.totals.cache}\n` : '') +
      (this.totals.tools > 0 ? `Tool-use tokens (Gemini hint): ${this.totals.tools}\n` : '') +
      (price
        ? `Est. cost: input=$${costIn.toFixed(6)} output=$${costOut.toFixed(6)} total=$${costAll.toFixed(6)}`
        : `Est. cost: (no price table entry for model "${model}")`
      )
    );

    const json = {
      tag: "aiCost",
      run: this.sessionId,
      model,
      calls: this.calls,
      retries: this.retries,
      totals: this.totals,
      pricing: price || null,
      estCost: price ? { input: costIn, output: costOut, total: costAll } : null,
    };
    console.log(`[aiCost-json][UsageTracker.ts][9101] ${JSON.stringify(json)}`);
  }

  /**
   * Print a per-model breakdown and a grand total across **all** buckets. O(M).
   * This is the recommended summary for mixed-model requests.
   */
  public toConsoleSummaryMulti(priceTable?: PriceTable): void { // update - 6
    const table = priceTable && Object.keys(priceTable).length > 0 ? priceTable : this.defaultPriceTable;

    const byModel: Record<string, any> = {};
    let grandInput = 0, grandCached = 0, grandOutput = 0, grandCostIn = 0, grandCostOut = 0;

    for (const [model, bucket] of Object.entries(this.buckets)) {
      const price = table[model];
      const t = bucket.totals;

      const inputTokens  = t.prompt;
      const cachedTokens = t.cachedPrompt;
      const freshTokens  = Math.max(0, inputTokens - cachedTokens);
      const outputTokens = t.billableOutput;

      // Compute input cost (respect cached pricing if defined)
      let costIn = 0;
      if (price) {
        if (price.cachedInputPer1k != null && cachedTokens > 0) {
          costIn = (freshTokens / 1000) * price.inputPer1k + (cachedTokens / 1000) * price.cachedInputPer1k;
        } else {
          costIn = (inputTokens / 1000) * price.inputPer1k;
        }
      }
      const costOut = price ? (outputTokens / 1000) * price.outputPer1k : 0;

      byModel[model] = {
        calls: bucket.calls,
        retries: bucket.retries,
        tokens: {
          prompt: t.prompt,
          candidates: t.candidates,
          thoughts: t.thoughts,
          total: t.total,
          cachedPrompt: t.cachedPrompt,
          billableOutput: t.billableOutput,
        },
        pricing: price || null,
        estCost: price ? { input: costIn, output: costOut, total: costIn + costOut } : null,
      };

      // Accumulate grand totals
      grandInput  += inputTokens;
      grandCached += cachedTokens;
      grandOutput += outputTokens;
      grandCostIn += costIn;
      grandCostOut += costOut;

      // Pretty print per-model line
      console.log(
        `[aiCost][run=${this.sessionId}][model=${model}] calls=${bucket.calls} retries=${bucket.retries}\n` +
        `Totals: prompt=${t.prompt} candidates=${t.candidates} thoughts=${t.thoughts} total=${t.total}\n` +
        `Cached input tokens=${cachedTokens} | Fresh input tokens=${freshTokens}\n` +
        `Billable output (cand+thinking)=${outputTokens}\n` +
        (price
          ? `Est. cost: input=$${costIn.toFixed(6)} output=$${costOut.toFixed(6)} total=$${(costIn + costOut).toFixed(6)}`
          : `Est. cost: (no price table entry for model "${model}")`
        )
      );
    }

    // Grand total line
    console.log(
      `[aiCost][run=${this.sessionId}][GRAND] inputTokens=${grandInput} cachedInput=${grandCached} ` +
      `outputTokens=${grandOutput} costIn=$${grandCostIn.toFixed(6)} costOut=$${grandCostOut.toFixed(6)} ` +
      `total=$${(grandCostIn + grandCostOut).toFixed(6)}`
    );

    // Structured JSON for ingestion
    const json = {
      tag: "aiCost",
      run: this.sessionId,
      byModel,
      grand: {
        inputTokens: grandInput,
        cachedInputTokens: grandCached,
        outputTokens: grandOutput,
        cost: { input: grandCostIn, output: grandCostOut, total: grandCostIn + grandCostOut }
      }
    };
    console.log(`[aiCost-json][UsageTracker.ts][9102] ${JSON.stringify(json)}`); // update - 6
  }
}

export default UsageTracker;
