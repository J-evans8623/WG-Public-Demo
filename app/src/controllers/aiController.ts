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

// controllers/aiController.ts
import { Request, Response } from 'express';
import AIService from '../services/aiService';
import predefinedPrompts from '../config/predefined-prompts';
import OpenAIClient from '../config/openai';

class AIController {
  private static aiService: AIService | null = null;

  private static getAIService(): AIService {
    if (!this.aiService) {
      const openaiClient = OpenAIClient.getClient();
      this.aiService = new AIService(openaiClient);
    }
    return this.aiService;
  }

  public static async generateAI(req: Request, res: Response): Promise<void> {
    try {
      console.log('Request received:', req.body); // Debug log

      const { text, option } = req.body;

      if (!text || !option) {
        res.status(400).json({ error: 'Invalid input. Both text and option are required.' });
        return;
      }

      const predefinedPrompt = predefinedPrompts[option];
      if (!predefinedPrompt) {
        res.status(400).json({ error: 'Invalid option selected.' });
        return;
      }

      const aiService = AIController.getAIService();
      console.log('AI Service initialized'); // Debug log

      const aiResponse = await aiService.processUserInput(text, predefinedPrompt);
      console.log('AI Response received:', aiResponse); // Debug log

      res.status(200).json({ content: aiResponse });
    } catch (error) {
      console.error('Detailed error in generateAI:', error);
      res.status(500).json({ error: 'Failed to generate AI content.' });
    }
  }
}

// Export the class itself, not an instance
export default AIController;