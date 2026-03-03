/**
 * @file aiFeedbackService.ts
 * @description
 * (update - 1.1)
 * This service has been refactored to support dynamic, multi-format assessment generation 
 * within the Quiz Feedback Pipeline. Its primary responsibility is to orchestrate the 
 * evidence-based prompting strategy for various quiz types, including Multiple Choice, 
 * True/False, Fill-in-the-Blank, and Matching. By removing the previous Multiple Choice 
 * hardcoding, the service now acts as a polymorphic gateway that resolves the correct 
 * pedagogical JSON schema based on the educator's request. It ensures that every 
 * question format is strictly grounded in the textbook context through verbatim citations 
 * and detailed explanations. This implementation maintains a clean separation of 
 * concerns by delegating transport to the UnifiedAIService while managing the 
 * feedback-specific system prompts and schema-validation logic required for student 
 * remediation. The service is designed to be highly extensible, allowing for the 
 * addition of new pedagogical formats without impacting the core assessment engine 
 * or existing standard quiz pathways.
 */

import UnifiedAIService from "@/app/src/services/UnifiedAIService";
// update - 1.2: Import the full suite of feedback-capable schemas
import { 
  FeedbackMultipleChoiceSchema, 
  TrueFalseSchema, 
  FillInBlankSchema, 
  MatchingQuizSchema 
} from "@/app/src/schemas/feedbackQuizSchema";

export class AiFeedbackService {
  private aiService: UnifiedAIService;

  constructor() {
    this.aiService = new UnifiedAIService();
  }

  /**
   * getFeedbackSchemaByType
   * @description
   * Private utility to resolve the correct feedback schema for the LLM based on the 
   * requested quiz type. This ensures O(1) lookup speed and provides a fallback 
   * to Multiple Choice if an unrecognized type is specified.
   * @param quizType - The requested format (multipleChoice, true-false, FIB, matching).
   * @returns The corresponding JSON schema object for the AI provider.
   */
  // update - 1.3
  private getFeedbackSchemaByType(quizType: string): any {
    const schemas: Record<string, any> = {
      'multipleChoice': FeedbackMultipleChoiceSchema,
      'true-false': TrueFalseSchema,
      'FIB': FillInBlankSchema,
      'matching': MatchingQuizSchema
    };

    return schemas[quizType] || FeedbackMultipleChoiceSchema;
  }

  /**
   * generateFeedbackQuiz
   * @description
   * (update - 1.4) Refactored to accept a dynamic 'quizType' parameter. This function 
   * coordinates the generation of citation-backed assessments by resolving the correct 
   * schema and building a format-aware system prompt. It grounded the AI in 
   * verbatim evidence while respecting the educator's chosen assessment style.
   * @param context - The lesson material extracted from the Yjs document.
   * @param promptExtension - The ID mapping dictionary for topic grounding.
   * @param questionCount - The number of questions requested.
   * @param quizType - The format of the quiz (e.g., matching, true-false).
   * @returns A promise resolving to an enriched, structured quiz response.
   */
  public async generateFeedbackQuiz(
    context: string,
    promptExtension: string,
    questionCount: number,
    quizType: string // update - 1.4: Parameterized type
  ): Promise<any> {
    // 1. Step 1: Resolve the appropriate schema for the requested format
    const chosenSchema = this.getFeedbackSchemaByType(quizType);

    // 2. Step 2: Build the specialized system prompt with format-specific instructions
    const systemPrompt = `
      You are an expert pedagogical assistant. You will be given a lesson and your goal is to create a quiz to assess student's grasp of the topics in that lesson. 
      INSTRUCTIONS:
      1. For every question, you MUST provide a detailed 'explanation' of the correct answer.
      2. You MUST provide a 'citation' containing a verbatim quote from the provided lesson context as proof.
      3. Use the 'topicKey' provided in the dictionary below to tag each question correctly. This is critical to identify which topic a quiz question was originally based on.
      4. Ground all questions strictly in the provided text.
      ${promptExtension}
    `;

    const userInput = `Generate a ${questionCount}-question ${quizType} quiz based on the following text:\n\n${context}`;
    const DataPrint = {systemPrompt, userInput}
    console.log(` 4356 Feedback quick Input data : ${JSON.stringify(DataPrint)}`)

    // 3. Step 3: Execute structured output call with provider-agnostic failover logic
    return await this.aiService.generateStructuredOutput(
      { openai: chosenSchema, gemini: chosenSchema } as any,
      userInput,
      systemPrompt,
      { model: "gpt-5-mini", modeleffort: "low" }
    );
  }
}