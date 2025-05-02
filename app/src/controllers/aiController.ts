/**
 * bloom-maps\app\src\controllers\aiController.ts
 *
 * This controller handles AI operations including lesson generation, quiz generation,
 * question handling, and topic generation.
 *
 * Newly added: handleQuizTool – Implements the specialized quiz generation pipeline.
 *
 * Responsibilities of handleQuizTool:
 *  1. Extracts from the request body:
 *      - topicIds: Array of selected concept node IDs.
 *      - quizTypes: Array of quiz types (supported values: multipleChoice, matching, FIB, true-false).
 *      - includeDocs: Boolean flag for using uploaded document context.
 *      - fileID, summary, summaryPresent, mapID, exportData.
 *  2. If includeDocs is true, calls getTextContext(exportData, fileID) to retrieve additional context.
 *  3. Constructs a final prompt that includes the export data, additional context (if any), and the quiz types.
 *  4. Selects the appropriate JSON schema and system prompt based on the quiz type(s).
 *  5. Invokes the AI service’s generateStructuredOutput and returns the structured quiz.
 */

import { NextApiRequest, NextApiResponse } from 'next';
import AIService from "../services/aiService";
import { lessonPrompt, predefinedPrompts } from "../config/predefined-prompts";
import OpenAIClient from "../config/openai";
import { lessonSchema, topicSchema } from "../schemas/lessonSchema";
import { MatchingQuizSchema, MultipleChoiceSchema, FillInBlankSchema, TrueFalseSchema } from "../schemas/quizSchema";
import { LessonModule } from "../services/TextPreprocessing/LessonModuleServiceV2";
import { getTextContext } from '@/app/src/services/TextPreprocessing/QuestionContextService';
import { QAschema } from '@/app/src/schemas/QASchema';
import { formatLessonMetadata } from "../services/TextPreprocessing/MetaDataFormatter";


class AIController {
  private static aiService: AIService | null = null;

  // Returns a singleton AIService instance.
  private static getAIService(): AIService {
    if (!this.aiService) {
      console.log('[AIController] Initializing AI Service');
      const openaiClient = OpenAIClient.getClient();
      this.aiService = new AIService(openaiClient);
    }
    return this.aiService;
  }

/**
   * generateLesson
   * @description
   *   Generates the full lesson content for a given LessonModule.
   *   It constructs a dynamic prompt based on the lesson module metadata,
   *   calls the AI service to generate structured lesson content, and returns
   *   the updated LessonModule with the AI-generated content attached.
   *
   * @param lessonModule - The LessonModule object containing basic metadata.
   * @returns A Promise that resolves to the updated LessonModule with full lesson content.
   */
public static async generateLesson(lessonModule: LessonModule): Promise<LessonModule> {
  try {
    // Step 1: Format the lesson metadata into a human-readable string.
    const formattedMetadata = formatLessonMetadata(lessonModule.metadata);
    // Step 2: Construct a dynamic prompt using the formatted metadata.
    const dynamicLessonPrompt = lessonPrompt(formattedMetadata);
    // Step 3: Retrieve the aggregated text from the lesson module.
    const aggregatedText = lessonModule.original_text;
    
    // Step 4: Obtain the AI service instance.
    const aiService = this.getAIService();
    
    // Step 5: Call the AI service to generate structured lesson content.
    // The generateStructuredOutput method is expected to return the full lesson content.
    const structuredResponse = await aiService.generateStructuredOutput(
      lessonSchema,
      `[start of user input]${aggregatedText}[end of user input]`,
      dynamicLessonPrompt
    );
  
    
    // Return the updated lesson module.
    return structuredResponse;
  } catch (error) {
    console.error("Error in AIController.generateLesson:", error);
    throw error;
  }
}


  public static async handleQuestion(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    try {
      console.log("[AIController] handleQuestion called with body:", req.body);
      const { question, textSelection, fileID } = req.body;
      if (!question || !fileID) {
        res.status(400).json({ error: "Missing question, moduleID, or fileID" });
        return;
      }
      let combinedInput = question;
      if (textSelection && typeof textSelection === 'string' && textSelection.trim().length > 0) {
        combinedInput += " " + textSelection.trim();
      }
      console.log("[AIController] Combined input for QA:", combinedInput);
      let retrievedContext = "";
      // Always get text context for a given question.
      retrievedContext = await getTextContext(combinedInput, fileID);
      console.log("[AIController] Retrieved additional context:", retrievedContext);
 
      let finalPrompt = question;
      if (retrievedContext && retrievedContext.trim().length > 0) {
        finalPrompt += "\nContext: " + retrievedContext.trim();
      }
      console.log("[AIController] Final prompt for QA:", finalPrompt);
      const systemPrompt = predefinedPrompts['QApipeline'];
      console.log("[AIController] Using system prompt for QA:", systemPrompt);
      const aiService = AIController.getAIService();
      const structuredResponse = await aiService.generateStructuredOutput(
        QAschema,
        finalPrompt,
        systemPrompt
      );
      console.log("[AIController] QA structured response:", structuredResponse);
      res.status(200).json(structuredResponse);
    } catch (error) {
      console.error("[AIController] Error in handleQuestion:", error);
      res.status(500).json({ error: "Failed to generate answer for the question." });
    }
  }

