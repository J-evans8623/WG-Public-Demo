/**
 * @file scripts/weaviateSchemaMigration.ts
 * @description
 * Initializes the Weaviate vector database schema for the application.
 * * SAFE EXECUTION STRATEGY:
 * This script is idempotent. It checks if the required 'TextChunk' class 
 * already exists.
 * - If exists: It logs success and exits immediately (PRESERVING DATA).
 * - If missing: It creates the schema definition.
 *
 * This allows the script to be safely run on every container startup
 * without risk of wiping the production vector index.
 *
 * Schema Definition: 'TextChunk'
 * - chunk_id    (string)
 * - file_id     (string)
 * - document_id (string)
 * - text        (text)
 * - createdAt   (date)
 * - vectorizer  "none" (Client-side embeddings)
 */

import weaviate from 'weaviate-ts-client';

/**
 * Main migration function.
 * Connects to Weaviate, verifies schema state, and initializes if empty.
 */
async function migrateSchema() {
  // New update - Initialize client with dynamic host from env (critical for Docker networking)
  const client = weaviate.client({
    scheme: 'http',
    host: process.env.WEAVIATE_HOST || 'localhost:8080',
  });

  console.log(`[Weaviate Init] Connecting to ${process.env.WEAVIATE_HOST || 'localhost:8080'}...`);

  try {
    // 1. Fetch current schema to perform safety checks
    const schemaRes = await client.schema.getter().do();
    const classes = schemaRes.classes || [];

    // New update - Check for existing schema to prevent data loss
    const schemaExists = classes.some(c => c.class === 'TextChunk');

    if (schemaExists) {
      // New update - Safe exit strategy: Schema exists, do nothing.
      console.log('✅ [Weaviate Init] Schema "TextChunk" already exists. Skipping initialization.');
      process.exit(0); 
    }

    console.log('⚡ [Weaviate Init] No schema found. Starting initialization...');

    // 2. Delete deprecated LessonModule (Cleanup legacy artifacts if present)
    if (classes.some(c => c.class === 'LessonModule')) {
      console.log('→ Deleting legacy LessonModule...');
      await client.schema.classDeleter()
        .withClassName('LessonModule')
        .do();
      console.log('✔ LessonModule deleted');
    }

    // 3. Delete old TextChunk (Cleanup if malformed or explicitly resetting)
    // Note: This block technically won't run given the safety check above, 
    // but is kept for manual reset scenarios.
    if (classes.some(c => c.class === 'TextChunk')) {
      console.log('→ Deleting old TextChunk...');
      await client.schema.classDeleter()
        .withClassName('TextChunk')
        .do();
      console.log('✔ Old TextChunk deleted');
    }

    // 4. Create new TextChunk schema
    console.log('→ Creating new TextChunk class...');
    await client.schema.classCreator().withClass({
      class: 'TextChunk',
      description: 'A chunk of text with client-provided embedding, grouped by file_id + document_id.',
      vectorizer: 'none', // We provide our own embeddings from OpenAI
      properties: [
        {
          name: 'chunk_id',
          description: 'Unique identifier for this chunk within the file',
          dataType: ['string'],
        },
        {
          name: 'file_id',
          description: 'Unique ID per upload session (segregates concurrent uploads)',
          dataType: ['string'],
        },
        {
          name: 'document_id',
          description: 'Shared document/session ID across uploads (The "Parent" ID)',
          dataType: ['string'],
        },
        {
          name: 'text',
          description: 'Raw text of the chunk',
          dataType: ['text'],
        },
        {
          name: 'createdAt',
          description: 'ISO-8601 timestamp when this chunk was created',
          dataType: ['date'],
        },
      ],
    }).do();
    
    console.log('✔ New TextChunk class created successfully');
    console.log('\n✅ [Weaviate Init] Schema initialization complete');
    process.exit(0);

  } catch (err) {
    // New update - Fatal error logging for startup failure debugging
    console.error('❌ [Weaviate Init] Schema initialization failed:', err);
    process.exit(1);
  }
}

migrateSchema();