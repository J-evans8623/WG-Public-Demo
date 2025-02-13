/**
 * QuestionContextService.ts
 *
 * This file provides a service for extracting semantically relevant context based on a user-selected text.
 * It is responsible for:
 *  1. Generating an embedding from the provided text selection using our modular embedding pipeline.
 *  2. Querying the Weviate vector database for similar text chunks.
 *  3. Aggregating the retrieved text chunks into a cohesive context string.
 *
 * Dependencies:
 *  - The modular embedding pipeline (aiTextPreProcessing.ts) for generating embeddings.
 *  - Weviate client (weaviate-ts-client) for interacting with the vector database.
 */

import weaviate from 'weaviate-ts-client';
// Import the generateEmbedding function from our new modular pipeline.
import { generateEmbedding } from './aiTextPreProcessing';

/**
 * Interface representing a single text chunk result returned from Weviate.
 */
interface TextChunkResult {
  text: string;
  score: number;
}

// Create and configure a Weviate client instance.
// Adjust the scheme, host, and authentication details as needed.
const weaviateClient = weaviate.client({
  scheme: 'http',
  host: 'localhost:8080', // Update this to your Weviate server address.
});

/**
 * getQuestionContext
 * 
 * Given a text selection from the user, this function performs the following:
 *  1. Calls generateEmbedding() from the aiTextPreProcessing module to obtain an embedding vector.
 *  2. Queries the Weviate vector database for similar text chunks using the generated embedding.
 *  3. Aggregates the retrieved text chunks into a single context string.
 *
 * @param textSelection - The text highlighted by the user.
 * @returns A Promise that resolves to an aggregated context string.
 */
export async function getQuestionContext(textSelection: string): Promise<string> {
  try {
    // Step 1: Generate an embedding for the highlighted text using the new modular pipeline.
    const embedding = await generateEmbedding(textSelection);

    // Step 2: Define the search query parameters for Weviate.
    // We assume text chunks are stored in a Weviate class called "TextChunk" with a "text" property.
    const nearVector = {
      vector: embedding,
      distance: 0.3, // Adjust the threshold as needed.
    };

    // Query the Weviate database for similar text chunks.
    const result = await weaviateClient.graphql.get()
      .withClassName('LessonModule')
      .withNearVector(nearVector)
      .withFields('text, _additional { distance }')
      .withLimit(5) // Retrieve the top 5 similar text chunks.
      .do();

    // Step 3: Extract the text chunks from the result.
    const chunks: TextChunkResult[] = result.data.Get.TextChunk.map((item: any) => ({
      text: item.text,
      score: item._additional.distance,
    }));

    // Aggregate all retrieved text chunks into a single context string.
    const aggregatedContext = chunks.map(chunk => chunk.text).join(' ');

    return aggregatedContext;
  } catch (error) {
    console.error("Error in getQuestionContext:", error);
    throw error;
  }
}

/**
 * Note:
 * This service is intended to be used as part of the backend (BFF). For example, the frontend
 * can call an API endpoint that wraps getQuestionContext(), allowing the backend to directly
 * access this function and provide the aggregated context to the AI model.
 */
