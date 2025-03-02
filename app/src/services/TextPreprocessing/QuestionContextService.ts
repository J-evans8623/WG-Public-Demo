/**
 * QuestionContextService.ts
 *
 * This service extracts semantically relevant context based on a user-provided text selection.
 * It performs the following:
 *   1. Generates an embedding from the given text selection using our modular embedding pipeline.
 *   2. Queries the Weaviate vector database for similar text chunks stored in the "TextChunk" class,
 *      filtering by the provided fileId.
 *   3. Aggregates the retrieved text chunks into a cohesive context string.
 *
 * Dependencies:
 *   - generateEmbedding from aiTextPreprocessing.ts for creating embeddings.
 *   - Weaviate client (weaviate-ts-client) for querying the vector database.
 */

import weaviate from 'weaviate-ts-client';
import { generateEmbedding } from './aiTextPreProcessing';

interface TextChunkResult {
  text: string;
  score: number;
}

const weaviateClient = weaviate.client({
  scheme: 'http',
  host: 'localhost:8080',
});

/**
 * getQuestionContext
 * 
 * Given a text selection and a fileId, this function:
 *   1. Generates an embedding for the text selection.
 *   2. Queries the Weaviate vector database for similar text chunks stored in the "TextChunk" class,
 *      filtering by the provided fileId.
 *   3. Aggregates the retrieved text chunks into a single context string.
 *
 * @param textSelection - The text input for which to retrieve context.
 * @param fileId - The file identifier used to filter text chunks.
 * @returns A Promise that resolves to an aggregated context string.
 */
export async function getTextContext(textSelection: string, fileId: string): Promise<string> {
  console.log('[QuestionContextService] getQuestionContext called with textSelection:', textSelection, 'and fileId:', fileId);
  try {
    const embedding = await generateEmbedding(textSelection);
    console.log('[QuestionContextService] Generated embedding:', embedding);

    const nearVector = {
      vector: embedding,
      distance: 0.3,
    };
    
    console.log('[QuestionContextService] Querying Weaviate with nearVector:', nearVector);
    const result = await weaviateClient.graphql.get()
      .withClassName('TextChunk')
      .withWhere({
        operator: "Equal",
        path: ["file_id"],
        valueString: fileId,
      })
      .withNearVector(nearVector)
      .withFields('text, _additional { distance }')
      .withLimit(5)
      .do();

    console.log('[QuestionContextService] Weaviate query result:', result);
    const chunks: TextChunkResult[] = result.data.Get.TextChunk.map((item: any) => ({
      text: item.text,
      score: item._additional.distance,
    }));
    const aggregatedContext = chunks.map(chunk => chunk.text).join(' ');
    console.log('[QuestionContextService] Aggregated context:', aggregatedContext);
    return aggregatedContext;
  } catch (error) {
    console.error("[QuestionContextService] Error in getQuestionContext:", error);
    throw error;
  }
}
