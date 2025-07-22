/**
 * @file    app/src/services/TextPreprocessing/aiTextPreProcessingV32.ts
 * @summary AI‐powered syllabus utilities using Google Gemini 2.0 Flash structured output.
 *
 * Responsibilities:
 *  - generateUnitSyllabus: Phase 1 – produce a UnitSyllabus JSON object from a text excerpt.
 *  - scoreUnitSyllabus: Phase 2 – assign quality scores to each secondary subtopic.
 *  - generateFinalizedSyllabus: Phase 3 – assemble global lesson metadata (title, intro, objectives).
 *  - generateFinalizedSyllabusv2: Alternative Phase 3 for full-text only.
 *  - generateEmbedding: Legacy OpenAI embedding support (unchanged).
 *
 * Observability:
 *  - Key entry/exit points logged with 4-digit codes for rapid traceability.
 */

import AIService from '../aiServiceV2';
import {
  unitSyllabus,
  unitSyllabusPromptV2,
  syllabusRatingV2,
  syllabusRatingPrompt,
  finalizedSyllabusPrompt,
  finalizedSyllabusSchema
} from './utils/syllabusSchemav1';
import { unit } from './LessonModuleTypes';
import OpenAI from 'openai';

// Initialize Gemini‐powered AIService and OpenAI for embeddings
const aiService = new AIService();
console.log('[aiTextPreProcessingV32.ts][2000] Initialized Gemini AIService');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

/**
 * Pass 1: Generate a focused UnitSyllabus from a text excerpt.
 */
export async function generateUnitSyllabus(LessonUnit: unit): Promise<any> {
  console.log('[aiTextPreProcessingV32.ts][2001] generateUnitSyllabus START');
  let dynamicprompt = unitSyllabusPromptV2();
  const result = await aiService.generateStructuredOutput(
    unitSyllabus,
    LessonUnit.unit_text,
    dynamicprompt,
  );
  console.log('[aiTextPreProcessingV32.ts][2002] generateUnitSyllabus RESULT', JSON.stringify(result));
  return result;
}

/**
 * Phase 2: Score each secondary subtopic against its source text.
 * Converts returned string scores ("1"–"4") to numbers before returning.
 */
export async function scoreUnitSyllabus(
  LessonUnit: unit,
  syllabusObj: any
): Promise<any> {
  console.log('[aiTextPreProcessingV32.ts][2003] scoreUnitSyllabus START');
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
console.log(`[aiTextPreProcessingV32.ts][2003.1] scoreUnitSyllabus input ${JSON.stringify(userInput)}`);

  // Call Gemini with string-enum schema
  const raw = await aiService.generateStructuredOutput(
    syllabusRatingV2,
    userInput,
    syllabusRatingPrompt
  );
  console.log('[aiTextPreProcessingV32.ts][2004] raw scoreUnitSyllabus', JSON.stringify(raw));

  // Convert string scores to numbers
  if (raw.primary_subtopics && Array.isArray(raw.primary_subtopics)) {
    raw.primary_subtopics = raw.primary_subtopics.map((pt: any) => {
      if (pt.secondary_topics && Array.isArray(pt.secondary_topics)) {
        pt.secondary_topics = pt.secondary_topics.map((st: any) => ({
          title: st.title,
          score: Number(st.score),
          Learning_Objectives: st.Learning_Objectives,
          LessonOutline:st.LessonOutline
        }));
      }
      return pt;
    });
  }
  console.log('[aiTextPreProcessingV32.ts][2005] normalized scoreUnitSyllabus', raw);
  return raw;
}


/**
 * Pass 3: Generate global lesson metadata (title, intro, objectives)
 * from the combined pruned syllabus + original full text.
 */
export async function generateFinalizedSyllabus(
  combinedSyllabus: unknown,
  fullText: string
): Promise<any> {
  console.log('[aiTextPreProcessingV32.ts][2005] generateFinalizedSyllabus START');
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
  const result = await aiService.generateStructuredOutput(
    finalizedSyllabusSchema,
    userInput,
    finalizedSyllabusPrompt
  );
  console.log('[aiTextPreProcessingV32.ts][2006] generateFinalizedSyllabus RESULT', result);
  return result;
}

/**
 * Pass 3 variant: Generate lesson metadata from full text only.
 */
export async function generateFinalizedSyllabusv2(fullText: string): Promise<any> {
  console.log('[aiTextPreProcessingV32.ts][2007] generateFinalizedSyllabusv2 START');
  const userInput = `
**Full Lesson-Module Text**
\`\`\`
${fullText}
\`\`\`
`;
  const result = await aiService.generateStructuredOutput(
    finalizedSyllabusSchema,
    userInput,
    finalizedSyllabusPrompt
  );
  console.log('[aiTextPreProcessingV32.ts][2008] generateFinalizedSyllabusv2 RESULT', result);
  return result;
}

/**
 * Legacy embedding support (unchanged).
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  console.log('[aiTextPreProcessingV32.ts][2009] generateEmbedding START');
  const resp = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text
  });
  const embedding = resp.data[0].embedding;
  console.log('[aiTextPreProcessingV32.ts][2010] generateEmbedding RESULT length=', embedding.length);
  return embedding;
}
