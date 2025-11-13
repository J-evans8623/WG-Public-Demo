/**
 * @file    app/src/services/TextPreprocessing/aiTextPreProcessingV32.ts
 * @summary Phase 1 – Combined syllabus + metadata generation via single Gemini call,
 *          and legacy OpenAI embedding support.
 *
 * Responsibilities:
 *  - generateBatchedUnitSyllabus: single Gemini structured-output call returning
 *      • LessonTitle: generated lesson title
 *      • Introduction: generated lesson introduction
 *      • unit_syllabus: array of primary subtopics (with Domain, local learning objectives, outline, etc.)
 *  - generateEmbedding: legacy OpenAI embedding support (unchanged).
 *
 */

import AIService from '../aiService';
import {  unitSyllabusPromptV2  } from './utils/syllabusSchemav2'; // gemini -> unitSyllabusArray
import { unitSyllabusArrayOpenAI as unitSyllabusArray } from '../../schemas/openai/unitSyllabus.openai';
import OpenAI from 'openai';
import UsageTracker from '../UsageTracker';

// ─── Initialize AI services ─────────────────────────────────────────────────────
const aiService = new AIService();
console.log('[aiTextPreProcessingV32.ts][2000] Initialized Gemini AIService');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

// ─── Types ───────────────────────────────────────────────────────────────────────
export interface SecondarySubtopic {
  Title: string;
  Learning_Objectives: string;
  LessonOutline: string;
}

export interface PrimarySubtopic {
  Title: string;
  Learning_Objectives: string;
  LessonOutline: string;
  SecondarySubtopic: SecondarySubtopic[];
  ChronologicalOrder: number;
  Domain: string;
  relevantPages: number[]
}

export interface BatchedSyllabus {
  LessonTitle: string;
  Introduction: string;
  CourseTitle:string;
  unit_syllabus: PrimarySubtopic[];
}

// ─── Combined Syllabus + Metadata Generation ────────────────────────────────────
// ─── Combined Syllabus + Metadata Generation ────────────────────────────────────
export async function generateBatchedUnitSyllabus(
  fullText: string,
  topicAmount: string,
  max: number,
  usageTracker?: UsageTracker
): Promise<BatchedSyllabus> {
  console.log('[aiTextPreProcessingV32.ts][2003] generateBatchedUnitSyllabus START', { topicAmount, max });

  console.log(
    `-----------------Text input to aiTextPreProcessingV32.ts [2000] \n--------- ${JSON.stringify(
      fullText
    )} \n -----------------Text input to aiTextPreProcessingV32.ts [2000] end \n---------`
  );

  const prompt = unitSyllabusPromptV2(topicAmount, max);

  // #7575 syllabus Latency test – track time for the unit-syllabus LLM call
  const syllabusStart = Date.now();

  const raw: any = await aiService.generateStructuredOutput(
    { name: unitSyllabusArray.name, schema: unitSyllabusArray.schema, strict: unitSyllabusArray.strict },
    fullText,
    prompt,
    { stream: false, tracker: usageTracker }
  );

  const syllabusElapsedSec = (Date.now() - syllabusStart) / 1000;
  console.log(
    `#7575 syllabus Latency test | Unit syllabus : ${syllabusElapsedSec.toFixed(2)} seconds`
  );

  console.log('[aiTextPreProcessingV32.ts][2004] generateBatchedUnitSyllabus RAW', JSON.stringify(raw));

  // Parse and shape into our TypeScript interfaces
  const parsed: BatchedSyllabus = {
    LessonTitle: raw.LessonTitle,
    Introduction: raw.Introduction,
    CourseTitle: raw.CourseTitle,
    unit_syllabus: raw.unit_syllabus.map((ps: any) => ({
      Title: ps.Title,
      Learning_Objectives: ps.Learning_Objectives,
      LessonOutline: ps.LessonOutline,
      SecondarySubtopic: ps.SecondarySubtopic,
      ChronologicalOrder: ps.ChronologicalOrder,
      relevantPages: ps.relevantPages
    }))
  };

  console.log('[aiTextPreProcessingV32.ts][2005] generateBatchedUnitSyllabus PARSED', {
    title: parsed.LessonTitle,
    count: parsed.unit_syllabus.length
  });

  return parsed;
}


// ─── Legacy Embedding Support ───────────────────────────────────────────────────
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
