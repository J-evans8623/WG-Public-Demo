/**
 * config/predefined-prompts.ts
 *
 * A mapping of user-selectable options to predefined prompts for AI processing.
 *
 * Responsibilities:
 * - Stores prompts exclusively for structured output.
 * - Aligns prompts with the lesson and quiz schemas for generating consistent and usable data.
 *
 * Dependencies:
 * - None directly, but these prompts are utilized in `aiController.ts` and `aiService.ts`.
 */
/**
 * config/predefined-prompts.ts
 *
 * A mapping of user-selectable options to predefined prompts for AI processing.
 *
 * Responsibilities:
 * - Stores prompts exclusively for structured output.
 * - Aligns prompts with the lesson and quiz schemas for generating consistent and usable data.
 *
 * Dependencies:
 * - None directly, but these prompts are utilized in `aiController.ts` and `aiService.ts`.
 */

const predefinedPrompts: Record<string, string> = {
  'Lesson': `You are a helpful assistant that generates structured JSON based on the following schema, organizing study materials into topics, concepts, and cue cards.

Schema Overview
Topic: A broad subject derived from study notes.

title: The topic name, a concise label for the subject. (string).
overview: Cue cards summarizing the topic (array).
mainConcepts: The primary ideas within the topic. These concepts represent key areas of focus and exploration. (array).


Concept: A specific idea within a topic, with optional child concepts.

title: The concept name (string).
lesson:Explains the concept in depth through two key components:
content:A collection of cue cards that exclusively focus on explaining the specific concept. (array).
relatedConcept: Cue cards that describe the relationship between this concept and other concepts in the topic, if such relationships exist (optional, array).
childConcepts: Supporting concepts that play a significant role in the parent concept (array). This field is recursively defined, allowing for nested hierarchies

CueCard: A self-contained explanation. Think of these as short paragraph, the length can be from 30 to 100 words.

title: A brief title.
content: Detailed explanation (string)  the length can be from 30 to 100 words.

Instructions
Generate structured JSON that adheres to the schema, capturing the hierarchy and relationships. Omit relatedConcept if no relationships exist.
Ensure child concepts logically support their parent.

Task
Organize study notes or textbook excerpts into this structured JSON format.



`,
  'multipleChoice': '[Instructions: Generate a multiple choice quiz using the given schema. Each question should have 4 options with one correct answer.]',
  'matching': '[Instructions: Generate a matching quiz where each term must be paired with its corresponding definition or explanation. Follow the matching quiz schema.]',
  'fillInBlank': '[Instructions: Generate fill-in-the-blank questions where key terms or concepts are removed from sentences. Follow the fill-in-blank schema format.]',
  'trueFalse': '[Instructions: Generate true/false statements about key concepts. Each question should have a clear true or false answer. Follow the true/false schema format.]'
};

export default predefinedPrompts;


/***
 * 
 * const predefinedPrompts: Record<string, string> = {
  'Lesson': `You are a helpful assistant that generates structured JSON based on the following schema, organizing study materials into topics, concepts, and cue cards.

Schema Overview
Topic: A broad subject derived from study notes.

title: The topic name, a concise label for the subject. (string).
overview: Cue cards summarizing the topic (array).
mainConcepts: The primary ideas within the topic. These concepts represent key areas of focus and exploration. (array).


Concept: A specific idea within a topic, with optional child concepts.

title: The concept name (string).
lesson:Explains the concept in depth through two key components:
content:A collection of cue cards that exclusively focus on explaining the specific concept. (array).
relatedConcept: Cue cards that describe the relationship between this concept and other concepts in the topic, if such relationships exist (optional, array).
childConcepts: Supporting concepts that play a significant role in the parent concept (array). This field is recursively defined, allowing for nested hierarchies

CueCard: A self-contained explanation. Think of these as short paragraph, the length can be from 30 to 100 words.

title: A brief title.
content: Detailed explanation (string)  the length can be from 30 to 100 words.

Instructions
Generate structured JSON that adheres to the schema, capturing the hierarchy and relationships. Omit relatedConcept if no relationships exist.
Ensure child concepts logically support their parent.

Task
Organize study notes or textbook excerpts into this structured JSON format.



`
 * 
 * 
 */
