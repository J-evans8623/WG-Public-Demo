// app/src/services/TextPreprocessing/aiTextPreProcessingV3.ts

/**
 * @file aiTextPreProcessingV3.ts
 * @description
 *   Phase 2: AI‐powered syllabus utilities with batch generation for multiple units.
 *
 * Responsibilities:
 *   - Batch‐request the LLM to produce a syllabus for 1–3 units in one call.
 *   - Use the `unit_syllabus` array schema (`unitSyllabusArray`) to parse structured output.
 *   - Mutate the provided `UnitContext[]` in place, assigning each context its syllabus.
 *   - Leave scoring and finalization logic for later phases.
 */

import OpenAI from 'openai';
import {
  unitSyllabusArray,
  unitSyllabusPrompt,
  syllabusRating,
  syllabusRatingPrompt,
  finalizedSyllabusPrompt,
  finalizedSyllabusSchema,
  syllabusRatingArray
} from './utils/syllabusSchemav1';
import { formatUnitContexts } from './unitContextFormatter';
import { PrimaryNode, unit, } from './LessonModuleTypes';
import { UnitSyllabus } from './aiTextPreProcessingV3';


export interface UnitContext {
  unit_id: string; // A | B | C
  unit_text: string;
  syllabus?: UnitSyllabus;
  rating?: SyllabusRating;
  prunedStubs?: PrimaryNode[];
}

export interface UnitSyllabusArrayItem {
  Key: string;
  PrimarySubtopic1: {
    Title: string;
    LessonOutline: string;
    SecondarySubtopic: Array<{ Title: string; LessonOutline: string }>;
  };
  PrimarySubtopic2: {
    Title: string;
    LessonOutline: string;
    SecondarySubtopic: Array<{ Title: string; LessonOutline: string }>;
  };
}

export interface SyllabusRating {
  primary_subtopics: Array<{
    title: string;
    secondary_topics: Array<{ title: string; score: number }>;
  }>;
}

export interface FinalizedSyllabus {
  LessonTitle: string;
  Introduction: string;
  LearningObjectives: string;
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

/**
 * Phase 2 Pass 1: Batch‐generate syllabi for multiple units.
 *
 * @param contexts Array of UnitContext objects (with numeric unit_id and unit_text).
 *                 Each context will be mutated: its `.syllabus` field set to the parsed syllabus object.
 */
export async function generateUnitSyllabus(
  contexts: UnitContext[]
): Promise<UnitContext[]> {
  const combinedText = formatUnitContexts(contexts);
  const unitCount = contexts.length;
  const dynamicPrompt = `You are given exactly ${unitCount} units from the course material of the same lesson, you are expected to create a total of ${unitCount} unit syllabus, one for each unit. You must use the associated key to reference associate each syllabus with its intended unit. \n` ;


  const response = await openai.beta.chat.completions.parse({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: dynamicPrompt + unitSyllabusPrompt },
      { role: 'user', content: combinedText }
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: unitSyllabusArray.name,
        schema: unitSyllabusArray.schema,
        strict: unitSyllabusArray.strict
      }
    }
  });

  const parsed = response.choices?.[0]?.message?.parsed;
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !Array.isArray((parsed as any).unit_syllabus)
  ) {
    throw new Error('generateUnitSyllabus: invalid or missing `unit_syllabus`');
  }

  console.log(`stage 1 result unit syllabus : ${JSON.stringify(parsed)}`)

  for (const item of (parsed as any).unit_syllabus) {
    const match = contexts.find(ctx => ctx.unit_id === item.Key);
    if (match) {
      match.syllabus = item;
    }
  }
  return contexts;
}

/**
 * Batch‐score every secondary subtopic across all units in one call.
 * @param contexts Array of UnitContext with .syllabus; sets .rating on each.
 */
export async function scoreUnitSyllabus(
  contexts: UnitContext[]
): Promise<UnitContext[]> {
  const combinedText = formatUnitContexts(contexts);
  const syllabi = contexts.map(ctx => ctx.syllabus);

  const userInput = `
**Units with Text & Candidate Syllabi**:

${combinedText}

**Candidate Syllabi JSON**:
\`\`\`json
${JSON.stringify({ unit_syllabus: syllabi }, null, 2)}
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
        name: syllabusRatingArray.name,
        schema: syllabusRatingArray.schema,
        strict: syllabusRatingArray.strict
      }
    }
  });

  const parsed = response.choices?.[0]?.message?.parsed as { UnitScoredSyllabus: any[] } | null;
  if (!parsed || !Array.isArray(parsed.UnitScoredSyllabus)) {
    throw new Error('scoreUnitSyllabus: invalid or missing `UnitScoredSyllabus`');
  }


  console.log(`stage 2 result unit scored syllabus : ${JSON.stringify(parsed)}`)
  // Map back each rated syllabus into its context.rating
  parsed.UnitScoredSyllabus.forEach(item => {
    const match = contexts.find(ctx => ctx.unit_id === item.Key);
    if (!match) return;
    const makePrimary = (ps: any) => ({
      title: ps.Title,
      secondary_topics: ps.SecondarySubtopic.map((st: any) => ({
        title: st.Title,
        score: st.LessonScore
      }))
    });
    match.rating = {
      primary_subtopics: [
        makePrimary(item.PrimarySubtopic1),
        makePrimary(item.PrimarySubtopic2)
      ]
    };
  });

  return contexts;
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
