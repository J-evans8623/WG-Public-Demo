// app/src/server/gradebook/gradebookFB.ts
/**
 * @file app/src/server/gradebook/gradebookFB.ts
 * @description
 *   Firestore helper layer for the Gradebook feature. It encapsulates *all* reads/writes
 *   for assignment metadata and quiz attempts under `userFiles/{docId}`. Keeping this
 *   logic in a single module prevents `firebase.ts` from ballooning, isolates transaction
 *   semantics (idempotent submit), and makes the BFF routes (Phase 3) thin and easy to
 *   reason about. The helpers return plain POJOs (no HTTP concerns) and enforce the key
 *   invariants: (1) Educator/Owner will be enforced by routes; (2) start/submit must be
 *   within `[startAt, endAt]`; (3) submissions cannot exceed `attemptLimit`; (4) submit
 *   is idempotent (re-submitting the same attempt just returns success). For the gradebook
 *   view, we aggregate the **highest** submitted score per student per assignment (per the
 *   corrected requirement). Timestamps are stored as server timestamps and returned as ISO
 *   strings. We rely on Firestore’s atomic transactions for correctness. Logging is concise,
 *   includes file and a 4-digit code for grep-ability, and only covers critical checkpoints
 *   (validations, transactions, and aggregates). Time complexity: CRUD ops are O(1); the
 *   gradebook snapshot is O(S + A + E) where S=students, A=assignments, E=submitted entries.
 */

import admin from 'firebase-admin';
import { firestore, getAclSnapshot } from '@/app/src/services/firebase';
import {
  AssignmentMeta,
  AssignmentMetaFS,
  AttemptEntryFS,
  AssignMetaUpsertReq,
  AssignMetaPatchReq,
  AttemptStartRes,
  AttemptSubmitRes,
  GradebookSnapshot,
  GradebookCell,
} from './gradebook.types';

// ───────────────────────────────────────────────────────────────────────────────
// [Section] Local helpers
// ───────────────────────────────────────────────────────────────────────────────

/**
 * toIso
 * Converts a Firestore Timestamp to an ISO string (UTC). Safe for undefined/null.
 */
function toIso(ts?: FirebaseFirestore.Timestamp | null): string {
  return ts ? ts.toDate().toISOString() : new Date(0).toISOString();
}

/**
 * normEmail
 * Normalizes an email for consistent ACL/students keys.
 */
function normEmail(e: string): string {
  return String(e || '').trim().toLowerCase();
}

/**
 * clampScore
 * Ensures scorePct is within [0, 100].
 */
function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return Math.round(n);
}

/**
 * getPaths
 * Centralizes collection/document path building to avoid string scatter.
 */
function getPaths(docId: string) {
  const root = firestore.collection('userFiles').doc(docId);
  const assigned = root.collection('assignedQuizzes');
  const attemptsRoot = (email: string) => root.collection('attempts').doc(normEmail(email));
  const attemptEntries = (email: string) => attemptsRoot(email).collection('entries');
  return { root, assigned, attemptsRoot, attemptEntries };
}

/**
 * validateWindowAndLimit
 * Step-by-step window and limit validation, shared by start/submit flows.
 * 1) Ensures meta exists
 * 2) Ensures now is within [startAt, endAt]
 * 3) Loads submitted count for (user, assignment)
 * 4) Computes remaining attempts (attemptLimit - submittedCount)
 */
