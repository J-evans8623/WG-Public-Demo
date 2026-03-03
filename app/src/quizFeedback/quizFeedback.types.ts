/**
 * @file app/src/services/quizFeedback/quizFeedback.types.ts
 * @description
 *   Canonical TypeScript type definitions for the QuizFeedback feature. This file is the
 *   single source of truth for every interface that touches the quiz feedback data pipeline,
 *   spanning three distinct layers: (1) Firestore document shapes (FS-suffixed types) that
 *   mirror the exact structure persisted in Firebase, (2) wire types returned by BFF endpoints
 *   over HTTP with timestamps serialized to ISO strings and no Firestore SDK dependencies, and
 *   (3) the React context value shape that components consume. Separating FS types from wire
 *   types prevents accidental Firestore Timestamp objects leaking into the client. This file
 *   intentionally has no runtime imports — it is a pure type module — so it can be safely
 *   imported by both server-side Firebase adapters and client-side React components without
 *   creating bundle bloat or circular dependency issues. All new Firestore collection paths
 *   introduced in Stage 1 are documented inline so schema intent is co-located with the types.
 *
 *   New Firestore paths introduced by this feature:
 *   - userFiles/{docId}/assignedQuizzes/{assignmentId}           (EXTENDED — new fields)
 *   - userFiles/{docId}/attempts/{email}/feedbackDetails/{attemptId}  (NEW)
 *   - userFiles/{docId}/assignedQuizzes/{assignmentId}/insights/summary (NEW)
 */

import type { Timestamp } from 'firebase-admin/firestore';

// ─────────────────────────────────────────────────────────────────────────────
// [Section 1] Shared primitives
// ─────────────────────────────────────────────────────────────────────────────

/**
 * AccountType
 * Discriminates between the two user roles in the system.
 * Used by the context provider to branch data-fetching strategy.
 */
export type AccountType = 'educator' | 'scholar';

/**
 * QuizResultFeedbackSetting
 * Controls when a student is allowed to view quiz corrections.
 * Persisted on AssignmentMetaFS and enforced server-side before serving feedback.
 */
export type QuizResultFeedbackSetting = 'immediately' | 'after_close';

// ─────────────────────────────────────────────────────────────────────────────
// [Section 2] Firestore document shapes  (server-side only — contain Timestamps)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * AssignmentMetaFSExtension
 * New fields added to the EXISTING AssignmentMetaFS document stored at
 * `userFiles/{docId}/assignedQuizzes/{assignmentId}`. These fields are merged
 * onto the existing document schema; legacy documents that predate Stage 1 will
 * have these fields undefined. Consumers must treat them as optional and gate
 * feedback-related UI accordingly.
 */
export interface AssignmentMetaFSExtension {
  /** Persisted at quiz creation; controls feedback visibility timing. Defaults to 'after_close'. */
  quizResultFeedback?: QuizResultFeedbackSetting;
  /** Human-readable lesson title stored at creation time to avoid cross-collection lookups. */
  lessonTitle?: string;
}

/**
 * FeedbackItemFS
 * Shape of a single incorrect-question record inside an AttemptFeedbackFS document.
 * Each item corresponds to one question the student answered incorrectly.
 */
export interface FeedbackItemFS {
  /** Stable question identifier from the quiz engine. */
  questionId: string;
  /** Identifier linking this question to a topic node in the lesson graph. */
  topicId: string;
  /** Display label for the topic shown in the UI breakdown. */
  topicLabel: string;
  /** Zero-based slide index within the lesson; used for "Review Topic" deep-linking. */
  yourAnswer: string;
  /** The authoritative correct answer. */
}

/**
 * AttemptFeedbackFS
 * Firestore document stored at:
 *   `userFiles/{docId}/attempts/{email}/feedbackDetails/{attemptId}`
 * Created by the ProducerAdapter at quiz submission time (Stage 1) for any attempt
 * processed through the feedbackquiz service. Legacy attempts will have no document
 * at this path; the ConsumerAdapter handles that absence gracefully.
 */
