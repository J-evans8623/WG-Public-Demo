/**
 * @file app/src/services/quizFeedback/ConsumerAdapter.ts
 * @description
 *   Server-side Firestore read layer for the QuizFeedback feature. This module is the
 *   "ConsumerAdapter" — it encapsulates every Firestore read operation required to hydrate
 *   the four new UI views introduced in Stage 2, and is the direct counterpart to the
 *   ProducerAdapter (not yet implemented) which handles writes. Following the same
 *   architectural conventions as gradebookFB.ts, this file: (1) imports only Firestore SDK
 *   types and the shared firebase singleton — never HTTP or React concerns; (2) returns plain
 *   POJOs using wire types from quizFeedback.types.ts so BFF endpoints remain thin; (3)
 *   centralizes path construction in a single getPaths() helper to prevent string scatter;
 *   (4) emits concise, grep-able logs with a stable 4-digit code at each critical checkpoint.
 *
 *   Big-O complexity summary:
 *   - getStudentAttemptSummaries : O(E + A)  — E=entries for student, A=assignments
 *   - getAttemptFeedbackDetail   : O(1)      — single document read
 *   - getQuizInsightSummaries    : O(A)      — one assignment doc + one insight doc each
 *   - getQuizHistogram           : O(1)      — single pre-aggregated document read
 *
 *   The O(1) histogram is achieved via the pre-aggregated QuizInsightSummaryFS document
 *   written by the ProducerAdapter on each submission, avoiding an O(S × E) fan-out at
 *   query time. All helpers are exported for use by BFF endpoints only; they must never
 *   be imported directly by client-side code.
 */

import { firestore } from '@/app/src/services/firebase';
import type {
  AttemptFeedbackFS,
  QuizInsightSummaryFS,
  AssignmentMetaFSExtension,
  StudentAttemptSummary,
  QuizFeedbackDetail,
  QuizInsightSummary,
  QuizHistogram,
  TopicBreakdown,
} from './quizFeedback.types';

// We also need the existing AttemptEntryFS and AssignmentMetaFS shapes. We reference
// the gradebook types inline here since those documents already exist in Firestore.
import type {
  AttemptEntryFS,
  AssignmentMetaFS,
} from '@/app/src/services/gradebook/gradebook.types';

// ─────────────────────────────────────────────────────────────────────────────
// [Section 1] Local utility helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * toIso
 * @description
 *   Converts a Firestore Timestamp to a UTC ISO string. Returns the Unix epoch
 *   as a fallback for undefined/null values to guarantee a non-null string return.
 *   Mirrors the same helper pattern used in gradebookFB.ts for consistency.
 */
function toIso(ts?: FirebaseFirestore.Timestamp | null): string {
  return ts ? ts.toDate().toISOString() : new Date(0).toISOString();
}

/**
 * normEmail
 * @description
 *   Normalises an email address to lowercase trimmed form so Firestore document
 *   key lookups are consistent regardless of how the email was originally cased.
 */
function normEmail(e: string): string {
  return String(e || '').trim().toLowerCase();
}

/**
 * formatDateWindow
 * @description
 *   Converts two Firestore Timestamps into a human-readable date range string
 *   suitable for the educator quiz card (e.g. "Jan 07 – Jan 08"). Uses short
 *   month names to keep the string compact at card width.
 */
function formatDateWindow(
  start: FirebaseFirestore.Timestamp,
  end: FirebaseFirestore.Timestamp
): string {
  // Step 1: Define a short formatter that avoids the year for same-year ranges.
  const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit' });
  return `${fmt.format(start.toDate())} – ${fmt.format(end.toDate())}`;
}

/**
 * clampScore
 * @description
 *   Ensures a scorePct value is within [0, 100] and is a finite integer.
 *   Mirrors the same helper in gradebookFB.ts to maintain score invariants.
 */
function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return Math.round(n);
}

// ─────────────────────────────────────────────────────────────────────────────
// [Section 2] Firestore path builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getPaths
 * @description
 *   Centralises every Firestore collection and document reference for this feature.
 *   All new paths introduced in Stage 1 are documented inline. Returning references
 *   rather than strings ensures TypeScript catches incorrect nesting at compile time.
 *
 * @param docId - The workspace document ID (top-level userFiles key).
 */
