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
  export const lessonMetadataJSONSchema ={
    "name": "lesson_module",
    "schema": {
      "type": "object",
      "properties": {
        "main_topic": {
          "type": "object",
          "description": "The root node containing the main topic and its associated subtopics.",
          "properties": {
            "title": {
              "type": "string",
              "description": "The title of the main topic."
            },
            "subtopics": {
              "type": "array",
              "description": "The subtopics related to the main topic.",
              "items": {
                "type": "object",
                "properties": {
                  "title": {
                    "type": "string",
                    "description": "The title of the subtopic at depth 1."
                  },
                  "subtopics": {
                    "type":  ["null", "array"],
                    "description": "Optional nested subtopics related to this subtopic.",
                    "items": {
                      "type": "object",
                      "properties": {
                        "title": {
                          "type": "string",
                          "description": "The title of the subtopic at depth 2."
                        }
                      },
                      "required": [
                        "title"
                      ],
                      "additionalProperties": false
                    }
                  }
                },
                "required": [
                  "title",
                  "subtopics"
                ],
                "additionalProperties": false
              }
            }
          },
          "required": [
            "title",
            "subtopics"
          ],
          "additionalProperties": false
        },
        "summary": {
          "type": "string",
          "description": "A summary explaining the entire topic covered in the lesson module."
        }
      },
      "required": [
        "main_topic",
        "summary"
      ],
      "additionalProperties": false
    },
    "strict": true
  }