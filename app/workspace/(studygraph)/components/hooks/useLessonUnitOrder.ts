// File: src/app/workspace/(studygraph)/components/hooks/useLessonUnitOrder.ts

/**
 * @file useLessonUnitOrder.ts
 * @description
 *   Hook that returns a flat array of ResourceCard slides grouped into "lesson units",
 *   plus review-node slides at the very end. For each node, it:
 *     1. Emits lecture notes, images, and cue cards.
 *     2. Recurses into all descendants.
 *     3. Emits the node’s quiz slide after its subtree.
 *   After the full traversal, it appends all slides for the review node in the same sequence.
 *
 * Responsibilities:
 *   - Traverse the concept map tree from the root node.
 *   - Group each node's resources: notes, pictures, cues, recurse children, then quizzes.
 *   - Append review-node resources last in notes → pictures → cues → quizzes order.
 *   - Export the ordered ResourceCard[] for openCustom().
 */

import { useMemo } from 'react';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { useResourceContext } from '@/app/Library/Context/ResourceContext';
import type { ResourceCard } from '@/app/Library/Definitions/Definitions';

function traverseUnit(
  nodeId: string,
  accumulator: ResourceCard[],
  nodesMap: Map<string, any>,
  getNodeTitle: (id: string) => string | null,
  selectors: {
    selectNoteCards: (id: string) => ResourceCard[];
    selectCueCards: (id: string) => ResourceCard[];
    selectPracticeSheets: (id: string) => ResourceCard[];
  },
  rootId?:string
) {
  console.log('[useLessonUnitOrder.ts:1002] Processing node:', nodeId);
  const title = getNodeTitle(nodeId) || 'Untitled';

  // 1. Lecture-note slides
  const notes = selectors.selectNoteCards(nodeId).map(raw => ({
    ...raw,
    conceptNodeTitle: title
  }));
  console.log('[useLessonUnitOrder.ts:1003] Collected', notes.length, 'note slides for', nodeId);
  accumulator.push(...notes);

  // 3. Cue-card slides
  const cues = selectors.selectCueCards(nodeId).map(raw => ({
    ...raw,
    conceptNodeTitle: title
  }));
  console.log('[useLessonUnitOrder.ts:1005] Collected', cues.length, 'cue slides for', nodeId);
  accumulator.push(...cues);

  // 4. Recurse into children
  const node = nodesMap.get(nodeId);
  if (!node) return; 
  // Add a one liner to order the child nodes by rank is the lesson order letter exist, in practice
  // this will only happen once when the root node is processed, because the children of the root node are the only primary nodes with the lesson order property

    // ◆ only sort once, when we're at the root:
  if (nodeId === rootId && node.childrenNodeIds?.length) {
    // ◆ sort primary‐level children by their A/B/C lessonOrder
    node.childrenNodeIds.sort((idA:string, idB:string) => {
    const orderA = nodesMap.get(idA)?.lessonOrder ?? '';
    const orderB = nodesMap.get(idB)?.lessonOrder ?? '';
    return orderA.localeCompare(orderB);
  });
  }

  if (node?.childrenNodeIds?.length) {
    node.childrenNodeIds.forEach((childId: string) =>
      traverseUnit(childId, accumulator, nodesMap, getNodeTitle, selectors)
    );
  }

  // 5. Quiz slides for this node
  const quizzes = selectors.selectPracticeSheets(nodeId).map(raw => ({
    ...raw,
    conceptNodeTitle: title
  }));
  console.log('[useLessonUnitOrder.ts:1006] Collected', quizzes.length, 'quiz slides for', nodeId);
  accumulator.push(...quizzes);
}

export function useLessonUnitOrder(): ResourceCard[] {
  const { nodes, getRootNode, getReviewNode, getNodeTitle } = useNodesContext();
  const {
    selectNoteCards,
    selectCueCards,
    selectPracticeSheets
  } = useResourceContext();

  return useMemo(() => {
    const rootId = getRootNode();
    console.log('[useLessonUnitOrder.ts:1001] Starting unit ordering from root:', rootId);
    const result: ResourceCard[] = [];

    // Main DFS-based unit ordering
    traverseUnit(rootId, result, nodes, getNodeTitle, {
      selectNoteCards,
      selectCueCards,
      selectPracticeSheets
    }, rootId);

    // Finally, append review-node slides
    const reviewInfo = getReviewNode();
    if (reviewInfo.exist && reviewInfo.id) {
      const reviewId = reviewInfo.id;
      const reviewTitle = getNodeTitle(reviewId) || 'Review';
      console.log('[useLessonUnitOrder.ts:1008] Appending review-node slides for:', reviewId);

      const revNotes = selectNoteCards(reviewId).map(raw => ({ ...raw, conceptNodeTitle: reviewTitle }));
      console.log('[useLessonUnitOrder.ts:1009] Collected', revNotes.length, 'review note slides');
      result.push(...revNotes);

      const revCues = selectCueCards(reviewId).map(raw => ({ ...raw, conceptNodeTitle: reviewTitle }));
      console.log('[useLessonUnitOrder.ts:1011] Collected', revCues.length, 'review cue slides');
      result.push(...revCues);

      const revQuizzes = selectPracticeSheets(reviewId).map(raw => ({ ...raw, conceptNodeTitle: reviewTitle }));
      console.log('[useLessonUnitOrder.ts:1012] Collected', revQuizzes.length, 'review quiz slides');
      result.push(...revQuizzes);
    }

    console.log('[useLessonUnitOrder.ts:1013] Completed ordering. Total slides:', result.length);
    return result;
  }, [
    nodes,
    getRootNode,
    getReviewNode,
    getNodeTitle,
    selectNoteCards,
    selectCueCards,
    selectPracticeSheets
  ]);
}
