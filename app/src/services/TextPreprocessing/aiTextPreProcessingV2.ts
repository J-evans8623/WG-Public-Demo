/**
 * @file app/src/services/TextPreprocessing/aiTextPreProcessing.ts
 * @description
 *   Provides AI‐powered syllabus generation and text embeddings.
 *
 * Responsibilities:
 * - generateEmbedding(text): returns an embedding vector for a piece of text.
 * - generateSyllabus(hierarchy): given an array of NodeStubs with `identifier` and `aggregated_text`,
 *   produces a complete syllabus JSON, filling in titles for each subtopic and global lesson fields.
 *   The prompt now includes a concrete example of input and expected output to guide the model.
 *
 * Dependencies:
 * - OpenAI client for embeddings and chat completions.
 * - Runtime validation against the imported `syllabusSchema`.
 */

import OpenAI from 'openai';
import { syllabus } from './utils/syllabusSchema';

export interface SyllabusTopic {
  identifier: string;
  title: string;
}
export interface Syllabus {
  main_title: string;
  introduction: string;
  learning_objective: string;
  topics: SyllabusTopic[];
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
});

/**
 * generateEmbedding
 * Generates an embedding for the given text using OpenAI’s embedding endpoint.
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
    return response.data[0].embedding;
  } catch (error) {
    console.error("Error in generateEmbedding:", error);
    throw error;
  }
}

/**
 * generateSyllabus
 *
 * Calls OpenAI to produce a structured syllabus JSON, strictly validating
 * against the `syllabusSchema`. The prompt includes:
 * - A description of the task.
 * - A concrete example input and expected output.
 * - The actual hierarchy input.
 *
 * @param hierarchy Array of NodeStubs, each with `.identifier` and `.aggregated_text`.
 * @returns Parsed & validated Syllabus object.
 */
export async function generateSyllabus(hierarchy: any[]): Promise<any> {
  const systemPrompt = `
You are an expert curriculum designer and you are creating the topics of a lesson.
You are given an incomplete lesson stored in a tree data structure: each node represents a subtopic that is part of that lesson.
The lesson is currently incomplete because:
- None of the subtopics have a title.
- There is no introduction or learning objectives for the lesson as a whole.

Each subtopic object has:
- "identifier": a unique key (e.g. "A", "AA").
- "aggregated_text": a body of text that describes that subtopic’s content.
- Some subtopics (ie nodes) have nested "depth2_subtopics" arrays; leaf nodes do not.

Your task is to produce a **syllabus** JSON object that:
1. Assigns each subtopic a **concise title**, referenced by its original "identifier".
2. Provides a **main_title** for the entire lesson.
3. Supplies an **introduction** in Markdown.
4. Supplies **3–5 learning objectives** as a Markdown bolded bullet list.

**Example**

**Input** (array of NodeStubs):
\`\`\`json
[
  {
    "identifier": "A",
    "aggregated_text": "The cell membrane is a lipid bilayer composed of phospholipids, proteins, and carbohydrates. It regulates movement of substances in and out of the cell."
  },
  {
    "identifier": "B",
    "aggregated_text": "The nucleus contains the cell’s genetic material, DNA, organized into chromosomes. It controls gene expression and mediates replication during the cell cycle."
  },
  {
    "identifier": "AA",
    "aggregated_text": "Integral membrane proteins span the bilayer and can act as channels, carriers, or receptors to facilitate transport and signaling."
  }
]
\`\`\`

**Expected output** (strictly JSON, matching the syllabus schema):
\`\`\`json
{
  "main_title": "Fundamentals of Cell Structure",
  "introduction": "# Introduction\\nThe study of cell structure lays the foundation for understanding how living organisms maintain their internal environment, communicate, and reproduce.",
  "learning_objective": " Simply use markdown for a bolded bullet point list of the three items here..."
  "topics": [
    { "identifier": "A",  "title": "Phospholipid Bilayer and Membrane Function" },
    { "identifier": "B",  "title": "Nuclear Organization and Genetic Control" },
    { "identifier": "AA", "title": "Roles of Integral Membrane Proteins" }
  ]
}
\`\`\`

**End of Example**

`

const userPrompt = `
** Actual User input ** :

Here is the hierarchy input (array of subtopic nodes with identifiers and aggregated_text):
\`\`\`json
${JSON.stringify(hierarchy, null, 2)}
\`\`\`
`.trim();

try {
  const response = await openai.beta.chat.completions.parse({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.5,
    max_completion_tokens: 1500,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: syllabus.name,
        schema: syllabus.schema,
        strict: syllabus.strict
      }
    }
  });
  console.log(" aiTextPreProcessing output ", JSON.stringify(response, null, 2));  
  return response.choices[0].message.parsed;
} catch (error) {
    console.error("Error in generateLessonMetadata:", error);
    // Fallback: Return a simple dummy result.
    return {
      topic: `Topic for lesson module...`,
      subtopics: [{ title: 'Subtopic 1', subtopics: [] }, { title: 'Subtopic 2', subtopics: [] }],
      summary: `Summary for lesson module...`
    };
  }
}