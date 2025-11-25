/**
 * parseQuizResponse.ts
 *
 * Responsibilities:
 *   1) Parse the AI service quiz response into a structured format that the front-end application can handle.
 *   2) Transform the backend response (which adheres to one of the quiz schemas) into a PracticeSheetResource
 *      (mapped to the 'quiz' card type via useCardCrudOperations).
 * 
 * The transformation includes:
 *   - Determining the quiz type based on properties in the questions array.
 *   - Mapping each question to the corresponding IQuizQuestion interface.
 *   - Assembling a PracticeSheetResource with:
 *       - id and title from the response.
 *       - content containing the quizType and an array of quiz questions.
 *
 * Dependencies:
 *   - The backend quiz schemas defined in quizSchema.ts.
 *   - Front-end interfaces (IQuizQuestion, PracticeSheetResource) defined in Definitions.tsx.
 */

import { QuizType, IQuizQuestion, PracticeSheetResource } from '@/app/Library/Definitions/Definitions';

export function parseQuizResponse(aiResponse: any, mapId:string): PracticeSheetResource | null {
  try {
    // Ensure the response contains the expected fields.
    if (!aiResponse || typeof aiResponse !== 'object' || !Array.isArray(aiResponse.questions)) {
      throw new Error("Invalid quiz response format");
    }

    // Determine the quiz type based on the first question.
    // Supported quiz types:
    //   - "multipleChoice" if questions include an "options" property.
    //   - "matching" if questions include a "matchingTerm" property.
    //   - "FIB" if questions include a "questionText" property.
    //   - "true-false" if question.type equals "true-false".
    let determinedQuizType: QuizType = "multipleChoice"; // default fallback
    const questions = aiResponse.questions;
    console.log(`56 QuizParsers test ${JSON.stringify(aiResponse)}`);
    if (questions.length > 0) {
      const sample = questions[0];
      if ("options" in sample) {
        determinedQuizType = "multipleChoice";
      } else if ("matchingQuestion" in sample) {
        determinedQuizType = "matching";
      } else if ("questionText" in sample) {
        determinedQuizType = "FIB";
      } else if (sample.type === "true-false") {
        determinedQuizType = "true-false";
      }
    }

    // Map each question from the AI response to an IQuizQuestion.
    const quizContent: IQuizQuestion[] = questions.map((q: any) => {
      switch (determinedQuizType) {
        case "multipleChoice":
          return {
            id: q.id,
            type: "multipleChoice",
            question: q.question,
            options: q.options,
            correctAnswer: q.correctAnswer,
          };
        case "matching":
          return {
            id: q.id,
            type: "matching",
            question: q.matchingQuestion, // using matchingTerm as the question prompt
            correctAnswer: q.matchingAnswer,
          };
        case "FIB":
          return {
            id: q.id,
            type: "FIB",
            question: q.questionText,
            questionText: q.questionText, // using questionText as the question prompt
            correctAnswer: q.correctAnswer,
          };
        case "true-false":
          return {
            id: q.id,
            type: "true-false",
            question: q.question,
            correctAnswer: q.correctAnswer,
          };
        default:
          throw new Error("Unsupported quiz type");
      }
    });

    // Build the PracticeSheetResource to be saved in the resource context.
    const quizResource: PracticeSheetResource = {
      id: aiResponse.id, // Use the ID provided by the backend
      nodeId: "", // The nodeId will be set when the resource is saved via useCardCrudOperations
      type: "practiceSheet", // Map the quiz to the 'practiceSheet' resource type
      title: aiResponse.title, // Use the title from the response
      content: {
        quizType: determinedQuizType,
        quizContent: quizContent,
      },
      mapId
    };

    return quizResource;
  } catch (error) {
    console.error('[parseQuizResponse] Error parsing quiz response:', error);
    return null;
  }
}
