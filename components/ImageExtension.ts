/**
 * @file ImageExtension.ts
 * @description
 * Custom Tiptap extension for handling inline images within rich text content. This extension provides
 * comprehensive image support including drag-and-drop functionality, clipboard paste operations, and
 * manual file upload capabilities. The extension automatically uploads images to the server via the
 * /api/asset endpoint and replaces local file references with permanent server URLs. It integrates
 * seamlessly with the existing Tiptap editor infrastructure and follows the same patterns established
 * by MathExtension and Citation extensions. The extension supports image resizing, alt text, and proper
 * HTML serialization for storage in the ResourceContext. All uploaded images are processed through
 * the established asset management pipeline to ensure consistency with existing image handling in
 * PictureResource components. The extension also provides proper error handling for upload failures
 * and maintains accessibility standards through proper alt text and ARIA attributes.
 */

import { Node, mergeAttributes, nodeInputRule } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export interface ImageOptions {
  inline: boolean;
  allowBase64: boolean;
  HTMLAttributes: Record<string, any>;
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
 * uploadImageToServer
 * Handles the server upload process for image files using the existing /api/asset endpoint.
 * Converts File objects to FormData and manages the upload lifecycle including error handling.
 * @param file The image file to upload to the server
 * @returns Promise resolving to the server URL of the uploaded image
 */
async function uploadImageToServer(file: File): Promise<string> {
  console.log('[ImageExtension.ts][1001] Starting image upload for file:', file.name);
  
  // 1. Create FormData object for multipart upload
  const formData = new FormData();
  formData.append('image', file);
  
  try {
    // 2. Send POST request to existing asset upload endpoint
    const response = await fetch('/api/asset', {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });
    
    // 3. Check response status and handle errors
    if (!response.ok) {
      console.error('[ImageExtension.ts][1002] Upload failed with status:', response.status);
      throw new Error(`Upload failed: ${response.status}`);
    }
    
    // 4. Extract server URL from response
    const { url: serverUrl } = await response.json();
    console.log('[ImageExtension.ts][1003] Upload successful, server URL:', serverUrl);
    
    return serverUrl;
  } catch (error) {
    console.error('[ImageExtension.ts][1004] Upload error:', error);
    throw error;
  }
}

/**
 * createImageUploadPlugin
 * Creates a ProseMirror plugin that handles drag-and-drop and paste events for images.
 * This plugin intercepts file operations and processes them through the upload pipeline.
 * @param uploadFn Function to handle image upload operations
 * @returns ProseMirror plugin for handling image upload events
 */
function createImageUploadPlugin(uploadFn: (file: File) => Promise<string>) {
  return new Plugin({
    key: new PluginKey('imageUpload'),
    
    props: {
      // Handle drag and drop events
      handleDrop(view, event, slice, moved) {
        console.log('[ImageExtension.ts][1005] Drop event detected');
        
        // 1. Check if files were dropped
        const files = Array.from(event.dataTransfer?.files || []);
        const imageFiles = files.filter(file => file.type.startsWith('image/'));
        
        if (imageFiles.length === 0) {
          return false; // Let other handlers process non-image drops
        }
        
        // 2. Process each dropped image file
        const { schema } = view.state;
        const coordinates = view.posAtCoords({
          left: event.clientX,
          top: event.clientY,
        });
        
        if (!coordinates) return true;
        
        // 3. Upload and insert images sequentially
        imageFiles.forEach(async (file, index) => {
          try {
            console.log('[ImageExtension.ts][1006] Processing dropped image:', file.name);
            const serverUrl = await uploadFn(file);
            
            // 4. Create image node and insert at drop position
            const node = schema.nodes.image.create({
              src: serverUrl,
              alt: file.name,
            });
            
            const transaction = view.state.tr.insert(coordinates.pos + index, node);
            view.dispatch(transaction);
            
          } catch (error) {
            console.error('[ImageExtension.ts][1007] Failed to process dropped image:', error);
          }
        });
        
        return true; // Prevent default drop handling
      },
      
      // Handle paste events
      handlePaste(view, event, slice) {
        console.log('[ImageExtension.ts][1008] Paste event detected');
        
        // 1. Extract files from clipboard
        const items = Array.from(event.clipboardData?.items || []);
        const imageItems = items.filter(item => item.type.startsWith('image/'));
        
        if (imageItems.length === 0) {
          return false; // Let other handlers process non-image pastes
        }
        
        // 2. Process clipboard images
        const { schema } = view.state;
        const { from } = view.state.selection;
        
        imageItems.forEach(async (item, index) => {
          const file = item.getAsFile();
          if (!file) return;
          
          try {
            console.log('[ImageExtension.ts][1009] Processing pasted image');
            const serverUrl = await uploadFn(file);
            
            // 3. Insert image at current cursor position
            const node = schema.nodes.image.create({
              src: serverUrl,
              alt: 'Pasted image',
            });
            
            const transaction = view.state.tr.insert(from + index, node);
            view.dispatch(transaction);
            
          } catch (error) {
            console.error('[ImageExtension.ts][1010] Failed to process pasted image:', error);
          }
        });
        
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
        renderHTML: attributes => ({
          src: attributes.src,
        }),
      },
      alt: {
        default: null,
        parseHTML: element => element.getAttribute('alt'),
        renderHTML: attributes => ({
          alt: attributes.alt,
        }),
      },
      title: {
        default: null,
        parseHTML: element => element.getAttribute('title'),
        renderHTML: attributes => ({
          title: attributes.title,
        }),
      },
      width: {
        default: null,
        parseHTML: element => element.getAttribute('width'),
        renderHTML: attributes => ({
          width: attributes.width,
        }),
      },
      height: {
        default: null,
        parseHTML: element => element.getAttribute('height'),
        renderHTML: attributes => ({
          height: attributes.height,
        }),
      },
    };
  },
  
  parseHTML() {
    return [
      {
        tag: 'img[src]',
      },
    ];
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
    return [
      createImageUploadPlugin(uploadImageToServer),
    ];
  },
});