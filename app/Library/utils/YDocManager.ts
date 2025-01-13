// src/utils/YDocManager.ts

/**
 * @file YDocManager.ts
 * @description
 *  Manages a singleton Y.Doc for the entire concept map.
 *  Encodes/decodes the Y.js updates for saving/loading.
 *
 * Dependencies:
 *  import * as Y from 'yjs';
 */

import * as Y from 'yjs';

let ydoc: Y.Doc | null = null;

/**
 * Initialize the Y.Doc if not already present.
 * @returns {Y.Doc} The shared Y.Doc instance.
 */
export function getOrCreateYDoc(): Y.Doc {
  if (!ydoc) {
    ydoc = new Y.Doc();
    console.log('Y.Doc instance created.');
  } else {
    console.log('Y.Doc instance already exists.');
  }
  return ydoc;
}

/**
 * Encode the entire Y.Doc state as a binary update.
 * @returns {Uint8Array} The binary representation of the current Y.Doc state.
 */
export function encodeDocState(): Uint8Array {
  if (!ydoc) {
    throw new Error('Y.Doc is not initialized. Call getOrCreateYDoc() first.');
  }
  const update = Y.encodeStateAsUpdate(ydoc);
  console.log('Y.Doc state encoded.');
  return update;
}

/**
 * Apply a binary update to the Y.Doc.
 * @param update - A Uint8Array representing Y.js changes.
 */
export function applyDocUpdate(update: Uint8Array): void {
  if (!ydoc) {
    throw new Error('Y.Doc is not initialized. Call getOrCreateYDoc() first.');
  }
  Y.applyUpdate(ydoc, update);
  console.log('Y.Doc update applied.');
}

/**
 * Optional: Function to listen for local changes and log them.
 * Useful for debugging purposes.
 */
export function observeDoc(): void {
  if (!ydoc) {
    throw new Error('Y.Doc is not initialized. Call getOrCreateYDoc() first.');
  }
  ydoc.on('update', (update: Uint8Array) => {
    console.log('Local Y.Doc update detected:', update);
  });
}