function getPaths(docId: string) {
  // Step 1: Root document reference — all data lives under userFiles/{docId}.
  const root = firestore.collection('userFiles').doc(docId);

  // Step 2: EXISTING — assignedQuizzes sub-collection (extended with new fields).
  const assignedQuizzes = root.collection('assignedQuizzes');

  // Step 3: EXISTING — per-student attempt entries.
  const attemptEntries = (email: string) =>
    root.collection('attempts').doc(normEmail(email)).collection('entries');

  // Step 4: NEW — per-student feedback detail documents.
  //   Path: userFiles/{docId}/attempts/{email}/feedbackDetails/{attemptId}
  const feedbackDetails = (email: string) =>
    root.collection('attempts').doc(normEmail(email)).collection('feedbackDetails');

  // Step 5: NEW — pre-aggregated quiz insight summary (single doc per quiz).
  //   Path: userFiles/{docId}/assignedQuizzes/{assignmentId}/insights/summary
  const insightSummary = (assignmentId: string) =>
    assignedQuizzes.doc(assignmentId).collection('insights').doc('summary');

  return { root, assignedQuizzes, attemptEntries, feedbackDetails, insightSummary };
}

// ─────────────────────────────────────────────────────────────────────────────
// [Section 3] Exported read helpers (consumed by BFF endpoints)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getStudentAttemptSummaries
 * @description
 *   Builds the row data for the Student Grade List (View ①). Reads all submitted
 *   attempt entries for the given student, then resolves the assignment title and
 *   lesson title from the corresponding AssignmentMeta document. Checks for the
 *   existence of a corresponding feedbackDetails document to set hasFeedback.
 *
 *   Big-O: O(E + A) where E = student entry count, A = unique assignment IDs in entries.
 *   Assignment meta documents are fetched in parallel via Promise.all to avoid serial
 *   round-trips. Existence of feedbackDetails is checked via a single getAll call.
 *
 * @param docId      - Workspace document ID.
 * @param userEmail  - Email of the student whose attempts are being fetched.
 * @returns          - Array of StudentAttemptSummary sorted by submittedAt descending.
 */
export async function getStudentAttemptSummaries(
  docId: string,
  userEmail: string
): Promise<StudentAttemptSummary[]> {
  const { attemptEntries, assignedQuizzes, feedbackDetails } = getPaths(docId);
  const email = normEmail(userEmail);

  // Step 1: Load all attempt entries for this student.
  const entriesSnap = await attemptEntries(email).get();

  // Step 2: Filter to submitted attempts only (unsubmitted have no scorePct/submittedAt).
  const submitted: Array<{ id: string; data: AttemptEntryFS }> = [];
  entriesSnap.forEach(doc => {
    const d = doc.data() as AttemptEntryFS;
    if (d.submittedAt) {
      submitted.push({ id: doc.id, data: d });
    }
  });

  if (submitted.length === 0) {
    console.log('ConsumerAdapter.ts [8101] › getStudentAttemptSummaries: no submitted attempts', { docId, email });
    return [];
  }

  // Step 3: Collect unique assignmentIds to batch-fetch their metadata.
  const uniqueAssignmentIds = [...new Set(submitted.map(e => e.data.assignmentId))];

  // Step 4: Fetch all assignment metadata documents in parallel (O(A) round-trips → one batch).
  const metaDocs = await Promise.all(
    uniqueAssignmentIds.map(id => assignedQuizzes.doc(id).get())
  );

  // Step 5: Build a lookup map from assignmentId → meta for O(1) resolution per entry.
  const metaMap = new Map<string, AssignmentMetaFS & AssignmentMetaFSExtension>();
  metaDocs.forEach(snap => {
    if (snap.exists) {
      metaMap.set(snap.id, snap.data() as AssignmentMetaFS & AssignmentMetaFSExtension);
    }
  });

  // Step 6: Fetch all feedbackDetail document refs in parallel to check existence.
  const feedbackDetailRefs = submitted.map(e => feedbackDetails(email).doc(e.id));
  const feedbackSnaps = await firestore.getAll(...feedbackDetailRefs);

  // Step 7: Build a Set of attemptIds that have a feedback document for O(1) lookup.
  const feedbackAttemptIds = new Set<string>();
  feedbackSnaps.forEach(snap => {
    if (snap.exists) feedbackAttemptIds.add(snap.id);
  });

  // UPDATE - 1.1: Filter the submitted list to ONLY include those with feedback documents.
  // 8. Step 8: Apply hard filter to exclude legacy or non-feedback attempts.
  const filteredSubmitted = submitted.filter(item => feedbackAttemptIds.has(item.id));


 // 9. Step 9: Map the filtered list to the StudentAttemptSummary wire shape.
  const summaries: StudentAttemptSummary[] = filteredSubmitted.map(({ id, data }) => {
    const meta = metaMap.get(data.assignmentId);
    return {
      attemptId:    id,
      assignmentId: data.assignmentId,
      lessonTitle:  meta?.lessonTitle ?? '',
      quizTitle:    meta?.title ?? data.assignmentId,
      submittedAt:  toIso(data.submittedAt),
      scorePct:     typeof data.scorePct === 'number' ? clampScore(data.scorePct) : null,
      hasFeedback:  true, // Guaranteed by UPDATE - 1.1 filtering
      feedbackSetting: meta?.quizResultFeedback ?? 'after_close', 
      /* UPDATE - 2.2: Extracting quiz end date to support 'after_close' logic on the frontend */
      quizEndAt: meta?.endAt ? toIso(meta.endAt) : undefined,
    };
  });

  // Step 10 Sort descending by submittedAt so the most recent attempt appears first.
  summaries.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

  console.log('ConsumerAdapter.ts [8102] › getStudentAttemptSummaries ok', {
    docId,
    email,
    total: summaries.length,
    withFeedback: [...feedbackAttemptIds].length,
  });

  return summaries;
}

