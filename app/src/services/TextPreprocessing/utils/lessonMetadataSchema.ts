// app/src/utils/lessonMetadataSchema.ts

/**
 * This file defines the JSON schema and TypeScript interface for the lesson metadata
 * generated from a lesson module.
 */

export interface LessonMetadata {
    topic: string;
    subtopics: string[];
  }
  
  // Optional: JSON Schema definition (for validation or documentation)
  export const lessonMetadataJSONSchema = {
    "name": "curriculum_designer",
    "schema": {
      "type": "object",
      "properties": {
        "topic": {
          "type": "string",
          "description": "The main topic title derived from the provided text."
        },
        "subtopics": {
          "type": "array",
          "description": "A list of sub topic titles associated with the main topic.",
          "items": {
            "type": "string",
            "description": "A sub topic title."
          }
        }
      },
      "required": [
        "topic",
        "subtopics"
      ],
      "additionalProperties": false
    },
    "strict": true
  }