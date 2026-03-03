/**
 * @file app/src/services/quizFeedback/ProducerAdapter.ts
 * @description
 *   Server-side Firestore write layer for the QuizFeedback feature. This file is the
 *   "ProducerAdapter" — the write-side counterpart to ConsumerAdapter.ts. It encapsulates
 *   every Firestore write operation required to produce the data that the four new UI
 *   views consume. There are exactly two moments in the quiz lifecycle where this adapter
 *   is invoked: (A) when an educator creates or updates an assigned quiz, and (B) when a
 *   scholar submits a quiz attempt. The adapter is designed to be called from the existing
 *   BFF endpoints (pages/api/gradebook/assign-meta.ts and pages/api/gradebook/attempt/submit.ts)
 *   after their primary Firestore operations complete, keeping those endpoints thin.
 *
 *   This module follows the same architectural conventions as gradebookFB.ts and ConsumerAdapter.ts:
 *   it imports only the Firestore Admin SDK and the shared firebase singleton, returns plain POJOs,
 *   centralizes path construction in getPaths(), and emits concise grep-able logs with 4-digit codes.
 *   All methods are exported for BFF use only and must never be imported by client-side code.
 *
 *   Integration points (both documented in detail above each method):
 *   MOMENT A: pages/api/gradebook/assign-meta.ts  (POST handler, after upsertAssignedQuizMeta)
 *     extendAssignmentWithFeedbackSetting(docId, assignmentId, quizResultFeedback, lessonTitle)
 *
 *   MOMENT B: pages/api/gradebook/attempt/submit.ts  (after submitAttempt returns accepted: true)
 *     writeAttemptFeedbackDocument(docId, email, attemptId, assignmentId, items, totalQuestions)
 *     incrementInsightSummary(docId, assignmentId, scorePct, items)
 *
 *   Big-O complexity summary:
 *   - extendAssignmentWithFeedbackSetting : O(1) single document update
 *   - writeAttemptFeedbackDocument        : O(1) two parallel document writes
 *   - incrementInsightSummary             : O(T) T=unique topic count, single transaction
 */

import admin from 'firebase-admin';
import { firestore } from '@/app/src/services/firebase';
import type {
  AttemptFeedbackFS,
  FeedbackItemFS,
  QuizInsightSummaryFS,
  TopicBreakdownEntryFS,
  QuizResultFeedbackSetting,
} from './quizFeedback.types';

// ─────────────────────────────────────────────────────────────────────────────
// [Section 1] Input types (used by BFF endpoints to call this adapter)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * FeedbackItemInput
 * @description
 *   The shape the BFF submit endpoint passes into ProducerAdapter methods. Mirrors
 *   FeedbackItemFS exactly but defined separately so BFF endpoints do not need to
 *   import firebase-admin Timestamp types. All fields are plain scalars.
 */
export interface FeedbackItemInput {
  questionId:    string;
  topicId:       string;
  topicLabel:    string;
  topicSlide:    number;
  questionText:  string;
  yourAnswer:    string;
  correctAnswer: string;
  explanation:   string;
  sourceQuote:   string;
}

/**
 * ExtendAssignmentInput
 * @description
 *   The payload the POST /api/gradebook/assign-meta BFF passes into
 *   extendAssignmentWithFeedbackSetting. Both new fields are optional so
 *   that legacy BFF calls that do not supply them are handled gracefully.
 */
export interface ExtendAssignmentInput {
  docId:               string;
  assignmentId:        string;
  quizResultFeedback?: QuizResultFeedbackSetting;
  lessonTitle?:        string;
}

/**
 * WriteAttemptFeedbackInput
 * @description
 *   The payload the POST /api/gradebook/attempt/submit BFF passes into
 *   writeAttemptFeedbackDocument. feedbackItems contains only incorrect answers.
 */
export interface WriteAttemptFeedbackInput {
  docId:          string;
  userEmail:      string;
  attemptId:      string;
  assignmentId:   string;
  feedbackItems:  FeedbackItemInput[];
  totalQuestions: number;
}

/**
 * IncrementInsightInput
 * @description
 *   The payload the POST /api/gradebook/attempt/submit BFF passes into
 *   incrementInsightSummary. Aggregated at the quiz level — no per-student identity needed.
 */
export interface IncrementInsightInput {
  docId:         string;
  assignmentId:  string;
  scorePct:      number;
  feedbackItems: FeedbackItemInput[];
}