/**
 * getAttemptFeedbackDetail
 * @description
 *   Loads the full quiz feedback detail for the Student Feedback Detail view (View ②).
 *   Reads the AttemptFeedbackFS document and the corresponding AssignmentMetaFS document
 *   to resolve display strings. Also reads the attempt entry to get the final scorePct
 *   and to derive totalQuestions from the items array length.
 *
 *   Big-O: O(1) — three parallel document reads (feedback doc, meta doc, entry doc).
 *
 * @param docId      - Workspace document ID.
 * @param userEmail  - Email of the student.
 * @param attemptId  - The attempt entry document ID.
 * @returns          - QuizFeedbackDetail wire shape.
 * @throws           - FEEDBACK_NOT_FOUND if no feedback document exists for the attempt.
 */
export async function getAttemptFeedbackDetail(
  docId: string,
  userEmail: string,
  attemptId: string
): Promise<QuizFeedbackDetail> {
  const { attemptEntries, assignedQuizzes, feedbackDetails } = getPaths(docId);
  const email = normEmail(userEmail);

  // Step 1: Fetch the three required documents in parallel to minimise latency.
  const feedbackRef   = feedbackDetails(email).doc(attemptId);
  const entryRef      = attemptEntries(email).doc(attemptId);

  const [feedbackSnap, entrySnap] = await Promise.all([
    feedbackRef.get(),
    entryRef.get(),
  ]);

  // Step 2: Guard — feedback document must exist (legacy attempts will not have one).
  if (!feedbackSnap.exists) {
    console.log('ConsumerAdapter.ts [8111] › getAttemptFeedbackDetail: feedback not found', { docId, email, attemptId });
    throw new Error('FEEDBACK_NOT_FOUND');
  }

  if (!entrySnap.exists) {
    console.log('ConsumerAdapter.ts [8112] › getAttemptFeedbackDetail: entry not found', { docId, email, attemptId });
    throw new Error('ATTEMPT_NOT_FOUND');
  }

  const feedback = feedbackSnap.data() as AttemptFeedbackFS;
  const entry    = entrySnap.data() as AttemptEntryFS;

  // Step 3: Fetch assignment meta to resolve display strings.
  const metaSnap = await assignedQuizzes.doc(feedback.assignmentId).get();
  const meta     = metaSnap.exists
    ? (metaSnap.data() as AssignmentMetaFS & AssignmentMetaFSExtension)
    : null;

  // Step 4: Derive counts — total questions inferred from incorrectItems length + correct answers.
  // The incorrectItems array only contains wrong answers; totalQuestions comes from the
  // quiz engine data embedded in the feedback document via a top-level field if available,
  // otherwise we fall back to incorrectItems.length as a lower bound.
  const incorrectCount  = feedback.items.length;
  // Note: totalQuestions should ideally be stored on AttemptFeedbackFS by the ProducerAdapter.
  // The type interface reserves a `totalQuestions` field; we cast safely here.
  const totalQuestions  = (feedback as AttemptFeedbackFS & { totalQuestions?: number }).totalQuestions
    ?? incorrectCount; // fallback if ProducerAdapter version predates the field

  // Step 5: Assemble the wire response.
  const detail: QuizFeedbackDetail = {
    attemptId,
    assignmentId:   feedback.assignmentId,
    quizTitle:      meta?.title ?? feedback.assignmentId,
    lessonTitle:    meta?.lessonTitle ?? '',
    scorePct:       typeof entry.scorePct === 'number' ? clampScore(entry.scorePct) : 0,
    totalQuestions,
    incorrectCount,
    incorrectItems: feedback.items.map(item => ({
      questionId:    item.questionId,
      topicId:       item.topicId,
      topicLabel:    item.topicLabel,
      yourAnswer:    item.yourAnswer,
    })),
  };

  console.log('ConsumerAdapter.ts [8113] › getAttemptFeedbackDetail ok', {
    docId,
    email,
    attemptId,
    assignmentId: feedback.assignmentId,
    incorrectCount,
  });

  return detail;
}

