/**
 * utils/moderation.ts
 * 
 * Integrates OpenAI's Moderation API to filter unsafe or harmful content.
 * 
 * Responsibilities:
 * - Uses OpenAI's Moderation API to check if the content violates safety policies.
 * - Returns a boolean indicating whether the content is flagged as unsafe.
 */

import OpenAI from 'openai';

class Moderation {
  private openai: OpenAI;

  constructor(openai: OpenAI) {
    this.openai = openai;
  }

  /**
   * Moderates the given content using OpenAI’s Moderation API.
   * 
   * @param content - The text content to be moderated.
   * @returns Promise<boolean> - True if the content is flagged as unsafe, false otherwise.
   */
  public async moderateContent(content: string): Promise<boolean> {
    try {
      const response = await this.openai.moderations.create({
        input: content,
      });

      const flagged = response.results[0]?.flagged || false;
      return flagged;
    } catch (error) {
      console.error('Error in moderation:', error);
      throw new Error('Failed to moderate content. Please try again.');
    }
  }
}

export default Moderation;
