/**
 * @file RichTextEditor.tsx
 * @description 
 * This file defines a RichTextEditor component that integrates 
 * Slate.js with React to enable rich text editing. It provides 
 * an editable area where users can apply basic text formatting 
 * such as bold, italic, underline, and highlight. The component 
 * accepts a Descendant[] value and a callback to handle editor 
 * state changes.
 * 
 * Responsibilities:
 * - Initialize a Slate editor instance using createEditor and withReact.
 * - Render an Editable component to allow users to edit rich text content.
 * - Invoke onChange callback whenever the editor's value updates.
 * - Provide a foundation for additional formatting controls.
 * 
 * Inputs:
 * - value: Descendant[] - The current rich text structure.
 * - onChange(value: Descendant[]): void - Function to handle updated content.
 * 
 * Outputs:
 * - Descendant[] - Updated rich text content as an array of Slate nodes.
 */

import React, { useCallback, useMemo } from 'react';
import { createEditor, Descendant, Editor, Transforms, Element as SlateElement, Range, Point } from 'slate';
import { Slate, Editable, withReact, useSlate } from 'slate-react';
import { Button } from 'antd';
import {
  FaBold,
  FaItalic,
  FaUnderline,
  FaHighlighter,
  FaListUl,
  FaListOl
} from 'react-icons/fa';
import { withHistory } from 'slate-history';

import './RichTextEditor.css';
import { BulletedListElement, NumberedListElement, ListItemElement } from '@/app/custom-types';

type MarkFormat = 'bold' | 'italic' | 'underline' | 'highlight';
type BlockFormat = 'bulleted-list' | 'numbered-list';

const LIST_TYPES = ['numbered-list', 'bulleted-list'];

