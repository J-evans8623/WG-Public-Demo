/**
 * @file UpdateStrategy.ts
 * @description
 * [Responsibility]
 * This module implements the "Append-Only" strategy for updating study plans. 
 * It provides a set of pure, stateless abstractions that handle the complex logic of:
 * 1. Determining where to safely resume scheduling (Anchor/Resume Point).
 * 2. Truncating obsolete future sessions to ensure a clean slate.
 * 3. Identifying new content (Delta) between the notebook file and tracking history.
 * 4. Appending a new "Learning Phase" (Blocks) for that content.
 * 5. Appending a new "Maintenance Phase" (Interleaved) to balance the quota.
 * * [SOLID Principles]
 * - SRP: Each function handles exactly one phase of the update pipeline.
 * - ISP: Functions accept only the specific data structures they need (e.g., Maps, Dates), not the entire State.
 * - DIP: Logic is decoupled from the Orchestrator class, allowing independent testing and reuse.
 */

import type { 
  StudySession, 
  NotebookMeta, 
  LessonUnit 
} from '@/app/Library/Definitions/CalendarDefinitions';
import type { LearningSet } from '../models/LearningSet';
import type { ScheduleConfig } from '../models/Configuration';
import type { NotebookProgress, LessonProgress } from '../models/Progress';
import type { Lesson, LessonChunk } from '../models/Lesson';
import { 
  addDays, 
  formatDateKey, 
  isDateAvailable, 
  getDayToken 
} from '../utils/dateUtils';
import { 
  DEFAULT_CHUNK_SIZE, 
  INTERLEAVED_REVISION_MULTIPLIER, 
  INTERLEAVED_INTERVAL_DAYS,
  ID_PREFIX
} from '../constants/schedulingConstants';

// --- Types ---

interface ChunkWithSource {
  chunk: LessonChunk;
  lessonId: string;
}

// --- Abstraction A: Determine Resume Point ---

/**
 * Step 1 & 2: Calculate the Resume Point (Anchor).
 * * @param sessionsByDate The full map of existing sessions.
 * @param notebookId The specific notebook we are updating.
 * @param learningSets The list of all learning sets (to find the pattern).
 * @param config Schedule availability configuration.
 * @param schedulePattern The date->set map for the relevant window.
 * @param today Local midnight of the current execution date.
 * * @returns The Date object representing the first safe slot to schedule NEW material.
 */
export function determineResumePoint(
  sessionsByDate: Map<string, StudySession[]>,
  notebookId: string,
  learningSets: LearningSet[],
  config: ScheduleConfig,
  schedulePattern: Map<string, LearningSet>,
  today: Date
): Date {
  const loc = 'UpdateStrategy.determineResumePoint';
  // // console.warn(`[UpdateStudy bug Tracking 01] Determining Resume Point for Notebook: ${notebookId}`);

  // 1. Find the last scheduled "Learning Block" for this notebook.
  let lastBlockDate: Date | null = null;
  
  // Iterate all days to find the max date containing a 'block' for this ID
  for (const [_, sessions] of sessionsByDate.entries()) {
    for (const session of sessions) {
      if (session.notebookMeta.fileId === notebookId && session.type === 'block') {
        if (!lastBlockDate || session.date > lastBlockDate) {
          lastBlockDate = session.date;
        }
      }
    }
  }

  // // console.warn(`[UpdateStudy bug Tracking 02] Last Block Date found in history: ${lastBlockDate ? lastBlockDate.toISOString() : 'NONE'}`);

  // 2. Apply "Max(Today)" Floor (Safeguard for "Past Tail").
  // If the last block was in the past (or doesn't exist), we must start searching from Today.
  // If the last block is in the future, we start searching from there.
  let searchBase: Date;
  if (lastBlockDate && lastBlockDate >= today) {
    searchBase = lastBlockDate; 
  } else {
    // If no history or history is old, effectively start search from Today.
    // We subtract 1 day because the loop below adds 1 day immediately.
    searchBase = addDays(today, -1);
  }

  // console.warn(`[UpdateStudy bug Tracking 03] Search Base Date established: ${searchBase.toISOString()} (Today is ${today.toISOString()})`);

  // 3. Identify the Target Learning Set ID for this notebook.
  // (We assume the notebook belongs to exactly one set for this context).
  const targetSet = learningSets.find(ls => 
    ls.notebooks.some(n => n.fileId === notebookId)
  );
  if (!targetSet) {
    console.error(`[UpdateStudy bug Tracking 04] ERROR: Notebook ${notebookId} is not assigned to any Learning Set.`);
    throw new Error(`Notebook ${notebookId} is not assigned to any Learning Set.`);
  }
  // console.warn(`[UpdateStudy bug Tracking 04] Target Set identified: ${targetSet.id}`);

  // 4. Scan forward for the Next Valid Slot.
  // Horizon Cap: 365 days.
  let cursor = searchBase;
  for (let i = 0; i < 365; i++) {
    cursor = addDays(cursor, 1); // Step forward
    
    // Condition A: Is the date available in user config (e.g., "Mon, Wed")?
    if (!isDateAvailable(cursor, config)) continue;

    // Condition B: Does the date belong to the correct Learning Set?
    // Note: The schedulePattern passed in must extend far enough. 
    // If it misses, we fallback to modulo arithmetic or assume the pattern generator handled it.
    // Ideally, the Orchestrator generated a pattern covering this search window.
    const key = formatDateKey(cursor);
    const setOnDay = schedulePattern.get(key);
    
    if (setOnDay && setOnDay.id === targetSet.id) {
        // FOUND IT.
        // console.warn(`[UpdateStudy bug Tracking 05] Resume Point Found: ${cursor.toISOString()} (Key: ${key})`);
        return cursor;
    }
  }

  console.error(`[UpdateStudy bug Tracking 06] ERROR: Horizon exceeded while searching for resume point.`);
  throw new Error(`Unable to find a valid study slot for Notebook ${notebookId} within 365 days.`);
}