/**
 * getQuizInsightSummaries
 * @description
 *   Builds the card data for the Educator Quiz List (View ③). Reads all active assigned
 *   quiz metadata documents, then for each fetches the pre-aggregated insight summary
 *   sub-document to compute avgGrade. Documents without an insight summary (i.e. quizzes
 *   that predate Stage 1 or have received zero feedback-enabled submissions) are included
 *   with attemptCount: 0 and avgGrade: 0 to keep the list complete.
 *
 *   Big-O: O(A) — A assignment docs fetched in one query, then A insight docs fetched
 *   in parallel via Promise.all. No per-student fan-out.
 *
 * @param docId - Workspace document ID.
 * @returns     - Array of QuizInsightSummary sorted by startAt descending (most recent first).
 */
export async function getQuizInsightSummaries(docId: string): Promise<QuizInsightSummary[]> {
  const { assignedQuizzes, insightSummary } = getPaths(docId);

  // 1. Step 1: Load all non-deleted assignment meta documents in one query.
  const metaSnap = await assignedQuizzes.where('status', '!=', 'deleted').get();

  if (metaSnap.empty) {
    console.log('ConsumerAdapter.ts [8121] › getQuizInsightSummaries: no assignments', { docId });
    return [];
  }

  // 2. Step 2: Collect metadata for all valid assignments.
  const assignments: Array<{ id: string; meta: AssignmentMetaFS & AssignmentMetaFSExtension }> = [];
  metaSnap.forEach(doc => {
    assignments.push({
      id:   doc.id,
      meta: doc.data() as AssignmentMetaFS & AssignmentMetaFSExtension,
    });
  });

  // 3. Step 3: Fetch all insight summary docs in parallel for O(1) aggregation lookups.
  const insightSnaps = await Promise.all(
    assignments.map(({ id }) => insightSummary(id).get())
  );

  // 4. Step 4: Map each assignment + optional insight into the summary wire shape.
  // UPDATE - 2.1: Implement two-tier filtering for educators.
  const summaries: QuizInsightSummary[] = [];

  assignments.forEach(({ id, meta }, idx) => {
    const snap = insightSnaps[idx];
    
    // 5. Step 5: Metadata Gate - Check if the quiz possesses the feedback pipeline setting.
    const isFeedbackQuiz = !!meta.quizResultFeedback;
    
    // 6. Step 6: Data Gate - Ensure an insight summary exists (meaning submissions were processed).
    if (isFeedbackQuiz && snap.exists) {
      const insight = snap.data() as QuizInsightSummaryFS;
      const attemptCount = insight.attemptCount ?? 0;
      const avgGrade     = attemptCount > 0
        ? Math.round((insight.totalScorePct ?? 0) / attemptCount)
        : 0;

      summaries.push({
        assignmentId:  id,
        quizTitle:     meta.title,
        lessonTitle:   meta.lessonTitle ?? '',
        attemptCount,
        avgGrade,
        dateWindow:    formatDateWindow(meta.startAt, meta.endAt),
      });
    }
  });

  // 7. Step 7: Sort descending by startAt so most recent assessments appear first.
  summaries.sort((a, b) => {
    const metaA = assignments.find(x => x.id === a.assignmentId)!.meta;
    const metaB = assignments.find(x => x.id === b.assignmentId)!.meta;
    return metaB.startAt.toMillis() - metaA.startAt.toMillis();
  });

  console.log('ConsumerAdapter.ts [8122] › getQuizInsightSummaries ok', {
    docId,
    total: summaries.length,
    omitted: assignments.length - summaries.length,
  });

  return summaries;
}

