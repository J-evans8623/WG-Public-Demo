/**
 * @file lessonExtractionService.ts
 * @description
 *   Backend-only, production-grade service that extracts normalized lesson data from a document’s
 *   Yjs state where **each concept map corresponds to one lesson**. This module provides:
 *     (1) A modern Yjs bytes decoder and schema-aware traversal that enumerates concept maps
 *         (aka lessons), then iterates their nodes and aggregates only "note" resources into
 *         newline-joined topic bodies. It is resilient to mild schema drift (per-node keyed
 *         resources vs. flat lists with nodeId) and uses safe fallbacks for titles.
 *     (2) Two families of entry points:
 *         • Legacy single-lesson entry points: `extractFromBytes(bytes)` and
 *           `extractFromDocId(docId)` return the **first concept map** found. These remain
 *           for backward compatibility but should be avoided for multi-lesson workflows.
 *         • New multi-lesson entry points: `extractLessonsFromBytes(bytes, opts?)` and
 *           `extractLessonsFromDocId(docId, opts?)` that return one or more **explicit lessons**
 *           selected by `mapIds`. If `mapIds` is omitted, they return **all lessons** in the doc.
 *     (3) Integration-ready results that include the `lessonId` (concept map id), a clear
 *         `lessonTitle` sourced from the concept map title (not the module title), and
 *         normalized `topics` ({ topicTitle, topicContent }) arrays.
 *     (4) Low-noise, file-tagged console logs with unique 4-digit codes at key checkpoints
 *         for observability (decode success, map selection, counts, and error paths).
 *
 *   Time & Space:
 *     - Let L be the number of lessons (concept maps), N the total nodes across the selected lessons,
 *       and R the total resources scanned. Decoding is O(1) relative to doc size; traversal is O(L + N + R).
 *       Lookups in Y.Map/Y.Array are O(1) average; resource association is O(1) if per-node keyed,
 *       O(R) worst-case if flat filtering is necessary. Memory is proportional to the size of the
 *       selected topic texts we materialize.
 *
 *   Notes:
 *     - **Caching**: `extractLessonsFromDocId` uses the generation-aware read-through cache
 *       (`readDocBytesCached`) added in Phase 3. On cache miss (or Redis failure), the loader
 *       downloads directly from Firebase Storage (fail-open) — no extra action required.
 *     - This module is server-only; do not import it into browser bundles.
 */

import * as Y from 'yjs';
import { readDocBytesCached } from '@/app/src/services/redisCache/docCache'; // update - 1

/* ========================================================================== *
 * Types & Error Taxonomy
 * ========================================================================== */

export interface LessonExtraction {
  /** Concept map id (the lesson identifier) */
  lessonId: string;
  /** Title of the specific lesson (concept map title, not the module title) */
  lessonTitle: string;
  /** Topics for this lesson, aggregated from node-level note resources */
  topics: { topicTitle: string; topicContent: string }[];
}

export class UnprocessableBytesError extends Error {
  public code = 'UNPROCESSABLE_BYTES';
  constructor(message = 'Bytes are not a valid modern Yjs update') {
    super(message);
    this.name = 'UnprocessableBytesError';
  }
}

export class DocNotFoundError extends Error {
  public code = 'DOC_NOT_FOUND';
  constructor(message = 'Document not found or not readable') {
    super(message);
    this.name = 'DocNotFoundError';
  }
}

export interface ExtractOpts {
  /** Optional filter of concept-map ids (lessons) to include. Omit → include all lessons. */
  mapIds?: string[];
}

/* ========================================================================== *
 * Public API (New multi-lesson surface)                                       update - 2
 * ========================================================================== */

/**
 * extractLessonsFromBytes
 * @description
 *   Decodes Yjs bytes, enumerates concept maps (lessons), filters by `opts.mapIds` if provided,
 *   and returns an array of normalized lessons. Each result has { lessonId, lessonTitle, topics }.
 *   This is the recommended entry for multi-lesson scenarios and is used by the docId wrapper.
 *   Errors: throws UnprocessableBytesError on invalid bytes. Complexity: O(L + N + R).
 */