export interface AttemptFeedbackFS {
  attemptId:    string;
  assignmentId: string;
  /** Server timestamp written at creation; used for TTL / audit purposes. */
  createdAt:    Timestamp;
  /** Array of incorrect question records. Empty array indicates a perfect score. */
  items:        FeedbackItemFS[];
}

/**
 * TopicBreakdownEntryFS
 * A single cell in the topicBreakdown map inside QuizInsightSummaryFS.
 * Stored as a map value keyed by topicId for O(1) lookup and atomic increment updates.
 */
export interface TopicBreakdownEntryFS {
  topicLabel:    string;
  /** Running count of students who answered this topic incorrectly. */
  incorrectCount: number;
  /** Equals the total attempt count at the time of last update; used as denominator. */
  totalAttempts:  number;
}

/**
 * QuizInsightSummaryFS
 * Pre-aggregated summary document stored at:
 *   `userFiles/{docId}/assignedQuizzes/{assignmentId}/insights/summary`
 * Written / incremented by the ProducerAdapter each time a feedback-enabled attempt
 * is submitted. This avoids a O(S × E) fan-out query when the educator opens the
 * histogram — reading this document is O(1). The `totalScorePct` field is a running
 * sum divided by `attemptCount` at read time to compute the average grade.
 */
export interface QuizInsightSummaryFS {
  assignmentId:   string;
  /** Total number of feedback-enabled submissions received so far. */
  attemptCount:   number;
  /** Running sum of scorePct values; divide by attemptCount to get avg. */
  totalScorePct:  number;
  updatedAt:      Timestamp;
  /** Map keyed by topicId. Updated atomically on each student submission. */
  topicBreakdown: Record<string, TopicBreakdownEntryFS>;
}

// ─────────────────────────────────────────────────────────────────────────────
// [Section 3] Wire types  (client-safe — Timestamps serialized to ISO strings)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * StudentAttemptSummary
 * Represents one row in the Student Grade List (View ①).
 * Returned by GET /api/quiz-feedback/student-attempts.
 */
export interface StudentAttemptSummary {
  attemptId:    string;
  assignmentId: string;
  /** Resolved from AssignmentMetaFS.lessonTitle at read time. */
  lessonTitle:  string;
  /** AssignmentMeta.title — the quiz display name. */
  quizTitle:    string;
  /** ISO string of the submission timestamp. */
  submittedAt:  string;
  /** Null indicates the attempt was started but never submitted (edge case). */
  scorePct:     number | null;
  /**
   * True only when an AttemptFeedbackFS document exists for this attempt.
   * False for legacy attempts predating Stage 1.
   */
  hasFeedback:  boolean;
  feedbackSetting?: QuizResultFeedbackSetting;
  /* UPDATE - 1.2: Added quizEndAt to calculate availability dates for 'after_close' quizzes */
  quizEndAt?: string;
}

/**
 * FeedbackItem
 * Client-safe version of FeedbackItemFS. Identical shape; no Timestamps.
 * Used in the Quiz Feedback Detail view (View ②).
 */
export interface FeedbackItem {
  questionId:    string;
  topicId:       string;
  topicLabel:    string;
  yourAnswer:    string;
}

/**
 * QuizFeedbackDetail
 * Full data payload for the Student Quiz Feedback Detail view (View ②).
 * Returned by GET /api/quiz-feedback/feedback-detail.
 */
export interface QuizFeedbackDetail {
  attemptId:      string;
  assignmentId:   string;
  quizTitle:      string;
  lessonTitle:    string;
  scorePct:       number;
  totalQuestions: number;
  incorrectCount: number;
  /** Only incorrect questions are included; correct answers are omitted intentionally. */
  incorrectItems: FeedbackItem[];
}

/**
 * QuizInsightSummary
 * Represents one card in the Educator Quiz List view (View ③).
 * Returned as part of GET /api/quiz-feedback/insights.
 */
