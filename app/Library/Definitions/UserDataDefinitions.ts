/**
 * @file UserDataDefinitions.ts
 * @description
 *   TypeScript definitions for the per-user offline review data model.
 *   This file enumerates quiz types, flash-card and quiz statistics,
 *   priority buckets, quotas, and the shape of the UserData document.
 *   In addition, it now defines the `RevisionCards` interface, which
 *   represents fully-formed resource objects returned by a revision
 *   session. `RevisionCards` contains two arrays—cue-card resources
 *   and practice-sheet resources—and ensures that consumer components
 *   receive ready-to-render objects without any further ID lookups.
 *   This update deprecates the old `RevisionQueues` in favor of
 *   object-based revision payloads.
 */

import type { CueCardResource, PracticeSheetResource } from '@/app/Library/Definitions/Definitions';

/** The different kinds of quiz questions we support */
export type QuizType = 'matching' | 'multipleChoice' | 'true-false' | 'FIB';

/** Statistics for a single quiz question */
export interface QuizItemStats {
  /** Unique identifier of the quiz question */
  itemId: string;
  /** Which QuizType this question belongs to */
  quizType: QuizType;
  mapId: string;
  /** Total number of times attempted */
  totalAttempts: number;
  /** Number of incorrect attempts */
  incorrectAttempts: number;
  /** UNIX timestamp of the last attempt */
  lastAttempted: number;
}

/** Statistics for a single flash card */
export interface FlashCardStats {
  /** Unique identifier of the flash card */
  flashCardId: string;
  /** How many times this card has been shown */
  timesShown: number;
  /** UNIX timestamp of the last display */
  lastShown: number;
}

/** A fully-qualified identifier for any resource card in a revision session */
export interface RevisionCard {
  /** The originating concept-map ID */
  mapId: string;
  /** The node within that map */
  nodeId: string;
  /** The specific card ID */
  cardId: string;
}

/** Two priority buckets: brand-new items vs. those above error threshold */
export interface PriorityBuckets {
  /** Items never seen yet */
  newItems: RevisionCard[];
  /** Items with failure rate > threshold */
  wrongItems: RevisionCard[];
}

/** Quotas for how many items to draw from each bucket */
export interface BucketQuotas {
  /** Fraction (0–1) or absolute count for newItems */
  newQuota: number;
  /** Fraction (0–1) or absolute count for wrongItems */
  wrongQuota: number;
  /** Fraction (0–1) or absolute count for seen/mastered items */
  seenQuota: number;
}

/**
 * Current session’s quiz queue, grouped by question type.
 *
 * NOTE: Using a mapped type alias (not "interface") to avoid TS#7061.
 */
export type QuizQueue = {
  [type in QuizType]: RevisionCard[];
};

/** The two queues produced each revision session */
export interface RevisionQueues {
  /** 20 flash-card triples in session order */
  flashCardQueue: RevisionCard[];
  /** Question triples by type in session order */
  quizQueue: QuizQueue;
}

/** All quota configurations for flash-cards and quizzes */
export interface QueueConfig {
  /** Quotas for flash-card selection */
  flashCardQuotas: BucketQuotas;
  /** Per-type quotas for quiz selection */
  quizQuotas: Record<QuizType, BucketQuotas>;
}

/**
 * NEW: Bookmark
 * A record representing a user‐flagged resource for later review.
 * Holds identifiers to locate the resource, its type, and the
 * timestamp when it was added, supporting sorting and grouping.
 */
export interface Bookmark {
  resourceId: string;
  mapId: string;
  nodeId: string;
  type: 'cueCard' | 'practiceSheet' | 'note';
  timestamp: number;
}

/** The top-level per-user offline data document */
export interface RevisionMetaData {
  /** The user’s unique identifier */
  userId: string;
  /** Map from question ID → stats */
  quizStats: Record<string, QuizItemStats>;
  /** Map from flash-card ID → stats */
  flashCardStats: Record<string, FlashCardStats>;
  /** Priority buckets for flash-cards and quizzes */
  priority: {
    flashCards: PriorityBuckets;
    quizzes: Record<QuizType, PriorityBuckets>;
  };
  /** Quotas and the live session queues */
  queues: {
    config: QueueConfig;
    current: RevisionQueues;
  };
  /** Last-modified timestamp for this document */
  updatedAt?: number;
  GlobalQuizAttempts: number;
    /** Global average at start of last session */
  previousGlobalAverage?: number;
  /** Per‐lesson averages at start of last session */
  previousLessonAverages?: Record<string, number>;

  bookmarks: Bookmark[];
}


export interface RevisionCards {
  /** Fully-formed cue-card resources ready for display */
  flashCards: CueCardResource[];
  /** Fully-formed practice-sheet resources ready for display */
  quizzes: PracticeSheetResource[];
}
