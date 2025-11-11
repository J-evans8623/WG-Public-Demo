// app/src/services/TextPreprocessing/utils/formatSyllabus.ts

/**
 * @file app/src/services/TextPreprocessing/utils/formatSyllabus.ts  // update - 1
 * @description                                                     // update - 1
 *   This utility file provides a small but critical helper that converts a single
 *   syllabus unit, represented as a primary topic plus its supporting secondary
 *   topics, into a human-readable syllabus block suitable for inclusion in LLM
 *   prompts. The goal of this formatting function is not to perform any complex
 *   business logic, but rather to standardize how unit-level context is presented
 *   to the model so that prompts remain consistent across different stages of the
 *   lesson pipeline. It is important that callers treat this helper as strictly
 *   unit-scoped: the `PrimaryForPrompt` parameter must describe exactly one unit
 *   (one main topic and its secondaries) and must not contain multiple unrelated
 *   units concatenated together. Using a single unit at a time ensures that the
 *   model receives focused, coherent syllabus information when generating either
 *   main-topic or supporting-topic lessons, and prevents cross-unit leakage that
 *   can confuse topic boundaries or cause overlapping coverage across distinct
 *   units in the generated lessons. The implementation is intentionally linear in
 *   the number of secondary topics to preserve O(N) complexity and maintain
 *   predictable performance even when units contain several supporting topics.    // update - 1
 */

export interface SecondaryForPrompt {
  title: string;
  Learning_Objectives: string;
  LessonOutline: string;
}

export interface PrimaryForPrompt {
  title: string;
  Learning_Objectives: string;
  LessonOutline: string;
  secondary_topics: SecondaryForPrompt[];
  ChronologicalOrder?: number;
}

/**
 * formatSyllabusForPrompt                                                 // update - 1
 * @description                                                            // update - 1
 *   Formats a single syllabus unit, consisting of one primary topic and
 *   zero or more supporting secondary topics, into a stable, human-readable
 *   block of text that can be embedded directly into LLM prompts. The primary
 *   topic’s title, chronological order, learning objectives, and lesson outline
 *   are rendered first, followed by a clearly delimited list of secondary
 *   subtopics when present. This function must always be called with a
 *   unit-scoped `PrimaryForPrompt` value: callers should never aggregate
 *   multiple units into a single input. By keeping the scope limited to a
 *   single unit, we ensure that topic-level enrichment calls see a coherent
 *   syllabus context and that the model can distinguish the main topic from
 *   its supporting topics without cross-unit interference. The implementation
 *   has O(N) time complexity in the number of secondary topics, which is
 *   optimal for the small arrays expected here.                               // update - 1
 */
export function formatSyllabusForPrompt(primary: PrimaryForPrompt): string {
  const { title, Learning_Objectives, LessonOutline, secondary_topics, ChronologicalOrder } = primary;

  const header =
`Primary Subtopic: ${title}
Lesson Order: ${ChronologicalOrder}
Learning Objectives: ${Learning_Objectives}
Lesson Outline: ${LessonOutline}`;

  if (!secondary_topics.length) {
    return `${header}

(No secondary subtopics.)`;
  }

  const secondaries = secondary_topics
    .map(sec =>
`- ${sec.title}
    • Learning Objectives: ${sec.Learning_Objectives}
    • Lesson Outline: ${sec.LessonOutline}`)
    .join(`\n ######################################################## \n`);

  return `${header}
###########################################################
Secondary Subtopics:
${secondaries}`;
}
