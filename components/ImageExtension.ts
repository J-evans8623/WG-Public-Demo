/**
 * @file ImageExtension.ts
 * @responsibility
 * Tiptap Image node with drag-drop & paste upload pipeline.
 * Now uses the general-purpose SupersedingCaller so that:
 * 1) A 429 schedules a single retry using the server’s Retry-After value.
 * 2) Newer images supersede older queued/in-flight uploads (flush stale).
 * 3) Each editor instance gets its own upload “lane” key to avoid cross-editor collisions.
 * * UPDATE (Phase 2):
 * - Accepts `docId` in configuration options.
 * - Appends `DocID` to the FormData payload to ensure backend stores image in doc-scoped path.
 *
 * Notes:
 * • Like the RichTextEditor integration, when a 429 defers the upload, we do not insert
 * the image immediately; the retry will fire later but there’s no callback path to
 * complete insertion. This mirrors the editor toolbar behavior you signed off on.
 */

import { Node, mergeAttributes, nodeInputRule } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

// ✨ update - 1: bring in the general-purpose caller
import { supersedingCall } from '@/app/src/net/SupersedingCaller';

export interface ImageOptions {
  inline: boolean;
  allowBase64: boolean;
  HTMLAttributes: Record<string, any>;
  docId?: string; // update - 1: Add docId to options
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    image: {
      /**
       * Add an image node with the specified source URL and optional alt text.
       * This command is used internally after successful image upload to server.
       * @param options Object containing src URL and optional alt text
       */
      setImage: (options: { src: string; alt?: string; title?: string }) => ReturnType;
    };
  }
}

/**
 * buildLaneKey — update - 2
 * @purpose
 * Create a per-editor-instance “lane” key so uploads from different editors don’t supersede each other.
 * @steps
 * 1) Prefix the lane.
 * 2) Append a short random token (sufficiently unique per view lifetime).
 */
