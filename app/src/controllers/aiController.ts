/**
 * controllers/aiController.ts
 *
 * Handles API requests related to AI services.
 *
 * Responsibilities:
 * - Accepts user input from HTTP requests or PDF uploads.
 * - Maps user-selected options to predefined prompts and schemas.
 * - Invokes AI Service methods for processing structured responses.
 * - Handles success and error responses.
 *
 * Dependencies:
 * - `aiService.ts` for AI operations.
 * - `predefined-prompts.ts` for predefined prompts.
 * - `schemas` for structured output validation.
 */

/**
 * controllers/aiController.ts
 */

import { Request, Response } from "express";
import AIService from "../services/aiService";
import predefinedPrompts from "../config/predefined-prompts";
import OpenAIClient from "../config/openai";
import { LessonSchema } from "../schemas/lessonSchema";
import { MatchingQuizSchema, MultipleChoiceSchema, FillInBlankSchema, TrueFalseSchema } from "../schemas/quizSchema";
import { IStructuredLessonResponse, IStructuredQuizResponse } from "../ai-definitions/Definitions";
import multer from "multer";
import pdfParse from "pdf-parse";
import fs from "fs";

const upload = multer({ dest: "uploads/" });

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

  private static async extractText(req: Request): Promise<string> {
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

  public static async generateLesson(req: Request, res: Response): Promise<void> {
    try {
      console.log("Lesson generation request received:", req.body);
      const text = await AIController.extractText(req);

      if (!text) {
        res.status(400).json({ error: "Invalid input. Text or a valid PDF is required." });
        return;
      }

      const aiService = AIController.getAIService();
      console.log("AI Service initialized");
      const lessonPrompt = predefinedPrompts['Lesson'];
      const fullPrompt = `${lessonPrompt}\n${text}`; 
      
      const structuredResponse = (await aiService.generateStructuredOutput(
        LessonSchema,
        fullPrompt,
        "lesson_schema"
      )) as IStructuredLessonResponse;

      res.status(200).json(structuredResponse);
    } catch (error) {
      console.error("Error in generateLesson:", error);
      res.status(500).json({ error: "Failed to generate structured lesson." });
    }
  }

  public static async generateQuiz_multipleChoice(req: Request, res: Response): Promise<void> {
    try {
      const text = await AIController.extractText(req);
      if (!text) {
        res.status(400).json({ error: "Invalid input. Text or a valid PDF is required." });
        return;
      }

      const aiService = AIController.getAIService();
      const quizPrompt = predefinedPrompts['multipleChoice'];
      const fullPrompt = `${quizPrompt}\n${text}`; 

      const structuredResponse = await aiService.generateStructuredOutput(
        MultipleChoiceSchema,
        fullPrompt,
        "quiz_schema"
      ) as IStructuredQuizResponse;

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

  public static async generateQuiz_trueFalse(req: Request, res: Response): Promise<void> {
    try {
      const text = await AIController.extractText(req);
      if (!text) {
        res.status(400).json({ error: "Invalid input. Text or a valid PDF is required." });
        return;
      }

      const aiService = AIController.getAIService();
      const quizPrompt = predefinedPrompts['trueFalse'];
      const fullPrompt = `${quizPrompt}\n${text}`; 

      const structuredResponse = await aiService.generateStructuredOutput(
        TrueFalseSchema,
        fullPrompt,
        "quiz_schema"
      ) as IStructuredQuizResponse;

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

  public static async generateQuiz_fillInBlank(req: Request, res: Response): Promise<void> {
    try {
      const text = await AIController.extractText(req);
      if (!text) {
        res.status(400).json({ error: "Invalid input. Text or a valid PDF is required." });
        return;
      }

      const aiService = AIController.getAIService();
      const quizPrompt = predefinedPrompts['fillInBlank'];
      const fullPrompt = `${quizPrompt}\n${text}`; 

      const structuredResponse = await aiService.generateStructuredOutput(
        FillInBlankSchema,
        fullPrompt,
        "quiz_schema"
      ) as IStructuredQuizResponse;

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

  public static async generateQuiz_matching(req: Request, res: Response): Promise<void> {
    try {
      const text = await AIController.extractText(req);
      if (!text) {
        res.status(400).json({ error: "Invalid input. Text or a valid PDF is required." });
        return;
      }

      const aiService = AIController.getAIService();
      const quizPrompt = predefinedPrompts['matching'];
      const fullPrompt = `${quizPrompt}\n${text}`; 

      const structuredResponse = await aiService.generateStructuredOutput(
        MatchingQuizSchema,
        fullPrompt,
        "quiz_schema"
      ) as IStructuredQuizResponse;

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