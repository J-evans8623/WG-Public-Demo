export const subtreeSchemaV2 = {
  name: "study_notes",
  schema: {
    type: "object",
    properties: {
      primary_subtopics: {
        type: "object",
        description: "The main topic of a lesson.",
        properties: {
          title: {
            type: "string",
            description: "Title of the main topic."
          },
          lesson: {
            type: "object",
            description: "Contains details of the lesson for the primary subtopic.",
            properties: {
              lecture_note: {
                type: "string",
                description: "Detailed lecture note on the subtopic."
              },
              flash_cards: {
                type: "array",
                description: "Flash cards relevant to the lesson.",
                items: {
                  type: "object",
                  properties: {
                    term: {
                      type: "string",
                      description: "Term or question on the flash card."
                    },
                    definition: {
                      type: "string",
                      description: "Definition or answer on the flash card."
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
          secondary_subtopic: {
            anyOf: [
              { type: "null" },
              {
                type: "array",
                description: "Optional secondary subtopics under the primary subtopic.",
                items: {
                  type: "object",
                  properties: {
                    title: {
                      type: "string",
                      description: "Title of the secondary subtopic."
                    },
                    lecture_note: {
                      type: "string",
                      description: "Lecture note for the secondary subtopic."
                    },
                    flash_cards: {
                      type: "array",
                      description: "Flash cards relevant to the secondary subtopic.",
                      items: {
                        type: "object",
                        properties: {
                          term: {
                            type: "string",
                            description: "Term or question on the flash card."
                          },
                          definition: {
                            type: "string",
                            description: "Definition or answer on the flash card."
                          }
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
            description: "Matching quiz for the primary subtopic.",
            properties: {
              id: {
                type: "string",
                description: "Unique identifier for the quiz."
              },
              title: {
                type: "string",
                description: "Title of the quiz."
              },
              questions: {
                type: "array",
                description: "List of questions in the matching quiz.",
                items: {
                  type: "object",
                  properties: {
                    id: {
                      type: "string",
                      description: "Unique identifier for each question."
                    },
                    type: {
                      type: "string",
                      enum: ["matching"],
                      description: "Specific quiz type."
                    },
                    matchingTerm: {
                      type: "string",
                      description: "The question text or prompt for the matching."
                    },
                    matchingAnswer: {
                      type: "string",
                      description: "Single correct answer as a string."
                    }
                  },
                  required: ["id", "type", "matchingTerm", "matchingAnswer"],
                  additionalProperties: false
                }
              }
            },
            required: ["id", "title", "questions"],
            additionalProperties: false
          },
          lesson_citation: {
            anyOf: [
              { type: "null" },
              {
                type: "array",
                description: "Citations related to the primary subtopic.",
                items: {
                  type: "object",
                  properties: {
                    index: {
                      type: "number",
                      description: "The index of the citation."
                    },
                    textsource: {
                      type: "string",
                      description: "The source of the text referenced in the citation."
                    },
                    page_number: {
                      type: "number",
                      description: "The page number of the cited source."
                    }
                  },
                  required: ["index", "textsource", "page_number"],
                  additionalProperties: false
                }
              }
            ]
          }
        },
        required: [
          "title",
          "lesson",
          "secondary_subtopic",
          "quiz",
          "lesson_citation"
        ],
        additionalProperties: false
      }
    },
    required: ["primary_subtopics"],
    additionalProperties: false
  },
  strict: true
};