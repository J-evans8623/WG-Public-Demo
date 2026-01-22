/**
 * @file InsertStrategy.ts
 * @description
 * This file serves as the primary implementation container for the non-destructive insertion algorithm within 
 * the study planner system. Its primary responsibility is to encapsulate the logic required to layer new notebooks 
 * onto an existing study plan without erasing or modifying previously scheduled sessions. It achieves this by 
 * implementing eight distinct semantic abstractions: context synchronization, structural load balancing, 
 * temporal anchoring, delta materialization, additive session mapping, maintenance program seeding, 
 * learning set pattern inference, and final state reconciliation. By centralizing these operations, the file 
 * ensures that the "Insert Notebook" logic is completely decoupled from standard updates or fresh plan 
 * generation, adhering to the Single Responsibility Principle. This architecture provides a stable, 
 * append-only pathway that preserves historical data while allowing the study plan to grow dynamically.
 */

import { 
  NotebookMeta, 
  StudySession, 
  LessonUnit 
} from '@/app/Library/Definitions/CalendarDefinitions';
import { 
  StudyPlanOutput, 
  LearningSet, 
  NotebookProgress, 
  ScheduleConfig, 
  LessonChunk,
  InterleavedRevisionProgress,
  Lesson,
  PlanMetadata
} from '../models';

import { 
  ISyncGlobalContext, 
  IBalanceStructuralLoad, 
  IMaterializeDelta,
  IIdentifyTemporalAnchor,
  IMapAdditiveSessions,
  ISeedMaintenanceProgram,
  IReconcileFinalState,
  IInferLearningSetPattern,
  IMaterializeInterleavedSessions
} from "@/app/workspace/(studygraph)/components/layout/Calendar/study-planner/types/InsertNotebookInterface";

import { 
  DEFAULT_CHUNK_SIZE, 
  ID_PREFIX, 
  INTERLEAVED_REVISION_MULTIPLIER, 
  INTERLEAVED_INTERVAL_DAYS, 
  INTERLEAVED_START_DELAY_DAYS,
  NOTEBOOK_SPLIT_THRESHOLD
} from '../constants/schedulingConstants';

import { formatDateKey, addDays, isDateAvailable } from '../utils/dateUtils';
import { generateSessionId } from '../utils/sessionUtils';

/**
 * @class InferLearningSetPattern
 * @description
 * Implements the logic to project the underlying alternating learning set rhythm 
 * for the future. This creates an authoritative "Map of the Future" that allows 
 * the mapper to find slots without relying on sparse session data.
 */
export class InferLearningSetPattern implements IInferLearningSetPattern {
  private buildSchedulePattern: (
    startDate: Date,
    learningSets: LearningSet[],
    config: ScheduleConfig,
    totalDays: number
  ) => Map<string, LearningSet>;

  constructor(patternFn: any) {
    this.buildSchedulePattern = patternFn;
  }

  /**
   * @function infer
   * @description
   * Generates a 365-day schedule pattern projection. It leverages the standard 
   * scheduler logic to determine which set (LS-A or LS-B) owns which future date 
   * based on the user's weekly availability.
   */
  infer(
    startDate: Date, 
    learningSets: LearningSet[], 
    config: ScheduleConfig
  ): Map<string, LearningSet> {
    //console.warn(`[InsertStrategy][Infer] Projecting 365-day pattern from ${startDate.toDateString()}`);
    return this.buildSchedulePattern(startDate, learningSets, config, 365);
  }
}

/**
 * @class SyncGlobalContext
 * @description
 * Implements the Gatekeeper logic to validate and filter incoming notebooks, ensuring 
 * that only untracked data enters the insertion pipeline to maintain idempotency.
 */
export class SyncGlobalContext implements ISyncGlobalContext {
  sync(
    incomingMetas: NotebookMeta[], 
    currentProgress: Map<string, NotebookProgress>
  ): NotebookMeta[] {
    //console.warn(`[InsertStrategy][Sync] Input count: ${incomingMetas.length}`, incomingMetas.map(m => m.fileId));
    const verified = incomingMetas.filter(meta => !currentProgress.has(meta.fileId));
    //console.warn(`[InsertStrategy][Sync] Verified new notebooks: ${verified.length}`, verified.map(m => m.fileId));
    return verified;
  }
}

/**
 * @class BalanceStructuralLoad
 * @description
 * Implements the balancing logic to assign notebooks to the correct schedule group.
 */
