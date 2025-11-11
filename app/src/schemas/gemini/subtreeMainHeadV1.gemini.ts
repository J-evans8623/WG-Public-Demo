// app/src/schemas/gemini/subtreeMainHeadV1.gemini.ts

/**
 * @file app/src/schemas/gemini/subtreeMainHeadV1.gemini.ts
 * @description
 *   This file defines the Gemini-compatible JSON schema used to generate the main-topic
 *   enrichment “head” for a single syllabus unit. The schema is intentionally scoped to
 *   the primary topic within a unit and is designed to be combined with zero-to-many
 *   supporting-topic heads to reconstruct the legacy `subtreeSchemaV3` structure used
 *   by the lesson pipeline. The main-topic head includes the chronological ordering,
 *   title, and full lesson content for the primary topic, as well as the matching quiz
 *   object for the entire unit. It also carries optional citation metadata that can be
 *   used to attach source references back to the original textbook pages. By isolating
 *   the main topic and quiz into a dedicated schema, we can run this call independently
 *   of supporting topics while still reconstructing the exact `EnrichedPrimary` shape
 *   expected by the frontend without requiring any change to the existing UI contract.
 */

export const subtreeMainHeadV1Gemini = {
  name: "unit_main_topic_head",
  schema: {
    type: "object",
    description:
      "Main-topic head for a single lesson unit. Represents the primary topic's lesson and the unit-level quiz, plus optional citations.",
    properties: {
      primary_topic: {
        type: "object",
        description:
          "The primary topic for this unit. Contains its standalone lesson content and the quiz that assesses the entire unit.",
        properties: {
          ChronologicalOrder: {
            type: "number",
            description:
              "Order of this primary topic within the larger lesson sequence. This should mirror the syllabus ordering for the unit."
          },
          title: {
            type: "string",
            description:
              "Title of the primary topic. This should be consistent with the unit syllabus and may be refined slightly for clarity."
          },
          lesson: {
            type: "object",
            description:
              "Lesson content for this primary topic, including a structured lecture note and a sequence of flash cards.",
            properties: {
              lecture_note: {
                type: "string",
                description:
                  "Detailed lecture note for the primary topic. The note must align with the learning objectives and lesson outline for this topic, respect the max word count, and use clear headings and paragraphs."
              },
              flash_cards: {
                type: "array",
                description:
                  "Flash cards that cover the key concepts, definitions, and relationships introduced in the lecture note.",
                items: {
                  type: "object",
                  properties: {
                    term: {
                      type: "string",
                      description:
                        "Front of the flash card. Use concise, readable phrasing without markdown or LaTeX."
                    },
                    definition: {
                      type: "string",
                      description:
                        "Back of the flash card. Provide a clear, self-contained explanation or definition of the term."
                    }
                  },
                  required: ["term", "definition"],
                  additionalProperties: false
                }
              }
            },
            required: ["lecture_note", "flash_cards"],
            additionalProperties: false
          },
          quiz: {
            type: "object",
            description:
              "Matching quiz that assesses the complete unit, including the primary topic and all of its supporting topics if they exist.",
            properties: {
              id: {
                type: "string",
                description:
                  "A unique identifier for this quiz object. It can be any stable string the model chooses."
              },
              title: {
                type: "string",
                description:
                  "Title of the quiz. Should clearly indicate that it covers the entire lesson unit."
              },
              questions: {
                type: "array",
                description:
                  "Array of matching-style quiz questions that test comprehension of major concepts across the unit.",
                items: {
                  type: "object",
                  properties: {
                    id: {
                      type: "string",
                      description:
                        "Unique identifier for the quiz question. The format is flexible but should be stable within the quiz."
                    },
                    type: {
                      type: "string",
                      enum: ["matching"],
                      description:
                        "The quiz question type. For now this schema supports only matching questions."
                    },
                    matchingTerm: {
                      type: "string",
                      description:
                        "The term or prompt that the learner must match to the correct answer."
                    },
                    matchingAnswer: {
                      type: "string",
                      description:
                        "The correct answer that should be matched with the given term or prompt."
                    }
                  },
                  required: ["id", "type", "matchingTerm", "matchingAnswer"],
                  additionalProperties: false
                }
              }
            },
            required: ["id", "title", "questions"],
            additionalProperties: false
          }
        },
        required: ["ChronologicalOrder", "title", "lesson", "quiz"],
        additionalProperties: false
      },
      lesson_citation: {
        anyOf: [
          { type: "null" },
          {
            type: "array",
            description:
              "Optional citations for the lesson unit. Each entry references a text span and page number in the original upload.",
            items: {
              type: "object",
              properties: {
                index: {
                  type: "number",
                  description:
                    "Ordinal index of the citation in the lesson body. This can be used to map citations back into rendered text."
                },
                textsource: {
                  type: "string",
                  description:
                    "Short excerpt or description of the source text being cited from the uploaded material."
                },
                page_number: {
                  type: "number",
                  description:
                    "Page number from the original upload where the cited text can be found, bounded by the page markers."
                }
              },
              required: ["index", "textsource", "page_number"],
              additionalProperties: false
            }
          }
        ]
      }
    },
    required: ["primary_topic", "lesson_citation"],
    additionalProperties: false
  },
  strict: true
};
