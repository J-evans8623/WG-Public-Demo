/**
 * CitationExtension.ts
 *
 * Responsibilities:
 *   - Define a lightweight Tiptap Mark extension that recognizes
 *     `<sup data-cite="…">` elements in HTML.
 *   - Preserve the `data-cite` attribute and apply a `.citation` class.
 *
 * Usage:
 *   import { Citation } from './CitationExtension'
 *   … add to your Tiptap editor’s extensions list …
 */

import { Mark, mergeAttributes } from '@tiptap/core'

export interface CitationOptions {
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    citation: {
      /**
       * Set a citation mark with the given index.
       */
      setCitation: (attributes: { 'data-cite': number }) => ReturnType
      /**
       * Remove any existing citation mark.
       */
      unsetCitation: () => ReturnType
    }
  }
}

export const Citation = Mark.create<CitationOptions>({
  name: 'citation',

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      'data-cite': {
        default: null,
        parseHTML: element => element.getAttribute('data-cite'),
        renderHTML: attrs => ({ 'data-cite': attrs['data-cite'] }),
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'sup[data-cite]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'sup',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { class: 'citation' }),
      0,
    ]
  },

  addCommands() {
    return {
      setCitation:
        attrs =>
        ({ commands }) => {
          return commands.setMark(this.name, attrs)
        },
      unsetCitation:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name)
        },
    }
  },
})
