/**
 * @file LessonParser.ts
 * @description
 * [Responsibility & Scope]
 * This module converts raw notebook lesson units into stable, scheduler-friendly lesson
 * structures and provides chunking utilities to derive session-sized slices. Parsing is
 * deterministic and enforces canonical ordering by LessonOrder, ensuring that downstream
 * schedulers and progress trackers operate on consistent data across runs. The parser
 * groups units into logical lessons by (parentTitle, mapID), generates stable identifiers
 * using a lightweight hash, precomputes chunk counts based on the configured default size,
 * and produces LessonChunk arrays that represent the atomic units of work for block
 * learning and block revision. All operations are pure and linear time O(N) with respect
 * to the number of lesson units processed, and include concise logs for observability.
 */

import type { NotebookMeta, LessonUnit } from '@/app/Library/Definitions/CalendarDefinitions';
import type { Lesson, LessonChunk } from '../models/Lesson';
import {
  groupUnitsByLesson,
  sortUnits,
  generateLessonId,
  calculateChunkCount,
} from '../utils/lessonUtils';
import { DEFAULT_CHUNK_SIZE } from '../constants/schedulingConstants';

/**
 * @function parseLessons
 * @description
 * Extracts logical lessons from a notebook by grouping its lessonUnits via the canonical
 * grouping strategy (parentTitle + mapID), sorting each group by LessonOrder, and creating
 * Lesson records with stable IDs and precomputed chunk counts. This routine is purely
 * transformational and does not mutate the notebook. It throws only if the underlying
 * validation in lessonUtils detects malformed units. Time complexity is O(U log U) worst
 * case due to sorting per lesson, where U is total units; in practice lessons are small.
 */
export function parseLessons(notebook: NotebookMeta): Lesson[] {
  const loc = 'core/LessonParser.ts#6721';
  const units: LessonUnit[] = (notebook as any).lessonUnits ?? [];
  const grouped = groupUnitsByLesson(units); // O(U)
  const out: Lesson[] = [];

  for (const [compoundKey, rawUnits] of grouped.entries()) {
    const [title, mapID = 'nomap'] = compoundKey.split('#');
    const ordered = sortUnits(rawUnits); // O(M log M), small M per lesson
    const id = generateLessonId(title, mapID);
    const chunkCount = calculateChunkCount(ordered.length, DEFAULT_CHUNK_SIZE);

    out.push({
      id,
      title,
      mapID,
      units: ordered,
      chunkCount,
    });
  }

  // eslint-disable-next-line no-console
  console.log(`[${loc}] parseLessons -> PASS notebook=${notebook.fileName} lessons=${out.length}`);
  return out;
}

/**
 * @function chunkLesson
 * @description
 * Splits a Lesson’s ordered units into session-sized chunks. The chunk size defaults to
 * DEFAULT_CHUNK_SIZE (typically three units) but can be overridden for testing. The result
 * preserves order and annotates each chunk with index and total count for UI progress bars
 * and robust progress tracking. Runs in linear time O(U) over the number of units with no
 * intermediate mutations. Throws nothing—callers should validate lesson data upstream.
 */
export function chunkLesson(lesson: Lesson, chunkSize: number = DEFAULT_CHUNK_SIZE): LessonChunk[] {
  const loc = 'core/LessonParser.ts#7334';

  const size = Math.max(1, Math.floor(chunkSize));
  const chunks: LessonChunk[] = [];
  const totalChunks = calculateChunkCount(lesson.units.length, size);

  for (let i = 0; i < lesson.units.length; i += size) {
    const units = lesson.units.slice(i, i + size);
    const chunkIndex = Math.floor(i / size);
    chunks.push({
      units,
      chunkIndex,
      totalChunks,
    });
  }

  // eslint-disable-next-line no-console
  console.log(
    `[${loc}] chunkLesson -> PASS lesson=${lesson.title} units=${lesson.units.length} chunks=${chunks.length} size=${size}`
  );
  return chunks;
}