export class BalanceStructuralLoad implements IBalanceStructuralLoad {
  /**
   * @function balance
   * @description
   * [update - 1303]
   * Patched: Now correctly identifies the lightest set by looking at the 
   * evolved set list.
   */
  balance(newMetas: NotebookMeta[], existingSets: LearningSet[]): Map<string, string> {
    const assignments = new Map<string, string>();
    
    // 1. Step: Use the actual evolved IDs
    let setA = existingSets.find(s => s.id === `${ID_PREFIX.LSET}-A`);
    let setB = existingSets.find(s => s.id === `${ID_PREFIX.LSET}-B`);

    let countA = setA?.notebooks.length || 0;
    let countB = setB?.notebooks.length || 0;

    newMetas.forEach(meta => {
      // 2. Step: If B exists, assign to the smaller one. Otherwise, stay in A.
      if (setB && countB < countA) {
        assignments.set(meta.fileId, setB.id);
        countB++;
      } else {
        assignments.set(meta.fileId, setA?.id || `${ID_PREFIX.LSET}-A`);
        countA++;
      }
    });

    //console.warn(`[InsertStrategy][Balance] Assignment Result:`, JSON.stringify(Object.fromEntries(assignments), null, 2));
    return assignments;
  }
}
/**
 * @class MaterializeDelta
 * @description
 * Implements the logic to transform raw notebook metadata into the scheduler's 
 * atomic chunks.
 */
export class MaterializeDelta implements IMaterializeDelta {
  private parseLessons: (nb: NotebookMeta) => Lesson[];
  private chunkLesson: (lesson: Lesson, size?: number) => LessonChunk[];

  constructor(
    parseFns: (nb: NotebookMeta) => Lesson[],
    chunkFns: (l: Lesson, s?: number) => LessonChunk[]
  ) {
    this.parseLessons = parseFns;
    this.chunkLesson = chunkFns;
  }

  materialize(notebookMeta: NotebookMeta): LessonChunk[] {
    const lessons = this.parseLessons(notebookMeta);
    const queue: LessonChunk[] = [];
    lessons.forEach(lesson => {
      const chunks = this.chunkLesson(lesson, DEFAULT_CHUNK_SIZE);
      queue.push(...chunks);
    });
    //console.warn(`[InsertStrategy][Materialize] Generated ${queue.length} chunks for ${notebookMeta.fileId}`);
    return queue;
  }
}

/**
 * @class IdentifyTemporalAnchor
 * @description
 * Implements logic to find the first valid calendar slot for a specific set.
 */
export class IdentifyTemporalAnchor implements IIdentifyTemporalAnchor {
  findAnchor(
    learningSetId: string, 
    config: ScheduleConfig, 
    globalSchedulePattern: Map<string, LearningSet>, 
    today: Date
  ): Date {
    //console.warn(`[InsertStrategy][Anchor] Finding anchor for Set: ${learningSetId}`);
    let cursor = new Date(today);
    cursor.setHours(0, 0, 0, 0);

    for (let i = 0; i < 365; i++) {
      const current = addDays(cursor, i);
      if (!isDateAvailable(current, config)) continue;

      const key = formatDateKey(current);
      const scheduledSet = globalSchedulePattern.get(key);
      
      if (scheduledSet?.id === learningSetId) {
        //console.warn(`[InsertStrategy][Anchor] Anchor found: ${current.toDateString()}`);
        return current;
      }
    }
    return cursor; 
  }
}

/**
 * @class MapAdditiveSessions
 * @description
 * Placement engine for additive study sessions.
 */
export class MapAdditiveSessions implements IMapAdditiveSessions {
  mapSessions(
    contentQueue: LessonChunk[], 
    anchorDate: Date, 
    notebookMetaSnapshot: NotebookMeta, 
    config: ScheduleConfig, 
    globalSchedulePattern: Map<string, LearningSet>
  ): { newSessions: StudySession[]; completionHorizon: Date } {
    //console.warn(`[InsertStrategy][Map] Mapping ${contentQueue.length} chunks starting ${anchorDate.toDateString()}`);

    const newSessions: StudySession[] = [];
    const learningSetId = globalSchedulePattern.get(formatDateKey(anchorDate))?.id || "";
    let cursor = new Date(anchorDate);
    let completionHorizon = new Date(anchorDate);

    contentQueue.forEach((chunk) => {
      while (!isDateAvailable(cursor, config) || globalSchedulePattern.get(formatDateKey(cursor))?.id !== learningSetId) {
        cursor = addDays(cursor, 1);
      }

      const blockId = generateSessionId();
      newSessions.push({
        id: blockId,
        date: new Date(cursor),
        notebookMeta: notebookMetaSnapshot,
        targetLessonUnits: chunk.units,
        type: 'block',
        sessionConfig: { unitCount: chunk.units.length },
        metadata: {
          sessionTitle: `Learning: ${notebookMetaSnapshot.fileName}`,
          estimatedDuration: chunk.units.length * 10,
          topicTitles: chunk.units.map(u => u.conceptNodeTitle)
        }
      } as any);

      const revisionDate = addDays(cursor, 1);
      newSessions.push({
        id: generateSessionId(),
        date: revisionDate,
        notebookMeta: notebookMetaSnapshot,
        targetLessonUnits: chunk.units,
        type: 'revision-block',
        sessionConfig: { unitCount: chunk.units.length },
        metadata: {
          sessionTitle: `Revision: ${notebookMetaSnapshot.fileName}`,
          estimatedDuration: Math.ceil(chunk.units.length * 10 * 0.8),
          topicTitles: chunk.units.map(u => u.conceptNodeTitle)
        }
      } as any);

      completionHorizon = revisionDate > completionHorizon ? revisionDate : completionHorizon;
      cursor = addDays(cursor, 1);
    });

    return { newSessions, completionHorizon };
  }
}

