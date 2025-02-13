// setSchema.ts
import weaviate from 'weaviate-ts-client';

async function setSchema() {
  // Configure the Weaviate client.
  const client = weaviate.client({
    scheme: 'http',
    host: process.env.WEAVIATE_HOST || 'localhost:8080',
  });

  // Define the LessonModule class as a schema.
  const lessonModuleClass = {
    class: "LessonModule",
    description: "A lesson module generated from uploaded files. For long modules, each segment is stored as a separate record with the same moduleID.",
    properties: [
      { name: "moduleID", dataType: ["string"] },
      { name: "documentID", dataType: ["string"] },
      { name: "modulePart", dataType: ["int"] },  // e.g., segment index (0, 1, etc.)
      { name: "text", dataType: ["text"] },
      { name: "topic", dataType: ["string"] },
      { name: "subtopics", dataType: ["string[]"] },
      { name: "embedding", dataType: ["number[]"] }  // Single embedding per record.
    ]
  };

  try {
    // First, get the current schema
    const currentSchema = await client.schema.getter().do();
    const classes = currentSchema.classes || [];

    // Check if LessonModule already exists.
    const lessonModuleExists = classes.some(
      (cls: any) => cls.class === lessonModuleClass.class
    );
    
    if (lessonModuleExists) {
      console.log(`Class ${lessonModuleClass.class} already exists. Skipping creation.`);
    } else {
      // Create the LessonModule class in Weaviate.
      const result = await client.schema.classCreator()
        .withClass(lessonModuleClass)
        .do();
      console.log("Schema successfully created:", result);
    }
  } catch (error) {
    console.error("Error creating/updating schema:", error);
    process.exit(1);
  }
}

setSchema();
