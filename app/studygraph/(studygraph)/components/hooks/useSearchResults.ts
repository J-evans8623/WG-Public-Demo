// src/app/studygraph/(studygraph)/components/hooks/useSearchResults.ts

/**
 * @file useSearchResults.ts
 * @description
 *   Custom hook that returns a memoized array of ResourceCard
 *   filtered by a search query.
 *
 * Responsibilities:
 *   - Pull all resources from useResourceContext().
 *   - Flatten the Map<string,ResourceCard[]> to a single array.
 *   - Perform case-insensitive substring match against title
 *     and content/description fields.
 *   - Memoize results for performance.
 */

import { useMemo } from 'react';
import { useResourceContext } from '@/app/Library/Context/ResourceContext';
import { ResourceCard } from '@/app/Library/Definitions/Definitions';

export const useSearchResults = (query: string): ResourceCard[] => {
  const { resources } = useResourceContext();

  return useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    // Flatten all resources into one array
    const allCards: ResourceCard[] = [];
    resources.forEach((cards) => {
      allCards.push(...cards);
    });

    return allCards.filter((card) => {
      // Title match
      if (card.title.toLowerCase().includes(q)) return true;

      // Extract textual content
      let contentText = '';
      if ('description' in card && typeof (card as any).description === 'string') {
        contentText = (card as any).description;
      } else if (typeof (card as any).content === 'string') {
        contentText = (card as any).content;
      } else {
        // Ensure we never assign undefined—coerce to empty string if JSON.stringify returns undefined
        contentText = JSON.stringify((card as any).content) ?? '';
      }

      return contentText.toLowerCase().includes(q);
    });
  }, [resources, query]);
};