// --- Abstraction B: Truncate Future Schedule ---

/**
 * Step 3: The "Clean Slate" Truncation.
 * Removes ALL sessions for the given notebook that occur on or after the resume point.
 * This effectively deletes the old "future" to make way for the new "future".
 * * @param sessionsByDate Mutable map of sessions.
 * @param notebookId The notebook ID to clean up.
 * @param resumePoint The cutoff date (inclusive).
 */
export function truncateFutureSchedule(
  sessionsByDate: Map<string, StudySession[]>,
  notebookId: string,
  resumePoint: Date
): void {
  const resumeTime = resumePoint.getTime();
  // console.warn(`[UpdateStudy bug Tracking 10] Starting Truncation for Notebook ${notebookId} at ${resumePoint.toISOString()}`);

  let removedCount = 0;

  for (const [key, sessions] of sessionsByDate.entries()) {
    // Optimization: Quick check if this day has relevant sessions
    const hasTarget = sessions.some(s => s.notebookMeta.fileId === notebookId);
    if (!hasTarget) continue;

    // Check date
    // We can pick the date from the first session (assuming homogenous dates per bucket)
    const date = sessions[0].date; 
    if (date.getTime() >= resumeTime) {
      // Filter out the target notebook's sessions
      const kept = sessions.filter(s => s.notebookMeta.fileId !== notebookId);
      
      const removedInBucket = sessions.length - kept.length;
      if (removedInBucket > 0) {
        removedCount += removedInBucket;
        if (kept.length === 0) {
          sessionsByDate.delete(key);
        } else {
          sessionsByDate.set(key, kept);
        }
      }
    }
  }
  // console.warn(`[UpdateStudy bug Tracking 11] Truncation Complete. Removed ${removedCount} sessions.`);
}

// --- Abstraction C: Identify New Content ---

/**
 * Step 4 & 5: Delta Identification and Chunking.
 * Compares the file (NotebookMeta) against History (Progress) to find what is new.
 * * @param notebookMeta The fresh file metadata.
 * @param progress The tracking history for this notebook.
 * @param lessonFns Dependency for chunking.
 * * @returns Array of LessonChunks representing the NEW material to be scheduled.
 */
