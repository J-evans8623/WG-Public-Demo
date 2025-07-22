// services/TextPreprocessing/utils/formatSyllabus.ts

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
 * Turn a primary + its secondaries into a human-readable block.
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
    .join(`\n\n`);

  return `${header}

Secondary Subtopics:
${secondaries}`;
}
