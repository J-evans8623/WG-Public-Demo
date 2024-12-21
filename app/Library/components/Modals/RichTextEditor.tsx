/**
 * @file RichTextEditor.tsx
 * @description 
 * This file defines a RichTextEditor component that integrates 
 * Slate.js with React to enable rich text editing. It provides 
 * an editable area where users can apply basic text formatting 
 * such as bold and italic. The component accepts a Descendant[] 
 * value and a callback to handle editor state changes.
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
import { createEditor, Descendant, Editor, Transforms, Element as SlateElement } from 'slate';
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

import './RichTextEditor.css'; // New CSS file for styling

type MarkFormat = 'bold' | 'italic' | 'underline' | 'highlight';
type BlockFormat = 'bulleted-list' | 'numbered-list';

const LIST_TYPES = ['numbered-list', 'bulleted-list'];

interface RichTextEditorProps {
  value: Descendant[];
  onChange: (value: Descendant[]) => void;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange }) => {
  const editor = useMemo(() => withReact(createEditor()), []);

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

  const renderElement = useCallback((props: any) => {
    const { attributes, children, element } = props;
    switch (element.type) {
      case 'bulleted-list':
        return <ul {...attributes}>{children}</ul>;
      case 'numbered-list':
        return <ol {...attributes}>{children}</ol>;
      case 'list-item':
        return <li {...attributes}>{children}</li>;
      default:
        return <p {...attributes}>{children}</p>;
    }
  }, []);

  const isMarkActive = (editor: Editor, format: MarkFormat): boolean => {
    const marks = Editor.marks(editor);
    return marks ? marks[format] === true : false;
  };

  const toggleMark = (editor: Editor, format: MarkFormat) => {
    const isActive = isMarkActive(editor, format);
    if (isActive) {
      Editor.removeMark(editor, format);
    } else {
      Editor.addMark(editor, format, true);
    }
  };

  const isBlockActive = (editor: Editor, format: BlockFormat) => {
    const [match] = Editor.nodes(editor, {
      match: n =>
        !Editor.isEditor(n) &&
        SlateElement.isElement(n) &&
        n.type === format,
    });
    return !!match;
  };

  const toggleBlock = (editor: Editor, format: BlockFormat) => {
    const isActive = isBlockActive(editor, format);
    const isList = LIST_TYPES.includes(format);

    // Unwrap existing lists if any
    Transforms.unwrapNodes(editor, {
      match: n =>
        !Editor.isEditor(n) &&
        SlateElement.isElement(n) &&
        LIST_TYPES.includes(n.type),
      split: true,
    });

    let newType: 'paragraph' | 'list-item' | BlockFormat;
    if (isActive) {
      // If active, revert to paragraph
      newType = 'paragraph';
    } else if (isList) {
      // If we're applying a list, first make selected nodes list-items
      Transforms.setNodes(editor, { type: 'list-item' } as Partial<SlateElement>, {
        match: n => SlateElement.isElement(n) && n.type === 'paragraph'
      });

      newType = format;
    } else {
      newType = 'paragraph';
    }

    Transforms.setNodes(editor, { type: newType } as Partial<SlateElement>);

    if (!isActive && isList) {
      // Wrap the list-items in the list container
      const block = { type: format, children: [] };
      Transforms.wrapNodes(editor, block);
    }
  };

  const ToolbarButton = ({ format, icon, mark }: { format: string; icon: JSX.Element; mark?: boolean }) => {
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
      >
        {icon}
      </Button>
    );
  };

  return (
    <div className="rte-container">
      <Slate key={JSON.stringify(value)} editor={editor} initialValue={value} onChange={onChange}>
        <div className="rte-toolbar">
          <ToolbarButton format="bold" icon={<FaBold />} mark />
          <ToolbarButton format="italic" icon={<FaItalic />} mark />
          <ToolbarButton format="underline" icon={<FaUnderline />} mark />
          <ToolbarButton format="highlight" icon={<FaHighlighter />} mark />
          <ToolbarButton format="bulleted-list" icon={<FaListUl />} mark={false} />
          <ToolbarButton format="numbered-list" icon={<FaListOl />} mark={false} />
        </div>
        <div className="rte-editor">
          <Editable
            renderLeaf={renderLeaf}
            renderElement={renderElement}
            placeholder="Type here..."
            onKeyDown={event => {
              if (event.ctrlKey && event.key === 'b') {
                event.preventDefault();
                toggleMark(editor, 'bold');
              }
              if (event.ctrlKey && event.key === 'i') {
                event.preventDefault();
                toggleMark(editor, 'italic');
              }
              if (event.ctrlKey && event.key === 'u') {
                event.preventDefault();
                toggleMark(editor, 'underline');
              }
            }}
          />
        </div>
      </Slate>
    </div>
  );
};

export default RichTextEditor;