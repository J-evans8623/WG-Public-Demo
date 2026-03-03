/***************************************************************************************************
 * @file useTopicSlidePlayer.ts
 * @description
 * (update - 2.1)
 * This hook has been refactored to act as the authoritative "Remediation Bridge" for scholars.
 * Its core responsibility is to resolve a 'topicId' from a failed quiz question into a 
 * focused study session. This update implements a strict pedagogical ordering logic 
 * as required by the sprint: Notes first, then FlashCards, then Practice Quizzes. 
 * By consuming ResourceContext selectors directly, the hook bypasses the massive 
 * global deck and assembles a specialized deck of parent-level resources for the 
 * conceptual struggle at hand. This ensures a high-fidelity, low-friction 
 * transition from corrections to review, satisfying the interactive 
 * navigation requirements of the Quiz Feedback Pipeline.
 ***************************************************************************************************/

import { useCallback } from 'react';
import { useSlideShow } from '@/app/Library/Context/SlideShowContext';
import { useResourceContext } from '@/app/Library/Context/ResourceContext';
import { useNodesContext } from '@/app/Library/Context/NodesProvider'; // update - 2.2: Needed for title resolution
import type { ResourceCard } from '@/app/Library/Definitions/Definitions';

/**
 * useTopicSlidePlayer
 * @description
 * Standardized hook for launching the SlideShow player for a specific conceptual topic.
 * (update - 2.3) Implements Notes → Cues → Quizzes ordering for focused review.
 */
export const useTopicSlidePlayer = () => {
  const { openCustom } = useSlideShow();
  const { getNodeTitle } = useNodesContext();
  const { 
    selectNoteCards, 
    selectCueCards, 
    selectPracticeSheets 
  } = useResourceContext();

  /**
   * jumpToTopic
   * @description
   * Prepares a focused slide deck for the given topic and launches the player.
   * (update - 2.4) Refactored to build a new ordered deck rather than searching indices.
   * Time Complexity: O(R) where R is the number of resources in the single topic node.
   * * @param topicId - The Node UUID (topic) to review.
   */
  const jumpToTopic = useCallback((topicId: string) => {
    console.log('[useTopicSlidePlayer.ts][4050] Preparing ordered review for topic:', topicId);

    if (!topicId) return;

    // 1. Step 1: Resolve the conceptual title for slide headers
    const title = getNodeTitle(topicId) || 'Review Topic';

    // 2. Step 2: Extract and hydrate resources in the specific pedagogical order (update - 2.5)
    // Group A: Lecture Notes (Notes)
    const notes = selectNoteCards(topicId).map(raw => ({
      ...raw,
      conceptNodeTitle: title
    }));

    // Group B: Flash Cards (Cues)
    const cues = selectCueCards(topicId).map(raw => ({
      ...raw,
      conceptNodeTitle: title
    }));

    // Group C: Practice Quizzes (Sheets)
    const quizzes = selectPracticeSheets(topicId).map(raw => ({
      ...raw,
      conceptNodeTitle: title
    }));

    // 3. Step 3: Concatenate into the final study deck (Notes -> Cues -> Quizzes)
    const topicDeck: ResourceCard[] = [...notes, ...cues, ...quizzes];

    // 4. Step 4: Logic Gate - ensure we have material before launching
    if (topicDeck.length > 0) {
      console.log('[useTopicSlidePlayer.ts][4051] Launching player with', topicDeck.length, 'slides');
      
      // 5. Step 5: Open the custom deck and disable "Resume" logic to ensure student starts at Note 1
      openCustom(topicDeck, "review", false); 
    } else {
      console.warn('[useTopicSlidePlayer.ts][4053] No study resources found for node:', topicId);
    }
  }, [getNodeTitle, selectNoteCards, selectCueCards, selectPracticeSheets, openCustom]);

  return {
    jumpToTopic
  };
};

export default useTopicSlidePlayer;