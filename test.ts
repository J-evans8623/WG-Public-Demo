// dumpTextChunks.ts
import weaviate from 'weaviate-ts-client';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Fetches all TextChunk objects from Weaviate and writes them to a JSON file.
 * 
 * Usage:
 *   ts-node dumpTextChunks.ts [outputFilename]
 * 
 * @param outputFilename  Name of the file to write (default: 'text_chunks_dump.json')
 */
async function dumpTextChunksToFile(outputFilename: string = 'text_chunks_dump.json') {
  // 1) Initialize Weaviate client
  const client = weaviate.client({
    scheme: process.env.WEAVIATE_SCHEME || 'http',
    host:   process.env.WEAVIATE_HOST   || 'localhost:8080',
  });


  // 2) GraphQL query for TextChunk class
  const resp: any = await client.graphql.get()
    .withClassName('TextChunk')
    .withFields(`
      chunk_id
      file_id
      document_id
      text
      _additional {
        id
        distance
        vector
      }
    `)
    .withLimit(1000)   // adjust as needed
    .do();

  const items = resp?.data?.Get?.TextChunk;
  if (!Array.isArray(items)) {
    throw new Error('Unexpected response shape, expected data.Get.TextChunk to be an array');
  }

  console.log(`[dumpTextChunks] Retrieved ${items.length} chunks. Writing to file...`);

  // 3) Write to disk
  const fullPath = path.resolve(process.cwd(), outputFilename);
  const json = JSON.stringify(items, null, 2);

  await fs.writeFile(fullPath, json, 'utf-8');
  console.log(`[dumpTextChunks] Successfully wrote ${items.length} chunks to ${fullPath}`);
}

(async () => {
  try {
    // Allow overriding the output file via CLI: ts-node dumpTextChunks.ts mychunks.json
    const [, , outputFilename] = process.argv;
    await dumpTextChunksToFile(outputFilename);
  } catch (err) {
    console.error('[dumpTextChunks] Error:', err);
    process.exit(1);
  }
})();