function buildLaneKey(): string {
  return `asset:upload:editor:${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * uploadImageToServer — update - 3
 * @purpose
 * Upload a single File via SupersedingCaller, honoring Retry-After and “latest wins”.
 * Returns the server URL string when the request succeeds immediately.
 * If the call is deferred (429) or superseded, returns null (no insertion).
 * UPDATE (Phase 2): Now accepts `docId` to scope the asset storage.
 * @steps
 * 1) Define makeRequest that rebuilds FormData each attempt (Files/FormData must be fresh).
 * 2) Call supersedingCall(laneKey, {file}, makeRequest).
 * 3) If null → superseded/deferred; if 429 → retry scheduled; otherwise parse {url}.
 */
async function uploadImageToServer(file: File, laneKey: string, docId?: string): Promise<string | null> {
  console.log('[ImageExtension.ts][1001] Starting image upload for file:', file.name, 'DocID:', docId);

  const makeRequest = async (signal: AbortSignal, payload: any): Promise<Response> => {
    const fd = new FormData();
    fd.append('image', payload.file as File);
    
    // update - 2: Append DocID if present
    if (payload.docId) {
      fd.append('DocID', payload.docId);
    }

    return fetch('/api/asset', {
      method: 'POST',
      body: fd,
      credentials: 'include',
      signal,
    });
  };

  try {
    // update - 3: Pass docId in the payload object so makeRequest can access it
    const resp = await supersedingCall(laneKey, { file, docId }, makeRequest);

    // Superseded or deferred due to Retry-After: do not insert now (matches RichTextEditor behavior)
    if (!resp) {
      console.log('[ImageExtension.ts][1001a] Upload superseded or deferred (timer scheduled if 429).');
      return null;
    }

    if (!resp.ok) {
      if (resp.status === 429) {
        console.warn('[ImageExtension.ts][1002] Upload hit 429; retry scheduled by SupersedingCaller.');
        return null;
      }
      console.error('[ImageExtension.ts][1002] Upload failed with status:', resp.status);
      throw new Error(`Upload failed: ${resp.status}`);
    }

    const { url: serverUrl } = await resp.json();
    console.log('[ImageExtension.ts][1003] Upload successful, server URL:', serverUrl);
    return serverUrl ?? null;
  } catch (error) {
    console.error('[ImageExtension.ts][1004] Upload error:', error);
    throw error;
  }
}

/**
 * createImageUploadPlugin — update - 4
 * @purpose
 * ProseMirror plugin that:
 * • Captures drop/paste of image files.
 * • Uploads via SupersedingCaller using a per-editor lane key.
 * • Inserts <img> only when the upload returns immediately OK.
 * @steps
 * 1) On init, generate a laneKey and keep it in plugin state.
 * 2) handleDrop: collect image files, upload sequentially; insert each if URL available.
 * 3) handlePaste: same as drop with current selection position.
 * UPDATE (Phase 2): Accepts `docId` from the extension options.
 */
function createImageUploadPlugin(docId?: string) {
  type PState = { laneKey: string; docId?: string };
  const key = new PluginKey<PState>('imageUpload');

  return new Plugin<PState>({
    key,
    state: {
      init() {
        const laneKey = buildLaneKey();
        console.log('[ImageExtension.ts][1005] imageUpload laneKey =', laneKey, 'DocID context:', docId);
        return { laneKey, docId };
      },
      apply(tr, prev) {
        return prev;
      },
    },

    props: {
      // Handle drag and drop events
      handleDrop(view, event) {
        console.log('[ImageExtension.ts][1006] Drop event detected');

        const files = Array.from(event.dataTransfer?.files || []);
        const imageFiles = files.filter(f => f.type.startsWith('image/'));
        if (imageFiles.length === 0) return false;

        const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
        if (!coords) return true;

        const { schema } = view.state;
        const state = key.getState(view.state)!;
        const { laneKey, docId } = state;

        // Sequentially upload and insert; if a file’s upload is deferred/superseded, skip insertion.
        (async () => {
          for (let i = 0; i < imageFiles.length; i++) {
            const file = imageFiles[i];
            try {
              console.log('[ImageExtension.ts][1007] Processing dropped image:', file.name);
              // update - 4: Pass docId to upload function
              const serverUrl = await uploadImageToServer(file, laneKey, docId);
              if (!serverUrl) {
                console.log('[ImageExtension.ts][1007a] No URL (deferred/superseded); skipping insert.');
                continue;
              }
              const node = schema.nodes.image.create({ src: serverUrl, alt: file.name });
              const tr = view.state.tr.insert(coords.pos + i, node);
              view.dispatch(tr);
            } catch (err) {
              console.error('[ImageExtension.ts][1007b] Failed to process dropped image:', err);
            }
          }
        })();

        return true; // Prevent default drop handling
      },

      // Handle paste events
      handlePaste(view, event) {
        console.log('[ImageExtension.ts][1008] Paste event detected');

        const items = Array.from(event.clipboardData?.items || []);
        const imageItems = items.filter(it => it.type.startsWith('image/'));
        if (imageItems.length === 0) return false;

        const { from } = view.state.selection;
        const { schema } = view.state;
        const state = key.getState(view.state)!;
        const { laneKey, docId } = state;

        (async () => {
          for (let i = 0; i < imageItems.length; i++) {
            const file = imageItems[i].getAsFile();
            if (!file) continue;
            try {
              console.log('[ImageExtension.ts][1009] Processing pasted image');
              // update - 5: Pass docId to upload function
              const serverUrl = await uploadImageToServer(file, laneKey, docId);
              if (!serverUrl) {
                console.log('[ImageExtension.ts][1009a] No URL (deferred/superseded); skipping insert.');
                continue;
              }
              const node = schema.nodes.image.create({ src: serverUrl, alt: 'Pasted image' });
              const tr = view.state.tr.insert(from + i, node);
              view.dispatch(tr);
            } catch (err) {
              console.error('[ImageExtension.ts][1010] Failed to process pasted image:', err);
            }
          }
        })();

        return true; // Prevent default paste handling
      },
    },
  });
}

/**
 * ImageExtension
 * Main Tiptap node extension for handling images in rich text content.
 * Provides comprehensive image support with upload capabilities and proper HTML serialization.
 */
export const ImageExtension = Node.create<ImageOptions>({
  name: 'image',

  defaultOptions: {
    inline: false,
    allowBase64: false,
    HTMLAttributes: {
      class: 'prose-image',
    },
    docId: undefined, // update - 6: Default docId option
  },

  inline() {
    return this.options.inline;
  },

  group() {
    return this.options.inline ? 'inline' : 'block';
  },

  draggable: true,

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: element => element.getAttribute('src'),
        renderHTML: attributes => ({ src: attributes.src }),
      },
      alt: {
        default: null,
        parseHTML: element => element.getAttribute('alt'),
        renderHTML: attributes => ({ alt: attributes.alt }),
      },
      title: {
        default: null,
        parseHTML: element => element.getAttribute('title'),
        renderHTML: attributes => ({ title: attributes.title }),
      },
      width: {
        default: null,
        parseHTML: element => element.getAttribute('width'),
        renderHTML: attributes => ({ width: attributes.width }),
      },
      height: {
        default: null,
        parseHTML: element => element.getAttribute('height'),
        renderHTML: attributes => ({ height: attributes.height }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'img[src]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)];
  },

  addCommands() {
    return {
      setImage: options => ({ commands }) => {
        console.log('[ImageExtension.ts][1011] Setting image with options:', options);
        return commands.insertContent({
          type: this.name,
          attrs: options,
        });
      },
    };
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: /!\[(.+|:?)\]\((\S+)(?:(?:\s+)["'](\S+)["'])?\)/,
        type: this.type,
        getAttributes: match => {
          const [, alt, src, title] = match;
          return { src, alt, title };
        },
      }),
    ];
  },

  addProseMirrorPlugins() {
    // ✨ update - 7: Pass docId from options to the upload plugin
    return [createImageUploadPlugin(this.options.docId)];
  },
});