export function identifyNewContent(
  notebookMeta: NotebookMeta,
  progress: NotebookProgress,
  lessonsByNotebook: Map<string, Lesson[]>,
  chunkLessonFn: (l: Lesson, s?: number) => LessonChunk[]
): ChunkWithSource[] {
  // console.warn(`[UpdateStudy bug Tracking 20] Identifying content for ${notebookMeta.fileId}`);
  
  const newChunks: ChunkWithSource[] = [];
  
  // Get the parsed lessons for this notebook
  const parsedLessons = lessonsByNotebook.get(notebookMeta.fileId) || [];
  // console.warn(`[UpdateStudy bug Tracking 21] Parsed Lessons Count from input: ${parsedLessons.length}`);
  
  // Map of tracked lesson IDs for O(1) lookup
  // We also map tracked unit counts to detect "Updates within a lesson"
  const trackedMap = new Map<string, number>();
  progress.lessonProgress.forEach(lp => {
    trackedMap.set(lp.lessonId, lp.totalUnits);
  });
  // console.warn(`[UpdateStudy bug Tracking 22] Tracked Map Size (History): ${trackedMap.size}`);

  for (const lesson of parsedLessons) {
    const trackedCount = trackedMap.get(lesson.id);

    if (trackedCount === undefined) {
      // CASE A: Completely New Lesson
      // console.warn(`[UpdateStudy bug Tracking 23] Lesson '${lesson.title}' (ID: ${lesson.id}) is NEW. (Not in history)`);
      const chunks = chunkLessonFn(lesson, DEFAULT_CHUNK_SIZE);
      // console.warn(`[UpdateStudy bug Tracking 23b] Generated ${chunks.length} chunks for new lesson.`);
      chunks.forEach(c => newChunks.push({ chunk: c, lessonId: lesson.id }));
    } else {
      // CASE B: Existing Lesson with New Units?
      // Logic: If file has 10 units, history has 8, we schedule the last 2.
      if (lesson.units.length > trackedCount) {
        const diff = lesson.units.length - trackedCount;
        // console.warn(`[UpdateStudy bug Tracking 24] Lesson '${lesson.title}' EXPANDED. History: ${trackedCount}, Current: ${lesson.units.length}. Diff: ${diff}`);
        
        const newUnits = lesson.units.slice(trackedCount);
        
        // Create a synthetic "Mini Lesson" just for chunking
        const partialLesson: Lesson = { ...lesson, units: newUnits };
        const chunks = chunkLessonFn(partialLesson, DEFAULT_CHUNK_SIZE);
        
        chunks.forEach(c => newChunks.push({ chunk: c, lessonId: lesson.id }));
      } else {
        // Logging the "No Change" case to verify we aren't skipping things incorrectly
        // // console.warn(`[UpdateStudy bug Tracking 25] Lesson '${lesson.title}' No change detected.`);
      }
    }
  }

  // console.warn(`[UpdateStudy bug Tracking 26] Final New Chunks Count: ${newChunks.length}`);
  return newChunks;
}

// --- Abstraction D: Append Learning Phase ---

/**
 * Step 6: Scheduling the New Learning Phase.
 * Iterates through chunks, assigning Learning Blocks and Revision Blocks.
 * * @returns The list of new sessions AND the date of the LAST scheduled block (cursor).
 */
export function appendLearningPhase(
  chunks: ChunkWithSource[],
  resumePoint: Date,
  notebookId: string,
  targetSetId: string,
  config: ScheduleConfig,
  schedulePattern: Map<string, LearningSet>,
  blockFns: any, // Typed as IBlockFns in usage
  progressMap: Map<string, NotebookProgress>,
  lessonsByNotebook: Map<string, Lesson[]>
): { newSessions: StudySession[], lastBlockDate: Date } {
  
  // console.warn(`[UpdateStudy bug Tracking 30] Appending Learning Phase. Chunks to schedule: ${chunks.length}. Start Date: ${resumePoint.toISOString()}`);

  const newSessions: StudySession[] = [];
  
  // Start searching FROM the resume point (inclusive)
  // We actually need to back up 1 day so the loop finds resumePoint as the first candidate
  let cursor = addDays(resumePoint, -1);
  let lastBlockDate = resumePoint;

  // We maintain a "Previous Day Sessions" buffer to allow Revision Blocks to link correctly
  let prevDaySessions: StudySession[] = [];

  for (const item of chunks) {
    // 1. Find next valid Learning Set Day for a BLOCK
    let foundSlot = false;
    
    // Horizon Cap 365
    for (let i = 0; i < 365; i++) {
      cursor = addDays(cursor, 1);
      if (!isDateAvailable(cursor, config)) continue;
      
      const key = formatDateKey(cursor);
      const set = schedulePattern.get(key);
      
      if (set && set.id === targetSetId) {
        foundSlot = true;
        break; // Cursor is now on the valid day
      }
    }

    if (!foundSlot) {
        console.error(`[UpdateStudy bug Tracking 31] ERROR: Horizon exceeded inside appendLearningPhase loop.`);
        throw new Error("Horizon exceeded in appendLearningPhase");
    }

    lastBlockDate = cursor; // Track for the maintenance phase

    // 2. Schedule Block Learning
    const blockSession: StudySession = {
      id: `SPS-${Math.random().toString(36).substr(2, 9)}`, // UUID-ish
      date: new Date(cursor),
      notebookMeta: progressMap.get(notebookId)!.notebookMetaSnapshot as any,
      targetLessonUnits: item.chunk.units,
      type: 'block',
      sessionConfig: { unitCount: item.chunk.units.length },
      metadata: {
        sessionTitle: `Learning: ${item.chunk.units[0]?.conceptNodeTitle || 'New Content'}`,
        estimatedDuration: item.chunk.units.length * 10,
        topicTitles: item.chunk.units.map(u => u.conceptNodeTitle),
      }
    };
    newSessions.push(blockSession);
    // console.warn(`[UpdateStudy bug Tracking 32] Scheduled Block at ${cursor.toISOString()} for LessonID ${item.lessonId}`);

    // 3. Schedule Block Revision (Always Next Day)
    // Constraint: Revision is next calendar day, regardless of Learning Set
    const revisionDate = addDays(cursor, 1);
    const revisionSession: StudySession = {
      id: `SPS-${Math.random().toString(36).substr(2, 9)}`,
      date: new Date(revisionDate),
      notebookMeta: progressMap.get(notebookId)!.notebookMetaSnapshot as any,
      targetLessonUnits: item.chunk.units, // Reviewing same units
      type: 'revision-block',
      sessionConfig: { unitCount: item.chunk.units.length },
      metadata: {
        sessionTitle: `Review: ${item.chunk.units[0]?.conceptNodeTitle || 'New Content'}`,
        estimatedDuration: Math.ceil(item.chunk.units.length * 10 * 0.8), // Multiplier
        topicTitles: item.chunk.units.map(u => u.conceptNodeTitle),
      }
    };
    newSessions.push(revisionSession);
  }

  // console.warn(`[UpdateStudy bug Tracking 33] Learning Phase Complete. Total new sessions (Block+Rev): ${newSessions.length}`);
  return { newSessions, lastBlockDate };
}

