/**
 * @file feedbackPromptShaper.ts
 * @description
 * This utility class is responsible for the critical "Context Shaping" phase of the Quiz Feedback Pipeline. 
 * Its primary responsibility is to transform raw, monolithic lesson data into a structured, unit-based 
 * summary that the LLM can consume as grounded context. By segmenting the lesson according to 
 * Concept Node IDs, it creates a clear mapping between educational content and system identifiers. 
 * For each node, it aggregates note resources and flashcard content, providing the AI with a 
 * "localized" view of each topic. This segmentation is vital for the generation of citations, 
 * as it allows the LLM to understand exactly which node provides the proof for a specific 
 * question. The utility adheres to the requirements of the Phase 1 mapping strategy by 
 * integrating the simplified TopicKeys (A0, B1, etc.) directly into the text blocks, 
 * ensuring that the resulting AI response is perfectly aligned with the bidirectional 
 * lookup table. This prevents data loss during the transition from extracted Yjs bytes 
 * to structured AI prompts, satisfying the sprint's core objective of data integrity.
 */

import { TopicIdMapper } from "./topicIdMapper";

/**
 * shapeRemediationContext
 * @description
 * This function takes extracted lesson topics and a pre-configured TopicIdMapper to generate 
 * a string-based context block. It organizes the material into clearly defined units 
 * where each topic is tagged with its LLM-facing TopicKey and original title.
 * @param lessons - The normalized array of topics extracted from the Yjs document state.
 * @param mapper - An instance of TopicIdMapper containing the UUID-to-Token dictionary.
 * @returns A formatted string containing the structured study material for the LLM input.
 */
// update - 1.1
export function shapeRemediationContext(
  lessons: { topicTitle: string; topicContent: string; nodeId: string }[],
  mapper: TopicIdMapper
): string {
  // 1. Step 1: Initialize the accumulator for the study material summary
  const lines: string[] = [];
  lines.push("### START OF STUDY MATERIAL UNITS ###");
  lines.push("The material below is divided into conceptual units. Each unit is tagged with a 'TopicKey'.");

  // 2. Step 2: Iterate through each unit to build the grounded context block
  lessons.forEach((unit) => {
    // 3. Step 3: Retrieve the simplified token assigned to this node's UUID
    const token = mapper.getToken(unit.nodeId);
    
    if (token) {
      lines.push(`\n[UNIT START: ${token}]`);
      lines.push(`TOPIC TITLE: ${unit.topicTitle}`);
      lines.push(`CONTENT: ${unit.topicContent}`);
      lines.push(`[UNIT END: ${token}]`);
    }
  });

  lines.push("\n### END OF STUDY MATERIAL UNITS ###");
  
  // 4. Step 4: Combine into a single instruction block for the AI context window
  return lines.join("\n");
}