// src/app/studygraph/(studygraph)/components/hooks/useOrderedResources.ts

import { useMemo } from 'react';
import { useResourceSync } from '@/app/studygraph/(studygraph)/components/hooks/useResourceSync';
import { usePreorderTraversal } from './usePreorderTraversal';
import { useSearchContext } from '@/app/Library/Context/SearchContext';
import { useResourceContext } from '@/app/Library/Context/ResourceContext';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import type { ResourceCard } from '@/app/Library/Definitions/Definitions';

/**
 * Returns a merged, ordered list of resources:
 *  1. Any search‐history cards whose node is *not* currently selected.
 *  2. All resources for selected nodes in preorder (Note → Image → Cue → Quiz).
 */
export function useOrderedResources(): ResourceCard[] {
  // 1️⃣ Sync raw resources & selected nodes from our resource layer
  const { selectedNodeIds, notes, pictures, cueCards, practiceSheets } = useResourceSync();
  const preorder = usePreorderTraversal();

  // 2️⃣ Search‐history & helper contexts
  const { selectedResultIds } = useSearchContext();
  const { getResourceCard } = useResourceContext();
  const { getSelectedNodeIds } = useNodeSelection();

  return useMemo(() => {
    const currentSelectedNodes = getSelectedNodeIds();

    // --- Build the search‐history cards, filtering out those whose nodes are now selected ---
    const historyCards: ResourceCard[] = selectedResultIds
      .map(id => getResourceCard(id))
      .filter(
        (card): card is ResourceCard =>
          Boolean(card) && !currentSelectedNodes.includes(card!.nodeId)
      );

    // --- Build base ordered resources per node in preorder ---
    // Helper: group resources by nodeId
    const groupByNode = <T extends ResourceCard>(arr: T[]): Record<string, T[]> =>
      arr.reduce((acc, r) => {
        acc[r.nodeId] = acc[r.nodeId] || [];
        acc[r.nodeId].push(r);
        return acc;
      }, {} as Record<string, T[]>);

    const byNote = groupByNode(notes);
    const byImage = groupByNode(pictures);
    const byCue = groupByNode(cueCards);
    const byQuiz = groupByNode(practiceSheets);

    // Only traverse nodes that are both in preorder and still selected
    const nodesInOrder = preorder.filter(id => selectedNodeIds.includes(id));

    // Accumulate in type priority
    const baseOrdered: ResourceCard[] = [];
    for (const nodeId of nodesInOrder) {
      (byNote[nodeId] || []).forEach(r => baseOrdered.push(r));
      (byImage[nodeId] || []).forEach(r => baseOrdered.push(r));
      (byCue[nodeId] || []).forEach(r => baseOrdered.push(r));
      (byQuiz[nodeId] || []).forEach(r => baseOrdered.push(r));
    }

    // --- Merge: history first (deduped), then baseOrdered ---
    const historyIds = new Set(historyCards.map(r => r.id));
    const merged: ResourceCard[] = [
      ...historyCards,
      ...baseOrdered.filter(r => !historyIds.has(r.id)),
    ];

    return merged;
  },
  [
    preorder,
    selectedNodeIds,
    notes,
    pictures,
    cueCards,
    practiceSheets,
    selectedResultIds,
    getResourceCard,
    getSelectedNodeIds,
  ]);
}
