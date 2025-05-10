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
 *  1. Search‐history cards (whose node is not selected).
 *  2. All resources for selected nodes in preorder, excluding dismissed cards.
 */
export function useOrderedResources(): ResourceCard[] {
  const { selectedNodeIds, notes, pictures, cueCards, practiceSheets } = useResourceSync();
  const preorder = usePreorderTraversal();

  const { selectedResultIds } = useSearchContext();
  const { getResourceCard } = useResourceContext();
  const { getSelectedNodeIds, isResourceDismissed } = useNodeSelection();

  return useMemo(() => {
    const currentNodes = getSelectedNodeIds();

    // 1️⃣ History cards, skipping ones from any *currently* selected node
    const historyCards = selectedResultIds
      .map(id => getResourceCard(id))
      .filter(
        (c): c is ResourceCard =>
          Boolean(c) && !currentNodes.includes(c!.nodeId)
      );

    // 2️⃣ Group existing resources by node
    const group = <T extends ResourceCard>(arr: T[]) =>
      arr.reduce((acc: Record<string, T[]>, r) => {
        (acc[r.nodeId] ||= []).push(r);
        return acc;
      }, {});

    const byNote = group(notes);
    const byImage = group(pictures);
    const byCue = group(cueCards);
    const byQuiz = group(practiceSheets);

    // 3️⃣ Build base list in node-preorder, filtering out dismissed
    const base: ResourceCard[] = [];
    preorder
      .filter(id => selectedNodeIds.includes(id))
      .forEach(nodeId => {
        [...(byNote[nodeId] || []),
         ...(byImage[nodeId] || []),
         ...(byCue[nodeId] || []),
         ...(byQuiz[nodeId] || [])]
        .forEach(r => {
          if (!isResourceDismissed(r.nodeId, r.id)) {
            base.push(r);
          }
        });
      });

    // 4️⃣ Merge: history first (dedupe), then base
    const seen = new Set(historyCards.map(r => r.id));
    return [
      ...historyCards,
      ...base.filter(r => !seen.has(r.id)),
    ];
  }, [
    selectedResultIds,
    notes, pictures, cueCards, practiceSheets,
    preorder,
    selectedNodeIds,
    getResourceCard,
    getSelectedNodeIds,
    isResourceDismissed,
  ]);
}