/**
 * @class SeedMaintenanceProgram
 * @description
 * Initializes the review program schedule using a mastery-based anchor.
 */
export class SeedMaintenanceProgram implements ISeedMaintenanceProgram {
  /**
   * @function seed
   * @description
   * Anchors the interleaved revision program to the provided masteryAnchor.
   */
  seed(
    notebookId: string, 
    totalLessons: number, 
    masteryAnchor: Date, 
    learningSetId: string, 
    globalSchedulePattern: Map<string, LearningSet>
  ): InterleavedRevisionProgress {
    const totalRequired = totalLessons * INTERLEAVED_REVISION_MULTIPLIER;
    const scheduledDates: Date[] = [];
    
    // update - 1003: Anchor logic fix
    let cursor = addDays(masteryAnchor, INTERLEAVED_START_DELAY_DAYS);
    
    for (let i = 0; i < 365 && scheduledDates.length < totalRequired; i++) {
      const key = formatDateKey(cursor);
      const scheduledSet = globalSchedulePattern.get(key);
      
      if (scheduledSet && scheduledSet.id === learningSetId) {
        scheduledDates.push(new Date(cursor));
        cursor = addDays(cursor, INTERLEAVED_INTERVAL_DAYS);
      } else {
        cursor = addDays(cursor, 1);
      }
    }

    return {
      totalRequired,
      sessionsScheduled: scheduledDates.length,
      sessionsCompleted: 0,
      firstSessionDate: scheduledDates[0],
      scheduledDates
    };
  }
}

/**
 * @class ReconcileFinalState
 * @description
 * Merges new data into the existing study plan.
 */
export class ReconcileFinalState implements IReconcileFinalState {
  reconcile(
    existingPlan: StudyPlanOutput, 
    newSessions: StudySession[], 
    newProgressEntries: Map<string, NotebookProgress>
  ): StudyPlanOutput {
    //console.warn(`[InsertStrategy][Reconcile] Merging ${newSessions.length} new sessions`);

    const updatedSessionsByDate = new Map(existingPlan.state.sessionsByDate);
    newSessions.forEach(session => {
      const key = formatDateKey(session.date);
      const existingInDay = updatedSessionsByDate.get(key) || [];
      updatedSessionsByDate.set(key, [...existingInDay, session]);
    });

    const updatedProgress = new Map(existingPlan.state.notebookProgress);
    newProgressEntries.forEach((progress, id) => {
      updatedProgress.set(id, progress);
    });

    const allSessions = Array.from(updatedSessionsByDate.values()).flat();
    let block = 0, revB = 0, revI = 0;
    let maxDate = existingPlan.planMetadata.startDate;

    allSessions.forEach(s => {
      if (s.date > maxDate) maxDate = s.date;
      if (s.type === 'block') block++;
      else if (s.type === 'revision-block') revB++;
      else if (s.type === 'revision-interleaved') revI++;
    });

    const meta: PlanMetadata = {
      ...existingPlan.planMetadata,
      endDate: maxDate,
      totalSessions: allSessions.length,
      sessionBreakdown: { 
        blockLearning: block, 
        blockRevision: revB, 
        interleavedRevision: revI 
      }
    };

    //console.warn(`[InsertStrategy][Reconcile] Reconciliation complete. Total Sessions: ${allSessions.length}`);

    return {
      sessions: allSessions,
      planMetadata: meta,
      state: {
        ...existingPlan.state,
        notebookProgress: updatedProgress,
        sessionsByDate: updatedSessionsByDate
      }
    };
  }
}


