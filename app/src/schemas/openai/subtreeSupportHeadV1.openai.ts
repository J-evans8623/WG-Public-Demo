// app/src/schemas/openai/subtreeSupportHeadV1.openai.ts

/**
 * @file app/src/schemas/openai/subtreeSupportHeadV1.openai.ts
 * @description
 *   This file defines the OpenAI-compatible JSON schema for supporting-topic heads
 *   used during lesson unit enrichment. Each head describes a single secondary
 *   topic’s lesson content—comprising a lecture note and flash cards—plus optional
 *   citation metadata. The schema is deliberately minimal and closely aligned with
 *   the shape of `secondary_subtopic[]` entries in the existing `EnrichedPrimary`
 *   type. It avoids any quiz fields because quizzes remain exclusively attached to
 *   the main-topic head. The implementation follows OpenAI’s strict JSON-schema
 *   requirements by representing nullable arrays through union types, using integer
 *   fields for numeric indices, and explicitly listing required properties. With
 *   this schema in place, OpenAI-backed enrichment can generate each supporting
 *   topic independently in parallel, and the results can then be slotted directly
 *   into the secondary-subtopic array while preserving the lesson structure relied
 *   upon by the frontend and lesson aggregation logic.
 */

export const subtreeSupportHeadV1OpenAI = {
  name: "unit_support_topic_head",
  schema: {
    type: "object",
    description:
      "OpenAI schema for a support-topic head. Encodes one secondary topic lesson plus optional citations.",
    properties: {
      support_topic: {
        type: "object",
        description:
          "A single supporting topic for the unit, containing its title and lesson content.",
        properties: {
          title: {
            type: "string",
            description:
              "Title of the supporting topic, usually taken from the unit syllabus."
          },
          lesson: {
            type: "object",
            description:
              "Lesson content for this supporting topic, including lecture note and flash cards.",
            properties: {
              lecture_note: {
                type: "string",
                description:
                  "Detailed lecture note explaining this supporting topic. Must follow the topic’s objectives and outline and respect the max word count."
              },
              flash_cards: {
  type: "object",
  description:
    "A single flash card reinforcing the key ideas and definitions for this supporting topic.",
  properties: {
    term: {
      type: "string",
      description:
        "Front of the flash card. Use a short, clear term or phrase with no markdown or LaTeX."
    },
    definition: {
      type: "string",
      description:
        "Back of the flash card. Provide a standalone explanation that covers the concept clearly."
    }
  },
  required: ["term", "definition"],
  additionalProperties: false
}

            },
            required: ["lecture_note", "flash_cards"],
            additionalProperties: false
          }
        },
        required: ["title", "lesson"],
        additionalProperties: false
      },
      lesson_citation: {
        type: ["array", "null"],
        description:
          "Nullable array of citations for this supporting topic’s lesson. When present, each entry maps back to the original source material.",
        items: {
          type: "object",
          properties: {
            index: {
              type: "integer",
              description:
                "Integer index for this citation’s position in the lesson body."
            },
            textsource: {
              type: "string",
              description:
                "Short excerpt or description of the cited text from the uploaded document."
            },
            page_number: {
              type: "integer",
              description:
                "Page number in the original upload where the cited content appears."
            }
          },
          required: ["index", "textsource", "page_number"],
          additionalProperties: false
        }
      }
    },
    required: ["support_topic", "lesson_citation"],
    additionalProperties: false
  },
  strict: true
};