// ─────────────────────────────────────────────────────────────────────────────
// [Section 2] Local utility helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * normEmail
 * @description
 *   Normalises an email address to lowercase trimmed form, matching the convention
 *   in gradebookFB.ts for consistent Firestore document key lookups across all adapters.
 */
function normEmail(e: string): string {
  return String(e || '').trim().toLowerCase();
}

// ─────────────────────────────────────────────────────────────────────────────
// [Section 3] Firestore path builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getPaths
 * @description
 *   Centralises every Firestore collection and document reference used by the ProducerAdapter.
 *   Mirrors the identical helper pattern in gradebookFB.ts and ConsumerAdapter.ts so paths
 *   are defined consistently across the entire feature and never duplicated as raw strings.
 *   New paths introduced by this feature are annotated inline.
 *
 * @param docId - The workspace document ID (top-level userFiles key).
 */
function getPaths(docId: string) {
  // Step 1: Root document reference — all data lives under userFiles/{docId}.
  const root = firestore.collection('userFiles').doc(docId);

  // Step 2: EXISTING — assignedQuizzes sub-collection.
  //   ProducerAdapter extends these docs with quizResultFeedback + lessonTitle (Moment A).
  const assignedQuizzes = root.collection('assignedQuizzes');

  // Step 3: EXISTING — per-student attempt entries.
  //   ProducerAdapter stamps hasFeedback: true on these docs (Moment B).
  const attemptEntries = (email: string) =>
    root.collection('attempts').doc(normEmail(email)).collection('entries');

  // Step 4: NEW — per-student feedback detail documents (written at Moment B).
  //   Path: userFiles/{docId}/attempts/{email}/feedbackDetails/{attemptId}
  const feedbackDetails = (email: string) =>
    root.collection('attempts').doc(normEmail(email)).collection('feedbackDetails');

  // Step 5: NEW — pre-aggregated quiz insight summary doc (incremented at Moment B).
  //   Path: userFiles/{docId}/assignedQuizzes/{assignmentId}/insights/summary
  const insightSummary = (assignmentId: string) =>
    assignedQuizzes.doc(assignmentId).collection('insights').doc('summary');

  return { root, assignedQuizzes, attemptEntries, feedbackDetails, insightSummary };
}

// ─────────────────────────────────────────────────────────────────────────────
// [Section 4] Exported write helpers (called by BFF endpoints only)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * extendAssignmentWithFeedbackSetting
 * @description
 *   MOMENT A — Called from POST /api/gradebook/assign-meta after upsertAssignedQuizMeta
 *   completes successfully. Writes the two new fields (quizResultFeedback, lessonTitle)
 *   onto the existing AssignmentMetaFS document via a targeted update so that the primary
 *   gradebookFB.ts upsert does not need to be modified.
 *
 *   If both optional fields are absent this method no-ops immediately, preserving full
 *   backward compatibility with any callers that have not yet been updated to supply them.
 *
 *   ── Required change to pages/api/gradebook/assign-meta.ts ──────────────────────────
 *   In the POST handler, directly after:
 *     const saved = await upsertAssignedQuizMeta({ ...body, createdBy: session.user.email });
 *   Add (update - 1.1):
 *     await extendAssignmentWithFeedbackSetting({
 *       docId:              body.docId,
 *       assignmentId:       body.assignmentId,
 *       quizResultFeedback: body.quizResultFeedback,
 *       lessonTitle:        body.lessonTitle,
 *     });
 *
 *   In validateUpsertInput, add optional validation (update - 1.2):
 *     if (body?.quizResultFeedback &&
 *         body.quizResultFeedback !== 'immediately' &&
 *         body.quizResultFeedback !== 'after_close') {
 *       errors.push('quizResultFeedback');
 *     }
 *
 *   ── Required change to AssignQuizModal.tsx handleCreate (update - 1.3) ────────────
 *   Add state: const [quizResultFeedback, setQuizResultFeedback] = useState<QuizResultFeedbackSetting>('after_close');
 *   Resolve lesson title: const resolvedLessonTitle = lessonOptions.find(l => l.id === chosenLesson)?.title ?? '';
 *   Pass both to assignMetaUpsert:
 *     await api.assignMetaUpsert({ ..., quizResultFeedback, lessonTitle: resolvedLessonTitle });
 *
 *   ── Required change to gradebookClient.ts AssignMetaUpsertReq (update - 1.4) ──────
 *   Extend AssignMetaUpsertReq with:
 *     quizResultFeedback?: 'immediately' | 'after_close';
 *     lessonTitle?: string;
 *
 *   Big-O: O(1) — single conditional Firestore document update.
 */