/**
 * @class MaterializeInterleavedSessions
 * @description
 * Implements the logic to create concrete revision-interleaved sessions.
 */
export class MaterializeInterleavedSessions implements IMaterializeInterleavedSessions {
  /**
   * @function materialize
   * @description
   * Maps each pre-calculated date in the interleaved progress to a new StudySession object.
   * These sessions carry the 'revision-interleaved' type and minimal metadata for display.
   */
  materialize(
    notebookId: string, 
    progress: InterleavedRevisionProgress, 
    notebookMeta: NotebookMeta
  ): StudySession[] {
    //console.warn(`[InsertStrategy][MaterializeInterleaved] Creating ${progress.scheduledDates.length} sessions for ${notebookId}`);
    
    return progress.scheduledDates.map(date => ({
      id: generateSessionId(),
      date: new Date(date),
      notebookMeta: notebookMeta,
      targetLessonUnits: [], // Content selection is randomized at runtime
      type: 'revision-interleaved',
      sessionConfig: { unitCount: 0 },
      metadata: {
        sessionTitle: `Spiral Review: ${notebookMeta.fileName}`,
        estimatedDuration: 20,
        topicTitles: ["Cumulative Review"]
      }
    } as StudySession));
  }
}


/**
 * @class IdentifyMasteryAnchor
 * @description
 * [update - 1001]
 * Abstraction Responsibility: Identifies the specific date a notebook first achieved 
 * mastery of its first logical lesson. Mastery is defined as the completion of 
 * the LAST revision block for the notebook's first lesson.
 */
export class IdentifyMasteryAnchor {
  /**
   * @function findMasteryDate
   * @description
   * [update - 1201]
   * Patched Logic: Instead of returning the first revision found, this function 
   * identifies the first lesson title and finds the latest revision block date 
   * associated with it. This ensures the anchor reflects the completion of 
   * the entire lesson (e.g. Day 4 in a 2-chunk lesson) rather than a single chunk.
   */
  findMasteryDate(newSessions: StudySession[], notebookId: string): Date {
    // 1. Step: Identify the first logical lesson title from the mapped sessions
    const notebookSessions = newSessions.filter(s => s.notebookMeta.fileId === notebookId);
    if (notebookSessions.length === 0) return new Date();

    const firstLessonTitle = notebookSessions[0].targetLessonUnits[0]?.parentTitle;

    // 2. Step: Find all revision blocks belonging to this specific first lesson
    const lessonRevisions = notebookSessions.filter(s => 
      s.type === 'revision-block' && 
      s.targetLessonUnits.some(u => u.parentTitle === firstLessonTitle)
    );

    // 3. Step: Select the LATEST date among these revisions as the true Mastery Anchor
    let latestDate = new Date(0);
    lessonRevisions.forEach(s => {
      if (s.date > latestDate) latestDate = new Date(s.date);
    });

    const anchor = latestDate.getTime() === 0 ? new Date() : latestDate;
    
    // update - 1202: Meaningful Telemetry
    /*console.warn(`[InsertStrategy][MasteryAnchor] Analysis for ${notebookId}:`, JSON.stringify({
      targetLesson: firstLessonTitle,
      revisionsConsidered: lessonRevisions.map(s => s.date.toISOString()),
      finalAnchorSelected: anchor.toISOString()
    }, null, 2));
    */
    
    return anchor;
  }
}

/**
 * @class EvolveLearningSets
 * @description
 * [update - 1302]
 * Responsibility: Inspects the existing plan structure and the new notebooks. 
 * If the threshold is crossed, it creates a new LearningSet object (LS-B).
 */
export class EvolveLearningSets {
  /**
   * @function evolve
   * @description
   * Ensures the learningSets array has the correct capacity for the new notebooks.
   */
  evolve(existingSets: LearningSet[], newMetas: NotebookMeta[]): LearningSet[] {
    const totalCount = existingSets.reduce((acc, s) => acc + s.notebooks.length, 0) + newMetas.length;
    const evolved = [...existingSets];

    // 1. Step: If threshold crossed and B doesn't exist, create it
    if (totalCount > NOTEBOOK_SPLIT_THRESHOLD && !evolved.find(s => s.id === `${ID_PREFIX.LSET}-B`)) {
      evolved.push({
        id: `${ID_PREFIX.LSET}-B`,
        name: "Learning Set B",
        notebooks: [],
        scheduledDayPattern: []
      });
      //console.warn(`[InsertStrategy][Structure] Threshold crossed (${totalCount}). Evolved to 2 sets.`);
    }

    return evolved;
  }
}