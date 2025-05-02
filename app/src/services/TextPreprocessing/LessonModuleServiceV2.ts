/**
 * @file LessonModuleServicev2.ts
 * @description
 *   This module provides services for generating lesson modules from text in an in-memory fashion.
 *   Previously, lesson modules were persisted to Weaviate; in this version, lesson modules are generated
 *   and returned without persistence. The text embeddings and raw text chunks are still persisted.
 *
 *   Key changes:
 *    - processDocument now returns a LessonModule object instead of persisting it.
 *    - A new helper function, generateLessonFromSegment, wraps processDocument and then calls the AI
 *      service (via AIController.generateLesson) to generate full lesson content.
 *    - AIController is imported (instead of AIService) and its generateLesson method is used.
 *
 *   This module is used by the GenerateLesson endpoint to process each text segment.
 *
 * @author  
 * @date    
 */

import axios from 'axios';
import { generateEmbedding, generateLessonMetadata } from './aiTextPreProcessing';
import weaviate from 'weaviate-ts-client';
import { kmeans } from 'ml-kmeans';
import AIController from '@/app/src/controllers/aiController';  // Corrected import: use AIController

// ------------------ Type Definitions ------------------

/**
 * LessonModule represents the structure of a lesson module.
 */
export interface LessonModule {
  file_id: string;
  original_text: string; // Combined text from the module
  metadata: {
    main_topic: {
      title: string;
      subtopics: Array<{
        title: string;
        subtopics: Array<{ title: string }>;
      }>;
    };
    summary: string;
  };
  // Field to store the AI-generated full lesson content
  fullLessonContent?: any;
}

/**
 * LessonSummary provides a high-level overview of a lesson module.
 */
export interface LessonSummary {
  moduleID: string;
  mainTopicTitle: string;
  summary: string;
}

/**
 * Updates the hierarchical result by adding a "hasNestedTopic" field to each depth‑1 subtopic.
 * For leaf nodes, the field will read "DO NOT CREATE SUBTOPICS for this topic" and any depth‑2 subtopics are removed.
 * For parent nodes, the field will read "This topic has subtopic".
 *
 * @param hierarchicalResult - The JSON object returned from the microservice.
 * @returns The updated hierarchical result.
 */
function updateHierarchicalResult(hierarchicalResult: any): any {
  // Check if the input has a depth1_subtopics array.
  if (!hierarchicalResult || !Array.isArray(hierarchicalResult.depth1_subtopics)) {
    return hierarchicalResult;
  }

  // Process each depth1 subtopic
  hierarchicalResult.depth1_subtopics = hierarchicalResult.depth1_subtopics.map((subtopic: any) => {
    if (subtopic.node_type === "leaf") {
      // For leaf nodes, instruct not to create further subtopics and remove any depth2 nodes.
      return {
        ...subtopic,
        hasNestedTopic: "DO NOT CREATE SUBTOPICS for this topic",
        depth2_subtopics: null,
      };
    } else if (subtopic.node_type === "parent") {
      // For parent nodes, indicate that the node has subtopics.
      return {
        ...subtopic,
        hasNestedTopic: "This topic has subtopic",
      };
    } else {
      // Fallback in case node_type is not specified.
      return {
        ...subtopic,
        hasNestedTopic: "DO NOT CREATE SUBTOPICS for this topic",
      };
    }
  });

  return hierarchicalResult;
}

// ------------------ Weaviate Client Setup ------------------
const weaviateClient = weaviate.client({
  scheme: 'http',
  host: 'localhost:8080',
});

// ------------------ Core Functions ------------------

/**
 * processDocument
 * 
 * Processes the given text (typically one segment) to generate lesson metadata.
 * It splits the text into overlapping chunks, generates embeddings, clusters them,
 * calls a hierarchical subtopic generation service, and produces lesson metadata.
 * 
 * This function is refactored to return a LessonModule object in memory,
 * rather than persisting the lesson module to Weaviate.
 *
 * @param fullText - The text to process.
 * @param documentID - The ID of the associated document.
 * @returns A Promise that resolves to a LessonModule object.
 */
