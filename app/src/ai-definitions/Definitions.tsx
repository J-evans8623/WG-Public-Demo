/**
 * Definitions.tsx
 *
 * This file defines TypeScript interfaces for structured lesson and quiz responses.
 *
 * Responsibilities:
 * - Provide type safety for structured outputs.
 * - Ensure structured lesson and quiz data align with their respective schemas.
 *
 * Dependencies:
 * - Interfaces are used across the application wherever structured data is handled.
 */

export interface IStructuredLessonResponse {
    /**
     * Represents the root concept in a structured lesson hierarchy.
     */
    rootConcept: {
      concept: string; // The main concept.
      parent: string | null; // Parent concept, or null for root nodes.
      cueCards: Array<{
        title: string; // Title of the cue card.
        description: string; // Description or content of the cue card.
      }>;
      subtopics: IStructuredLessonResponse['rootConcept'][]; // Recursive structure for nested subtopics.
    };
  }
  
  export interface IStructuredQuizResponse {
    /**
     * Represents the structure of a quiz response.
     */
    id: string; // Unique identifier for the quiz.
    title: string; // Title of the quiz.
    questions: Array<{
      id: string; // Unique identifier for each question.
      question: string; // The question text.
      options?: string[]; // Array of answer options (for multiple-choice questions).
      correctAnswer: string | string[] | boolean; // The correct answer(s) for the question.
    }>;
  }
  