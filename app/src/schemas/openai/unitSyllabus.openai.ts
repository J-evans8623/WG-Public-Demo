/**
 * @file    schemas-openai/unitSyllabus.openai.ts
 * @purpose OpenAI-compatible JSON schema for unit syllabus generation (gpt-5-nano).
 *          Mirrors the original Gemini schema but conforms to OpenAI’s strict validator:
 *          1) Every key in `properties` is included in `required` when strict=true.
 *          2) All nested objects also mark all defined properties as required.
 *          3) Numeric page/order fields use `integer` (safer for strict typing).
 *          4) No `anyOf` patterns that mix null—handled elsewhere if needed.
 *
 * Usage: import { unitSyllabusArrayOpenAI } from './schemas-openai/unitSyllabus.openai';
 */

export const unitSyllabusArrayOpenAI = {
  name: "unit_syllabus",
  schema: {
    type: "object",
    description: "Combined output including lesson metadata and array of primary subtopics.",
    properties: {
      LessonTitle: {
        type: "string",
        description: "The generated title of the lesson module. "
      },
      Introduction: {
        type: "string",
        description: "The generated introduction for the lesson module."
      },
      CourseTitle: {
        type: "string",
        description: "Short, conventional University course name (e.g., Biology, Calculus I, World History, Pscyhology, Sosciology, Economics, Statistics, Business, Religion, Physics, Chemistry, Organic Chemistry, Algebra, Math, Computer Science)."
      },
      unit_syllabus: {
        type: "array",
        description: "An array of primary subtopic objects for the unit syllabus.",
        items: {
          type: "object",
          properties: {
            Title: {
              type: "string",
              description: "The title of the primary subtopic."
            },
            Learning_Objectives: {
              type: "string",
              description: "The learning objectives for this primary subtopic."
            },
            LessonOutline: {
              type: "string",
              description: "An outline of the lesson for this primary subtopic."
            },
            SecondarySubtopic: {
              type: "array",
              description: "Array of secondary subtopic objects supporting this primary subtopic.",
              items: {
                type: "object",
                properties: {
                  Title: {
                    type: "string",
                    description: "The title of the secondary subtopic. Do not use the word Elaborate or Background in the title we do not want a repeititve naming covention used across the syllabus because it sound unnatural. The title should be short and natural sounding. "
                  },
                  Learning_Objectives: {
                    type: "string",
                    description: "The learning objectives for this secondary subtopic."
                  },
                  LessonOutline: {
                    type: "string",
                    description: "An outline of the lesson for this secondary subtopic."
                  }
                },
                required: ["Title", "Learning_Objectives", "LessonOutline"],
                additionalProperties: false
              }
            },
            ChronologicalOrder: {
              type: "integer",
              description: "Order in which this primary subtopic is presented."
            },
            relevantPages: {
              type: "array",
              description: "Page numbers from the original document that this subtopic covers.",
              items: { type: "integer" }
            }
          },
          // IMPORTANT for OpenAI strict: list *every* key from properties here.
          required: [
            "Title",
            "Learning_Objectives",
            "LessonOutline",
            "SecondarySubtopic",
            "ChronologicalOrder",
            "relevantPages"
          ],
          additionalProperties: false
        }
      }
    },
    // IMPORTANT for OpenAI strict at the top-level as well.
    required: ["LessonTitle", "Introduction", "CourseTitle","unit_syllabus"],
    additionalProperties: false
  },
  strict: true
};