export interface QuizInsightSummary {
  assignmentId:  string;
  quizTitle:     string;
  lessonTitle:   string;
  /** Total feedback-enabled submissions for this quiz. */
  attemptCount:  number;
  /** Computed as totalScorePct / attemptCount, rounded to nearest integer. */
  avgGrade:      number;
  /** Human-readable date range string, e.g. "Jan 07 – Jan 08". */
  dateWindow:    string;
}

/**
 * TopicBreakdown
 * Client-safe version of TopicBreakdownEntryFS. Used in the Histogram view (View ④).
 */
export interface TopicBreakdown {
  topicId:       string;
  topicLabel:    string;
  incorrectCount: number;
  /** Denominator for percentage display in the histogram bars. */
  totalAttempts:  number;
}

/**
 * QuizHistogram
 * Full data payload for the Educator Histogram view (View ④).
 * Returned by GET /api/quiz-feedback/histogram.
 */
export interface QuizHistogram {
  assignmentId:  string;
  quizTitle:     string;
  lessonTitle:   string;
  attemptCount:  number;
  avgGrade:      number;
  /**
   * Array sorted descending by incorrectCount so the most-struggled
   * topics appear at the top of the histogram without client-side sorting.
   */
  topics:        TopicBreakdown[];
}

// ─────────────────────────────────────────────────────────────────────────────
// [Section 4] BFF request / response envelopes
// ─────────────────────────────────────────────────────────────────────────────

/** Response envelope for GET /api/quiz-feedback/student-attempts */
export interface StudentAttemptsRes {
  attempts: StudentAttemptSummary[];
}

/** Response envelope for GET /api/quiz-feedback/feedback-detail */
export interface FeedbackDetailRes {
  detail: QuizFeedbackDetail;
}

/** Response envelope for GET /api/quiz-feedback/insights */
export interface QuizInsightsRes {
  insights: QuizInsightSummary[];
}

/** Response envelope for GET /api/quiz-feedback/histogram */
export interface QuizHistogramRes {
  histogram: QuizHistogram;
}

// ─────────────────────────────────────────────────────────────────────────────
// [Section 5] React context value shape
// ─────────────────────────────────────────────────────────────────────────────

/**
 * QuizFeedbackContextValue
 * The full interface exposed by QuizFeedbackDataContext. Components should consume
 * only the slice relevant to their account type; the context itself is role-agnostic
 * and relies on the BFF to enforce authorization per session.
 */
export interface QuizFeedbackContextValue {
  // ── Scholar data ──────────────────────────────────────────────────────────
  /** Populated after fetchStudentAttempts resolves. Empty array before first fetch. */
  studentAttempts:       StudentAttemptSummary[];
  /** Populated after fetchFeedbackDetail resolves. Null before selection or on error. */
  quizFeedbackDetail:    QuizFeedbackDetail | null;

  // ── Educator data ─────────────────────────────────────────────────────────
  /** Populated after fetchQuizInsights resolves. Empty array before first fetch. */
  quizInsights:          QuizInsightSummary[];
  /** Populated after fetchQuizHistogram resolves. Null before selection or on error. */
  quizHistogram:         QuizHistogram | null;

  // ── Methods ───────────────────────────────────────────────────────────────
  /** Fetches all submitted attempts for the current scholar from the BFF. */
  fetchStudentAttempts:  (docId: string) => Promise<void>;
  /** Fetches the full feedback detail for a specific attempt. */
  fetchFeedbackDetail:   (docId: string, attemptId: string) => Promise<void>;
  /** Fetches summary cards for all quizzes in the educator's document. */
  fetchQuizInsights:     (docId: string) => Promise<void>;
  /** Fetches the pre-aggregated topic histogram for a specific quiz. */
  fetchQuizHistogram:    (docId: string, assignmentId: string) => Promise<void>;

  /** Resets quizFeedbackDetail to null; called when navigating back from View ②. */
  clearFeedbackDetail:   () => void;
  /** Resets quizHistogram to null; called when navigating back from View ④. */
  clearHistogram:        () => void;

  // ── Shared state ──────────────────────────────────────────────────────────
  isLoading:             boolean;
  /** Non-null when the most recent fetch operation failed. Reset on next fetch. */
  error:                 string | null;
}
