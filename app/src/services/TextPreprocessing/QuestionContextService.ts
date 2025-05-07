/**
 * @file QuestionContextService.ts                                           *
 * @description                                                               *
 *   Retrieves semantically‑relevant context for a user query by:             *
 *     1. Generating an embedding for the query text.                         *
 *     2. Pulling the *top‑k* nearest `TextChunk` objects for the same        *
 *        `document_id` from Weaviate **without** an a‑priori distance        *
 *        ceiling.                                                            *
 *     3. Keeping every chunk whose distance ≤ (topDistance × DIST_FACTOR)    *
 *        where `topDistance` is the best (lowest) distance in the batch      *
 *        and `DIST_FACTOR` defaults to `1.2`.                                *
 *     4. Concatenating and hard‑truncating the result to ≤ 10 pages          *
 *        (≈ 25 000 characters).                                              *
 *                                                                           *
 *   Schema assumptions for the `TextChunk` class:                            *
 *     - chunk_id    (string)                                                 *
 *     - file_id     (string)                                                 *
 *     - document_id (string)                                                 *
 *     - text        (text)                                                   *
 *     - createdAt   (date)                                                   *
 */

import weaviate from 'weaviate-ts-client';
import { generateEmbedding } from './aiTextPreProcessing';

interface TextChunkResult {
  text:  string;
  score: number;           // cosine distance (lower is better)
}

/* -------------------------------------------------------------------------- */
/*                    0.  Weaviate client (env‑configurable)                  */
/* -------------------------------------------------------------------------- */
const weaviateClient = weaviate.client({
  scheme: process.env.WEAVIATE_SCHEME || 'http',
  host:   process.env.WEAVIATE_HOST   || 'localhost:8080',
});

/* -------------------------------------------------------------------------- */
/*                              1.  Main Helper                               */
/* -------------------------------------------------------------------------- */

/**
 * Retrieves contextual text for a given query within the bounds of one Y‑Doc.
 *
 * @param queryText     Free‑text query or highlight from the user.
 * @param documentId    Shared `document_id` tying all uploads in the session.
 * @param topK          How many neighbours to fetch *before* post‑filtering.      (default = 5)
 * @param distFactor    Retain chunks with distance ≤ bestDistance × distFactor.  (default = 1.2)
 */
export async function getTextContext(
  queryText : string,
  documentId: string,
  topK      : number  = 5,
  distFactor: number  = 1.2
): Promise<string>
{
  console.log('[QuestionContextService] === getTextContext START ===');
  console.log('[QuestionContextService] Inputs:', { queryText, documentId, topK, distFactor });

  /* ---------------------------------------------------------------------- */
  /* 1. Generate embedding                                                  */
  /* ---------------------------------------------------------------------- */
  const embedding = await generateEmbedding(queryText);
  console.log(
    '[QuestionContextService] Embedding generated:',
    `dim=${embedding.length}, first5=${embedding.slice(0,5).map(n => n.toFixed(4)).join(',')}`
  );

  /* ---------------------------------------------------------------------- */
  /* 2. Build & execute Weaviate GraphQL query                              */
  /*    –  NO hard distance ceiling here; we post‑filter in code            */
  /* ---------------------------------------------------------------------- */
  const whereFilter =  { operator: 'Equal' as const, path: ['document_id'], valueString: documentId };
  const response    = await weaviateClient.graphql
    .get()
    .withClassName('TextChunk')
    .withWhere(whereFilter)
    .withNearVector({ vector: embedding })    // <- no “distance” key
    .withFields('text _additional { distance }')
    .withLimit(topK)
    .do();

  console.log('[QuestionContextService] Raw response:', JSON.stringify(response, null, 2));

  const rawItems = response?.data?.Get?.TextChunk;
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    console.warn('[QuestionContextService] No chunks returned from Weaviate');
    return '';
  }

  /* ---------------------------------------------------------------------- */
  /* 3. Map -> internal structure & inspect                                 */
  /* ---------------------------------------------------------------------- */
  const chunks: TextChunkResult[] = rawItems.map((it: any, i: number) => {
    const score = Number(it._additional?.distance ?? Infinity);
    console.log(`[QC] Candidate ${i}: dist=${score.toFixed(4)}, len=${it.text.length}`);
    return { text: it.text as string, score };
  }).sort((a, b) => a.score - b.score);

  const bestDistance = chunks[0].score;
  const cutoff       = bestDistance * distFactor;
  const keptChunks   = chunks.filter(c => c.score <= cutoff);

  console.log(`[QC] bestDistance=${bestDistance.toFixed(4)}, cutoff=${cutoff.toFixed(4)}`);
  console.log('[QC] Distances kept:', keptChunks.map(c => c.score.toFixed(4)));

  /* ---------------------------------------------------------------------- */
  /* 4. Aggregate & truncate (≤ 25 000 chars ≈ 10 pages)                    */
  /* ---------------------------------------------------------------------- */
  const MAX_CHARS = 2_500 * 10;
  let context     = '';

  for (const { text, score } of keptChunks) {
    if (context.length + text.length <= MAX_CHARS) {
      context += text + ' ';
      console.log(`[QC] +chunk (dist=${score.toFixed(4)}), newLen=${context.length}`);
    } else {
      const remaining = MAX_CHARS - context.length;
      if (remaining > 0) {
        context += text.slice(0, remaining);
        console.log(`[QC] +slice (${remaining} chars) to fill cap`);
      }
      break;
    }
  }

  context = context.trimEnd();
  console.log('[QuestionContextService] Final context length:', context.length);
  console.log(
    '[QuestionContextService] Preview:',
    `"${context.slice(0, 200)}${context.length > 200 ? '…' : ''}"`
  );
  console.log('[QuestionContextService] === getTextContext END ===');

  return context;
}