  public static async handleTopicGeneration(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    try {
      console.log("[AIController] handleTopicGeneration called with body:", req.body);
      const { userTopicRequest, exportData, moduleID, summary, summaryPresent, fileID } = req.body;
      if (!userTopicRequest || !moduleID || !fileID) {
        res.status(400).json({ error: "Missing required fields: userTopicRequest, moduleID, or fileID" });
        return;
      }
      // Retrieve additional context based on the user's topic request.
      const retrievedContext = await getTextContext(userTopicRequest, fileID);
      console.log("[AIController] Retrieved context for topic generation:", retrievedContext);
      // Construct final prompt.
      let finalPrompt = "User Topic Request: " + userTopicRequest;
      finalPrompt += "\nUpload: " + exportData;
      finalPrompt += "\nContext: " + retrievedContext;
      console.log("[AIController] Final prompt for topic generation:", finalPrompt);
      const systemPrompt = predefinedPrompts['ExploreTopic'];
      console.log("[AIController] Using system prompt for topic generation:", systemPrompt);
      const aiService = AIController.getAIService();
      const structuredResponse = await aiService.generateStructuredOutput(
        topicSchema,
        finalPrompt,
        systemPrompt
      );
      console.log("[AIController] Topic generation structured response:", structuredResponse);
      res.status(200).json(structuredResponse);
    } catch (error) {
      console.error("[AIController] Error in handleTopicGeneration:", error);
      res.status(500).json({ error: "Failed to generate topic." });
    }
  }

  /**
   * handleQuizTool
   *
   * Processes specialized quiz generation requests from the Quiz Tool.
   * It extracts the following fields from the request body:
   *   - topicIds: string[] (selected concept node IDs)
   *   - quizTypes: string[] (supported values: multipleChoice, matching, FIB, true-false)
   *   - includeDocs: boolean
   *   - fileID, summary, summaryPresent, mapID, exportData: exported study data
   *
   * Based on the includeDocs flag:
   *   - If true: Calls getTextContext on exportData to retrieve additional document context.
   *   - If false: Uses exportData directly.
   *
   * Constructs a final prompt including the export data, additional context (if any),
   * and a note of the selected quiz types.
   *
   * Then selects an appropriate JSON schema and system prompt based on the quiz type.
   * Finally, calls generateStructuredOutput and returns the structured quiz response.
   */
  public static async handleQuizTool(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    try {
      console.log("[AIController] handleQuizTool called with body:", req.body);
      const {
        topicIds,
        quizTypes,
        includeDocs,
        fileID,
        summary,
        summaryPresent,
        mapID,
        exportData
      } = req.body;

      if (!topicIds || !quizTypes || !fileID || !mapID || !exportData) {
        res.status(400).json({ error: "Missing required fields for quiz generation." });
        return;
      }

      // Determine additional context if includeDocs is true.
      let additionalContext = "";
      if (includeDocs === true) {
        additionalContext = await getTextContext(exportData, fileID);
        console.log("[AIController] Additional context retrieved:", additionalContext);
      }

      // Construct the final prompt.
      // It always includes the export data and the quiz types.
      let finalPrompt = "Export: " + exportData;
      if (includeDocs === true && additionalContext.trim().length > 0) {
        finalPrompt += "\nContext: " + additionalContext;
      }
      finalPrompt += "\nQuiz Types: " + quizTypes.join(", ");
      console.log("[AIController] Final prompt for quiz generation:", finalPrompt);

      // Mapping for system prompts and schemas.
      const quizTypeMapping: { [key: string]: { promptKey: string, schema: any } } = {
        "multipleChoice": { promptKey: "multipleChoice", schema: MultipleChoiceSchema },
        "matching": { promptKey: "matching", schema: MatchingQuizSchema },
        "FIB": { promptKey: "fillInBlank", schema: FillInBlankSchema },
        "true-false": { promptKey: "trueFalse", schema: TrueFalseSchema }
      };

      let chosenSchema = MultipleChoiceSchema;
      let systemPrompt = "";

      if (quizTypes.length === 1) {
        const mapping = quizTypeMapping[quizTypes[0]];
        if (mapping) {
          chosenSchema = mapping.schema;
          systemPrompt = predefinedPrompts[mapping.promptKey] || "";
        } else {
          systemPrompt = "Generate a quiz based on the provided content.";
        }
      } else {
        // If multiple quiz types are selected, use a composite prompt.
        systemPrompt = "Generate a composite quiz that includes the following types: " + quizTypes.join(", ");
      }
      console.log("[AIController] Using system prompt:", systemPrompt);

      const aiService = AIController.getAIService();
      const structuredResponse = await aiService.generateStructuredOutput(
        chosenSchema,
        finalPrompt,
        systemPrompt
      );
      console.log("[AIController] Quiz generation structured response:", structuredResponse);
      res.status(200).json(structuredResponse);
    } catch (error) {
      console.error("[AIController] Error in handleQuizTool:", error);
      res.status(500).json({ error: "Failed to generate quiz." });
    }
  }
}

export default AIController;