export async function processDocument(
  fullText: string,
   documentID: string,
   sourceFileId: string
  ): Promise<LessonModule> {
  try {
    // Step 1: Split the text into overlapping chunks.
    const chunks = splitTextIntoChunks(fullText, 3000, 500);
    const numberedChunks = chunks.map((chunk, idx) => ({
      chunk_id: `page-${idx + 1}`,
      chunk_text: chunk,
    }));

    // Step 2: Generate embeddings for each chunk.
    const embeddingPromises = numberedChunks.map(chunk => generateEmbedding(chunk.chunk_text));
    const embeddings = await Promise.all(embeddingPromises);

    // 2.b Persist all raw text chunks + embeddings in Weaviate.
    const chunkRecords = numberedChunks.map((chunk, idx) => ({
      chunk_id:   chunk.chunk_id,
      chunk_text: chunk.chunk_text,
      embedding:  embeddings[idx],
      file_id:    sourceFileId,
      document_id: documentID,
      createdAt:  new Date(),
    }));
    await persistTextChunks(chunkRecords);


    // Step 3: Cluster embeddings using K-means.
    // Heuristic: pageCount = fullText.length / 2500, chapterEstimate = pageCount / 40.
    const pageCount = fullText.length / 2500;
    const chapterEstimate = pageCount / 30;
    // For a given segment, we expect one module.
    const numModules = Math.round(chapterEstimate) || 1;

    // Cluster embeddings.
    const moduleAssignments = clusterEmbeddings(embeddings, numModules);

    // Aggregate all chunks into a single module.
    const moduleData = { chunks: [] as { chunk_id: string; chunk_text: string }[], embeddings: [] as number[][] };
    moduleAssignments.forEach((moduleIdx, idx) => {
      // For in-memory processing we combine all chunks.
      moduleData.chunks.push(numberedChunks[idx]);
      moduleData.embeddings.push(embeddings[idx]);
    });

    // Step 4: Concatenate chunks to form the full module text.
    const fullModuleText = moduleData.chunks.map(c => c.chunk_text).join(" ");

    // Step 5: Call the Python microservice for hierarchical subtopic generation.
    const hierarchicalResult = await callHierarchicalConceptMapService(
      documentID,
      moduleData.chunks,
      moduleData.embeddings,
      {
        metric: 'cosine',
        num_depth1: 6,
        min_depth1_size: 5,
        num_depth2: 2,
        min_depth2_size: 3,
      }
    );
    const refinedResult = updateHierarchicalResult(hierarchicalResult);
    console.log("Refined hierarchical result:", refinedResult);

    // Step 6: Generate lesson metadata using the AI text preprocessing.
    const metadata = await generateLessonMetadata(refinedResult);

    // Assemble and return the LessonModule.
    const lessonModule: LessonModule = {
      file_id: documentID,
      original_text: fullModuleText,
      metadata: {
        main_topic: {
          title: metadata.main_topic.title,
          subtopics: metadata.main_topic.subtopics,
        },
        summary: metadata.summary || "",
      },
    };
    return lessonModule;
  } catch (error) {
    console.error("Error in processDocument:", error);
    throw error;
  }
}

/**
 * generateLessonFromSegment
 * 
 * Generates a lesson module for a given text segment.
 * This function wraps processDocument to create a lesson module from the segment,
 * then invokes the AI service (via AIController.generateLesson) to generate the
 * full lesson content. The final lesson module is returned.
 *
 * @param segment - The pre-segmented text input.
 * @param documentID - The document ID.
 * @returns A Promise that resolves to the fully generated LessonModule.
 */
export async function generateLessonFromSegment(
  segment: string,
  documentID: string,
  sourceFileId: string
): Promise<LessonModule> {
  console.log(` issue 88 generateLessonFromSegment invoked for documentID: ${documentID} with segment length: ${segment.length}`);
  try {
    // Step 1: Generate a basic lesson module from the text segment.
    const basicLessonModule = await processDocument(segment, documentID, sourceFileId);

    // Step 2: Generate full lesson content using the AI service.
    // Instead of instantiating AIService directly, call the generateLesson method from AIController.
    // We assume that AIController.generateLesson has been refactored to accept a lesson module (or its metadata)
    // and return an updated lesson module with full content.
    const finalLessonModule = await AIController.generateLesson(basicLessonModule);
    console.log(finalLessonModule)
    return finalLessonModule;
  } catch (error) {
    console.error("Error in generateLessonFromSegment:", error);
    throw error;
  }
}

// ------------------ Internal Helper Functions ------------------

/**
 * Splits the provided text into overlapping chunks.
 *
 * @param text - The text to split.
 * @param chunkSize - Maximum size of each chunk (default: 2500 characters).
 * @param overlap - Number of characters to overlap (default: 500).
 * @returns An array of text chunks.
 */
