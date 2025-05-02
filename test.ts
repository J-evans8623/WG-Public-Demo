import weaviate from 'weaviate-ts-client';

async function dumpTextChunks() {
  const client = weaviate.client({
    scheme: process.env.WEAVIATE_SCHEME || 'http',
    host:   process.env.WEAVIATE_HOST   || 'localhost:8080',
  });

  // Pull back chunk_id, file_id, document_id, text, plus the raw vector
  const resp: any = await client.graphql.get()
    .withClassName('TextChunk')
    .withFields(`
      chunk_id
      file_id
      document_id
      text
      _additional { 
        distance 
        vector 
        id 
      }
    `)
    .withLimit(1000)   // bump as high as you need
    .do();

  console.log(JSON.stringify(resp.data.Get.TextChunk, null, 2));
}

dumpTextChunks().catch(console.error);
