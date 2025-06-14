/**
 * @file app/src/services/TextPreprocessing/LessonModuleServiceV3.ts
 * @description
 *   Phase 2 service for generating a titled hierarchy (LessonModuleV3).
 *   Responsibilities:
 *   - Split & embed text chunks, persist them.
 *   - Call Python micro-service to get raw hierarchical clusters.
 *   - Inject unique identifiers into every NodeStub.
 *   - Call the LLM (via aiTextPreProcessing.generateSyllabus) to obtain a syllabus.
 *   - Merge syllabus titles into the hierarchy, remove identifiers.
 *   - Return a LessonModuleV3 containing global syllabus fields + titled hierarchy.
 */

import axios from 'axios';
import { nextKey2, Key2 } from './TextKeys';
import { NodeStub, LessonModuleV3 } from './LessonModuleTypes';
import { generateEmbedding } from './aiTextPreProcessing';
import { generateSyllabus, Syllabus } from './aiTextPreProcessingV2';
import weaviate from 'weaviate-ts-client';
import AIController from '../../controllers/aiController';
import { mergeToLessonSchema } from './mergeToLessonSchema';

const weaviateClient = weaviate.client({
  scheme: 'http',
  host: 'localhost:8080',
});

/**
 * Splits text into overlapping chunks.
 */
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

/**
 * Persist text chunks + embeddings into Weaviate under TextChunk class.
 */
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
    await weaviateClient.data.creator()
      .withClassName('TextChunk')
      .withProperties({
        chunk_id: rec.chunk_id,
        file_id: rec.file_id,
        document_id: rec.document_id,
        text: rec.chunk_text,
        createdAt: rec.createdAt.toISOString(),
      })
      .withVector(rec.embedding)
      .do();
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


/**
 * Calls the Python micro-service to generate hierarchical clusters.
 */
async function callHierarchicalConceptMapService(
  file_id: string,
  textChunks: { chunk_id: string; text: string }[],
  embeddings: number[][],
  options?: Record<string, any>
): Promise<any> {
  const payload = {
    file_id,
    text_chunks: textChunks.map((c, i) => ({
      chunk_id: c.chunk_id,
      text: c.text,
      embedding: embeddings[i],
    })),
    clustering_options: options || {},
  };
  const response = await axios.post('http://localhost:8000/generate_subtopics', payload);
  return response.data;
}

/**
 * processDocument
 * 
 * Orchestrates Phase 2:
 * 1. Chunk + embed + persist
 * 2. Call Python service → raw hierarchicalResult
 * 3. Inject identifiers into NodeStubs
 * 4. Call LLM to get syllabus
 * 5. Merge titles into hierarchy, remove identifier
 * 6. Return LessonModuleV3
 */
export async function processDocument(
  fullText: string,
  documentID: string,
  sourceFileId: string
): Promise<LessonModuleV3> {
  // 1. Chunking & embedding
  const rawChunks = splitTextIntoChunks(fullText);
  const chunkRecords = rawChunks.map((text, idx) => ({ chunk_id: `page-${idx+1}`, text }));
  // Takes about 8 seconds
  const embeddings = await Promise.all(rawChunks.map(t => generateEmbedding(t)));
  await persistTextChunks(
    rawChunks.map((text, idx) => ({
      chunk_id: `page-${idx+1}`,
      chunk_text: text,
      embedding: embeddings[idx],
      file_id: sourceFileId,
      document_id: documentID,
      createdAt: new Date(),
    }))
  );

  // 2. Call Python hierarchical clustering
  const hierarchicalResult = await callHierarchicalConceptMapService(
    documentID,
    chunkRecords,
    embeddings,
    { metric: 'cosine', num_depth1: 6, min_depth1_size: 5, num_depth2: 2, min_depth2_size: 3 }
  );

  // 3. Convert to NodeStub[] with identifiers
  const hierarchy: NodeStub[] = [];
  let idCounter = 0;
  for (const d1 of hierarchicalResult.depth1_subtopics as any[]) {
    const key1 = nextKey2(idCounter++) as Key2;
    const stub1: NodeStub = {
      node_id: d1.node_id,
      aggregated_text: d1.aggregated_text,
      title: undefined,
      depth2_subtopics: [],
    };
    (stub1 as any).identifier = key1;
    if (Array.isArray(d1.depth2_subtopics)) {
      for (const d2 of d1.depth2_subtopics) {
        const key2 = nextKey2(idCounter++) as Key2;
        const stub2: NodeStub = {
          node_id: d2.node_id,
          aggregated_text: d2.aggregated_text,
          title: undefined,
        };
        (stub2 as any).identifier = key2;
        stub1.depth2_subtopics!.push(stub2);
      }
    }
    hierarchy.push(stub1);
  }

  // 4. Generate syllabus via LLM
  const syllabus: Syllabus = await generateSyllabus(hierarchy);
   console.log('[LessonModuleServiceV3] syllabus from LLM:', syllabus);

  // 5. Merge titles into hierarchy & drop identifiers
  for (const topic of syllabus.topics) {
    const findStub = (arr: NodeStub[]): NodeStub | undefined => {
      return arr.find(s => (s as any).identifier === topic.identifier)
        || arr.flatMap(s => s.depth2_subtopics || []).find(s2 => (s2 as any).identifier === topic.identifier);
    };
    const stub = findStub(hierarchy);
    if (stub) {
      stub.title = topic.title;
      delete (stub as any).identifier;
    }
  }

   console.log('[LessonModuleServiceV3] titled hierarchy:', JSON.stringify(hierarchy, null, 2));

  // 6. Build and return LessonModuleV3
  const result: LessonModuleV3 = {
    file_id: sourceFileId,
    main_title: syllabus.main_title,
    introduction: syllabus.introduction,
    learning_objective: syllabus.learning_objective,
    hierarchy,
  };
  console.log('[LessonModuleServiceV3] returning LessonModuleV3:', result);
  return result;
}



/**
 * generateLessonFromSegment
 *
 * Completes the lesson pipeline for one text segment:
 * 1. Obtain titled hierarchy and global fields (LessonModuleV3).
 * 2. In parallel, generate detailed content for each depth-1 subtree.
 * 3. Merge all results into the original LessonSchema format.
 *
 * @param segment - Text for this lesson module segment.
 * @param documentID - Document identifier.
 * @param sourceFileId - File upload identifier.
 * @returns JSON object matching the legacy `lessonSchema`.
 */
export async function generateLessonFromSegment(
  segment: string,
  documentID: string,
  sourceFileId: string
): Promise<unknown> {
  // Phase 2 result: titled hierarchy + syllabus fields
  console.time(`8640-processDocument`)
  const moduleV3: LessonModuleV3 = await processDocument(segment, documentID, sourceFileId);
console.timeEnd(`8640-processDocument`)
  // Phase 3-A: generate each subtree in parallel

  console.time(`8640-parralel subtree generation`)
  const enrichedHierarchy = await Promise.all(
    moduleV3.hierarchy.map((root: NodeStub) =>
      AIController.generateSubtreeLesson(root, moduleV3.main_title)
    )
  );
  moduleV3.hierarchy = enrichedHierarchy;
  console.timeEnd(`8640-parralel subtree generation`)

  // Phase 3-B: merge into legacy lessonSchema JSON
  const lessonJson = mergeToLessonSchema(moduleV3);
  console.log('[LessonModuleServiceV3] final lesson 392 JSON:', JSON.stringify(lessonJson));
  return lessonJson;
}