async function validateWindowAndLimit(
  docId: string,
  userEmail: string,
  assignmentId: string
): Promise<{
  meta: AssignmentMetaFS;
  submittedCount: number;
  remainingAttempts: number;
}> {
  const { assigned, attemptEntries } = getPaths(docId);

  // 1) Meta existence
  const metaRef = assigned.doc(assignmentId);
  const metaSnap = await metaRef.get();
  if (!metaSnap.exists) {
    console.log('gradebookFB.ts [7201] › meta not found', { docId, assignmentId });
    throw new Error('ASSIGNMENT_NOT_FOUND');
  }
  const meta = metaSnap.data() as AssignmentMetaFS;

  // 2) Window check
  const now = Date.now();
  const startMs = meta.startAt.toDate().getTime();
  const endMs = meta.endAt.toDate().getTime();
  if (now < startMs) {
    console.log('gradebookFB.ts [7202] › window not started', { docId, assignmentId, now, startMs });
    throw new Error('WINDOW_NOT_STARTED');
  }
  if (now > endMs) {
    console.log('gradebookFB.ts [7203] › window closed', { docId, assignmentId, now, endMs });
    throw new Error('WINDOW_CLOSED');
  }

  // 3) Submitted count
  const q = attemptEntries(userEmail).where('assignmentId', '==', assignmentId);
  const qs = await q.get();
  let submittedCount = 0;
  qs.forEach(doc => {
    const d = doc.data() as AttemptEntryFS;
    if (d.submittedAt) submittedCount += 1;
  });

  // 4) Remaining attempts
  const remainingAttempts = Math.max(0, (meta.attemptLimit ?? 0) - submittedCount);

  console.log('gradebookFB.ts [7204] › validateWindowAndLimit ok', {
    docId,
    assignmentId,
    userEmail: normEmail(userEmail),
    submittedCount,
    attemptLimit: meta.attemptLimit,
    remainingAttempts,
  });

  // ⬇️ NOTE: no metaSnap in return
  return { meta, submittedCount, remainingAttempts };
}

/**
 * fsMetaToWire
 * Converts Firestore AssignmentMeta (TS) to wire-friendly AssignmentMeta (ISO strings).
 */
function fsMetaToWire(id: string, fs: AssignmentMetaFS): AssignmentMeta {
  return {
    assignmentId: id,
    title: fs.title,
    startAt: toIso(fs.startAt),
    endAt: toIso(fs.endAt),
    attemptLimit: fs.attemptLimit,
    createdBy: normEmail(fs.createdBy),
    createdAt: toIso(fs.createdAt),
    updatedAt: toIso(fs.updatedAt),
  };
}



// ───────────────────────────────────────────────────────────────────────────────
// [Section] Public helpers (imported by BFF endpoints in Phase 3)
// ───────────────────────────────────────────────────────────────────────────────

/**
 * upsertAssignedQuizMeta
 * Responsibility:
 *   Creates or updates assigned quiz metadata under `userFiles/{docId}/assignedQuizzes/{assignmentId}`.
 *   1) Validates endAt > startAt and attemptLimit >= 1.
 *   2) Sets createdAt/updatedAt correctly (createdAt only on first write).
 *   3) Returns the saved metadata as wire shape (ISO strings).
 * Notes:
 *   Owner+Educator enforcement happens in the route. This is a pure Firestore operation.
 */
export async function upsertAssignedQuizMeta(input: AssignMetaUpsertReq & { createdBy: string }): Promise<AssignmentMeta> {
  const { docId, assignmentId, title, startAt, endAt, attemptLimit, createdBy } = input;

  // Step 1: Validate simple constraints
  const startDate = new Date(startAt);
  const endDate = new Date(endAt);
  if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) {
    console.log('gradebookFB.ts [7211] › invalid date inputs', { docId, assignmentId, startAt, endAt });
    throw new Error('VALIDATION_INVALID_DATE');
  }
  if (endDate.getTime() <= startDate.getTime()) {
    console.log('gradebookFB.ts [7212] › end <= start', { docId, assignmentId });
    throw new Error('VALIDATION_INVALID_WINDOW');
  }
  if (!Number.isFinite(attemptLimit) || attemptLimit < 1) {
    console.log('gradebookFB.ts [7213] › invalid attemptLimit', { docId, assignmentId, attemptLimit });
    throw new Error('VALIDATION_INVALID_ATTEMPT_LIMIT');
  }

  // Step 2: Upsert in Firestore with proper timestamps
  const { assigned } = getPaths(docId);
  const ref = assigned.doc(assignmentId);

  await firestore.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const now = admin.firestore.FieldValue.serverTimestamp();

    if (!snap.exists) {
      // New document
      tx.set(ref, {
        assignmentId,
        title,
        startAt: admin.firestore.Timestamp.fromDate(startDate),
        endAt: admin.firestore.Timestamp.fromDate(endDate),
        attemptLimit,
        createdBy: normEmail(createdBy),
        createdAt: now,
        updatedAt: now,
      } as AssignmentMetaFS);
    } else {
      // Merge/update (preserve createdBy/createdAt)
      tx.update(ref, {
        title,
        startAt: admin.firestore.Timestamp.fromDate(startDate),
        endAt: admin.firestore.Timestamp.fromDate(endDate),
        attemptLimit,
        updatedAt: now,
      });
    }
  });

  const saved = (await ref.get()).data() as AssignmentMetaFS;
  console.log('gradebookFB.ts [7214] › upsertAssignedQuizMeta ok', { docId, assignmentId, attemptLimit });
  return fsMetaToWire(assignmentId, saved);
}

