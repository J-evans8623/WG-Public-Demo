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

import AIService from '../aiServiceV2';
import { unitSyllabusArray, unitSyllabusPromptV2 } from './utils/syllabusSchemav2';
import OpenAI from 'openai';

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
  unit_syllabus: PrimarySubtopic[];
}

// ─── Combined Syllabus + Metadata Generation ────────────────────────────────────
export async function generateBatchedUnitSyllabus(
  fullText: string,
  topicAmount: number,
  max: number,
): Promise<BatchedSyllabus> {
  console.log('[aiTextPreProcessingV32.ts][2003] generateBatchedUnitSyllabus START', { topicAmount, max });

  const prompt = unitSyllabusPromptV2(topicAmount.toString(), max);
  const raw: any = await aiService.generateStructuredOutput(
    { name: unitSyllabusArray.name, schema: unitSyllabusArray.schema, strict: unitSyllabusArray.strict },
    fullText,
    prompt
  );
  console.log('[aiTextPreProcessingV32.ts][2004] generateBatchedUnitSyllabus RAW', raw);

  // Parse and shape into our TypeScript interfaces
  const parsed: BatchedSyllabus = {
    LessonTitle: raw.LessonTitle,
    Introduction: raw.Introduction,
    unit_syllabus: raw.unit_syllabus.map((ps: any) => ({
      Title: ps.Title,
      Learning_Objectives: ps.Learning_Objectives,
      LessonOutline: ps.LessonOutline,
      SecondarySubtopic: ps.SecondarySubtopic,
      ChronologicalOrder: ps.ChronologicalOrder,
      Domain: ps.Domain,
      relevantPages: ps.relevantPages  
    }))
  };

  console.log(
    '[aiTextPreProcessingV32.ts][2005] generateBatchedUnitSyllabus PARSED',
    { title: parsed.LessonTitle, count: parsed.unit_syllabus.length }
  );

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
