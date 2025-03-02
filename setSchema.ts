import weaviate from 'weaviate-ts-client';

async function setSchema() {
  const client = weaviate.client({
    scheme: 'http',
    host: process.env.WEAVIATE_HOST || 'localhost:8080',
  });

  try {
    const currentSchema = await client.schema.getter().do();
    const classes = currentSchema.classes || [];

    // Create or update the LessonModule class with metadata stored inline.
    const lessonModuleExists = classes.some((cls) => cls.class === "LessonModule");
    if (!lessonModuleExists) {
      const lessonModuleClass = {
        class: "LessonModule",
        description: "A lesson module with inline metadata stored as a JSON string.",
        properties: [
          { name: "moduleID", dataType: ["string"] },
          { name: "file_id", dataType: ["string"] },
          { name: "original_text", dataType: ["text"] },
          // Updated: store metadata inline as a JSON string (primitive type)
          { name: "metadata", dataType: ["text"] }
        ]
      };
      const resultLessonModule = await client.schema.classCreator()
        .withClass(lessonModuleClass)
        .do();
      console.log("LessonModule schema created:", resultLessonModule);
    } else {
      console.log("Class LessonModule already exists. Skipping creation.");
    }

    // The TextChunk schema remains unchanged.
    const textChunkExists = classes.some((cls) => cls.class === "TextChunk");
    if (!textChunkExists) {
      const textChunkClass = {
        class: "TextChunk",
        description: "A text chunk with its precomputed embedding and metadata for filtering by user and module.",
        vectorizer: "none",
        properties: [
          { name: "chunk_id", dataType: ["string"] },
          { name: "file_id", dataType: ["string"] },
          { name: "lesson_module_title", dataType: ["string"] },
          { name: "lesson_module_id", dataType: ["string"] },
          { name: "uploadId", dataType: ["string"] },
          { name: "text", dataType: ["text"] }
        ]
      };
      const resultTextChunk = await client.schema.classCreator()
        .withClass(textChunkClass)
        .do();
      console.log("TextChunk schema created:", resultTextChunk);
    } else {
      console.log("Class TextChunk already exists. Skipping creation.");
    }
  } catch (error) {
    console.error("Error creating/updating schema:", error);
    process.exit(1);
  }
}

setSchema();



/***
 * I will use this script later remove the old lesson module schema
 * 
 import weaviate from 'weaviate-ts-client';

async function deleteClass() {
  const client = weaviate.client({
    scheme: 'http',
    host: process.env.WEAVIATE_HOST || 'localhost:8080',
  });

  try {
    await client.schema.classDeleter()
      .withClassName('LessonModule')
      .do();
   
  } catch (error) {
    console.error("Error deleting TextEmbedding class:", error);
  }
}

deleteClass();

 * 
 */
