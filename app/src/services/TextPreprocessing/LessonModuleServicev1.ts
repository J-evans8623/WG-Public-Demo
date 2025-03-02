import axios from 'axios';
import { generateEmbedding, generateLessonMetadata } from './aiTextPreProcessing';
import weaviate from 'weaviate-ts-client';
import { kmeans } from 'ml-kmeans';

// Represents the final persisted lesson module.
export interface LessonModule {
  file_id: string;
  original_text: string; // The complete text (from the initial K-means clustering step)
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
}

// Represents a high-level overview of a lesson module.
export interface LessonSummary {
  moduleID: string;
  mainTopicTitle: string;
  summary: string;
}

/* ---------------- Weaviate Client Setup ---------------- */
const weaviateClient = weaviate.client({
  scheme: 'http',
  host: 'localhost:8080',
});

/**
 * Processes the full document text to generate and persist lesson modules and text chunks.
 *
 * @param fullText - The complete text of the document.
 * @param documentID - The ID of the bloomdocx instance associated with this document.
 */
export async function processDocument(fullText: string, documentID: string): Promise<void> {
  try {
    // Step 1: Split the full text into overlapping chunks.
    const chunks = splitTextIntoChunks(fullText, 3000, 500);

    // Assign a unique chunk ID to each chunk (e.g., "page-1", "page-2", ...).
    const numberedChunks = chunks.map((chunk, idx) => ({ chunk_id: `page-${idx + 1}`, chunk_text: chunk }));

    // Step 2: Generate embeddings for each text chunk.
    const embeddingPromises = numberedChunks.map(chunk => generateEmbedding(chunk.chunk_text));
    const embeddings = await Promise.all(embeddingPromises);

    // Step 3: Use K-means to split the document into lesson modules (chapters).
    // Heuristic: pageCount = fullText.length / 2500, then chapterEstimate = pageCount / 40.
    const pageCount = fullText.length / 2500;
    const chapterEstimate = pageCount / 40;
    const numModules = Math.round(chapterEstimate) || 1; // Ensure at least one module

    // Use ml-kmeans to cluster the embeddings.
    const moduleAssignments = clusterEmbeddings(embeddings, numModules);

    // Aggregate chunks and embeddings into separate modules.
    const modulesMap: Map<number, { chunks: { chunk_id: string; chunk_text: string }[]; embeddings: number[][] }> = new Map();
    moduleAssignments.forEach((moduleIdx, idx) => {
      if (!modulesMap.has(moduleIdx)) {
        modulesMap.set(moduleIdx, { chunks: [], embeddings: [] });
      }
      modulesMap.get(moduleIdx)!.chunks.push(numberedChunks[idx]);
      modulesMap.get(moduleIdx)!.embeddings.push(embeddings[idx]);
    });

    // For each lesson module (chapter), process HDBSCAN subtopic generation.
    for (const [moduleIdx, moduleData] of modulesMap.entries()) {
      // Concatenate all chunks to produce the full module text.
      const fullModuleText = moduleData.chunks.map(c => c.chunk_text).join(" ");

      // Call the Python microservice to perform HDBSCAN subtopic generation.
      const  hierarchicalResult = await callHierarchicalConceptMapService(documentID, moduleData.chunks, moduleData.embeddings, {        metric: 'cosine',
        num_depth1: 6,           // target number of depth-1 nodes
        min_depth1_size: 5,      // minimum number of chunks for a depth-1 cluster to be “non-trivial”
        num_depth2: 2,           // target number of depth-2 clusters within a parent
        min_depth2_size: 3       // minimum number of chunks for a depth-2 cluster
      });
      
      
      const refinedResult = updateHierarchicalResult(hierarchicalResult);
  console.log("Refined hierarchical result:", refinedResult);

      // Generate lesson metadata using the hierarchical JSON from the microservice.
      const metadata = await generateLessonMetadata(refinedResult);

      // Create the final LessonModule record.
      const lessonModule: LessonModule = {
        file_id: documentID,
        original_text: fullModuleText,
        metadata: {
          main_topic: {
            title: metadata.main_topic.title,
            subtopics: metadata.main_topic.subtopics // Already in the proper nested structure.
          },
          summary: metadata.summary || ""
        }
      };



      // Generate unique IDs for module-level metadata.
      const lesson_module_id = `module-${moduleIdx}-${new Date().getTime()}`;

      console.log(`lesson module id used in LessonModuleService # 1:  ${lesson_module_id}`);

       // Persist the lesson module to Weaviate.
      await persistLessonModule(lessonModule, lesson_module_id);
      const uploadId = `${documentID}-upload-1`;

      // Persist each text chunk as an individual TextChunk object.
      const textChunkRecords = moduleData.chunks.map((c, idx) => ({
        chunk_id: c.chunk_id,
        chunk_text: c.chunk_text,
        embedding: moduleData.embeddings[idx],
        file_id: documentID,
        lesson_module_title: metadata.main_topic.title,
        lesson_module_id,
        uploadId
      }));

      await persistTextChunks(textChunkRecords);
    }
  } catch (error) {
    console.error("Error in processDocument:", error);
    throw error;
  }
}


