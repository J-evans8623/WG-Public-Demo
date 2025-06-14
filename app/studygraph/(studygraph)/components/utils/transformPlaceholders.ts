/**
 * Turn "<< 1 >>" placeholders into ready-to-render <sup> tags **with tooltip**.
 *
 * @param content     The raw lecture_note / paragraph string
 * @param citations   The matching citation array coming from the AI
 * @returns           HTML-ready string with numbered <sup> marks
 */


export type Citations = {
  index: number;
  textsource: string;
  page_number?: number;
}[];


export function transformPlaceholders(
  content: string,
  citations?: Citations,
): string {
  if (!citations?.length) return content;

  return content.replace(/<<\s*(\d+)\s*>>/g, (_match, numStr) => {
    const num = Number(numStr);
    const cite = citations.find(c => c.index === num);
    if (!cite) return _match;                              // safety-net

    const page = cite.page_number ? ` (p. ${cite.page_number})` : '';
    const tooltip = `${cite.textsource}${page}`
      .replace(/"/g, '&quot;');                           // escape quotes

    /* final HTML injected straight into markdown-it */
    return `<sup class="citation" data-cite="${num}" title="${tooltip}">[${num}]</sup>`;
  });
}
