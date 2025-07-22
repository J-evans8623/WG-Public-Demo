/**
 * @file app/src/services/TextPreprocessing/aiTextPreProcessingV3.ts
 * @description
 *   **Phase 2+3** AI‐powered syllabus utilities:
 *     • Pass 1: generateUnitSyllabus → small UnitSyllabus from text excerpt.
 *     • Pass 2: scoreUnitSyllabus → assign scores to each secondary subtopic.
 *     • **Pass 3: generateFinalizedSyllabus → global Lesson metadata (title, intro, objectives).**
 *     • Embed support: generateEmbedding.
 */

import OpenAI from 'openai';
import {
  unitSyllabus,
  unitSyllabusPrompt,
  syllabusRating,
  syllabusRatingPrompt,
  finalizedSyllabusPrompt,
  finalizedSyllabusSchema
} from './utils/syllabusSchemav1';
import { unit } from './LessonModuleTypes';

export interface UnitSyllabus {
  PrimarySubtopic1: {
    Title: string;
    LessonOutline: string;
    SeconaryTopic1: { Title: string; LessonOutline: string };
    SeconaryTopic2: { Title: string; LessonOutline: string };
    SeconaryTopic3: { Title: string; LessonOutline: string };
  };
  PrimarySubtopic2: {
    Title: string;
    LessonOutline: string;
    SeconaryTopic1: { Title: string; LessonOutline: string };
    SeconaryTopic2: { Title: string; LessonOutline: string };
    SeconaryTopic3: { Title: string; LessonOutline: string };
  };
}

export interface SyllabusRating {
  primary_subtopics: Array<{
    LessonOutline: string | undefined;
    Learning_Objectives: string | undefined;
    title: string;
    secondary_topics: Array<{
      LessonOutline: any;
      Learning_Objectives: any; title: string; score: number 
}>;
  }>;
}

export interface FinalizedSyllabus {
  LessonTitle: string;
  Introduction: string;
  LearningObjectives: string;
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

/**
 * Pass 1: Generate a focused UnitSyllabus from a text excerpt.
 */
export async function generateUnitSyllabus(LessonUnit: unit): Promise<any> {

  const response = await openai.beta.chat.completions.parse({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: unitSyllabusPrompt },
      { role: 'user', content: LessonUnit.unit_text }
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: unitSyllabus.name,
        schema: unitSyllabus.schema,
        strict: unitSyllabus.strict
      }
    }
  });
  return response.choices[0].message.parsed;
}

/**
 * Pass 2: Score each secondary subtopic in a UnitSyllabus against its source text.
 */
export async function scoreUnitSyllabus(
  LessonUnit: unit,
  syllabusObj: UnitSyllabus
): Promise<any> {
  const userInput = `
**Text Excerpt:**
\`\`\`
${LessonUnit.unit_text}
\`\`\`

**Candidate Syllabus:**
\`\`\`json
${JSON.stringify(syllabusObj, null, 2)}
\`\`\`
`;
  const response = await openai.beta.chat.completions.parse({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: syllabusRatingPrompt },
      { role: 'user', content: userInput }
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: syllabusRating.name,
        schema: syllabusRating.schema,
        strict: syllabusRating.strict
      }
    }
  });
  return response.choices[0].message.parsed;
}

/**
 * Pass 3: Generate global lesson metadata (title, introduction, objectives)
 * from the combined pruned syllabus + original full text.
 */
export async function generateFinalizedSyllabus(
  combinedSyllabus: unknown,
  fullText: string
): Promise<any> {
  const userInput = `
**Combined Pruned Syllabus:**
\`\`\`json
${JSON.stringify(combinedSyllabus, null, 2)}
\`\`\`

**Full Text of Lesson Module:**
\`\`\`
${fullText}
\`\`\`
`;
  const response = await openai.beta.chat.completions.parse({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: finalizedSyllabusPrompt },
      { role: 'user', content: userInput }
    ],
    response_format: {
      type: 'json_schema',
      json_schema: finalizedSyllabusSchema
    }
  });
  return response.choices[0].message.parsed;
}


export async function generateFinalizedSyllabusv2(
  fullText: string
): Promise<any> {
  const userInput = `
**Full Lesson-Module Text**
\`\`\`
${fullText}
\`\`\`
`;
  const response = await openai.beta.chat.completions.parse({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: finalizedSyllabusPrompt },
      { role: 'user', content: userInput }
    ],
    response_format: {
      type: 'json_schema',
      json_schema: finalizedSyllabusSchema
    }
  });
  return response.choices[0].message.parsed ;
}



/**
 * Legacy embedding support.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const resp = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text
  });
  return resp.data[0].embedding;
}
