// bloom-maps/app/Library/utils/convertStringToNodeArray.ts

import { Descendant, BaseElement } from 'slate';

/**
 * Defines the structure of a Paragraph Element.
 */
interface ParagraphElement extends BaseElement {
  type: 'paragraph';
  children: { text: string }[];
}

/**
 * Type representing any custom element in the editor.
 * Extend this union as you add more element types.
 */
export type CustomElement = ParagraphElement;

/**
 * Converts a plain string into a Slate Descendant array.
 * Typically wraps the string in a single paragraph element.
 *
 * @param content - The legacy string-based text content.
 * @returns A Slate Descendant array representing the content.
 */
export function convertStringToNodeArray(content: string): Descendant[] {
  const paragraph: CustomElement = {
    type: 'paragraph',
    children: [{ text: content }],
  };
  return [paragraph];
}
