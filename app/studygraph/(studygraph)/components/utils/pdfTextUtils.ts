// utils/pdfTextUtils.ts

import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';

/**
 * Extracts and cleans all text content from the given PDF page.
 *
 * Responsibilities:
 *   - Retrieve raw text items via PDF.js.
 *   - Concatenate them without injecting extra spaces.
 *   - Collapse any incidental whitespace runs into single spaces.
 */
export async function getPageText(
  pdfDoc: PDFDocumentProxy,
  pageNum: number
): Promise<string> {
  // Load the specified page
  const page = await pdfDoc.getPage(pageNum);

  // Extract all text content items
  const textContent = await page.getTextContent();
  const items = textContent.items as Array<{ str: string }>;

  // Join item.str without adding extra separators;
  // this preserves natural spaces encoded by PDF.js
  const rawText = items.map(item => item.str).join('');

  // Collapse any sequences of whitespace into a single space,
  // and trim leading/trailing spaces for cleanliness
  const cleaned = rawText.replace(/\s+/g, ' ').trim();

  return cleaned;
}

/**
 * Returns the user’s currently selected text in the document, if any.
 *
 * Responsibilities:
 *   - Read browser selection via window.getSelection().
 *   - Fallback to empty string if no selection exists.
 */
export function getSelectedText(): string {
  const sel = window.getSelection();
  return sel ? sel.toString() : '';
}
