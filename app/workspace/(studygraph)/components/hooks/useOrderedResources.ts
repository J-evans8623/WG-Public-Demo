// src/app/workspace/(studygraph)/components/hooks/useOrderedResources.ts
import { useMemo } from 'react';
import { useResourceSync } from '@/app/workspace/(studygraph)/components/hooks/useResourceSync';
import { usePreorderTraversal } from './usePreorderTraversal';
import { useSearchContext } from '@/app/Library/Context/SearchContext';
import { useResourceContext } from '@/app/Library/Context/ResourceContext';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import type { ResourceCard } from '@/app/Library/Definitions/Definitions';

/**
 * @file useOrderedResources.ts
 * @description
 *   Returns a merged, ordered list of resources:
 *     1) Search-history cards (whose node is not currently selected),
 *        filtered to EXCLUDE dismissed items.
 *     2) All resources for selected nodes in preorder, excluding dismissed cards.
 *
 *   This change ensures that dismissing a searched (history) card actually removes it
 *   from the Notes list immediately and keeps it out if the user reopens Notes.
 */
export function useOrderedResources(): ResourceCard[] {
  const { selectedNodeIds, notes, cueCards, practiceSheets } = useResourceSync();
  const preorder = usePreorderTraversal();

  const { selectedResultIds } = useSearchContext();
  const { getResourceCard } = useResourceContext();
  const { getSelectedNodeIds, isResourceDismissed } = useNodeSelection();

  return useMemo(() => {
    const currentNodes = getSelectedNodeIds();

    // 1️⃣ History cards (from search) — exclude (a) missing cards,
    // (b) cards from currently selected nodes, and (c) dismissed cards.
    const historyCards = selectedResultIds
      .map(id => getResourceCard(id))
      .filter((c): c is ResourceCard => Boolean(c))
      .filter(c => !currentNodes.includes(c.nodeId))
      .filter(c => !isResourceDismissed(c.nodeId, c.id));

    // 2️⃣ Group existing resources by node
    const group = <T extends ResourceCard>(arr: T[]) =>
      arr.reduce((acc: Record<string, T[]>, r) => {
        (acc[r.nodeId] ||= []).push(r);
        return acc;
      }, {});

    const byNote = group(notes);
    const byCue = group(cueCards);
    const byQuiz = group(practiceSheets);

    // 3️⃣ Build base list in node-preorder, filtering out dismissed
    const base: ResourceCard[] = [];
    preorder
      .filter(id => selectedNodeIds.includes(id))
      .forEach(nodeId => {
        [...(byNote[nodeId] || []),
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
    return [...historyCards, ...base.filter(r => !seen.has(r.id))];
  }, [
    selectedResultIds,
    notes,
    cueCards,
    practiceSheets,
    preorder,
    selectedNodeIds,
    getResourceCard,
    getSelectedNodeIds,
    isResourceDismissed,
  ]);
}
