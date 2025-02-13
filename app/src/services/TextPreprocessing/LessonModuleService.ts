/**
 * LessonModuleService.ts
 *
 * This file implements the lesson module generation pipeline.
 * Its responsibilities include:
 *  - Processing a full document's text into overlapping chunks.
 *  - Generating semantic embeddings for each text chunk.
 *  - Clustering the embeddings into a target number of lesson modules.
 *  - For each cluster, generating a high-level topic title and extracting subtopics via an LLM.
 *  - Aggregating the text chunks for each cluster into a comprehensive lesson module.
 *  - Persisting each lesson module into Weaviate for later retrieval.
 *  - Exposing interfaces to:
 *      - getLessonList(): Return a numbered list of lesson module summaries.
 *      - getLessonModule(moduleID): Return detailed metadata for a selected lesson module.
 *
 * As modules are processed, asynchronous notifications are emitted so that the frontend
 * can be alerted immediately when an individual module is ready.
 */

import { generateEmbedding, generateLessonMetadata } from './aiTextPreProcessing';
import { EventEmitter } from 'events';
import weaviate from 'weaviate-ts-client';

/**
 * Updated interfaces:
 * - We add documentID (to associate lesson modules with a bloomdocx)
 * - We add modulePart (to indicate the segment index)
 * - Note that a lesson module now is stored as multiple records (an array) for a given moduleID.
 */
export interface LessonSummary {
  moduleID: string;
  topic: string;
}

export interface LessonModule {
  moduleID: string;
  documentID: string;    // New field to associate with a bloomdocx instance.
  modulePart: number;    // New field: the segment index.
  topic: string;
  subtopics: string[];
  textChunk: string;
  embedding: number[];
}

// Update in-memory storage: now grouping by moduleID.
const lessonModules: { [moduleID: string]: LessonModule[] } = {};

// Event emitter for asynchronous notifications.
const lessonEventEmitter = new EventEmitter();

// Configure the Weaviate client.
const weaviateClient = weaviate.client({
  scheme: 'http',
  host: 'localhost:8080',
});

/**
 * Splits the provided text into overlapping chunks.
 *
 * @param text - The full text to split.
 * @param chunkSize - Maximum size of each chunk (in characters).
 * @param overlap - Number of characters to overlap between chunks.
 * @returns An array of text chunks.
 */
function splitTextIntoChunks(text: string, chunkSize: number = 500, overlap: number = 100): string[] {
  if (chunkSize <= overlap) {
    throw new Error("chunkSize must be greater than overlap");
  }
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.substring(start, end));
    start += chunkSize - overlap;
  }
  return chunks;
}

/**
 * Placeholder clustering function.
 */
function clusterEmbeddings(embeddings: number[][], k: number): number[] {
  return embeddings.map(() => Math.floor(Math.random() * k));
}

/**
 * Persists a lesson module record (i.e. a segment) to Weaviate.
 */
async function persistLessonModule(module: LessonModule): Promise<void> {
  try {
    const response = await weaviateClient.data.creator()
      .withClassName('LessonModule')
      .withProperties({
        moduleID: module.moduleID,
        documentID: module.documentID,
        modulePart: module.modulePart,
        text: module.textChunk,
        topic: module.topic,
        subtopics: module.subtopics,
        embedding: module.embedding,
      })
      .do();
    
    console.log("Successfully persisted module:", response);
  } catch (error) {
    console.error("Error persisting module to Weaviate:", error);
    throw error;
  }
}


/**
 * Processes the full document text to generate and persist lesson modules.
 *
 * @param fullText - The complete text of the document.
 * @param documentID - The ID of the bloomdocx instance associated with this document.
 */