export async function extendAssignmentWithFeedbackSetting(
  input: ExtendAssignmentInput
): Promise<void> {
  const { docId, assignmentId, quizResultFeedback, lessonTitle } = input;

  // Step 1: No-op guard — both new fields are optional. If neither is supplied,
  //         the base AssignmentMetaFS document already has everything it needs.
  if (!quizResultFeedback && !lessonTitle) {
    console.log('ProducerAdapter.ts [8201] extendAssignmentWithFeedbackSetting: no new fields, skip', {
      docId, assignmentId,
    });
    return;
  }

  // Step 2: Build a partial update payload — only include fields that were supplied
  //         to avoid overwriting an existing lessonTitle with undefined on PATCH flows.
  const updatePayload: Record<string, unknown> = {
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (quizResultFeedback) {
    // Step 3: Persist the QuizResultFeedback setting — controls when the student
    //         is allowed to view their corrections (immediately vs after quiz closes).
    updatePayload.quizResultFeedback = quizResultFeedback;
  }

  if (lessonTitle) {
    // Step 4: Store lesson title at creation time to avoid cross-collection reads
    //         on every ConsumerAdapter query for the student grade list and educator cards.
    updatePayload.lessonTitle = lessonTitle;
  }

  // Step 5: Update the existing document. upsertAssignedQuizMeta ran first so the
  //         document is guaranteed to exist. If it does not, Firestore throws NOT_FOUND
  //         which surfaces as a clear error for debugging race conditions.
  const { assignedQuizzes } = getPaths(docId);

  try {
    await assignedQuizzes.doc(assignmentId).update(updatePayload);
    console.log('ProducerAdapter.ts [8202] extendAssignmentWithFeedbackSetting ok', {
      docId,
      assignmentId,
      quizResultFeedback: quizResultFeedback ?? '(not set)',
      lessonTitle:        lessonTitle        ?? '(not set)',
    });
  } catch (err: any) {
    // Step 6: Re-throw with context so the BFF can log a meaningful error.
    console.error('ProducerAdapter.ts [8299] extendAssignmentWithFeedbackSetting failed', {
      docId, assignmentId, error: err?.message,
    });
    throw err;
  }
}

/**
 * writeAttemptFeedbackDocument
 * @description
 *   MOMENT B step 1 of 2 — Called from POST /api/gradebook/attempt/submit after
 *   submitAttempt returns { accepted: true }. Performs two writes in parallel:
 *     (a) Creates the AttemptFeedbackFS document at feedbackDetails/{attemptId}
 *     (b) Sets hasFeedback: true on the existing AttemptEntryFS at entries/{attemptId}
 *
 *   An empty feedbackItems array (perfect score) is valid — the document is written
 *   with items: [] and hasFeedback is still set true so the student grade list shows
 *   the feedback button and the detail view renders the "perfect score" empty state.
 *
 *   ── Required changes to pages/api/gradebook/attempt/submit.ts ──────────────────
 *   Extend AttemptSubmitReq in gradebookClient.ts to add (update - 2.1):
 *     assignmentId:    string;
 *     feedbackItems?:  FeedbackItemInput[];
 *     totalQuestions?: number;
 *
 *   In the POST handler body validation, add (update - 2.2):
 *     if (!body?.assignmentId || typeof body.assignmentId !== 'string')
 *       throw new Error('VALIDATION_ERROR: assignmentId');
 *
 *   After the submitAttempt call, add (update - 2.3):
 *     if (result.accepted && Array.isArray(body.feedbackItems) && body.feedbackItems.length >= 0) {
 *       await writeAttemptFeedbackDocument({
 *         docId,
 *         userEmail:      session.user.email,
 *         attemptId:      body.attemptId,
 *         assignmentId:   body.assignmentId,
 *         feedbackItems:  body.feedbackItems,
 *         totalQuestions: body.totalQuestions ?? body.feedbackItems.length,
 *       });
 *     }
 *
 *   ── Required change to the quiz submission client (wherever submitAttempt is called) ──
 *   The client must include assignmentId and feedbackItems in the submit request (update - 2.4).
 *   The feedbackItems come from the parsed feedbackquiz service response already stored in Yjs.
 *   Each item maps the incorrect question: { questionId, topicId, topicLabel, topicSlide,
 *   questionText, yourAnswer, correctAnswer, explanation, sourceQuote }.
 *
 *   Big-O: O(1) — two parallel Firestore document operations.
 */
export async function writeAttemptFeedbackDocument(
  input: WriteAttemptFeedbackInput
): Promise<void> {
  const { docId, userEmail, attemptId, assignmentId, feedbackItems, totalQuestions } = input;
  const email = normEmail(userEmail);
  const { feedbackDetails, attemptEntries } = getPaths(docId);

  // Step 1: Map FeedbackItemInput array to FeedbackItemFS array.
  //         The shapes are identical — this explicit mapping makes the boundary clear
  //         and protects against future shape divergence between input and storage types.
  const mappedItems: FeedbackItemFS[] = feedbackItems.map(item => ({
    questionId: item.questionId,
    topicId:    item.topicId,
    topicLabel: item.topicLabel,
    yourAnswer: item.yourAnswer,
  }));

  // Step 2: Build the AttemptFeedbackFS document payload.
  //         totalQuestions is stored here (not in AttemptEntryFS) because it is
  //         a feedback-specific concern, not a grading concern.
  const feedbackDocPayload = {
    attemptId,
    assignmentId,
    createdAt:      admin.firestore.FieldValue.serverTimestamp(),
    totalQuestions,
    items:          mappedItems,
  };

  // Step 3: Reference the target documents using the path builder.
  const feedbackDocRef = feedbackDetails(email).doc(attemptId);
  const entryDocRef    = attemptEntries(email).doc(attemptId);

  // Step 4: Issue both writes in parallel — set for the new feedback document,
  //         update for the existing attempt entry to stamp hasFeedback: true.
  await Promise.all([
    feedbackDocRef.set(feedbackDocPayload),
    entryDocRef.update({
      hasFeedback:        true,
      feedbackWrittenAt:  admin.firestore.FieldValue.serverTimestamp(),
    }),
  ]);

  console.log('ProducerAdapter.ts [8211] writeAttemptFeedbackDocument ok', {
    docId,
    email,
    attemptId,
    assignmentId,
    itemCount:      feedbackItems.length,
    totalQuestions,
  });
}

/**
 * incrementInsightSummary
 * @description
 *   MOMENT B step 2 of 2 — Called from POST /api/gradebook/attempt/submit immediately
 *   after writeAttemptFeedbackDocument completes. Atomically creates-or-increments the
 *   pre-aggregated QuizInsightSummaryFS document at:
 *     userFiles/{docId}/assignedQuizzes/{assignmentId}/insights/summary
 *
 *   This document is the sole data source for the Educator Histogram (View IV). Keeping it
 *   incrementally updated at submission time makes the histogram read O(1) regardless of
 *   how many students have submitted. A Firestore transaction prevents lost updates from
 *   concurrent submissions arriving within the same write window.
 *
 *   Create path (document absent — first submission):
 *     Sets attemptCount=1, totalScorePct=scorePct, and topicBreakdown with incorrectCount
 *     and totalAttempts=1 for each topic that appeared in this submission's feedbackItems.
 *
 *   Increment path (document exists — subsequent submissions):
 *     Atomically increments attemptCount and totalScorePct. For each topicId in feedbackItems,
 *     increments incorrectCount and totalAttempts. For topics already tracked but answered
 *     correctly this time (absent from feedbackItems), increments only totalAttempts so the
 *     denominator stays accurate for percentage calculations.
 *
 *   ── Integration — called in the same block as writeAttemptFeedbackDocument (update - 3.1) ──
 *     await incrementInsightSummary({
 *       docId,
 *       assignmentId: body.assignmentId,
 *       scorePct:     result.latestResult.scorePct,
 *       feedbackItems: body.feedbackItems,
 *     });
 *
 *   Big-O: O(T) where T = unique topic count in feedbackItems, inside one Firestore transaction.
 */
export async function incrementInsightSummary(
  input: IncrementInsightInput
): Promise<void> {
  const { docId, assignmentId, scorePct, feedbackItems } = input;
  const { insightSummary } = getPaths(docId);
  const summaryRef = insightSummary(assignmentId);

  // Step 1: Build a Set of topicIds from this submission's incorrect items for O(1) lookup.
  const incorrectTopicIds = new Set(feedbackItems.map(i => i.topicId));

  await firestore.runTransaction(async (tx) => {
    // Step 2: Read the current summary document inside the transaction boundary.
    const snap = await tx.get(summaryRef);

    if (!snap.exists) {
      // ── CREATE PATH ──────────────────────────────────────────────────────────────────

      // Step 3: Build the initial topicBreakdown from this submission's feedbackItems.
      //         Group by topicId so multiple questions from the same topic are counted once
      //         per topic (incorrectCount tracks questions, not occurrences per student).
      const topicBreakdown: Record<string, TopicBreakdownEntryFS> = {};

      for (const item of feedbackItems) {
        if (!topicBreakdown[item.topicId]) {
          // Step 4: First question seen for this topicId — initialise the entry.
          topicBreakdown[item.topicId] = {
            topicLabel:     item.topicLabel,
            incorrectCount: 1,
            totalAttempts:  1,
          };
        } else {
          // Step 5: Additional question for the same topic in the same quiz — increment
          //         incorrectCount (a student can miss multiple questions under the same topic).
          topicBreakdown[item.topicId].incorrectCount += 1;
        }
      }

      // Step 6: Write the initial summary document.
      const initialDoc: QuizInsightSummaryFS = {
        assignmentId,
        attemptCount:  1,
        totalScorePct: scorePct,
        updatedAt:     admin.firestore.Timestamp.now() as any,
        topicBreakdown,
      };

      tx.set(summaryRef, initialDoc);

      console.log('ProducerAdapter.ts [8221] incrementInsightSummary: created initial summary', {
        docId, assignmentId, scorePct, topicCount: Object.keys(topicBreakdown).length,
      });

    } else {
      // ── INCREMENT PATH ────────────────────────────────────────────────────────────────

      const existing = snap.data() as QuizInsightSummaryFS;

      // Step 7: Top-level atomic increments for the running average calculation.
      const updatePayload: Record<string, unknown> = {
        attemptCount:  admin.firestore.FieldValue.increment(1),
        totalScorePct: admin.firestore.FieldValue.increment(scorePct),
        updatedAt:     admin.firestore.FieldValue.serverTimestamp(),
      };

      // Step 8: Process topics the student answered incorrectly — increment both counters.
      for (const item of feedbackItems) {
        const tid = item.topicId;

        if (existing.topicBreakdown?.[tid]) {
          // Step 9: Topic already tracked — use FieldValue.increment on the nested fields.
          updatePayload[`topicBreakdown.${tid}.incorrectCount`] =
            admin.firestore.FieldValue.increment(1);
          updatePayload[`topicBreakdown.${tid}.totalAttempts`] =
            admin.firestore.FieldValue.increment(1);
        } else {
          // Step 10: New topic not seen in previous submissions — initialise it as an object.
          //          FieldValue.increment cannot initialise a non-existent nested map field
          //          so we write the initial object directly.
          updatePayload[`topicBreakdown.${tid}`] = {
            topicLabel:     item.topicLabel,
            incorrectCount: 1,
            totalAttempts:  1,
          } satisfies TopicBreakdownEntryFS;
        }
      }

      // Step 11: For topics already tracked in this quiz but answered correctly this time
      //          (not in feedbackItems), increment only totalAttempts so the denominator
      //          used for percentage display in the histogram remains accurate.
      for (const existingTopicId of Object.keys(existing.topicBreakdown ?? {})) {
        if (!incorrectTopicIds.has(existingTopicId)) {
          updatePayload[`topicBreakdown.${existingTopicId}.totalAttempts`] =
            admin.firestore.FieldValue.increment(1);
        }
      }

      tx.update(summaryRef, updatePayload);

      console.log('ProducerAdapter.ts [8222] incrementInsightSummary: incremented', {
        docId,
        assignmentId,
        scorePct,
        previousAttemptCount: existing.attemptCount,
        incorrectTopicsCount:  incorrectTopicIds.size,
      });
    }
  });

  console.log('ProducerAdapter.ts [8223] incrementInsightSummary: transaction committed', {
    docId, assignmentId,
  });
}
