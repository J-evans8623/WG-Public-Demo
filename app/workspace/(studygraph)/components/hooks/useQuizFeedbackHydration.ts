/***************************************************************************************************
 * @file useQuizFeedbackHydration.ts
 * @description
 * This hook serves as the core reconciliation engine of the Quiz Feedback system. Its primary 
 * responsibility is to implement the 'Just-in-Time' hydration logic required by the Lean 
 * Data Strategy. It takes lean performance records (question IDs and student answers) 
 * from Firestore and merges them with rich pedagogical metadata (text, explanations, 
 * citations, and correct answers) stored in the Resource Context (Yjs). By performing 
 * this stitching at the UI layer, we eliminate data redundancy in the database and 
 * ensure students always see the most current version of the curriculum material. 
 * The hook utilizes memoization to prevent unnecessary re-calculations and provides 
 * a stable API for the StudentQuizDetail view.
 ***************************************************************************************************/

import { useCallback, useMemo } from 'react';
import { useResourceContext } from '@/app/Library/Context/ResourceContext';
import type { QuizFeedbackDetail, FeedbackItem } from '@/app/src/quizFeedback/quizFeedback.types';

/**
 * useQuizFeedbackHydration
 * @description
 * Reconciliation engine hook that merges lean DB attempt data with rich Yjs curriculum content.
 * * Dependencies:
 * - useResourceContext: To access authoritative AI metadata from the Sentinel Node.
 */
export const useQuizFeedbackHydration = (assignmentId: string) => {
  // 1. Step 1: Consume ResourceContext to access the Sentinel Node metadata
  const { getQuizAssessmentById } = useResourceContext();

  /**
   * hydrate
   * @description
   * Takes a lean detail object from the database and populates it with curriculum strings.
   * Time Complexity: O(N) where N is the number of incorrect items.
   * * @param dbDetail - The raw detail object fetched from QuizFeedbackDataContext.
   * @returns A fully hydrated QuizFeedbackDetail object ready for rendering.
   */
  const hydrate = useCallback((dbDetail: QuizFeedbackDetail | null): QuizFeedbackDetail | null => {
    // 2. Step 2: Guard - ensure we have data to hydrate
    if (!dbDetail || !assignmentId) return dbDetail;

    // 3. Step 3: Locate the authoritative Quiz Card in Yjs (Source of Truth)
    const authoritativeCard = getQuizAssessmentById(assignmentId);
    if (!authoritativeCard) {
      console.warn('[useQuizFeedbackHydration] Authoritative quiz card not found in Yjs:', assignmentId);
      return dbDetail;
    }

    const quizContent = authoritativeCard.binding.spec.quizContent;

    // 4. Step 4: Map through lean DB items and inject missing static strings
    const hydratedItems = dbDetail.incorrectItems.map((leanItem: FeedbackItem) => {
      // Find matching question metadata in the Yjs document
      const meta = quizContent.find(q => q.id === leanItem.questionId);

      return {
        ...leanItem,
        // Inject rich curriculum metadata from Yjs
        questionText: meta?.question || "Question text no longer available.",
        explanation:  meta?.explanation || "No explanation provided.",
        sourceQuote:  meta?.citation?.text || "Citation no longer available.",
        // Authoritative correct answer (for comparison)
        correctAnswer: String(meta?.correctAnswer || ""),
      };
    });

    // 5. Step 5: Return the merged high-fidelity record
    return {
      ...dbDetail,
      incorrectItems: hydratedItems
    };
  }, [assignmentId, getQuizAssessmentById]);

  return { hydrate };
};