export async function processDocument(fullText: string, documentID: string): Promise<void> {
  try {
    // Step 1: Split the document into overlapping chunks (for clustering purposes).
    const textChunks = splitTextIntoChunks(fullText);

    // Step 2: Generate embeddings for each chunk.
    const embeddingPromises = textChunks.map(chunk => generateEmbedding(chunk));
    const embeddings = await Promise.all(embeddingPromises);

    // Step 3: Compute desired number of clusters based on text length.
    // Assume 2500 characters per page, and one lesson module should cover 20 pages (~50,000 characters).
    const desiredCharactersPerModule = 50000;
    const computedClusterCount = Math.max(1, Math.floor(fullText.length / desiredCharactersPerModule));
    console.log(`Computed cluster count: ${computedClusterCount} (for fullText length: ${fullText.length} characters)`);

    // Cluster the embeddings.
    const clusterIndices = clusterEmbeddings(embeddings, computedClusterCount);
    const clusters: { [clusterId: number]: string[] } = {};
    textChunks.forEach((chunk, idx) => {
      const clusterId = clusterIndices[idx];
      if (!clusters[clusterId]) clusters[clusterId] = [];
      clusters[clusterId].push(chunk);
    });

    // Step 4: For each cluster, generate metadata and process embeddings.
    const clusterIds = Object.keys(clusters);
    await Promise.all(clusterIds.map(async (clusterKey) => {
      const clusterId = parseInt(clusterKey);
      const clusterChunks = clusters[clusterId];

      // Aggregate text for the cluster.
      const aggregatedText = clusterChunks.join(' ');

      // Generate metadata using the LLM.
      const metadata = await generateLessonMetadata(aggregatedText);
      const { topic, subtopics } = metadata;

      // Use a maximum segment size for embedding generation (25k characters).
      const MAX_SEGMENT_LENGTH = 25000;
      let moduleRecords: LessonModule[] = [];
      if (aggregatedText.length > MAX_SEGMENT_LENGTH) {
        // Split the aggregated text into segments.
        const segments: string[] = [];
        for (let i = 0; i < aggregatedText.length; i += MAX_SEGMENT_LENGTH) {
          segments.push(aggregatedText.substring(i, i + MAX_SEGMENT_LENGTH));
        }
        // Generate an embedding for each segment.
        const segmentEmbeddings = await Promise.all(segments.map(seg => generateEmbedding(seg)));
        // Create a record for each segment.
        console.log('LessonModuleService.ts is persisting module.... with file id', documentID);
        moduleRecords = segments.map((seg, index) => ({
          moduleID: `module-${clusterId}`,
          documentID,
          modulePart: index,
          topic,
          subtopics,
          textChunk: seg,
          embedding: segmentEmbeddings[index]
        }));
      } else {
        // Single segment record.
        const moduleEmbedding = await generateEmbedding(aggregatedText);
        moduleRecords = [{
          moduleID: `module-${clusterId}`,
          documentID,
          modulePart: 0,
          topic,
          subtopics,
          textChunk: aggregatedText,
          embedding: moduleEmbedding
        }];
      }

      console.log(`Generated ${moduleRecords.length} records for module: module-${clusterId}`, moduleRecords);

      // Store the records in memory, grouping by moduleID.
      lessonModules[`module-${clusterId}`] = moduleRecords;

      // Persist each record in Weaviate.
      await Promise.all(moduleRecords.map(record => persistLessonModule(record)));
      console.log(`Persisted module module-${clusterId} with ${moduleRecords.length} segments to Weaviate`);

      // Emit an event for each record.
      moduleRecords.forEach(record => lessonEventEmitter.emit('moduleReady', record));
    }));
  } catch (error) {
    console.error("Error in processDocument:", error);
    throw error;
  }
}

/**
 * Returns a list of lesson module summaries.
 * With multiple segments per module, we group by moduleID.
 */
