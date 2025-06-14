// app/src/services/TextPreprocessing/mergeToLessonSchema.ts

/**
 * @file mergeToLessonSchema.ts
 * @description
 *   Merges a fully processed LessonModule (with inline citation metadata on each subtree)
 *   into the `lessonSchema` format expected by the front-end.
 *
 *   Responsibilities:
 *   - Assemble `main_topic` with title, introduction, learning objectives, and combined quiz.
 *   - Build `primary_subtopics`, carrying over:
 *       • `lesson` (lecture note + flash cards),
 *       • nested `secondary_subtopic` arrays,
 *       • `lesson_citation` arrays on both primary and secondary subtopics.
 *   - Ensure the output strictly matches the updated lessonSchema JSON shape.
 */

export function mergeToLessonSchema(module: any): unknown {
  // 1) Wrap the single learning objective string into an array
  const objectives: string[] = [module.learning_objective];

  console.log(`5555 - Initial module in mergeToLessonSchema ${JSON.stringify(module)}`);


  // 2) Build primary_subtopics, preserving citations
  const primarySubtopics = module.hierarchy.map((stub: any) => {
    // Primary-level citations (or null if none)
    const primaryCitations = Array.isArray(stub.lesson_citation)
      ? stub.lesson_citation
      : null;

    // Map any secondary subtopics, preserving their citations
    const secondary = Array.isArray(stub.secondary_subtopic)
      ? stub.secondary_subtopic.map((ss: any) => ({
          title: ss.title,
          lecture_note: ss.lecture_note,
          flash_cards: ss.flash_cards,
          lesson_citation: Array.isArray(ss.lesson_citation)
            ? ss.lesson_citation
            : null,
        }))
      : null;

    return {
      title: stub.title,
      lesson: stub.lesson,
      secondary_subtopic: secondary,
      lesson_citation: primaryCitations,
    };
  });

  // 3) Combine all subtree quizzes into one matching_quiz
  const allQuestions = module.hierarchy.flatMap((stub: any) =>
    Array.isArray(stub.quiz?.questions) ? stub.quiz.questions : []
  );
  const combinedQuiz = {
    id: module.main_title.replace(/\s+/g, '_').toLowerCase(),
    title: `${module.main_title} Quiz`,
    questions: allQuestions,
  };

  // 4) Return the final object matching lessonSchema
  return {
    main_topic: {
      title: module.main_title,
      introduction: module.introduction,
      learning_objectives: objectives,
      primary_subtopics: primarySubtopics,
      quiz: combinedQuiz,
    },
  };
}
