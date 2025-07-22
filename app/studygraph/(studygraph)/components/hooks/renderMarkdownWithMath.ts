// app/Library/utils/renderMarkdownWithMath.ts

/**
 * renderMarkdownWithMath.ts
 *
 * Responsibilities:
 *  - Provides `renderMarkdownWithMath(raw: string) → string`
 *    which:
 *      1. Extracts LaTeX fragments into placeholders.
 *      2. Runs markdown-it on the stripped text.
 *      3. Restores the original LaTeX fragments.
 *  - Logs input length, number of extracted segments, and output length
 *    with unique tags for debugging and metrics.
 */

import MarkdownIt from 'markdown-it';
import { extractMath, restoreMath } from './mathPlaceholder';

const md = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: true,
});

export function renderMarkdownWithMath(raw: string): string {
  console.log(`RMwM-0001: raw input length=${raw.length}`);
  const { stripped, map } = extractMath(raw);
  console.log(`RMwM-0001: extracted ${Object.keys(map).length} math segments`);

  const rendered = md.render(stripped);
  const result = restoreMath(rendered, map);

  console.log(`RMwM-0002: restored math, output length=${result.length}`);
  return result;
}