export function extractLessonsFromBytes(bytes: Uint8Array, opts?: ExtractOpts): LessonExtraction[] { // update - 2
  // [1] Decode Y.Doc
  const ydoc = new Y.Doc();
  try {
    Y.applyUpdate(ydoc, bytes);
    // eslint-disable-next-line no-console
    console.log('lessonExtractionService.ts [7501] › Yjs decode OK (bytes length)', bytes?.byteLength ?? 0);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('lessonExtractionService.ts [7591] › Yjs decode failed', e);
    throw new UnprocessableBytesError();
  }

  // [2] Read module root and concept maps
  const lessonModule = ydoc.getMap<any>('lessonModule');
  const cmArr = (lessonModule?.get?.('conceptMaps') as Y.Array<any> | undefined) ?? undefined;
  const allMaps = Array.isArray(cmArr?.toArray?.()) ? (cmArr!.toArray() as any[]) : [];
  // eslint-disable-next-line no-console
  console.log('lessonExtractionService.ts [7502] › total conceptMaps', allMaps.length);

  // [3] Compute selection
  const requested = normalizeIds(opts?.mapIds);
  const selectedMaps = requested.length === 0
    ? allMaps
    : allMaps.filter(m => requested.includes(safeId(m?.id)));

  // eslint-disable-next-line no-console
  console.log('lessonExtractionService.ts [7503] › selected maps', {
    requestedCount: requested.length,
    selectedCount: selectedMaps.length,
    selectedIds: selectedMaps.map(m => m?.id),
  });

  // [4] Build results per selected concept map (lesson)
  const results: LessonExtraction[] = [];
  for (const cm of selectedMaps) {
    const mapId = safeId(cm?.id) || 'default';
    const lessonTitle = safeString(cm?.title) || 'Unnamed Lesson';
    const topics = collectTopicsForMap(ydoc, mapId);
    results.push({ lessonId: mapId, lessonTitle, topics });
  }

  // [5] Return normalized lessons
  // eslint-disable-next-line no-console
  console.log('lessonExtractionService.ts [7504] › extraction complete', {
    returnedLessons: results.length,
    totalTopics: results.reduce((a, b) => a + b.topics.length, 0),
  });
  return results;
}

/**
 * extractLessonsFromDocId
 * @description
 *   Cached docId wrapper for multi-lesson extraction. Fetches the document bytes using the
 *   generation-aware cache (`readDocBytesCached`), then delegates to `extractLessonsFromBytes`.
 *   If the doc is missing, throws DocNotFoundError. Complexity adds O(1) beyond IO and O(L+N+R)
 *   for traversal. This is the **preferred** docId API for AI pipelines (e.g., quiz generation).
 */
export async function extractLessonsFromDocId(docId: string, opts?: ExtractOpts): Promise<LessonExtraction[]> { // update - 2
  try {
    const bytes = await readDocBytesCached(docId);
    // eslint-disable-next-line no-console
    console.log('lessonExtractionService.ts [7601] › cached bytes OK', { docId, length: bytes.byteLength });
    return extractLessonsFromBytes(bytes, opts);
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (msg.includes('No such object') || msg.includes('404') || msg.includes('not exist') || e?.code === 'DOC_NOT_FOUND') {
      // eslint-disable-next-line no-console
      console.error('lessonExtractionService.ts [7691] › DOC_NOT_FOUND', { docId });
      throw new DocNotFoundError();
    }
    // eslint-disable-next-line no-console
    console.error('lessonExtractionService.ts [7692] › unexpected error', { docId, err: msg });
    throw e;
  }
}

/* ========================================================================== *
 * Backward-compatible single-lesson wrappers                                  update - 3
 * ========================================================================== */

