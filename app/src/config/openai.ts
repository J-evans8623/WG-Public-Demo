/**
 * config/openai.ts
 *
 * Configures the OpenAI client to interact with the OpenAI API.
 * Retrieves the API key from environment variables and sets up the client.
 *
 * Responsibilities:
 * - Ensures the OpenAI client is initialized with a valid API key.
 * - Provides access to the OpenAI client instance for other parts of the application.
 */

/**
 * config/openai.ts
 */
import OpenAI from 'openai';

class OpenAIClient {
  private static instance: OpenAI | null = null;

  /**
   * Gets or creates the OpenAI client instance.
   * Lazy initialization ensures environment variables are loaded first.
   */
  public static getClient(): OpenAI {
    if (!this.instance) {
      const apiKey = process.env.OPENAI_API_KEY;
      
      if (!apiKey) {
        throw new Error('OpenAI API key is not set. Please set OPENAI_API_KEY in your environment variables.');
      }

      this.instance = new OpenAI({ apiKey });
    }

    return this.instance;
  }
}

export default OpenAIClient;