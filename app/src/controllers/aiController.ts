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

import { Request, Response } from "express";
import AIService from "../services/aiService";
import predefinedPrompts from "../config/predefined-prompts";
import OpenAIClient from "../config/openai";
import { LessonSchema } from "../schemas/lessonSchema";
import { QuizSchema } from "../schemas/quizSchema";
import { IStructuredLessonResponse, IStructuredQuizResponse } from "../ai-definitions/Definitions";
import multer from "multer";
import pdfParse from "pdf-parse";
import fs from "fs";

const upload = multer({ dest: "uploads/" });

class AIController {
  private static aiService: AIService | null = null;

  /**
   * Lazily initializes and retrieves the AIService instance.
   */
  private static getAIService(): AIService {
    if (!this.aiService) {
      const openaiClient = OpenAIClient.getClient();
      this.aiService = new AIService(openaiClient);
    }
    return this.aiService;
  }

  /**
   * Extracts text from a PDF file or uses the `text` field from the request body.
   */
  private static async extractText(req: Request): Promise<string> {
    if (req.file) {
      const pdfBuffer = await fs.promises.readFile(req.file.path);
      const pdfData = await pdfParse(pdfBuffer);
      return pdfData.text.trim();
    }
    return req.body.text;
  }

  /**
   * Handles the `POST /generate-lesson` endpoint for generating structured lessons.
   */
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

      const structuredResponse = (await aiService.generateStructuredOutput(
        LessonSchema,
        text,
        "lesson_schema"
      )) as IStructuredLessonResponse;

      console.log("Structured lesson response received:", structuredResponse);

      res.status(200).json(structuredResponse);
    } catch (error) {
      console.error("Error in generateLesson:", error);
      res.status(500).json({ error: "Failed to generate structured lesson." });
    }
  }

  /**
   * Handles the `POST /generate-quiz` endpoint for generating structured quizzes.
   */
  public static async generateQuiz(req: Request, res: Response): Promise<void> {
    try {
      console.log("Quiz generation request received:", req.body);

      const text = await AIController.extractText(req);

      if (!text) {
        res.status(400).json({ error: "Invalid input. Text or a valid PDF is required." });
        return;
      }

      const aiService = AIController.getAIService();
      console.log("AI Service initialized");

      const structuredResponse = (await aiService.generateStructuredOutput(
        QuizSchema,
        text,
        "quiz_schema"
      )) as IStructuredQuizResponse;

      console.log("Structured quiz response received:", structuredResponse);

      res.status(200).json(structuredResponse);
    } catch (error) {
      console.error("Error in generateQuiz:", error);
      res.status(500).json({ error: "Failed to generate structured quiz." });
    }
  }
}

export default AIController;
