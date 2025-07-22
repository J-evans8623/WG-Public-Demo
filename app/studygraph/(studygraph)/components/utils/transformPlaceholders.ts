export type Citations = {
  index: number;
  textsource: string;
  page_number?: number;
}[];

/**
 * Turn "<< 1 >>" placeholders into ready-to-render <sup> tags **with tooltip**,
 * and collect only the citations that were actually referenced in the content.
 *
 * @param content     The raw lecture_note / paragraph string
 * @param citations   The full citation array coming from the AI
 * @returns           An object with:
 *   - content: the HTML-ready string with numbered <sup> marks
 *   - citations: the subset of citation objects that were referenced
 */
export function transformPlaceholders(
  content: string,
  citations?: Citations,
): { content: string; citations: Citations } {
  // If there are no citations, just return the original content and an empty list.
  if (!citations?.length) {
    return { content, citations: [] };
  }

  // Track which citation indices actually appeared.
  const usedIndices = new Set<number>();

  // Replace placeholders with <sup> tags, and record the index.
  const transformed = content.replace(/<<\s*(\d+)\s*>>/g, (_match, numStr) => {
    const num = Number(numStr);
    usedIndices.add(num);

    const cite = citations.find(c => c.index === num);
    if (!cite) return _match;  // safety-net: leave it alone if not found

    const page = cite.page_number != null ? ` (p. ${cite.page_number})` : '';
    const tooltip = `${cite.textsource}${page}`.replace(/"/g, '&quot;');

    return `<sup class="citation" data-cite="${num}" title="${tooltip}">[${num}]</sup>`;
  });

  // Now pull out just the citation objects we used.
  const usedCitations = citations.filter(c => usedIndices.has(c.index));

  return {
    content: transformed,
    citations: usedCitations,
  };
}