function splitTextIntoChunks(text: string, chunkSize: number = 2500, overlap: number = 500): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.substring(start, end));
    const newStart = end - overlap;
    if (newStart <= start) break;
    start = newStart;
  }
  return chunks;
}

/**
 * Clusters embeddings into k clusters using ml-kmeans.
 *
 * @param embeddings - Array of embedding vectors.
 * @param k - Number of clusters.
 * @returns An array of cluster indices.
 */
function clusterEmbeddings(embeddings: number[][], k: number): number[] {
  const result = kmeans(embeddings, k, {});
  return result.clusters;
}

/**
 * Calls the Python microservice to generate hierarchical subtopics using HDBSCAN.
 *
 * @param file_id - The document ID.
 * @param chunks - Array of text chunks.
 * @param embeddings - Embedding vectors corresponding to each chunk.
 * @param clusteringOptions - Options for clustering.
 * @returns A Promise that resolves to the hierarchical clustering result.
 */
async function callHierarchicalConceptMapService(
  file_id: string,
  chunks: { chunk_id: string; chunk_text: string }[],
  embeddings: number[][],
  clusteringOptions?: {
    metric?: string;
    num_depth1?: number;
    min_depth1_size?: number;
    num_depth2?: number;
    min_depth2_size?: number;
  }
): Promise<any> {
  const payload = {
    file_id,
    text_chunks: chunks.map((chunk, idx) => ({
      chunk_id: chunk.chunk_id,
      text: chunk.chunk_text,
      embedding: embeddings[idx],
    })),
    clustering_options: clusteringOptions || {},
  };

  try {
    const response = await axios.post("http://localhost:8000/generate_subtopics", payload);
    return response.data;
  } catch (error) {
    console.error("Error calling HDBSCAN microservice:", error);
    throw error;
  }
}

/**
 * persistTextChunks
 *
 * Writes each chunk+vector into the `TextChunk` class of Weaviate,
 * using the full minimal schema: chunk_id, file_id, document_id, text, createdAt + vector.
 */
async function persistTextChunks(chunks: Array<{
  chunk_id: string;
  chunk_text: string;
  embedding: number[];
  file_id: string;
  document_id: string;
  createdAt: Date;
}>): Promise<void> {
  try {
    for (const c of chunks) {
      const result: any = await weaviateClient.data
        .creator()
        .withClassName('TextChunk')
        .withProperties({
          chunk_id:    c.chunk_id,
          file_id:     c.file_id,
          document_id: c.document_id,
          text:        c.chunk_text,
          createdAt:   c.createdAt.toISOString(),
        })
        .withVector(c.embedding)
        .do();

        console.log(
          '[persistTextChunks] Successfully stored chunk',
          c.chunk_id,
          '– Weaviate object ID:',
          result?.id || '(no id returned)'
        );
    }
  } catch (err) {
    console.error('persistTextChunks error:', err);
    throw err;
  }
}

/**
 * persistRawEmbeddings
 *
 * Used when a PDF is uploaded without lesson generation.
 * Splits the full text into chunks, embeds, and persists all to Weaviate
 * under the given file_id + document_id so they can later be retrieved
 * by document_id for Q&A or exploration pipelines.
 *
 * @param fullText      - Entire extracted text of the PDF.
 * @param documentID    - The editor session’s document identifier.
 * @param sourceFileId  - Unique identifier for this file upload.
 */
export async function persistRawEmbeddings(
  fullText: string,
  documentID: string,
  sourceFileId: string
): Promise<void> {
  try {
    // 1. Chunk the text
    const rawChunks = splitTextIntoChunks(fullText, 3000, 500);
    const numbered = rawChunks.map((chunk, idx) => ({
      chunk_id:   `raw-page-${idx + 1}`,
      chunk_text: chunk,
    }));

    // 2. Embed each chunk
    const embeddings = await Promise.all(
      numbered.map(c => generateEmbedding(c.chunk_text))
    );

    // 3. Prepare records and persist
    const records = numbered.map((c, idx) => ({
      chunk_id:    c.chunk_id,
      chunk_text:  c.chunk_text,
      embedding:   embeddings[idx],
      file_id:     sourceFileId,
      document_id: documentID,
      createdAt:   new Date(),
    }));
    await persistTextChunks(records);
  } catch (error) {
    console.error('persistRawEmbeddings error:', error);
    throw error;
  }
}