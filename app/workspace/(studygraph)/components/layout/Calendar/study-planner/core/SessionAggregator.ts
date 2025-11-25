/**
 * @file SessionAggregator.ts
 * @description
 * [Responsibility & Scope]
 * This module provides a small, focused utility to assemble the final set of daily sessions
 * from heterogeneous sources: block learning, block revision, and interleaved revision. It
 * enforces the canonical ordering (learning → revision-block → revision-interleaved) and
 * opportunistically enriches sessions with display metadata when sufficient context is
 * present on the session object (e.g., attached notebook/lesson/chunk). The aggregator is
 * intentionally conservative—if enrichment prerequisites are missing, it leaves the session
 * untouched to avoid accidental shape assumptions. It emits concise logs capturing input
 * counts and output totals to support observability in production. All operations are O(N)
 * where N is the total sessions aggregated for the given date, with no side effects.
 */

import type { StudySession, NotebookMeta } from '@/app/Library/Definitions/CalendarDefinitions';
import type { Lesson, LessonChunk } from '../models/Lesson';
import { createSessionMetadata } from '../utils/sessionUtils';

/**
 * @function aggregateSessions
 * @description
 * Combines and orders sessions for a given date. It concatenates the block learning,
 * block revision, and interleaved arrays in a stable order and attempts metadata
 * enrichment when a session carries enough context (notebook, lesson, chunk, and type).
 * The function does not mutate the provided arrays; it always returns a new array.
 * Logging captures pre/post counts in a single line to aid triage without noise.
 */
export function aggregateSessions(
  date: Date,
  blockLearningSessions: StudySession[],
  blockRevisionSessions: StudySession[],
  interleavedSessions: StudySession[]
): StudySession[] {
  const loc = 'core/SessionAggregator.ts#8144';

  const merged: StudySession[] = [
    ...blockLearningSessions,
    ...blockRevisionSessions,
    ...interleavedSessions,
  ].map((s) => enrichSessionMetadata(s));

  // eslint-disable-next-line no-console
  console.log(
    `[${loc}] aggregateSessions -> PASS date=${date.toISOString()} counts={block:${blockLearningSessions.length},rev:${blockRevisionSessions.length},il:${interleavedSessions.length}} total=${merged.length}`
  );

  return merged;
}

/**
 * @function enrichSessionMetadata
 * @description
 * Opportunistically attaches display metadata to a session. If the session includes a
 * notebook reference, a lesson reference, and a chunk reference (as produced by upstream
 * schedulers), this function synthesizes a consistent metadata object (title, estimated
 * minutes, topics, and progress indices). If the fields are absent, the session is
 * returned unchanged. This defensive approach prevents assumptions about external shapes
 * while still enabling rich calendar rendering when context exists. Runs in O(1).
 */
function enrichSessionMetadata(session: StudySession): StudySession {
  const loc = 'core/SessionAggregator.ts#8392';
  const anySession = session as unknown as {
    notebook?: NotebookMeta;
    lesson?: Lesson;
    chunk?: LessonChunk;
    type?: 'block' | 'revision-block' | 'revision-interleaved';
    metadata?: unknown;
  };

  if (anySession.notebook && anySession.lesson && anySession.chunk && anySession.type) {
    try {
      const meta = createSessionMetadata(
        anySession.notebook,
        anySession.lesson,
        anySession.chunk,
        anySession.type
      );
      const enriched = { ...session, metadata: meta } as StudySession;
      // eslint-disable-next-line no-console
      console.log(`[${loc}] enrich -> PASS id=${(session as any).id ?? 'unknown'}`);
      return enriched;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(`[${loc}] enrich -> FAIL id=${(session as any).id ?? 'unknown'} reason=${(err as Error).message}`);
      return session;
    }
  }

  // eslint-disable-next-line no-console
  console.log(`[${loc}] enrich -> SKIP id=${(session as any).id ?? 'unknown'} (insufficient context)`);
  return session;
}
