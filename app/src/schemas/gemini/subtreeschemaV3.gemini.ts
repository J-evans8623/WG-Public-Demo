// gemini schema for generatelesson.ts
export const subtreeSchemaV3 = {
  name: "batch_study_notes",
  schema: {
    type: "object",
    properties: {
      primary_subtopic: {
        type: "object",
        description: "List of enriched primary subtopics.",
          properties: {
            ChronologicalOrder: {
              type: "number",
              description: "Order of this primary subtopic."
            },
            title: {
              type: "string",
              description: "Title of the primary subtopic."
            },
            lesson: {
              type: "object",
              description: "Lesson content for this primary subtopic.",
              properties: {
                lecture_note: {
                  type: "string",
                  description: "Detailed lecture note."
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
              anyOf: [
                { type: "null" },
                {
                  type: "array",
                  description: "Optional secondary subtopics.",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      lecture_note: { type: "string" },
                      flash_cards: {
                        type: "array",
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
                    required: ["title", "lecture_note", "flash_cards"],
                    additionalProperties: false
                  }
                }
              ]
            },
            quiz: {
              type: "object",
              description: "Matching quiz for this subtopic.",
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
            },
          },
          required: [
            "ChronologicalOrder",
            "title",
            "lesson",
            "secondary_subtopic",
            "quiz",
          ],
          additionalProperties: false
      },
      lesson_citation: {
              anyOf: [
                { type: "null" },
                {
                  type: "array",
                  description: "Citations for this subtopic.",
                  items: {
                    type: "object",
                    properties: {
                      index: { type: "number" },
                      textsource: { type: "string" },
                      page_number: { type: "number" }
                    },
                    required: ["index", "textsource", "page_number"],
                    additionalProperties: false
                  }
                }
              ]
            }

    },
    required: ["primary_subtopic", "lesson_citation"],
    additionalProperties: false
  },
  strict: true
};
