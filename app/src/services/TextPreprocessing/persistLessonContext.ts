/**
 * @file app/src/services/TextPreprocessing/PersistLessonContext.ts
 * @description
 *   Fire-and-forget helper that
 *     1. splits the full document into chunks,
 *     2. generates an embedding for each chunk, and
 *     3. persists {chunk, vector} into Weaviate.
 *
 *   **SRP:** owns persistence only – the lesson-generation pipeline no longer blocks on this task.
 *   **DIP:** accepts an EmbeddingProvider so different models can be swapped in without edits.
 */

import weaviate from 'weaviate-ts-client';
import { generateEmbedding } from './aiTextPreProcessingV33';

export interface EmbeddingProvider {
  generate(text: string): Promise<number[]>;
}

function splitTextIntoChunks(text: string, chunkSize: number = 3000, overlap: number = 500): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.substring(start, end));
    const next = end - overlap;
    if (next <= start) break;
    start = next;
  }
  return chunks;
}

const defaultProvider: EmbeddingProvider = { generate: generateEmbedding };

const hst = process.env.WEAVIATE_HOST || ""
const weaviateClient = weaviate.client({
  scheme: 'http',
  host: hst,
});

async function persistTextChunks(
  records: Array<{
    chunk_id: string;
    chunk_text: string;
    embedding: number[];
    file_id: string;
    document_id: string;
    createdAt: Date;
  }>
): Promise<void> {
  for (const rec of records) {
    await weaviateClient.data
      .creator()
      .withClassName('TextChunk')
      .withProperties({
        chunk_id: rec.chunk_id,
        file_id: rec.file_id,
        document_id: rec.document_id,
        text: rec.chunk_text,
        createdAt: rec.createdAt.toISOString()
      })
      .withVector(rec.embedding)
      .do();
  }
}

/**
 * persistLessonContext
 * Runs asynchronously; callers should **not** await.
 */
export async function persistLessonContext(
  fullText: string,
  documentID: string,
  sourceFileId: string,
  provider: EmbeddingProvider = defaultProvider
): Promise<void> {
  try {
    const rawChunks = splitTextIntoChunks(fullText, 3000, 500);
    const numbered = rawChunks.map((chunk, idx) => ({
      chunk_id: `raw-page-${idx + 1}`,
      chunk_text: chunk
    }));

    const embeddings = await Promise.all(
      numbered.map(c => provider.generate(c.chunk_text))
    );

    const records = numbered.map((c, idx) => ({
      chunk_id: c.chunk_id,
      chunk_text: c.chunk_text,
      embedding: embeddings[idx],
      file_id: sourceFileId,
      document_id: documentID,
      createdAt: new Date()
    }));

    await persistTextChunks(records);
    console.info(
      `[PersistLessonContext] persisted ${records.length} text chunks for document ${documentID}`
    );
  } catch (err) {
    // Non-fatal: log and allow the lesson pipeline to continue.
    console.error('[PersistLessonContext] persistence failed:', err);
  }
}
