// File: subDocExtractor.ts

/***********************************************************************************************
 * @file subDocExtractor.ts
 * @description
 *   Responsible for extracting a minimal, self-contained Yjs document (a “sub-doc”) that
 *   contains only the data for a single concept map, identified by its `mapId`. This helper
 *   builds a fresh `Y.Doc`, copies exactly:
 *     • The single entry in `lessonModule.conceptMaps` matching `mapId`.
 *     • The namespaced maps `nodes:{mapId}`, `resources:{mapId}`, **and** `subtrees:{mapId}`.
 *     • Minimal metadata fields (`author`, `timestamp`) from the root metadata map.
 *   It then returns a compressed binary update via `Y.encodeStateAsUpdate`. This enables
 *   per-map snapshots in the new version-history service without touching the existing
 *   full-document autosave. Purposeful console.log statements with unique codes trace
 *   invocation, key steps, and output size for debugging.
 *
 * Responsibilities:
 *   - Provide a single exported function `extractSubDoc`.
 *   - Ensure only the specified data is included—no bleed-through of other Yjs keys.
 *   - Copy subtree layout data so that node positions are preserved on replay.
 *   - Log entry, intermediate state checks, and resulting payload size.
 *   - Facilitate lightweight, on-demand per-map version snapshots.
 *
 ***********************************************************************************************/
import * as Y from 'yjs';

export function extractSubDoc(sourceYdoc: Y.Doc, mapId: string): Uint8Array {
  console.log('subDocExtractor.ts 5001 › extractSubDoc called for mapId=', mapId);

  const tempDoc = new Y.Doc();

  // 1) Copy just the one conceptMap entry
  const srcLessonModule = sourceYdoc.getMap('lessonModule');
  const srcConceptMaps = srcLessonModule.get('conceptMaps') as Y.Array<any>;
  const targetLessonModule = tempDoc.getMap('lessonModule');
  const newConceptMaps = new Y.Array<any>();

  const allMaps = srcConceptMaps.toArray();
  console.log(
    'subDocExtractor.ts 5002 › all conceptMaps:',
    allMaps.map((cm: any) => cm.id),
    allMaps
  );

  const entry = allMaps.find((cm: any) => cm.id === mapId);
  if (entry) {
    newConceptMaps.push([entry]);
    targetLessonModule.set('conceptMaps', newConceptMaps);
    console.log('subDocExtractor.ts 5003 › Copied lessonModule.conceptMaps entry for', mapId);
  } else {
    console.warn('subDocExtractor.ts 5004 › No conceptMap found for', mapId);
  }

  // 2) Copy namespaced nodes & resources
  ['nodes', 'resources'].forEach(ns => {
    const key = `${ns}:${mapId}`;
    const srcOuter = sourceYdoc.getMap<any>(key);
    const dstOuter = tempDoc.getMap<any>(key);

    srcOuter.forEach((value, k) => {
      if (value instanceof Y.Map) {
        // deep-clone inner map
        const innerClone = new Y.Map();
        value.forEach((v, ik) => innerClone.set(ik, v));
        dstOuter.set(k, innerClone);
      } else {
        dstOuter.set(k, value);
      }
    });

    console.log(`subDocExtractor.ts 5005 › Copied ${key} entries:`, dstOuter.size);
  });

  // 3) Copy subtree layout data for this map
  const subtreesKey = `subtrees:${mapId}`;
  const srcSubtrees = sourceYdoc.getMap<any>(subtreesKey);
  const dstSubtrees = tempDoc.getMap<any>(subtreesKey);

  srcSubtrees.forEach((value, nodeId) => {
    dstSubtrees.set(nodeId, value);
  });
  console.log(
    `subDocExtractor.ts 5007 › Copied ${subtreesKey} entries:`,
    dstSubtrees.size
  );

  // 4) Copy minimal metadata fields
  const srcMeta = sourceYdoc.getMap('metadata');
  const dstMeta = tempDoc.getMap('metadata');
  ['author', 'timestamp'].forEach(field => {
    if (srcMeta.has(field)) {
      dstMeta.set(field, srcMeta.get(field));
      console.log(`subDocExtractor.ts 5008 › Copied metadata.${field}`);
    }
  });

  // 5) Encode and return the update
  const update = Y.encodeStateAsUpdate(tempDoc);
  console.log('subDocExtractor.ts 5009 › extractSubDoc produced update byteLength=', update.byteLength);
  return update;
}
