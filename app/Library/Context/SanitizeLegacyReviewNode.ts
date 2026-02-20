/**
 * @file SanitizeLegacyReviewNode.ts
 * @description
 * This file implements the **SanitizeLegacyReviewNode utility**, which serves as the primary data hygiene 
 * controller for the BloomMap study planning system. Its core responsibility is to provide a pure, 
 * deterministic function that deep-cleans study session arrays by removing any references to the 
 * hardcoded 'reviewNode' ID. This architectural separation ensures that the complex logic required 
 * to "heal" legacy production data—including the surgical removal of units from mixed sessions 
 * and the subsequent pruning of sessions that become empty—is kept distinct from the React context 
 * and scheduling services. Importantly, this targeted implementation includes a type-safety guard 
 * to ensure that 'revision-interleaved' sessions, which represent lesson-wide mastery flows, are 
 * preserved even if their unit arrays are empty or structured differently. This utility facilitates 
 * a "Heal-on-Load" strategy that cleanses persisted data as it enters the application state.
 */

import { StudySession } from '@/app/Library/Definitions/CalendarDefinitions';

/**
 * sanitizeStudySessions
 * @description
 * Processes an array of study sessions to surgically remove the 'reviewNode' sentinel ID.
 * The function implements a type-aware filter: it only sanitizes 'block' and 'revision-block' 
 * sessions, as these are the only types where node-specific ID references are mandatory. 
 * 'revision-interleaved' sessions are ignored by the sanitizer to prevent regression.
 */
export const sanitizeStudySessions = (sessions: StudySession[]): StudySession[] => {
  // 1. Step 1: Guard against empty inputs to prevent unnecessary processing
  if (!sessions || sessions.length === 0) return [];

  // 2. Step 2: Perform a type-aware map-and-filter pass
  const sanitized = sessions.map(session => {
    // 3. Step 3: Branching logic - only sanitize block-based sessions
    // revision-interleaved sessions do not use literal node IDs for their primary trigger
    // and must be preserved regardless of their targetLessonUnits length.
    if (session.type === 'revision-interleaved') {
        return session;
    }

    // 4. Step 4: Filter targetLessonUnits for standard blocks to exclude 'reviewNode'
    const cleanUnits = (session.targetLessonUnits || []).filter(
      unit => unit.primaryConceptNodeID !== 'reviewNode'
    );

    // 5. Step 5: Return the modified session with cleaned unit references
    return {
      ...session,
      targetLessonUnits: cleanUnits
    };
  });

  // 6. Step 6: Perform pruning of empty sessions
  // We only prune sessions if they are NOT 'revision-interleaved' AND have zero units.
  // This ensures that topic-blocks that become empty are removed, but the review pipeline stays.
  return sanitized.filter(session => {
    if (session.type === 'revision-interleaved') return true;
    return session.targetLessonUnits.length > 0;
  });
};