/**
 * @file ReadOnlyRichTextRenderer.tsx
 * @description
 * This component renders a `Descendant[]` array as formatted text using a Slate editor
 * in read-only mode. It preserves all formatting applied during editing (bold, italic,
 * underline, highlight, bulleted/numbered lists).
 * 
 * Responsibilities:
 * - Initialize a Slate editor for read-only rendering.
 * - Render `Descendant[]` content as formatted text.
 * - Supports marks (bold, italic, underline, highlight) and block formatting (lists).
 * - No user edits allowed.
 * 
 * Inputs:
 * - value: Descendant[] - The rich text data to display.
 * 
 * Outputs:
 * - JSX displaying the formatted, read-only rich text.
 */

import React, { useMemo, useCallback } from 'react';
import { createEditor, Descendant, Element as SlateElement } from 'slate';
import { Slate, Editable, withReact } from 'slate-react';

interface ReadOnlyRichTextRendererProps {
  value: Descendant[];
}

const ReadOnlyRichTextRenderer: React.FC<ReadOnlyRichTextRendererProps> = ({ value }) => {
  // Create a read-only Slate editor instance
  const editor = useMemo(() => withReact(createEditor()), []);

  /**
   * Render function for leaf nodes (text with formatting).
   * Handles rendering based on active marks (bold, italic, etc.).
   */
  const renderLeaf = useCallback((props: any) => {
    const { attributes, children, leaf } = props;
    let element = children;

    if (leaf.bold) {
      element = <strong>{element}</strong>;
    }
    if (leaf.italic) {
      element = <em>{element}</em>;
    }
    if (leaf.underline) {
      element = <u>{element}</u>;
    }
    if (leaf.highlight) {
      element = <span style={{ backgroundColor: 'yellow' }}>{element}</span>;
    }

    return <span {...attributes}>{element}</span>;
  }, []);

  /**
   * Render function for element nodes (blocks like paragraphs, lists).
   * Handles rendering based on the element's type property.
   */
  const renderElement = useCallback((props: any) => {
    const { attributes, children, element } = props;
    console.log('Rendering element:', element.type);

    switch (element.type) {
      case 'bulleted-list':
        return (
          <ul
            {...attributes}
            style={{
              listStyleType: 'disc',
              marginLeft: '20px',
              paddingLeft: '20px',
            }}
          >
            {children}
          </ul>
        );
      case 'numbered-list':
        return (
          <ol
            {...attributes}
            style={{
              listStyleType: 'decimal',
              marginLeft: '20px',
              paddingLeft: '20px',
            }}
          >
            {children}
          </ol>
        );
      case 'list-item':
        return <li {...attributes}>{children}</li>;
      default:
        return <p {...attributes}>{children}</p>;
    }
  }, []);

  // Log the input value for debugging
  console.log('Read-only value:', value);

  return (
    <Slate editor={editor} initialValue={value} onChange={() => {}}>
      <Editable
        renderLeaf={renderLeaf}
        renderElement={renderElement}
        readOnly={true}
        spellCheck={false}
      />
    </Slate>
  );
};

export default ReadOnlyRichTextRenderer;
