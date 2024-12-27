/**
 * services/aiService.ts
 * 
 * Handles AI-related operations, including:
 * - Processing and validating user input.
 * - Interacting with OpenAI API for content generation.
 * - Caching responses to optimize performance.
 * - Logging requests for traceability.
 */
// services/aiService.ts
// services/aiService.ts
import OpenAI from 'openai';

class AIService {
  private openai: OpenAI;

  constructor(openai: OpenAI) {
    this.openai = openai;
    console.log('AIService initialized with OpenAI client');
  }

  public async processUserInput(text: string, predefinedPrompt: string): Promise<string> {
    try {
      console.log('Processing input:', { text, predefinedPrompt });
      
      const prompt = `${predefinedPrompt}\n\n${text}`;
      
      console.log('Sending request to OpenAI...');
      
      // Using chat completion instead of the deprecated completions endpoint
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo', // Updated to use current model
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that provides detailed explanations and lessons.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.7,
      });

      console.log('Response received from OpenAI:', response);
      
      if (!response.choices?.[0]?.message?.content) {
        throw new Error('No response text received from OpenAI');
      }

      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error('Detailed error in processUserInput:', error);
      throw error;
    }
  }
}

export default AIService;