/**
 * patchAssignedQuizMeta
 * Responsibility:
 *   Applies a narrow patch (startAt/endAt/attemptLimit) to an existing assignment meta.
 *   1) Reads current doc, merges provided fields.
 *   2) Re-validates endAt > startAt and attemptLimit >= 1.
 *   3) Writes updatedAt and returns wire shape.
 */
export async function patchAssignedQuizMeta(input: AssignMetaPatchReq): Promise<AssignmentMeta> {
  const { docId, assignmentId } = input;
  const { assigned } = getPaths(docId);
  const ref = assigned.doc(assignmentId);

  const snap = await ref.get();
  if (!snap.exists) {
    console.log('gradebookFB.ts [7221] › patch: meta not found', { docId, assignmentId });
    throw new Error('ASSIGNMENT_NOT_FOUND');
  }

  const cur = snap.data() as AssignmentMetaFS;
  const nextStart = input.startAt ? new Date(input.startAt) : cur.startAt.toDate();
  const nextEnd = input.endAt ? new Date(input.endAt) : cur.endAt.toDate();
  const nextLimit = input.attemptLimit ?? cur.attemptLimit;

  if (!Number.isFinite(nextStart.getTime()) || !Number.isFinite(nextEnd.getTime()) || nextEnd <= nextStart) {
    console.log('gradebookFB.ts [7222] › patch: invalid window', { docId, assignmentId, start: nextStart, end: nextEnd });
    throw new Error('VALIDATION_INVALID_WINDOW');
  }
  if (!Number.isFinite(nextLimit) || nextLimit < 1) {
    console.log('gradebookFB.ts [7223] › patch: invalid attemptLimit', { docId, assignmentId, attemptLimit: nextLimit });
    throw new Error('VALIDATION_INVALID_ATTEMPT_LIMIT');
  }

  await ref.update({
    startAt: admin.firestore.Timestamp.fromDate(nextStart),
    endAt: admin.firestore.Timestamp.fromDate(nextEnd),
    attemptLimit: nextLimit,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const saved = (await ref.get()).data() as AssignmentMetaFS;
  console.log('gradebookFB.ts [7224] › patchAssignedQuizMeta ok', { docId, assignmentId, attemptLimit: saved.attemptLimit });
  return fsMetaToWire(assignmentId, saved);
}

/**
 * startAttempt
 * Responsibility:
 *   Starts a new attempt (idempotent vs. *submit*, not vs. *start*) for a student.
 *   1) Validates window and remaining attempts (submission-based; start does not decrement).
 *   2) Creates entries/{autoId} with { assignmentId, startedAt }.
 *   3) Returns { attemptId, remainingAttempts } reflecting current submissions count.
 */
export async function startAttempt(
  docId: string,
  userEmail: string,
  assignmentId: string
): Promise<AttemptStartRes> {
  // Step 1: Validate against window and submitted attempts
  const { remainingAttempts } = await validateWindowAndLimit(docId, userEmail, assignmentId);
  if (remainingAttempts <= 0) {
    console.log('gradebookFB.ts [7231] › startAttempt: no remaining attempts', { docId, assignmentId, userEmail: normEmail(userEmail) });
    throw new Error('ATTEMPT_LIMIT_REACHED');
  }

  // Step 2: Create a new attempt entry
  const { attemptEntries } = getPaths(docId);
  const ref = attemptEntries(userEmail).doc();
  await ref.set({
    assignmentId,
    startedAt: admin.firestore.FieldValue.serverTimestamp(),
    submittedAt: null,
    scorePct: null,
  } as AttemptEntryFS);

  console.log('gradebookFB.ts [7232] › startAttempt ok', {
    docId,
    assignmentId,
    userEmail: normEmail(userEmail),
    attemptId: ref.id,
    remainingAttempts,
  });

  // Step 3: Return remainingAttempts without decrement (starts don't count)
  return { attemptId: ref.id, remainingAttempts };
}

/**
 * submitAttempt
 * Responsibility:
 *   Transactionally submits an existing, unsubmitted attempt with a client-reported score.
 *   1) Resolves attempt document and associated assignment meta.
 *   2) If already submitted → idempotent success; recompute remainingAttempts and return.
 *   3) Re-validate window & remaining attempts (submissions count cannot exceed attemptLimit).
 *   4) Write { submittedAt, scorePct } atomically.
 *   5) Return { accepted: true, remainingAttempts }.
 */
export async function submitAttempt(
  docId: string,
  userEmail: string,
  attemptId: string,
  scorePct: number
): Promise<AttemptSubmitRes> {
  const { attemptEntries } = getPaths(docId);
  const entryRef = attemptEntries(userEmail).doc(attemptId);

  const txRes = await firestore.runTransaction<AttemptSubmitRes>(async tx => {
    // Step 1: Load attempt
    const entrySnap = await tx.get(entryRef);
    if (!entrySnap.exists) {
      console.log('gradebookFB.ts [7241] › submit: attempt not found', { docId, attemptId, userEmail: normEmail(userEmail) });
      throw new Error('ATTEMPT_NOT_FOUND');
    }

    const entry = entrySnap.data() as AttemptEntryFS;
    const assignmentId = entry.assignmentId;

    // Step 2: Load meta & current submissions
    const { meta, submittedCount } = await validateWindowAndLimit(docId, userEmail, assignmentId);

    // Step 3: Idempotency — already submitted
    if (entry.submittedAt) {
      const stillRemaining = Math.max(0, meta.attemptLimit - submittedCount); // entry already counted
      const latestResult: GradebookCell = {
        submittedAt: toIso(entry.submittedAt),
        scorePct: clampScore(entry.scorePct ?? 0),
      };
      console.log('gradebookFB.ts [7242] › submit: idempotent success', { docId, attemptId, assignmentId, remainingAttempts: stillRemaining });
      return { accepted: true, remainingAttempts: stillRemaining, latestResult };
    }

    // Step 4: Enforce limit against submissions
    if (submittedCount >= meta.attemptLimit) {
      console.log('gradebookFB.ts [7243] › submit: limit reached', { docId, attemptId, assignmentId, submittedCount, limit: meta.attemptLimit });
      throw new Error('ATTEMPT_LIMIT_REACHED');
    }

    // Step 5: Write submission (clamped score, server time)
    const clamped = clampScore(scorePct);
    tx.update(entryRef, {
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
      scorePct: clamped,
    });

    // After this submit, remaining = limit - (submittedCount + 1)
    const remainingAfter = Math.max(0, meta.attemptLimit - (submittedCount + 1));

    console.log('gradebookFB.ts [7244] › submit: write ok', {
      docId,
      attemptId,
      assignmentId,
      scorePct: clamped,
      remainingAttempts: remainingAfter,
    });

    // Provisional latestResult; we'll refresh submittedAt after tx commit
    return {
      accepted: true,
      remainingAttempts: remainingAfter,
      latestResult: {
        submittedAt: new Date().toISOString(), // replaced after commit
        scorePct: clamped,
      },
    };
  });

  // Post-transaction: fetch real server timestamp for submittedAt
  try {
    const updatedSnap = await entryRef.get();
    const updated = updatedSnap.data() as AttemptEntryFS | undefined;
    if (updated?.submittedAt) {
      return {
        ...txRes,
        latestResult: {
          scorePct: txRes.latestResult.scorePct,
          submittedAt: toIso(updated.submittedAt),
        },
      };
    }
  } catch {
    // Non-fatal: fall back to provisional timestamp
  }

  return txRes;
}


/**
 * getAssignmentsMeta
 * Responsibility:
 *   Loads all assigned quiz metadata under a doc and returns them as wire shapes.
 *   1) Reads `assignedQuizzes` collection.
 *   2) Maps timestamps to ISO strings.
 *   3) Returns an array suitable for table headers in gradebook.
 */
export async function getAssignmentsMeta(docId: string): Promise<AssignmentMeta[]> {
  const { assigned } = getPaths(docId);
  const qs = await assigned.get();
  const out: AssignmentMeta[] = [];
  qs.forEach(d => out.push(fsMetaToWire(d.id, d.data() as AssignmentMetaFS)));

  // Sort by startAt ascending for stable headers (O(n log n))
  out.sort((a, b) => a.startAt.localeCompare(b.startAt));

  console.log('gradebookFB.ts [7251] › getAssignmentsMeta ok', { docId, count: out.length });
  return out;
}

/**
 * getGradebookSnapshot
 * Responsibility:
 *   Builds the gradebook matrix: students × assignments → highest submitted score per cell.
 *   1) Resolves students from ACL (owner excluded): editors ∪ sharedWith.
 *   2) Reads all assignment metas for header columns.
 *   3) For each student, reads their entries/* and reduces per assignment to the highest score.
 *   4) Returns { students, assignments, grades } sparse matrix.
 * Notes:
 *   - We aggregate **highest score** per assignment (corrected requirement).
 *   - Complexity is O(S + A + E). For typical classroom sizes, this is efficient and clear.
 */
export async function getGradebookSnapshot(docId: string): Promise<GradebookSnapshot> {
  // Step 1: Fetch ACL for student list
  const acl = await getAclSnapshot(docId);
  if (!acl.docExists) {
    console.log('gradebookFB.ts [7261] › doc not found for gradebook', { docId });
    return { students: [], assignments: [], grades: {} };
  }
  const owner = normEmail(acl.ownerId);
  const studentsSet = new Set<string>();
  (acl.editors || []).forEach(e => { const n = normEmail(e); if (n && n !== owner) studentsSet.add(n); });
  (acl.sharedWith || []).forEach(e => { const n = normEmail(e); if (n && n !== owner) studentsSet.add(n); });

  const students = Array.from(studentsSet).sort((a, b) => a.localeCompare(b));

  // Step 2: Assignment headers
  const assignments = await getAssignmentsMeta(docId);

  // Step 3: Build grades map
  const grades: Record<string, Record<string, GradebookCell>> = {};
  const { attemptsRoot } = getPaths(docId);

  for (const email of students) {
    const entriesCol = attemptsRoot(email).collection('entries');
    const qs = await entriesCol.get();

    // Reduce attempts → highest score per assignment
    const best: Record<string, GradebookCell> = {};
    qs.forEach(doc => {
      const d = doc.data() as AttemptEntryFS;
      if (!d.submittedAt || typeof d.scorePct !== 'number') return;

      const aId = d.assignmentId;
      const cell: GradebookCell = {
        scorePct: clampScore(d.scorePct),
        submittedAt: toIso(d.submittedAt),
      };

      if (!best[aId] || cell.scorePct > best[aId].scorePct) {
        best[aId] = cell;
      }
    });

    grades[email] = best;
  }

  console.log('gradebookFB.ts [7262] › snapshot ok', {
    docId,
    students: students.length,
    assignments: assignments.length,
  });

  return { students, assignments, grades };
}
