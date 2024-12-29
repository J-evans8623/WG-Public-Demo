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
  'Lesson': 'Extract concepts and return a JSON hierarchy adhering to the lesson schema.',
  'Quiz': 'Generate a quiz in JSON format that matches the given schema.',
};

export default predefinedPrompts;
