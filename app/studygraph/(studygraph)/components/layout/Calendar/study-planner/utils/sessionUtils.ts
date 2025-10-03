// src/services/study-planner/utils/sessionUtils.ts
/**
 * @file sessionUtils.ts
 * @description
 * [Responsibility & Scope]
 * Session utilities create consistent, calendar-ready metadata for StudySession objects
 * and provide stable identifiers and titles. This module avoids repetition across the
 * schedulers by centralizing: ID generation, human-readable titles, duration estimates,
 * topic extraction, and metadata assembly. All functions are pure (no I/O or mutation).
 * Logs are intentionally sparse and appear only at important checkpoints to expose state
 * transitions in production debugging. Complexity is O(1) or O(N) with small N arrays.
 */

import type {
  StudySession,
  NotebookMeta,
  LessonUnit,
} from '@/app/Library/Definitions/CalendarDefinitions';
import type { Lesson, LessonChunk } from '../models/Lesson';
import {
  DEFAULT_CHUNK_SIZE,
  ESTIMATED_MINUTES_PER_UNIT,
  REVISION_BLOCK_DURATION_MULTIPLIER,
  INTERLEAVED_SESSION_MINUTES,
  ID_PREFIX,
} from '../constants/schedulingConstants';
import type { SessionType } from '../types';

/** Internal shape used to populate session.metadata consistently across the app. */
// update - 1
export interface SessionMetadata {
  /** Human-readable session title for display */
  sessionTitle: string;
  /** Estimated duration in minutes (matches StudySession.metadata) */
  estimatedDuration: number;
  /** Array of topic titles for quick reference (always present) */
  topicTitles: string[];
  /** Optional fields retained for richer UI, but not required by StudySession */
  unitCount?: number;
  chunkIndex?: number;
  totalChunks?: number;
}

/**
 * @function generateSessionId
 * @description
 * Produces a compact, time-sortable ID using time and randomness. IDs carry a semantic
 * prefix to aid log filtering and analytics. This function is collision resistant for
 * practical volumes in client apps and costs O(1).
 */
export function generateSessionId(): string {
  const loc = 'utils/sessionUtils.ts#1058';
  const rand = Math.floor(Math.random() * 36 ** 6).toString(36).toUpperCase();
  const time = Date.now().toString(36).toUpperCase();
  const id = `${ID_PREFIX.SESSION}-${time}-${rand}`;
  // eslint-disable-next-line no-console
  console.log(`[${loc}] generateSessionId -> ${id}`);
  return id;
}

/**
 * @function buildSessionTitle
 * @description
 * Creates a human-readable title such as "Biology — Algebra Basics (Units 1–3) [Block]".
 * Titles are stable and include the notebook name, lesson, covered unit range, and the
 * session type label for clarity when rendered in calendar UIs.
 */
export function buildSessionTitle(
  notebook: NotebookMeta,
  lesson: Lesson,
  chunk: LessonChunk,
  type: SessionType
): string {
  const first = (chunk.units[0] as any).LessonOrder ?? 1;
  const last = (chunk.units[chunk.units.length - 1] as any).LessonOrder ?? first;
  const typeLabel = type === 'block'
    ? 'Block'
    : type === 'revision-block'
    ? 'Revision (Block)'
    : 'Revision (Interleaved)';
  return `${notebook.fileName} — ${lesson.title} (Units ${first}–${last}) [${typeLabel}]`;
}

/**
 * @function calculateEstimatedDuration
 * @description
 * Estimates minutes for a session. Learning blocks scale with unit count. Block revisions
 * are slightly shorter by multiplier. Interleaved revisions use a pragmatic fixed length to
 * reflect mixed content without predictable unit counts.
 */
export function calculateEstimatedDuration(
  unitCount: number,
  type: SessionType
): number {
  if (type === 'block') return unitCount * ESTIMATED_MINUTES_PER_UNIT;
  if (type === 'revision-block') return Math.round(unitCount * ESTIMATED_MINUTES_PER_UNIT * REVISION_BLOCK_DURATION_MULTIPLIER);
  return INTERLEAVED_SESSION_MINUTES;
}

/**
 * @function extractTopicTitles
 * @description
 * Pulls conceptNodeTitle fields from units for lightweight, user-visible summaries. The
 * function tolerates missing fields by filtering falsy values.
 */
export function extractTopicTitles(units: LessonUnit[]): string[] {
  const titles = units.map(u => (u as any).conceptNodeTitle as string).filter(Boolean);
  return titles.length ? titles : [];
}

/**
 * @function createSessionMetadata
 * @description
 * Builds a consistent metadata object to attach to StudySession.metadata. It includes a
 * title, estimated duration, chunk indexing for progress UI, and topic titles for tooltips.
 * The returned shape matches the StudySession.metadata contract to avoid type mismatches.
 */
// update - 2
export function createSessionMetadata(
  notebook: NotebookMeta,
  lesson: Lesson,
  chunk: LessonChunk,
  type: SessionType
): SessionMetadata {
  const loc = 'utils/sessionUtils.ts#4412';
  const unitCount = chunk.units.length || DEFAULT_CHUNK_SIZE;

  const meta: SessionMetadata = {
    sessionTitle: buildSessionTitle(notebook, lesson, chunk, type),
    estimatedDuration: calculateEstimatedDuration(unitCount, type), // update - 3
    topicTitles: extractTopicTitles(chunk.units),                   // update - 4
    unitCount,
    chunkIndex: chunk.chunkIndex,
    totalChunks: chunk.totalChunks,
  };

  // eslint-disable-next-line no-console
  console.log(
    `[${loc}] createSessionMetadata -> ${JSON.stringify({
      unitCount,
      type,
      chunk: `${chunk.chunkIndex + 1}/${chunk.totalChunks}`,
      estimatedDuration: meta.estimatedDuration,                   // update - 5
    })}`
  );
  return meta;
}
