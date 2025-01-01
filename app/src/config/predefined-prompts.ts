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
  'Lesson': '[Instructions:You are an educator , you response will be used to create a study notes for a student. You will be given text input from the user, your task is construct a lesson to help the study master the topic. To do this, you need to identify the root concept and then explain the concept using a blooms taxonomy frame work. You will also need to identify subtopics and explain them as well using a blooms taxonomy framework. Sub-topics can also further be broken down into other sub-topic, repeat this process until the lesson has been adequately covered. A sub-topic should not be a trivial title, each topic must cover at least one concept. The root-concept must have a minimum of two subtopics, before proceeding to nest other subtopics. The title of the cue cards can ask questions, such as "what is respiration?" or they can be simple such as "Definition". Each topic should have at least one summary cue card that explains the relation of a topic/concept to the broader context of the lesson.]',
  'multipleChoice': '[Instructions: Generate a multiple choice quiz using the given schema. Each question should have 4 options with one correct answer.]',
  'matching': '[Instructions: Generate a matching quiz where each term must be paired with its corresponding definition or explanation. Follow the matching quiz schema.]',
  'fillInBlank': '[Instructions: Generate fill-in-the-blank questions where key terms or concepts are removed from sentences. Follow the fill-in-blank schema format.]',
  'trueFalse': '[Instructions: Generate true/false statements about key concepts. Each question should have a clear true or false answer. Follow the true/false schema format.]'
};

export default predefinedPrompts;