/**
 * extractFromBytes (legacy)
 * @description
 *   Legacy single-lesson wrapper that returns the **first** concept map as one lesson. Kept for
 *   backward compatibility; new callers should prefer `extractLessonsFromBytes`. If the doc has
 *   no maps, returns an empty single lesson with zero topics (lessonId "default").
 */
export function extractFromBytes(bytes: Uint8Array): LessonExtraction { // update - 3
  const lessons = extractLessonsFromBytes(bytes);
  return lessons[0] ?? { lessonId: 'default', lessonTitle: 'Unnamed Lesson', topics: [] };
}

/**
 * extractFromDocId (legacy)
 * @description
 *   Legacy single-lesson wrapper that returns the **first** concept map in the doc. New code
 *   should use `extractLessonsFromDocId(docId, { mapIds: [...] })` to target one or more lessons.
 */
export async function extractFromDocId(docId: string): Promise<LessonExtraction> { // update - 3
  const lessons = await extractLessonsFromDocId(docId);
  return lessons[0] ?? { lessonId: 'default', lessonTitle: 'Unnamed Lesson', topics: [] };
}

/* ========================================================================== *
 * Private helpers                                                             update - 4
 * ========================================================================== */

/**
 * collectTopicsForMap
 * @description
 *   Reads nodes and resources for a specific concept map (identified by `mapId`) and returns
 *   topic rows with note-only content joined by newlines. Supports both per-node keyed arrays
 *   and flat resource maps with `nodeId`. Complexity is O(N + R_mapScope).
 */
function collectTopicsForMap(ydoc: Y.Doc, mapId: string): { topicTitle: string; topicContent: string }[] { // update - 4
  const nodesKey = `nodes:${mapId}`;
  const resourcesKey = `resources:${mapId}`;
  const nodesMap = ydoc.getMap<any>(nodesKey);
  const resMap = ydoc.getMap<any>(resourcesKey);

  // eslint-disable-next-line no-console
  console.log('lessonExtractionService.ts [7701] › map traversal', { mapId, nodes: nodesMap?.size ?? 0, resources: resMap?.size ?? 0 });

  const topics: { topicTitle: string; topicContent: string }[] = [];

  for (const [nodeId, nodeVal] of nodesMap) {
    const topicTitle = safeString(nodeVal?.title) || 'Unnamed Topic';
    let noteTexts: string[] = [];

    // Per-node keyed array
    const perNode = resMap?.get?.(nodeId);
    if (Array.isArray(perNode)) {
      noteTexts = extractNotesFromArray(perNode);
    } else {
      // Flat scan of resources in this map scope
      for (const [_rid, rVal] of resMap) {
        if (!rVal) continue;
        const belongs = (rVal.nodeId ?? rVal.nodeID) === nodeId;
        if (!belongs) continue;
        if (isNoteResource(rVal)) {
          const text = coerceNoteText(rVal);
          if (text) noteTexts.push(text);
        }
      }
    }
    topics.push({ topicTitle, topicContent: joinNoteTexts(noteTexts) });
  }

  return topics;
}

function safeString(v: any): string {
  return typeof v === 'string' ? v.trim() : '';
}
function safeId(v: any): string {
  return typeof v === 'string' ? v.trim() : '';
}
function normalizeIds(ids?: string[]): string[] {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  return ids.map(safeId).filter(Boolean);
}
function isNoteResource(r: any): boolean {
  const t = safeString(r?.type).toLowerCase();
  return t === 'note';
}
function coerceNoteText(r: any): string {
  return safeString(r?.text) || safeString(r?.content) || safeString(r?.body);
}
function extractNotesFromArray(arr: any[]): string[] {
  const out: string[] = [];
  for (const r of arr) {
    if (!isNoteResource(r)) continue;
    const text = coerceNoteText(r);
    if (text) out.push(text);
  }
  return out;
}
function joinNoteTexts(notes: string[]): string {
  if (!Array.isArray(notes) || notes.length === 0) return '';
  return notes.join('\n');
}