/**
 * getQuizHistogram
 * @description
 *   Returns the pre-aggregated topic breakdown for the Educator Histogram view (View ④).
 *   This is a single document read on the insight summary sub-document, achieving O(1)
 *   complexity regardless of how many students have submitted the quiz. The topics array
 *   is returned sorted descending by incorrectCount so the histogram renders the highest
 *   bars first without any client-side sorting.
 *
 *   Big-O: O(1) — two parallel document reads (meta + insight summary).
 *
 * @param docId        - Workspace document ID.
 * @param assignmentId - The quiz assignment to build the histogram for.
 * @returns            - QuizHistogram wire shape.
 * @throws             - ASSIGNMENT_NOT_FOUND if the meta document does not exist.
 * @throws             - INSIGHTS_NOT_FOUND if no submissions have been recorded yet.
 */
export async function getQuizHistogram(
  docId: string,
  assignmentId: string
): Promise<QuizHistogram> {
  const { assignedQuizzes, insightSummary } = getPaths(docId);

  // Step 1: Fetch the assignment meta and insight summary in parallel.
  const [metaSnap, insightSnap] = await Promise.all([
    assignedQuizzes.doc(assignmentId).get(),
    insightSummary(assignmentId).get(),
  ]);

  // Step 2: Validate that the assignment exists.
  if (!metaSnap.exists) {
    console.log('ConsumerAdapter.ts [8131] › getQuizHistogram: assignment not found', { docId, assignmentId });
    throw new Error('ASSIGNMENT_NOT_FOUND');
  }

  // Step 3: Validate that at least one feedback-enabled submission has been recorded.
  if (!insightSnap.exists) {
    console.log('ConsumerAdapter.ts [8132] › getQuizHistogram: no insight data yet', { docId, assignmentId });
    throw new Error('INSIGHTS_NOT_FOUND');
  }

  const meta    = metaSnap.data() as AssignmentMetaFS & AssignmentMetaFSExtension;
  const insight = insightSnap.data() as QuizInsightSummaryFS;

  // Step 4: Compute the average grade from the running sum.
  const attemptCount = insight.attemptCount ?? 0;
  const avgGrade     = attemptCount > 0
    ? Math.round((insight.totalScorePct ?? 0) / attemptCount)
    : 0;

  // Step 5: Convert the topicBreakdown map into a sorted array.
  const topics: TopicBreakdown[] = Object.entries(insight.topicBreakdown ?? {}).map(
    ([topicId, entry]) => ({
      topicId,
      topicLabel:    entry.topicLabel,
      incorrectCount: entry.incorrectCount,
      totalAttempts:  entry.totalAttempts,
    })
  );

  // Step 6: Sort descending by incorrectCount — highest struggle topics appear first.
  topics.sort((a, b) => b.incorrectCount - a.incorrectCount);

  const histogram: QuizHistogram = {
    assignmentId,
    quizTitle:   meta.title,
    lessonTitle: meta.lessonTitle ?? '',
    attemptCount,
    avgGrade,
    topics,
  };

  console.log('ConsumerAdapter.ts [8133] › getQuizHistogram ok', {
    docId,
    assignmentId,
    attemptCount,
    avgGrade,
    topicCount: topics.length,
  });

  return histogram;
}
