/**
 * config/predefined-prompts.ts
 * 
 * A mapping of user-selectable options to predefined prompts for AI processing.
 */

const predefinedPrompts: Record<string, string> = {
    'Create Lesson': 'Extract each concept from the text and provide detailed explanations for each.',
    'Generate Quiz': 'Create multiple-choice questions from the provided text.',
    'Summarize Text': 'Summarize the text into key points and highlight main ideas.',
  };
  
  export default predefinedPrompts;
  