export async function getLessonList(documentID: string): Promise<LessonSummary[]> {
  console.log('LessonModuleService invoking getLessonList for documentID:', documentID);
  try {
    // Cast the getter as 'any' so that TypeScript does not complain about withWhere.
    const result = await weaviateClient.graphql
    .get()
    .withClassName('LessonModule')
    .withFields('moduleID documentID modulePart topic subtopics text embedding')
    .withWhere({
      operator: "Equal",
      path: ["documentID"],
      valueString: documentID,
    })
    .do();

    // The returned records are found in result.data.Get.LessonModule.
    const modules = result.data.Get.LessonModule || [];

    // Group the returned records by moduleID.
    const modulesMap: { [key: string]: LessonModule[] } = {};
    modules.forEach((record: any) => {
      // Transform the record into our LessonModule object.
      // Note: the persisted property "text" is mapped to "textChunk" in our interface.
      const moduleData: LessonModule = {
        moduleID: record.moduleID,
        documentID: record.documentID,
        modulePart: record.modulePart,
        topic: record.topic,
        subtopics: record.subtopics,
        textChunk: record.text,
        embedding: record.embedding,
      };

      if (!modulesMap[moduleData.moduleID]) {
        modulesMap[moduleData.moduleID] = [];
      }
      modulesMap[moduleData.moduleID].push(moduleData);
    });

    // Create a summary for each module (using the topic from the first segment).
    const summaries: LessonSummary[] = Object.entries(modulesMap).map(([moduleID, parts]) => ({
      moduleID,
      topic: parts[0].topic,
    }));


    console.log('LessonModuleService Generated summaries:', summaries);

    return summaries;
  } catch (error) {
    console.error("Error in getLessonList:", error);
    throw error;
  }
}


/**
 * Returns detailed metadata for a lesson module given its moduleID.
 * If multiple parts exist for a module, their text chunks are concatenated (in order)
 * and the metadata from the first record is used.
 */
export async function getLessonModule(documentID: string, moduleID: string): Promise<LessonModule> {
  try {
    // Cast the getter to 'any' so we can use withWhere without type errors.
    const getter: any = weaviateClient.data.getter();
    const result = await weaviateClient.graphql
      .get()
      .withClassName('LessonModule')
      .withFields('moduleID documentID modulePart topic subtopics text embedding')
      .withWhere({
        operator: "And",
        operands: [
          {
            operator: "Equal",
            path: ["documentID"],
            valueString: documentID,
          },
          {
            operator: "Equal",
            path: ["moduleID"],
            valueString: moduleID,
          }
        ],
      })
      .do();
  

    const records = result.data.Get.LessonModule || [];
    if (!records || records.length === 0) {
      throw new Error(`Lesson module with ID ${moduleID} not found for document ${documentID}.`);
    }

    // Map each record to our LessonModule type.
    const lessonModulesArray: LessonModule[] = records.map((record: any) => ({
      moduleID: record.moduleID,
      documentID: record.documentID,
      modulePart: record.modulePart,
      topic: record.topic,
      subtopics: record.subtopics,
      textChunk: record.text,
      embedding: record.embedding,
    }));

    // If only one part was returned, just return that part.
    if (lessonModulesArray.length === 1) {
      return lessonModulesArray[0];
    } else {
      // Sort parts by modulePart and combine the text chunks.
      lessonModulesArray.sort((a, b) => a.modulePart - b.modulePart);
      const combinedTextChunk = lessonModulesArray.map(part => part.textChunk).join("\n");

      // Create a combined lesson module using metadata from the first part.
      const combinedModule: LessonModule = {
        moduleID: moduleID,
        documentID: documentID,
        modulePart: 0, // a new value to indicate the combined module
        topic: lessonModulesArray[0].topic,
        subtopics: lessonModulesArray[0].subtopics,
        textChunk: combinedTextChunk,
        embedding: lessonModulesArray[0].embedding, // you can adjust this if needed
      };
      return combinedModule;
    }
  } catch (error) {
    console.error("Error in getLessonModule:", error);
    throw error;
  }
}

/**
 * Allows external subscribers to be notified when a new lesson module record is ready.
 */
export function onModuleReady(listener: (module: LessonModule) => void): void {
  lessonEventEmitter.on('moduleReady', listener);
}
