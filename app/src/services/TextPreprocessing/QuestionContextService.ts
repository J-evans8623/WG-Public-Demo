/**
 * @file QuestionContextService.ts
 * @description
 *   Retrieves semantically relevant text context for a user query by:
 *     1. Generating an embedding for the input text.
 *     2. Performing a near-vector search in Weaviate’s TextChunk class,
 *        scoped by the shared document_id property.
 *     3. Aggregating and truncating the top-ranked chunks into a single context string,
 *        ensuring it never exceeds 10 pages (≈ 25 000 characters).
 *
 *   This service assumes the TextChunk schema includes:
 *     - chunk_id    (string)
 *     - file_id     (string)
 *     - document_id (string)
 *     - text        (text)
 *     - createdAt   (date)
 */

import weaviate from 'weaviate-ts-client';
import { generateEmbedding } from './aiTextPreProcessing';

interface TextChunkResult {
  text:  string;
  score: number;
}

/** Configure Weaviate client via environment or fallback */
const weaviateClient = weaviate.client({
  scheme: process.env.WEAVIATE_SCHEME || 'http',
  host:   process.env.WEAVIATE_HOST   || 'localhost:8080',
});

/**
 * getTextContext
 *
 * Generates context for a query by:
 *   1. Embedding the query.
 *   2. Querying Weaviate for nearest TextChunk within the same document.
 *   3. Sorting, aggregating, and truncating to ≤ 25 000 characters.
 *
 * Extensive logging is included for each internal step.
 *
 * @param queryText     The user’s input to find context for.
 * @param documentId    The document_id to filter chunks by.
 * @param topK          Number of chunks to retrieve (default: 5).
 * @param maxDistance   Maximum vector distance (default: 0.3).
 * @returns             The aggregated, truncated context string.
 */
export async function getTextContext(
  queryText: string,
  documentId: string,
  topK: number = 5,
  maxDistance: number = 0.3
): Promise<string> {
  console.log('[QuestionContextService] === getTextContext START ===');
  console.log('[QuestionContextService] Inputs:', {
    queryText,
    documentId,
    topK,
    maxDistance
  });

  try {
    // 1. Generate embedding for the query text
    const embedding = await generateEmbedding(queryText);
    console.log(
      '[QuestionContextService] Embedding generated:',
      Array.isArray(embedding)
        ? `vector length=${embedding.length}, first dims=${embedding.slice(0,5).map(n=>n.toFixed(4)).join(',')}…`
        : embedding
    );

    // 2. Build filters for Weaviate query
    const nearVector = { vector: embedding, distance: maxDistance };
    const whereFilter = {
      operator:  'Equal' as const,
      path:      ['document_id'],
      valueString: documentId,
    };
    console.log('[QuestionContextService] nearVector:', nearVector);
    console.log('[QuestionContextService] whereFilter:', whereFilter);

    // 3. Execute GraphQL query
    const response = await weaviateClient
      .graphql.get()
      .withClassName('TextChunk')
      .withWhere(whereFilter)
      .withNearVector(nearVector)
      .withFields('text _additional { distance }')
      .withLimit(topK)
      .do();

    console.log('[QuestionContextService] Raw GraphQL response:', JSON.stringify(response, null, 2));

    const rawItems = response?.data?.Get?.TextChunk;
    if (!Array.isArray(rawItems)) {
      console.warn('[QuestionContextService] No TextChunk array in response—returning empty context');
      return '';
    }
    console.log(`[QuestionContextService] Retrieved ${rawItems.length} raw items`);

    // 4. Map to internal type and sort by ascending distance
    const chunks: TextChunkResult[] = rawItems
      .map((item: any, idx: number) => {
        const text = item.text as string;
        const score = item._additional?.distance ?? Infinity;
        console.log(`[QuestionContextService] Item ${idx}: score=${score.toFixed(4)}, textLength=${text.length}`);
        return { text, score };
      })
      .sort((a, b) => a.score - b.score);

    console.log('[QuestionContextService] Sorted chunks by score:', chunks.map(c => c.score.toFixed(4)));

    // 5. Aggregate & truncate to max 10 pages (≈ 25 000 chars)
    const CHARS_PER_PAGE  = 2500;
    const MAX_PAGES       = 10;
    const MAX_TOTAL_CHARS = CHARS_PER_PAGE * MAX_PAGES; // 25000
    let aggregated = '';
    console.log(`[QuestionContextService] Truncation cap: ${MAX_TOTAL_CHARS} chars`);

    for (let i = 0; i < chunks.length; i++) {
      const { text, score } = chunks[i];
      if (aggregated.length + text.length <= MAX_TOTAL_CHARS) {
        aggregated += text + ' ';
        console.log(
          `[QuestionContextService] Added chunk ${i} (score=${score.toFixed(4)}), new length=${aggregated.length}`
        );
      } else {
        const remaining = MAX_TOTAL_CHARS - aggregated.length;
        console.log(
          `[QuestionContextService] Chunk ${i} would exceed cap. Remaining budget=${remaining}`
        );
        if (remaining > 0) {
          aggregated += text.slice(0, remaining);
          console.log(
            `[QuestionContextService] Sliced chunk ${i} to ${remaining} chars, final length=${aggregated.length}`
          );
        }
        break;
      }
    }

    const finalContext = aggregated.trim();
    console.log(
      `[QuestionContextService] === getTextContext END === finalContext length=${finalContext.length}`
    );
    console.log(
      '[QuestionContextService] Context preview:',
      `"${finalContext.slice(0, 200)}${finalContext.length > 200 ? '…' : ''}"`
    );

    return finalContext;
  } catch (err) {
    console.error('[QuestionContextService] Error during getTextContext:', err);
    throw err;
  }
}
