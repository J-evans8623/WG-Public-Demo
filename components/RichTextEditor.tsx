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

// ✨ update - 2: add a stable per-editor key so multiple editors don’t collide
// Purpose: if you ever render >1 RichTextEditor at once, each one will have its own upload lane.
import { useRef } from 'react';
import { supersedingCall } from '@/app/src/net/SupersedingCaller';

function useStableEditorKey(prefix = 'asset:upload'): string {
  const keyRef = useRef<string | null>(null);
  if (!keyRef.current) {
    // Simple, fast uniqueness. If you prefer UUID, swap it in — we just need per-instance uniqueness.
    keyRef.current = `${prefix}:${Math.random().toString(36).slice(2, 10)}`;
  }
  return keyRef.current;
}



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

  // (2) get a stable key for *this* editor instance
  const key = (window as any).__rtuKey ??= `asset:upload:singleton`;
  // NOTE: if you render multiple editors simultaneously, replace the line above with:
  //   const key = useStableEditorKey();  // ← see update - 2 helper
  // and hoist `handleImageUpload` inside the component so hooks are valid.

  // 1) Create a hidden input to choose an image
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.multiple = false;

  input.onchange = async (event) => {
    const file = (event.target as HTMLInputElement)?.files?.[0];
    if (!file) {
      console.log('[RichTextEditor.tsx][2002] No file selected');
      return;
    }
    console.log('[RichTextEditor.tsx][2003] Processing selected file:', file.name);

    // 3) Define how to actually execute the request (used for first send AND any retry)
    const makeRequest = async (signal: AbortSignal, payload: any): Promise<Response> => {
      // Rebuild FormData fresh each attempt so it’s valid for re-send
      const formData = new FormData();
      formData.append('image', payload.file as File);

      return fetch('/api/asset', {
        method: 'POST',
        body: formData,
        credentials: 'include',
        signal,
      });
    };

    try {
      // 4) Call via superseding lane — handles 429 Retry-After, in-flight aborts, and stale flush
      const resp = await supersedingCall(key, { file }, makeRequest);

      // If we got superseded (null) or request failed, bail quietly.
      if (!resp) {
        console.log('[RichTextEditor.tsx][2003a] Upload superseded or deferred.');
        return;
      }
      if (!resp.ok) {
        // If it was a 429 we’ve already scheduled a retry; other errors surface here.
        console.warn('[RichTextEditor.tsx][2003b] Upload response not OK:', resp.status);
        if (resp.status === 429) return; // scheduled by SupersedingCaller
        throw new Error(`Upload failed: ${resp.status}`);
      }

      // 5) Insert the (latest) uploaded image URL
      const { url: serverUrl } = await resp.json();
      console.log('[RichTextEditor.tsx][2004] Upload successful, inserting image:', serverUrl);

      editor
        ?.chain()
        .focus()
        .setImage({ src: serverUrl, alt: file.name })
        .run();
    } catch (err) {
      console.error('[RichTextEditor.tsx][2005] Image upload failed:', err);
    }
  };

  // 1) Trigger the file picker
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
