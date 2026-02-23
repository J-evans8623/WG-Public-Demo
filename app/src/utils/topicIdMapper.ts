/**
 * @file topicIdMapper.ts
 * @description
 * This utility class is responsible for solving the "LLM Memory" bottleneck by providing a bidirectional 
 * mapping between complex system UUIDs and simplified tokens (e.g., A0, A1, B2). AI models perform 
 * significantly better when referencing short, distinct strings rather than 36-character UUIDs. 
 * This file implements a robust translation layer that generates an ephemeral dictionary for 
 * each AI request session. It ensures that the LLM can accurately tag generated quiz items with 
 * a "topicKey" that the system can then reliably map back to the original database record. 
 * By encapsulating this logic, we prevent ID hallucination, reduce token consumption in prompts, 
 * and establish the foundational data integrity required for the educator histograms and 
 * scholar citation features. The class is designed for high performance with O(1) lookup 
 * times for both forward and reverse mapping using internal Map structures.
 */

export interface TopicMappingResult {
  token: string;
  realId: string;
  title: string;
}

export class TopicIdMapper {
  // 1. Storage for forward and reverse lookups
  private idToToken: Map<string, string> = new Map();
  private tokenToId: Map<string, string> = new Map();
  private topicTitles: Map<string, string> = new Map();

  /**
   * generateMapping
   * @description
   * This function iterates through a collection of extracted topics to assign each one a unique, 
   * simple token. It populates the internal lookup maps to facilitate O(1) bidirectional 
   * translation between system UUIDs and LLM-friendly keys.
   * @param topics - Array of topic objects containing at least an ID and a Title.
   * @returns An array of mapping results for audit or logging purposes.
   */
  public generateMapping(topics: { id: string; title: string }[]): TopicMappingResult[] {
    const results: TopicMappingResult[] = [];
    
    // 2. Loop through topics and assign tokens based on index
    // We use a prefix 'A' for simplicity, but this can be expanded if topics > 26
    topics.forEach((topic, index) => {
      const token = `A${index}`;
      const realId = topic.id;
      
      this.idToToken.set(realId, token);
      this.tokenToId.set(token, realId);
      this.topicTitles.set(token, topic.title);
      
      results.push({ token, realId, title: topic.title });
    });
    
    return results;
  }

  /**
   * getPromptExtension
   * @description
   * Generates a structured string dictionary that is injected into the AI system prompt. 
   * This instructions-block tells the LLM exactly which simple token represents which 
   * educational topic, ensuring accurate attribution in the AI's response.
   * @returns A string block formatted for inclusion in an LLM prompt.
   */
  public getPromptExtension(): string {
    if (this.tokenToId.size === 0) return "";

    let extension = "\n### TOPIC REFERENCE DICTIONARY ###\n";
    extension += "When generating questions, you MUST include the associated 'topicKey' from the list below:\n";
    
    // 3. Build the dictionary string for the AI
    this.tokenToId.forEach((id, token) => {
      const title = this.topicTitles.get(token);
      extension += `- topicKey: "${token}" refers to Topic: "${title}"\n`;
    });
    
    extension += "### END OF DICTIONARY ###\n";
    return extension;
  }

  /**
   * getRealId
   * @description
   * Translates a simplified token (A0, A1, etc.) back into the original system UUID. 
   * This is used during the post-processing phase after the AI has returned 
   * its structured quiz data to ensure database consistency.
   * @param token - The simplified token string returned by the LLM.
   * @returns The original UUID string or undefined if the token is unrecognized.
   */
  public getRealId(token: string): string | undefined {
    return this.tokenToId.get(token);
  }

  /**
   * getToken
   * @description
   * Translates a real system UUID into its simplified token representation. 
   * This is primarily used for internal validation or debugging the prompt 
   * generation logic within the service layer.
   * @param realId - The 36-character system UUID.
   * @returns The associated simple token or undefined if not mapped.
   */
  public getToken(realId: string): string | undefined {
    return this.idToToken.get(realId);
  }
}