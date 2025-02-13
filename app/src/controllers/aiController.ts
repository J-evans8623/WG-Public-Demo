/**
 * controllers/aiController.ts
 */

import { NextApiRequest, NextApiResponse } from 'next';
import AIService from "../services/aiService";
import { lessonPrompt, predefinedPrompts } from "../config/predefined-prompts";
import OpenAIClient from "../config/openai";
import { lessonSchema } from "../schemas/lessonSchema";
import { MatchingQuizSchema, MultipleChoiceSchema, FillInBlankSchema, TrueFalseSchema } from "../schemas/quizSchema";
import pdfParse from "pdf-parse";
import fs from "fs";
import { IStructuredQuizResponse } from "../ai-definitions/Definitions";
import { getLessonModule } from "../services/TextPreprocessing/LessonModuleService";


// Define standardized quiz types that match the frontend enum
enum StandardQuizType {
  MULTIPLE_CHOICE = 'multipleChoice',
  MATCHING = 'matching',
  FILL_IN_BLANK = 'FIB',
  TRUE_FALSE = 'true-false'
}

class AIController {
  private static aiService: AIService | null = null;

  private static getAIService(): AIService {
    if (!this.aiService) {
      const openaiClient = OpenAIClient.getClient();
      this.aiService = new AIService(openaiClient);
    }
    return this.aiService;
  }

  private static async extractText(req: NextApiRequest): Promise<string> {
    if (req.file) {
      const pdfBuffer = await fs.promises.readFile(req.file.path);
      const pdfData = await pdfParse(pdfBuffer);
      return pdfData.text.trim();
    }
    return req.body.text;
  }

  private static addStandardQuizType(response: IStructuredQuizResponse, quizType: StandardQuizType): IStructuredQuizResponse {
    return {
      ...response,
      quizType // Add the standardized quiz type to the response
    };
  }

  public static async generateLesson(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    try {
      console.log("Lesson generation request received:", req.body);
      const { documentID, moduleID } = req.body;

      if (!documentID || !moduleID) {
        res.status(400).json({ error: "Missing documentID or moduleID" });
        return;
      }

      const lessonModuleRecord = await getLessonModule(documentID, moduleID);
      if (!lessonModuleRecord) {
        res.status(404).json({ error: "Lesson module not found" });
        return;
      }

      // Step 3: Concatenate text segments.
      // Step 4: Extract precomputed metadata from the first segment.
      // Step 5: Construct a dynamic lesson prompt.
      const aggregatedText = lessonModuleRecord.textChunk;
      const topic = lessonModuleRecord.topic;
      const subtopics = lessonModuleRecord.subtopics;
      const dynamiclessonPrompt = lessonPrompt(topic, subtopics);

      
      const aiService = AIController.getAIService();
      
      console.log("AI Service initialized");
      

      // Step 6: Call the AI service to generate the lesson using the aggregated text and dynamic prompt.
      const structuredResponse = (await aiService.generateStructuredOutput(
        lessonSchema,
        `[start of user input]${aggregatedText}[end of user input]`,
        dynamiclessonPrompt,
      ));

      // Step 7: Return the generated lesson.
      res.status(200).json(structuredResponse);
    } catch (error) {
      console.error("Error in generateLesson:", error);
      res.status(500).json({ error: "Failed to generate structured lesson." });
    }
  }

  public static async generateQuiz_multipleChoice(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    try {
      const text = await AIController.extractText(req);
      if (!text) {
        res.status(400).json({ error: "Invalid input. Text or a valid PDF is required." });
        return;
      }

      const aiService = AIController.getAIService();
      const quizPrompt = predefinedPrompts['multipleChoice'];
      

      const structuredResponse = await aiService.generateStructuredOutput(
        MultipleChoiceSchema,
        text,
        "quiz_schema"
      );

      // Add the standardized quiz type before sending the response
      const standardizedResponse = AIController.addStandardQuizType(
        structuredResponse, 
        StandardQuizType.MULTIPLE_CHOICE
      );

      res.status(200).json(standardizedResponse);
    } catch (error) {
      console.error("Error in generateQuiz_multipleChoice:", error);
      res.status(500).json({ error: "Failed to generate multiple choice quiz." });
    }
  }

  public static async generateQuiz_trueFalse(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    try {
      const text = await AIController.extractText(req);
      if (!text) {
        res.status(400).json({ error: "Invalid input. Text or a valid PDF is required." });
        return;
      }

      const aiService = AIController.getAIService();
      const quizPrompt = predefinedPrompts['trueFalse'];
      

      const structuredResponse = await aiService.generateStructuredOutput(
        TrueFalseSchema,
        text,
        "quiz_schema"
      );

      // Add the standardized quiz type before sending the response
      const standardizedResponse = AIController.addStandardQuizType(
        structuredResponse, 
        StandardQuizType.TRUE_FALSE
      );

      res.status(200).json(standardizedResponse);
    } catch (error) {
      console.error("Error in generateQuiz_trueFalse:", error);
      res.status(500).json({ error: "Failed to generate true/false quiz." });
    }
  }

  public static async generateQuiz_fillInBlank(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    try {
      const text = await AIController.extractText(req);
      if (!text) {
        res.status(400).json({ error: "Invalid input. Text or a valid PDF is required." });
        return;
      }

      const aiService = AIController.getAIService();
      const quizPrompt = predefinedPrompts['fillInBlank'];
      

      const structuredResponse = await aiService.generateStructuredOutput(
        FillInBlankSchema,
        text,
        "quiz_schema"
      );

      // Add the standardized quiz type before sending the response
      const standardizedResponse = AIController.addStandardQuizType(
        structuredResponse, 
        StandardQuizType.FILL_IN_BLANK
      );

      res.status(200).json(standardizedResponse);
    } catch (error) {
      console.error("Error in generateQuiz_fillInBlank:", error);
      res.status(500).json({ error: "Failed to generate fill in the blank quiz." });
    }
  }

  public static async generateQuiz_matching(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    try {
      const text = await AIController.extractText(req);
      if (!text) {
        res.status(400).json({ error: "Invalid input. Text or a valid PDF is required." });
        return;
      }

      const aiService = AIController.getAIService();
      const quizPrompt = predefinedPrompts['matching'];
      

      const structuredResponse = await aiService.generateStructuredOutput(
        MatchingQuizSchema,
        text,
        "quiz_schema"
      );

      // Add the standardized quiz type before sending the response
      const standardizedResponse = AIController.addStandardQuizType(
        structuredResponse, 
        StandardQuizType.MATCHING
      );

      res.status(200).json(standardizedResponse);
    } catch (error) {
      console.error("Error in generateQuiz_matching:", error);
      res.status(500).json({ error: "Failed to generate matching quiz." });
    }
  }
}

export default AIController;