// --- Abstraction E: Append Maintenance Phase ---

/**
 * Step 7, 8, 9: Maintenance Phase.
 * Calculates the delta for Interleaved sessions and schedules them.
 */
export function appendMaintenancePhase(
  notebookId: string,
  progress: NotebookProgress,
  totalLessons: number, // Old + New
  lastBlockDate: Date,
  sessionsByDate: Map<string, StudySession[]>, // The map AFTER truncation
  config: ScheduleConfig,
  schedulePattern: Map<string, LearningSet>,
  targetSetId: string
): StudySession[] {
  
  const sessions: StudySession[] = [];

  // 1. Calculate Quotas
  const totalRequired = totalLessons * INTERLEAVED_REVISION_MULTIPLIER;
  
  // 2. Count Surviving Sessions (The ones we didn't delete)
  let survivingCount = 0;
  for (const arr of sessionsByDate.values()) {
    for (const s of arr) {
      if (s.notebookMeta.fileId === notebookId && s.type === 'revision-interleaved') {
        survivingCount++;
      }
    }
  }

  // 3. Determine Needed
  const needed = Math.max(0, totalRequired - survivingCount);
  // console.warn(`[UpdateStudy bug Tracking 40] Maintenance Calc. Total Required: ${totalRequired}, Surviving: ${survivingCount}, Needed: ${needed}`);

  if (needed === 0) return [];

  // 4. Schedule Loop
  // Start from Delay (e.g. 4 days) after the last learning block
  let cursor = addDays(lastBlockDate, 4); // Delay
  let scheduled = 0;

  for (let i = 0; i < 365 && scheduled < needed; i++) {
    cursor = addDays(cursor, 1);
    
    // Check Availability
    if (!isDateAvailable(cursor, config)) continue;
    
    // Check Learning Set (Interleaved respects sets)
    const key = formatDateKey(cursor);
    const set = schedulePattern.get(key);
    
    if (set && set.id === targetSetId) {
      // Create Session
      const session: StudySession = {
        id: `SPS-${Math.random().toString(36).substr(2, 9)}`,
        date: new Date(cursor),
        notebookMeta: progress.notebookMetaSnapshot as any,
        targetLessonUnits: [], // Generic review
        type: 'revision-interleaved',
        sessionConfig: { unitCount: 0 },
        metadata: {
          sessionTitle: `Spiral Review: ${progress.notebookMetaSnapshot?.fileName}`,
          estimatedDuration: 20, // Constant
          topicTitles: ['General Review'],
        }
      };
      
      sessions.push(session);
      scheduled++;
      
      // Cadence: Skip days? 
      cursor = addDays(cursor, INTERLEAVED_INTERVAL_DAYS); 
    }
  }

  // // console.warn(`[UpdateStudy bug Tracking 41] Maintenance Phase Complete. Scheduled: ${sessions.length}`);
  return sessions;
}