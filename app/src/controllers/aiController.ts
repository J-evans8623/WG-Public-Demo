/**
 * controllers/aiController.ts
 */

import { Request, Response } from "express";
import AIService from "../services/aiService";
import predefinedPrompts from "../config/predefined-prompts";
import OpenAIClient from "../config/openai";
import { lessonSchema } from "../schemas/lessonSchema";
import { MatchingQuizSchema, MultipleChoiceSchema, FillInBlankSchema, TrueFalseSchema } from "../schemas/quizSchema";
import multer from "multer";
import pdfParse from "pdf-parse";
import fs from "fs";
import { IStructuredQuizResponse } from "../ai-definitions/Definitions";

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

      
      const structuredResponse = (await aiService.generateStructuredOutput(
        lessonSchema,
        `[start of user input]${text}[end of user input]`,
        lessonPrompt,
      ));

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

  public static async generateQuiz_trueFalse(req: Request, res: Response): Promise<void> {
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

  public static async generateQuiz_fillInBlank(req: Request, res: Response): Promise<void> {
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

  public static async generateQuiz_matching(req: Request, res: Response): Promise<void> {
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