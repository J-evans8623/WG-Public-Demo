/**
 * controllers/aiController.ts
 * 
 * Handles API requests related to AI services.
 * 
 * Responsibilities:
 * - Accepts user input from HTTP requests.
 * - Maps user-selected options to predefined prompts.
 * - Invokes AI Service methods for processing.
 * - Handles success and error responses.
 */

import { Request, Response } from 'express';
import AIService from '../services/aiService';
import predefinedPrompts from '../config/predefined-prompts';
import OpenAIClient from '../config/openai';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import fs from 'fs';

const upload = multer({ dest: 'uploads/' });

class AIController {
  private static aiService: AIService | null = null;

  /**
   * Lazily initializes and retrieves the AIService instance.
   * 
   * Responsibilities:
   * - Ensures the AIService is initialized only once.
   * - Reuses the same instance of AIService for all subsequent requests.
   * 
   * @returns {AIService} The initialized AIService instance.
   */
  private static getAIService(): AIService {
    if (!this.aiService) {
      const openaiClient = OpenAIClient.getClient();
      this.aiService = new AIService(openaiClient);
    }
    return this.aiService;
  }

  /**
   * Handles the `POST /generate-ai` endpoint for generating AI content.
   * 
   * Responsibilities:
   * - Validates the incoming request for required fields (`text` and `option`).
   * - Maps the user-selected `option` to a predefined prompt.
   * - Uses AIService to process user input and retrieve AI-generated content.
   * - Sends a successful response with the generated content or an appropriate error message.
   * 
   * @param req - Express Request object containing user input and selected option.
   * @param res - Express Response object to send back AI-generated content or error responses.
   */
  public static async generateAI(req: Request, res: Response): Promise<void> {
    try {
      console.log('Request received:', req.body); // Debug log

      const { text, option } = req.body;

      // Validate request input
      if (!text || !option) {
        res.status(400).json({ error: 'Invalid input. Both text and option are required.' });
        return;
      }

      // Map option to predefined prompt
      const predefinedPrompt = predefinedPrompts[option];
      if (!predefinedPrompt) {
        res.status(400).json({ error: 'Invalid option selected.' });
        return;
      }

      // Initialize AIService
      const aiService = AIController.getAIService();
      console.log('AI Service initialized'); // Debug log

      // Process user input and generate AI content
      const aiResponse = await aiService.processUserInput(text, predefinedPrompt);
      console.log('AI Response received:', aiResponse); // Debug log

      // Send successful response with AI-generated content
      res.status(200).json({ content: aiResponse });
    } catch (error) {
      console.error('Detailed error in generateAI:', error);
      res.status(500).json({ error: 'Failed to generate AI content.' });
    }
  }

  /**
   * Handles the `POST /generate-ai-pdf` endpoint for generating AI content from PDF uploads.
   */
  public static async generateAIWithPDF(req: Request, res: Response): Promise<void> {
    try {
      console.log('PDF-based AI Request received:', req.body); // Debug log

      const { option } = req.body;

      // Validate request input
      if (!option) {
        res.status(400).json({ error: 'Invalid input. Option is required.' });
        return;
      }

      // Ensure a file is uploaded
      if (!req.file) {
        res.status(400).json({ error: 'No PDF file uploaded.' });
        return;
      }

      // Validate option
      const predefinedPrompt = predefinedPrompts[option];
      if (!predefinedPrompt) {
        res.status(400).json({ error: 'Invalid option selected.' });
        return;
      }

      // Extract text from PDF
      const pdfBuffer = await fs.promises.readFile(req.file.path);
      const pdfData = await pdfParse(pdfBuffer);
      const extractedText = pdfData.text;

      if (!extractedText.trim()) {
        res.status(400).json({ error: 'PDF contains no extractable text.' });
        return;
      }

      // Initialize AIService
      const aiService = AIController.getAIService();
      console.log('AI Service initialized'); // Debug log

      // Process extracted text and generate AI content
      const aiResponse = await aiService.processUserInput(extractedText, predefinedPrompt);
      console.log('AI Response received:', aiResponse); // Debug log

      // Send successful response with AI-generated content
      res.status(200).json({ content: aiResponse });
    } catch (error) {
      console.error('Detailed error in generateAIWithPDF:', error);
      res.status(500).json({ error: 'Failed to generate AI content from PDF.' });
    }
  }

}




// Export the class itself, not an instance
export default AIController;
