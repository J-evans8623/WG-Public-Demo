// components/RichTextEditor.tsx

/**
 * @file RichTextEditor.tsx
 * @description
 *   Wraps the Tiptap editor to allow users to create and edit rich text content,
 *   including inline and block LaTeX math via KaTeX, and inline citations.
 *   Provides a toolbar with distinct icons for:
 *     • Bold, Italic, Lists
 *     • Inline math ($…$) — Sigma icon
 *     • Block math ($$…$$) — Code icon
 *     • Citation placeholders (via Citation mark)
 *
 *   - Loads KaTeX CSS to style rendered math.
 *   - Uses StarterKit for core prose features.
 *   - Integrates MathExtension for math nodes.
 *   - Integrates Citation for recognizing <sup data-cite> citation marks.
 *   - Emits serialized HTML on each update via onChange callback.
 *   - Toolbar icons: Bold, Italic, Lists, Inline‐Math, Block‐Math.
 */

import React from 'react';
import 'katex/dist/katex.min.css'; // KaTeX styles

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { MathExtension } from '@/app/studygraph/(studygraph)/Library/tiptap/MathExtension';
import { Citation } from './CitationExtension'; // <-- Correct export
import { ImageExtension } from './ImageExtension';

import { Toggle } from '@/components/ui/toggle';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Sigma,
  Code,
  Image as ImageIcon,
} from 'lucide-react';

interface RichTextEditorProps {
  /** Initial HTML content to load into the editor */
  content: string;
  /** Callback invoked on every content change with the new HTML */
  onChange: (content: string) => void;
  /** Optional wrapper class names */
  className?: string;
}



/**
 * handleImageUpload
 * Handles the image upload process triggered by the toolbar button.
 * Opens a file picker dialog and processes the selected image through the editor.
 * @param editor The Tiptap editor instance to insert the image into
 */
const handleImageUpload = (editor: any) => {
  console.log('[RichTextEditor.tsx][2001] Image upload button clicked');
  
  // 1. Create hidden file input element
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.multiple = false;
  
  // 2. Handle file selection
  input.onchange = async (event) => {
    const file = (event.target as HTMLInputElement)?.files?.[0];
    if (!file) {
      console.log('[RichTextEditor.tsx][2002] No file selected');
      return;
    }
    
    console.log('[RichTextEditor.tsx][2003] Processing selected file:', file.name);
    
    try {
      // 3. Upload file to server
      const formData = new FormData();
      formData.append('image', file);
      
      const response = await fetch('/api/asset', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }
      
      // 4. Get server URL and insert image
      const { url: serverUrl } = await response.json();
      console.log('[RichTextEditor.tsx][2004] Upload successful, inserting image:', serverUrl);
      
      editor.chain().focus().setImage({ 
        src: serverUrl, 
        alt: file.name 
      }).run();
      
    } catch (error) {
      console.error('[RichTextEditor.tsx][2005] Image upload failed:', error);
    }
  };
  
  // 5. Trigger file picker
  input.click();
};

/**
 * MenuBar
 *
 * Renders toolbar controls:
 * - Bold, Italic, Bullet / Ordered lists
 * - Inline math ($…$) — Sigma icon
 * - Block math ($$…$$) — Code icon
 */
const MenuBar: React.FC<{ editor: any }> = ({ editor }) => {
  if (!editor) return null;

  return (
    <div className="border-b p-1 flex gap-1">
      {/* Bold */}
      <Toggle
        size="sm"
        pressed={editor.isActive('bold')}
        onPressedChange={() => editor.chain().focus().toggleBold().run()}
        title="Bold (Ctrl+B)"
      >
        <Bold className="h-4 w-4" />
      </Toggle>

      {/* Italic */}
      <Toggle
        size="sm"
        pressed={editor.isActive('italic')}
        onPressedChange={() => editor.chain().focus().toggleItalic().run()}
        title="Italic (Ctrl+I)"
      >
        <Italic className="h-4 w-4" />
      </Toggle>

      {/* Bullet list */}
      <Toggle
        size="sm"
        pressed={editor.isActive('bulletList')}
        onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
        title="Bullet List"
      >
        <List className="h-4 w-4" />
      </Toggle>

      {/* Ordered list */}
      <Toggle
        size="sm"
        pressed={editor.isActive('orderedList')}
        onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
        title="Ordered List"
      >
        <ListOrdered className="h-4 w-4" />
      </Toggle>

      {/* Inline math ($…$) */}
      <Toggle
        size="sm"
        pressed={editor.isActive('inlineMath')}
        onPressedChange={() => editor.chain().focus().insertContent({ type: 'inlineMath' }).run()}
        title="Inline Math \(...\) (Ctrl+M)"
      >
        <Sigma className="h-4 w-4" />
      </Toggle>

      {/* Block math ($$…$$) */}
      <Toggle
        size="sm"
        pressed={editor.isActive('blockMath')}
        onPressedChange={() =>
          editor.chain().focus()
            .insertContent({ type: 'blockMath', attrs: { display: true } })
            .run()
        }
        title="Block Math \[…\] (Ctrl+Alt+M)"
      >
        <Code className="h-4 w-4" />
      </Toggle>


      {/* Image upload */}
      <Toggle
        size="sm"
        pressed={false}
        onPressedChange={() => handleImageUpload(editor)}
        title="Insert Image (supports upload, drag & drop, and paste)"
      >
        <ImageIcon className="h-4 w-4" />
      </Toggle>

    </div>
  );
};

/**
 * RichTextEditor
 *
 * - Configures the Tiptap editor with:
 *     • StarterKit for core text tooling
 *     • MathExtension for inline/block math
 *     • Citation for <sup data-cite> marks
 * - Calls `onChange` with `editor.getHTML()` on every update.
 */
const RichTextEditor: React.FC<RichTextEditorProps> = ({
  content,
  onChange,
  className,
}) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      MathExtension,
      Citation, 
       ImageExtension,
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  return (
    <div className={`border rounded-md flex flex-col ${className}`}>
      <MenuBar editor={editor} />
      <EditorContent
        editor={editor}
        className="prose max-w-none h-full p-3 [&_.ProseMirror]:min-h-full [&_.ProseMirror]:outline-none"
      />
    </div>
  );
};

export default RichTextEditor;
