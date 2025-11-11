// app/src/schemas/openai/subtreeMainHeadV1.openai.ts

/**
 * @file app/src/schemas/openai/subtreeMainHeadV1.openai.ts
 * @description
 *   This file defines the OpenAI-compatible JSON schema for the main-topic head used
 *   during unit enrichment when the OpenAI provider is selected. It mirrors the logical
 *   structure of the Gemini `subtreeMainHeadV1Gemini` schema but conforms to the stricter
 *   validation rules required by OpenAI’s JSON-schema based response parsing. In
 *   particular, it represents numeric counters such as chronological order and citation
 *   indices as integers, lists all properties explicitly in `required` arrays when
 *   `strict` mode is enabled, and uses union-style type declarations (for example,
 *   `type: ["array", "null"]`) for nullable arrays instead of `anyOf` patterns. The
 *   schema encapsulates the primary topic’s lesson, the unit-level quiz, and optional
 *   citation metadata. When combined with the support-topic head outputs for the same
 *   unit, this main-head result can be deterministically mapped back into the existing
 *   `EnrichedPrimary` structure without any modification to the frontend, ensuring that
 *   OpenAI-backed pipelines remain fully aligned with Gemini-backed pipelines.
 */

export const subtreeMainHeadV1OpenAI = {
  name: "unit_main_topic_head",
  schema: {
    type: "object",
    description:
      "OpenAI schema for the main-topic head of a lesson unit, including primary topic lesson, quiz, and optional citations.",
    properties: {
      primary_topic: {
        type: "object",
        description:
          "Primary topic object for this unit, containing its lesson and the unit-level quiz.",
        properties: {
          ChronologicalOrder: {
            type: "integer",
            description:
              "Integer index indicating where this primary topic appears in the syllabus order."
          },
          title: {
            type: "string",
            description:
              "Title of the primary topic. Should correspond to the syllabus but may be lightly refined."
          },
          lesson: {
            type: "object",
            description:
              "Lesson content for the primary topic, consisting of a lecture note and flash cards.",
            properties: {
              lecture_note: {
                type: "string",
                description:
                  "Detailed lecture note for this primary topic, aligned with its learning objectives and outline and respecting the max word count."
              },
              flash_cards: {
                type: "array",
                description:
                  "Array of flash cards derived from the lecture note, each capturing one key concept or definition.",
                items: {
                  type: "object",
                  properties: {
                    term: {
                      type: "string",
                      description:
                        "Concise front of the flash card, containing the term or prompt."
                    },
                    definition: {
                      type: "string",
                      description:
                        "Back of the flash card with a clear explanation or definition that stands alone."
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
              "Matching quiz assessing understanding across the primary topic and all of its supporting topics within the unit.",
            properties: {
              id: {
                type: "string",
                description: "Unique identifier string for this quiz."
              },
              title: {
                type: "string",
                description:
                  "Quiz title that signals coverage of the entire unit’s material."
              },
              questions: {
                type: "array",
                description: "Array of matching-type quiz questions.",
                items: {
                  type: "object",
                  properties: {
                    id: {
                      type: "string",
                      description: "Unique identifier for this question."
                    },
                    type: {
                      type: "string",
                      enum: ["matching"],
                      description:
                        "Question type. For this schema, only 'matching' is allowed."
                    },
                    matchingTerm: {
                      type: "string",
                      description:
                        "The term or left-hand-side prompt the learner must match."
                    },
                    matchingAnswer: {
                      type: "string",
                      description:
                        "The correct right-hand-side answer that matches the term."
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
        type: ["array", "null"],
        description:
          "Nullable array of lesson citations for this unit. When present, each entry references back to the original uploaded material.",
        items: {
          type: "object",
          properties: {
            index: {
              type: "integer",
              description:
                "Integer index for this citation’s position in the rendered lesson content."
            },
            textsource: {
              type: "string",
              description:
                "Short excerpt or description of the cited text fragment from the source material."
            },
            page_number: {
              type: "integer",
              description:
                "Page number from the original upload where the referenced text appears."
            }
          },
          required: ["index", "textsource", "page_number"],
          additionalProperties: false
        }
      }
    },
    required: ["primary_topic", "lesson_citation"],
    additionalProperties: false
  },
  strict: true
};
