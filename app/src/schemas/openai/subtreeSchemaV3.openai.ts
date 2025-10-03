/**
 * @file    schemas-openai/subtreeSchemaV3.openai.ts
 * @purpose OpenAI-compatible JSON schema for the batched study notes / subtree enrichment
 *          (gpt-5-nano). Changes vs original:
 *          1) Replace `anyOf: [{type:"null"}, {type:"array"}]` with `type: ["array","null"]`.
 *          2) Ensure all object `properties` are enumerated in `required` (strict=true).
 *          3) Use `integer` for numeric counters/indices where sensible.
 *          4) Keep `additionalProperties: false` consistently.
 */

export const subtreeSchemaV3OpenAI = {
  name: "batch_study_notes",
  schema: {
    type: "object",
    properties: {
      primary_subtopic: {
        type: "object",
        description: "This is the main topic of the given syllabus. It contains it's own stand alone learning content , along with optional supporting secondary subtopics. It also contains the quiz assement for the entire lesson unit.",
        properties: {
          ChronologicalOrder: {
            type: "integer",
            description: "Order of this primary subtopic."
          },
          title: {
            type: "string",
            description: "Title of the primary subtopic. "
          },
          lesson: {
            type: "object",
            description: "Lesson content for this primary subtopic.",
            properties: {
              lecture_note: {
                type: "string",
                description: "Detailed lecture note that aligns with the learning objectives and lesson outline specified in the syllabus for this primary subtopic. Must be formatted to optimize readability, use the lesson outline from the given syllabus to include natural fitting subheadings. Paragraphs should be medium length 100-140 words when possible, however do not exceed the max word count limit given in the system instructions. Do not mention the learning objectives in the text. "
              },
              flash_cards: {
                type: "array",
                description: "Flash cards for this lesson.",
                items: {
                  type: "object",
                  properties: {
                    term: { type: "string" },
                    definition: { type: "string" }
                  },
                  required: ["term", "definition"],
                  additionalProperties: false
                }
              }
            },
            required: ["lecture_note", "flash_cards"],
            additionalProperties: false
          },
          secondary_subtopic: {
            // OpenAI prefers a simple union type for nullable arrays
            type: ["array", "null"],
            description: "Optional secondary subtopics as specified in the provided syllabus. The secondary_subtopic supports the primary subtopic. Use the learning objectives, lesson outline and provided textbook material to create each respective secondary subtopic as the syllabus specifies",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                lecture_note: { type: "string", description: "Detailed lecture note that aligns with the learning objectives and lesson outline specified in the syllabus for this secondary subtopic. Must be formatted to optimize readability, use the lesson outline from the given syllabus to include natural fitting subheadings.  Paragraphs should be medium length 100-140 words when possible, however do not exceed the max word count given in the system instructions. Do not mention the learning objectives in this text."
               },
                flash_cards: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      term: { type: "string", description: "The front of the flash card. Plain text formatting only (no markdown or latex)." },
                      definition: { type: "string" }
                    },
                    required: ["term", "definition"],
                    additionalProperties: false
                  }
                }
              },
              required: ["title", "lecture_note", "flash_cards"],
              additionalProperties: false
            }
          },
          quiz: {
            type: "object",
            description: "Matching quiz for the entire lesson unit (primary subtopic + secondary subtopics if present).",
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              questions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    type: { type: "string", enum: ["matching"] },
                    matchingTerm: { type: "string" },
                    matchingAnswer: { type: "string" }
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
        // strict=true: all keys in properties must be required
        required: ["ChronologicalOrder", "title", "lesson", "secondary_subtopic", "quiz"],
        additionalProperties: false
      },

      lesson_citation: {
        // Nullable array using union type
        type: ["array", "null"],
        description: "Citations for the entire lesson unit (primary subtopic + secondary subtopics if present). ",
        items: {
          type: "object",
          properties: {
            index: { type: "integer" },
            textsource: { type: "string" },
            page_number: { type: "integer" , description: "The page number enclosed the ###### Start of Page######## and #### End of Page ##### markers"}
          },
          required: ["index", "textsource", "page_number"],
          additionalProperties: false
        }
      }
    },
    // strict=true: top-level properties must also be fully required if present
    required: ["primary_subtopic", "lesson_citation"],
    additionalProperties: false
  },
  strict: true
};