interface ClusteringOptions {
  metric?: string;
  num_depth1?: number;      // target number of depth-1 nodes
  min_depth1_size?: number; // minimum number of chunks for a depth-1 cluster to be non-trivial
  num_depth2?: number;      // target number of depth-2 clusters within a parent
  min_depth2_size?: number; // minimum number of chunks for a depth-2 cluster
}

/**
 * Makes an HTTP POST request to the Python microservice to generate subtopics using HDBSCAN.
 *
 * @param chunks - Array of text chunks (with chunk_id and chunk_text).
 * @param embeddings - Corresponding embedding vectors for the chunks.
 * @returns A Promise that resolves to the hierarchical clustering result.
 */
async function callHierarchicalConceptMapService(
  file_id: string,
  chunks: { chunk_id: string; chunk_text: string }[],
  embeddings: number[][],
  clusteringOptions?: ClusteringOptions
): Promise<any> {
  const payload = {
    file_id: file_id,
    text_chunks: chunks.map((chunk, idx) => ({
      chunk_id: chunk.chunk_id,
      text: chunk.chunk_text,
      embedding: embeddings[idx]
    })),
    clustering_options: clusteringOptions || {}  // Include options in the payload
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
 * Returns a list of lesson module overviews.
 *
 * @param documentID - The ID of the document.
 * @returns A Promise that resolves to an array of LessonSummary objects.
 */
export async function getLessonList(documentID: string): Promise<LessonSummary[]> {
  try {
    const result = await weaviateClient.graphql
      .get()
      .withClassName('LessonModule')
      // Now, request metadata as a simple field.
      .withFields('moduleID file_id metadata')
      .withWhere({
        operator: "Equal",
        path: ["file_id"],
        valueString: documentID,
      })
      .do();

    const modules = result.data.Get.LessonModule || [];
    const modulesMap: { [key: string]: any[] } = {};
    modules.forEach((record: any) => {
      // Parse metadata JSON string for each record.
      if (record.metadata) {
        try {
          record.metadata = JSON.parse(record.metadata);
        } catch (e) {
          console.error("Error parsing metadata:", e);
          record.metadata = null;
        }
      }
      const moduleID = record.moduleID || 'module-unknown';
      if (!modulesMap[moduleID]) {
        modulesMap[moduleID] = [];
      }
      modulesMap[moduleID].push(record);
    });

    const summaries: LessonSummary[] = Object.entries(modulesMap).map(([moduleID, parts]) => ({
      moduleID,
      mainTopicTitle: parts[0].metadata?.main_topic?.title || "",
      summary: parts[0].metadata?.summary || "",
    }));

    return summaries;
  } catch (error) {
    console.error("Error in getLessonList:", error);
    throw error;
  }
}



/**
 * Returns detailed metadata for a lesson module given its document ID and moduleID.
 *
 * @param documentID - The document ID.
 * @param moduleID - The lesson module ID.
 * @returns A Promise that resolves to a LessonModule.
 */
export async function getLessonModule(documentID: string, moduleID: string): Promise<LessonModule> {
  try {
    const result = await weaviateClient.graphql
      .get()
      .withClassName('LessonModule')
      // Fetch metadata as a plain field.
      .withFields(
        `moduleID 
         file_id 
         original_text 
         metadata`
      )
      .withWhere({
        operator: "And",
        operands: [
          {
            operator: "Equal",
            path: ["file_id"],
            valueString: documentID,
          },
          {
            operator: "Equal",
            path: ["moduleID"],
            valueString: moduleID,
          }
        ]
      })
      .do();

    const records = result.data.Get.LessonModule || [];
    if (!records || records.length === 0) {
      throw new Error(`Lesson module with ID ${moduleID} not found for document ${documentID}.`);
    }

    // Assume one record; if multiple, combine as before.
    const record = records.length === 1 ? records[0] : {
      file_id: documentID,
      original_text: records.map((r: any) => r.original_text).join("\n"),
      metadata: records[0].metadata,
    };

    // Parse the stored metadata JSON string back into an object.
    record.metadata = record.metadata ? JSON.parse(record.metadata) : null;
    return record;
  } catch (error) {
    console.error("Error in getLessonModule:", error);
    throw error;
  }
}



/* ---------------- Internal Helper Functions ---------------- */

/**
 * Splits the provided text into overlapping chunks.
 *
 * @param text - The full text to split.
 * @param chunkSize - Maximum size of each chunk (in characters).
 * @param overlap - Number of characters to overlap between chunks.
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
 * Clusters the given embeddings into k clusters using the ml-kmeans library.
 *
 * @param embeddings - Array of embedding vectors.
 * @param k - The number of clusters.
 * @returns An array of cluster indices for each embedding.
 */
function clusterEmbeddings(embeddings: number[][], k: number): number[] {
  const result = kmeans(embeddings, k, {});
  return result.clusters;
}

/**
 * Persists a LessonModule record to Weaviate.
 *
 * @param module - The LessonModule object to persist.
 */
async function persistLessonModule(module: LessonModule, moduleID: string): Promise<void> {
  console.log(`lesson module id used in LessonModuleService # 2:  ${moduleID}`);
  try {
    const response = await weaviateClient.data.creator()
      .withClassName('LessonModule')
      .withProperties({
        moduleID: moduleID,
        file_id: module.file_id,
        original_text: module.original_text,
        // Store metadata as a JSON string.
        metadata: JSON.stringify(module.metadata)
      })
      .do();
    //console.log("Successfully persisted lesson module:", response);
  } catch (error) {
    console.error("Error persisting lesson module to Weaviate:", error);
    throw error;
  }
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

/**
 * Persists each text chunk as a separate TextChunk object in Weaviate.
 *
 * @param chunks - Array of text chunk records to persist.
 */
async function persistTextChunks(chunks: Array<{
  chunk_id: string;
  chunk_text: string;
  embedding: number[];
  file_id: string;
  lesson_module_title: string;
  lesson_module_id: string;
  uploadId: string;
}>): Promise<void> {
  try {
    for (const chunk of chunks) {
      const response = await weaviateClient.data.creator()
        .withClassName('TextChunk')
        .withProperties({
          chunk_id: chunk.chunk_id,
          file_id: chunk.file_id,
          lesson_module_title: chunk.lesson_module_title,
          lesson_module_id: chunk.lesson_module_id,
          uploadId: chunk.uploadId,
          text: chunk.chunk_text,
          source: "original"
        })
        .withVector(chunk.embedding)
        .do();
      //console.log(`Persisted TextChunk ${chunk.chunk_id}:`, response);
    }
  } catch (error) {
    console.error("Error persisting text chunks to Weaviate:", error);
    throw error;
  }
}
