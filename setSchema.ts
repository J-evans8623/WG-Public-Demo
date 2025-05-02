/**
 * @file scripts/weaviateSchemaMigration.ts
 * @description
 *   Drops the old LessonModule and TextChunk classes in Weaviate,
 *   then creates a new TextChunk class with:
 *     - chunk_id    (string)
 *     - file_id     (string)
 *     - document_id (string)
 *     - text        (text)
 *     - createdAt   (date)
 *   and vectorizer="none".
 */

import weaviate from 'weaviate-ts-client';

async function migrateSchema() {
  const client = weaviate.client({
    scheme: 'http',
    host: process.env.WEAVIATE_HOST || 'localhost:8080',
  });

  try {
    // 1. Fetch current schema
    const schemaRes = await client.schema.getter().do();
    const classes = schemaRes.classes || [];

    // 2. Delete deprecated LessonModule
    if (classes.some(c => c.class === 'LessonModule')) {
      console.log('→ Deleting LessonModule...');
      await client.schema.classDeleter()
        .withClassName('LessonModule')
        .do();
      console.log('✔ LessonModule deleted');
    } else {
      console.log('• LessonModule not found, skipping');
    }

    // 3. Delete old TextChunk
    if (classes.some(c => c.class === 'TextChunk')) {
      console.log('→ Deleting old TextChunk...');
      await client.schema.classDeleter()
        .withClassName('TextChunk')
        .do();
      console.log('✔ Old TextChunk deleted');
    } else {
      console.log('• TextChunk not found, skipping');
    }

    // 4. Create new TextChunk schema
    console.log('→ Creating new TextChunk class...');
    await client.schema.classCreator().withClass({
      class: 'TextChunk',
      description: 'A chunk of text with client-provided embedding, grouped by file_id + document_id.',
      vectorizer: 'none',
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
          description: 'Shared document/session ID across uploads',
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
    console.log('✔ New TextChunk class created');

    console.log('\n✅ Weaviate schema migration complete');
    process.exit(0);
  } catch (err) {
    console.error('❌ Schema migration failed:', err);
    process.exit(1);
  }
}

migrateSchema();
