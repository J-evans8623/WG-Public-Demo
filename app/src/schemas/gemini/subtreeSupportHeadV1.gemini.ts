// app/src/schemas/gemini/subtreeSupportHeadV1.gemini.ts

/**
 * @file app/src/schemas/gemini/subtreeSupportHeadV1.gemini.ts
 * @description
 *   This file defines the Gemini-compatible JSON schema used to generate enrichment
 *   for supporting topics within a single syllabus unit. Supporting topics exist to
 *   reinforce and elaborate on the main topic, but they do not own the unit-level
 *   quiz. The schema therefore focuses on lesson content only, providing a lecture
 *   note and flash cards for one secondary topic at a time, along with optional
 *   citation metadata. By keeping this schema narrowly scoped to a single supporting
 *   topic, we can safely issue multiple independent enrichment calls in parallel,
 *   each targeting a different secondary topic under the same primary node. When
 *   combined with the main-topic head and aligned by index with the underlying
 *   syllabus, the outputs produced by this schema map directly into the existing
 *   `secondary_subtopic[]` portion of the `EnrichedPrimary` lesson structure. This
 *   separation helps us maintain a clear boundary between main and supporting topics
 *   while enabling topic-level parallelism without altering frontend contracts.
 */

export const subtreeSupportHeadV1Gemini = {
  name: "unit_support_topic_head",
  schema: {
    type: "object",
    description:
      "Support-topic head for a single lesson unit. Represents one secondary topic's lesson plus optional citations.",
    properties: {
      support_topic: {
        type: "object",
        description:
          "A single supporting topic that reinforces the primary topic in this unit. Contains its own standalone lesson content.",
        properties: {
          title: {
            type: "string",
            description:
              "Title of the supporting topic. This should reflect the syllabus title for the secondary node but may be lightly refined."
          },
          lesson: {
            type: "object",
            description:
              "Lesson content for this supporting topic, including a lecture note and flash cards.",
            properties: {
              lecture_note: {
                type: "string",
                description:
                  "Detailed lecture note for the supporting topic. Must follow the unit syllabus for this secondary topic and respect the max word count."
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
        anyOf: [
          { type: "null" },
          {
            type: "array",
            description:
              "Optional citations specifically for this supporting topic. Each entry refers back to the original uploaded material.",
            items: {
              type: "object",
              properties: {
                index: {
                  type: "number",
                  description:
                    "Ordinal index of this citation within the supporting-topic lesson body."
                },
                textsource: {
                  type: "string",
                  description:
                    "Excerpt or short description of the cited text segment drawn from the uploaded source."
                },
                page_number: {
                  type: "number",
                  description:
                    "Page number from the original upload where the cited text is located, bounded by explicit page markers."
                }
              },
              required: ["index", "textsource", "page_number"],
              additionalProperties: false
            }
          }
        ]
      }
    },
    required: ["support_topic", "lesson_citation"],
    additionalProperties: false
  },
  strict: true
};
