/**
 * aiTextPreprocessing.ts
 *
 * This file implements an independent pipeline for generating text embeddings
 * and structured lesson metadata using the OpenAI API.
 *
 * Responsibilities:
 *  - generateEmbedding: Accepts raw text and returns an embedding vector.
 *  - generateLessonMetadata: Accepts aggregated lesson module text and uses a
 *    Chain-of-Thought (CoT) prompt to generate structured lesson metadata (a topic
 *    and exactly three subtopics) that conforms to a predefined JSON schema.
 *
 * Note: Ensure that the environment variable OPENAI_API_KEY is set with your API key.
 */

import OpenAI from 'openai';
import { lessonMetadataJSONSchema } from './utils/lessonMetadataSchema'; // Adjust relative path if necessary

// Initialize the OpenAI client.
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generates an embedding for the given text using the "text-embedding-ada-002" model.
 *
 * @param text - The raw input text.
 * @returns A promise that resolves to an array of numbers representing the embedding.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    
    // In the new OpenAI API structure, the embedding is directly available.
    const embedding = response.data[0].embedding;
    return embedding;
  } catch (error) {
    console.error("Error in generateEmbedding:", error);
    throw error;
  }
}

/**
 * Heuristic function to compute the number of subtopics to generate based on the length of the aggregated text.
 * Assumes approximately 2500 characters per page.
 *
 * Mapping:
 * - Less than 5 pages: 1–3 subtopics → choose 2 (midpoint)
 * - 5 to 10 pages: 2–4 subtopics → choose 3
 * - 10 to 15 pages: 4–6 subtopics → choose 5
 * - 15 to 20 pages: 5–7 subtopics → choose 6
 * - More than 20 pages: default to 6 subtopics (adjustable as needed)
 *
 * @param text - The aggregated text from the lesson module.
 * @returns The desired number of subtopics.
 */
function computeSubtopicBounds(text: string): { min: number, max: number } {
  const pages = Math.ceil(text.length / 2500);
  if (pages < 5) {
    return { min: 1, max: 3 };
  } else if (pages < 10) {
    return { min: 2, max: 4 };
  } else if (pages < 15) {
    return { min: 4, max: 6 };
  } else if (pages <= 20) {
    return { min: 5, max: 7 };
  } else {
    return { min: 5, max: 7 };
  }
}

/**
 * Generates lesson metadata (a topic and exactly three subtopics) for a given aggregated lesson module text.
 * This function uses a Chain-of-Thought (CoT) prompt to instruct the model to produce a structured JSON object
 * that adheres to a predefined JSON schema.
 *
 * @param aggregatedText - The aggregated text from a lesson module.
 * @returns A promise that resolves to a LessonMetadata object.
 */
export async function generateLessonMetadata(aggregatedText: string): Promise<any> {
  // Define a Chain-of-Thought prompt template.

  // Compute the desired subtopic bounds based on the aggregated text.
  const { min, max } = computeSubtopicBounds(aggregatedText);

  const prompt = `
You are an expert curriculum designer. Analyze the following text excerpt from a lesson module and generate a concise topic summarizing its main theme, along with an array of between ${min} and ${max} distinct subtopics that capture the key aspects of the content.
Output must be a valid JSON object strictly following this exact format (do not change the key names):
{
  "topic": "string"    //The title of the main Topic of the lesson module,
  "subtopics": ["string", ..., "string"]  // The array should contain between ${min} and ${max} sub topics.
}
Do not include any additional text or explanation.
Here is the text:w
"""${aggregatedText}"""
  `.trim();

  // Define the structured output schema for lesson metadata.

  try {
    const response = await openai.beta.chat.completions.parse({
      model: "gpt-4o-mini", // Use a cost-effective model; replace with "gpt-4o-mini" or desired model identifier
      messages: [
        { role: "system", content: "You are a helpful assistant that generates structured lesson metadata." },
        { role: "user", content: prompt }
      ],
      temperature: 0.5,
      max_completion_tokens: 400,
      response_format: { 
        type: "json_schema",
        json_schema: {
          name: lessonMetadataJSONSchema.name,
          schema: lessonMetadataJSONSchema.schema,
          strict: lessonMetadataJSONSchema.strict
        }
      }
    });

    console.log("Structured response received:", JSON.stringify(response, null, 2));   


    // Return the parsed structured output.
    return response.choices[0].message.parsed;
  } catch (error) {
    console.error("Error in generateLessonMetadata:", error);
    // Fallback: Return a simple dummy result.
    return {
      topic: `Topic for ${aggregatedText.substring(0, 30)}...`,
      subtopics: ['Subtopic 1', 'Subtopic 2', 'Subtopic 3']
    };
  }
}