interface RichTextEditorProps {
  value: Descendant[];
  onChange: (value: Descendant[]) => void;
  defaultString: string;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange, defaultString }) => {
  // Initialize the editor with React and History plugins
  const editor = useMemo(() => withHistory(withReact(createEditor())), []);

  /**
   * Render function for leaf nodes (text with formatting).
   * Handles rendering based on active marks (bold, italic, etc.).
   */
  const renderLeaf = useCallback((props: any) => {
    return <Leaf {...props} />;
  }, []);

  /**
   * Render function for element nodes (blocks like paragraphs, lists).
   * Handles rendering based on element type (paragraph, list, etc.).
   */
  const renderElement = useCallback((props: any) => {
    return <Element {...props} />;
  }, []);

  /**
   * Checks if a specific mark format is active in the current selection.
   * @param editor - The Slate editor instance.
   * @param format - The mark format to check (e.g., 'bold').
   * @returns boolean indicating if the mark is active.
   */
  const isMarkActive = (editor: Editor, format: MarkFormat): boolean => {
    const marks = Editor.marks(editor);
    return marks ? marks[format] === true : false;
  };

  /**
   * Toggles a specific mark format on or off.
   * @param editor - The Slate editor instance.
   * @param format - The mark format to toggle (e.g., 'bold').
   */
  const toggleMark = (editor: Editor, format: MarkFormat) => {
    const isActive = isMarkActive(editor, format);
    if (isActive) {
      Editor.removeMark(editor, format);
    } else {
      Editor.addMark(editor, format, true);
    }
  };

  /**
   * Checks if a specific block format is active in the current selection.
   * @param editor - The Slate editor instance.
   * @param format - The block format to check (e.g., 'bulleted-list').
   * @returns boolean indicating if the block is active.
   */
  const isBlockActive = (editor: Editor, format: BlockFormat): boolean => {
    const { selection } = editor;
    if (!selection) return false;

    const [match] = Array.from(
      Editor.nodes(editor, {
        at: Editor.unhangRange(editor, selection),
        match: n =>
          !Editor.isEditor(n) &&
          SlateElement.isElement(n) &&
          n.type === format,
      })
    );

    return !!match;
  };

/**
 * Toggles a specific block format on or off.
 * Wraps or unwraps blocks (e.g., lists).
 * @param editor - The Slate editor instance.
 * @param format - The block format to toggle (e.g., 'bulleted-list').
 */
const toggleBlock = (editor: Editor, format: BlockFormat) => {
    console.log('Toggling block:', format);
    const isActive = isBlockActive(editor, format);
    const isList = LIST_TYPES.includes(format);
  
    // Unwrap existing list blocks
    Transforms.unwrapNodes(editor, {
      match: n =>
        !Editor.isEditor(n) &&
        SlateElement.isElement(n) &&
        LIST_TYPES.includes(n.type),
      split: true,
    });
  
    console.log('Setting new properties:', {
      type: isActive ? 'paragraph' : isList ? 'list-item' : format,
    });
  
    // Set the block type to 'list-item' if toggling a list
    const newProperties: Partial<SlateElement> = {
      type: isActive ? 'paragraph' : isList ? 'list-item' : format,
    };
    Transforms.setNodes<SlateElement>(editor, newProperties);
  
    if (!isActive && isList) {
      console.log('Wrapping in container:', format);
  
      // Ensure all selected nodes are wrapped in `list-item`
      Transforms.wrapNodes(editor, {
        type: 'list-item',
        children: [{ text: '' }], // Add a default text node
      } as ListItemElement, {
        match: n =>
          !Editor.isEditor(n) &&
          SlateElement.isElement(n) &&
          n.type !== 'list-item', // Only wrap non-list-item elements
      });
  
      // Wrap `list-item` blocks in the appropriate list container
      const block: BulletedListElement | NumberedListElement = {
        type: format,
        children: [],
      };
      Transforms.wrapNodes(editor, block, {
        match: n =>
          !Editor.isEditor(n) &&
          SlateElement.isElement(n) &&
          n.type === 'list-item', // Only wrap `list-item` blocks
      });
    }
  
    console.log('Final block structure:', editor.children);
  };
  
  
  


  /**
   * ToolbarButton component for formatting controls.
   * Renders a button that toggles marks or block types.
   * @param props - Includes format, icon, and mark flag.
   * @returns JSX Element representing the button.
   */
  const ToolbarButton = ({
    format,
    icon,
    mark
  }: {
    format: string;
    icon: JSX.Element;
    mark?: boolean;
  }) => {
    const e = useSlate();
    const isActive = mark
      ? isMarkActive(e, format as MarkFormat)
      : isBlockActive(e, format as BlockFormat);

    return (
      <Button
        type={isActive ? 'primary' : 'default'}
        onMouseDown={event => {
          event.preventDefault();
          mark
            ? toggleMark(e, format as MarkFormat)
            : toggleBlock(e, format as BlockFormat);
        }}
        style={{ marginRight: '4px' }}
        icon={icon}
      />
    );
  };

  return (
    <Slate
      editor={editor}
      initialValue={value}
      onChange={newValue => onChange(newValue)}
      key={JSON.stringify(value)} // Ensures remounting when value changes
    >
      {/* Toolbar with formatting buttons */}
      <div className="rte-toolbar">
        <ToolbarButton format="bold" icon={<FaBold />} mark />
        <ToolbarButton format="italic" icon={<FaItalic />} mark />
        <ToolbarButton format="underline" icon={<FaUnderline />} mark />
        <ToolbarButton format="highlight" icon={<FaHighlighter />} mark />
        <ToolbarButton format="bulleted-list" icon={<FaListUl />} />
        <ToolbarButton format="numbered-list" icon={<FaListOl />} />
      </div>

      {/* Editable area for rich text */}
      <div className="rte-editor">
        <Editable
          renderLeaf={renderLeaf}
          renderElement={renderElement}
          placeholder={defaultString}
          spellCheck
          autoFocus
          onKeyDown={event => {
            if (event.ctrlKey) {
              switch (event.key) {
                case 'b':
                  event.preventDefault();
                  toggleMark(editor, 'bold');
                  break;
                case 'i':
                  event.preventDefault();
                  toggleMark(editor, 'italic');
                  break;
                case 'u':
                  event.preventDefault();
                  toggleMark(editor, 'underline');
                  break;
                default:
                  break;
              }
            }
          }}
        />
      </div>
    </Slate>
  );
};

/**
 * Element component to render different block types.
 * Handles rendering based on the element's type property.
 * @param props - Includes attributes, children, and element.
 * @returns JSX Element representing the block.
 */
const Element = ({ attributes, children, element }: any) => {
  switch (element.type) {
    case 'bulleted-list':
      return <ul {...attributes}>{children}</ul>;
    case 'numbered-list':
      return <ol {...attributes}>{children}</ol>;
    case 'list-item':
      return <li {...attributes}>{children}</li>;
    case 'paragraph':
      return <p {...attributes}>{children}</p>;
    default:
      return <p {...attributes}>{children}</p>;
  }
};

/**
 * Leaf component to render text with marks.
 * Applies styles based on the leaf's mark properties.
 * @param props - Includes attributes, children, and leaf.
 * @returns JSX Element representing the text with applied styles.
 */
const Leaf = ({ attributes, children, leaf }: any) => {
  if (leaf.bold) {
    children = <strong>{children}</strong>;
  }

  if (leaf.italic) {
    children = <em>{children}</em>;
  }

  if (leaf.underline) {
    children = <u>{children}</u>;
  }

  if (leaf.highlight) {
    children = <mark>{children}</mark>;
  }

  return <span {...attributes}>{children}</span>;
};

export default RichTextEditor;
