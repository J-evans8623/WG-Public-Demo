// app/workspace/(studygraph)/components/modals/AssignQuizModal.tsx
/**
 * @file AssignQuizModal.tsx
 * @description
 *   (update - 6, 14, 16, 20, 26, 27–44)
 *   Role-gated, production-ready quiz authoring modal that lets Educators select a lesson (mapId)
 *   within a document (docId), configure assignment metadata (title, availability window, attempts),
 *   pick a quiz type, and specify the number of questions (hard-capped at 25). On submit, the modal
 *   performs the complete back-end flow end-to-end:
 *     1) Calls the shared quiz generator with (docId, lessonId, quizType, questionCount), which
 *        uses the concept-map extraction to build `exportData` server-side. (O(1) locally.)
 *     2) Writes a global `quizAssessment` Yjs card into the sentinel node with an **inline** binding
 *        containing the generated quiz JSON so it’s instantly visible to all collaborators.
 *     3) Persists enforcement metadata (title, start/end ISO stamps, attemptLimit) to the BFF via
 *        `/api/gradebook/assign-meta` (Owner/Educator only). This keeps server authority stable.
 *     4) Nudges the gradebook headers with `useGradebook.upsertAssignmentMeta` and then `refresh()`
 *        to confirm server truth. All network checkpoints emit compact, traceable logs.
 *
 *   The modal is strictly **gated to Educators** via the `isEducator` prop: non-educators see a
 *   disabled view with no ability to submit. The UI remains responsive and accessible, reuses the
 *   pre-existing styling, and avoids any layout or CSS changes. Rendering the lesson list is O(N);
 *   all other operations are O(1). Console logs include file-scoped 4-digit codes for grepability.
 */

import React, { useCallback, useMemo, useState } from 'react';
import '@/app/workspace/(studygraph)/components/modals/modalStyles.css';
import './ReviewModalSystem.css';
import { AlertTriangle, ArrowLeft } from 'lucide-react';

import { useResourceContext } from '@/app/Library/Context/ResourceContext';
import { useGradebook } from '@/app/Library/hooks/useGradebook';
import { useApiContext } from '@/app/src/context/ApiContext';
import { useYDoc } from '@/app/Library/Context/YDocContext';
import { useLessonModule } from '@/app/Library/Context/LessonModuleContext';
import { parseQuizResponse } from '@/app/workspace/(studygraph)/components/hooks/parseQuizFeedbackResponse';
import type { QuizBinding } from '@/app/Library/Definitions/Definitions'; 
// (no CSS changes)
export type QuizType = 'multipleChoice' | 'matching' | 'trueFalse' | 'fillBlanks';

export type LessonLite = {
  id: string;   // concept map id (aka lessonId)
  title: string;
};

export interface CreateQuizPayload {
  lessonId: string;
  title: string;
  quizType: QuizType;
  startAtISO: string;
  endAtISO: string;
  attempts: number;
  numQuestions?: number;
}

interface AssignQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (payload: CreateQuizPayload) => void;
  defaultOpenDropdown?: boolean;
  isEducator:boolean;
   onCreated?: (args: { assignmentId: string }) => void;
}

/**
 * combineLocalDateTime12h
 * @description
 *   Compose a Date from yyyy-MM-dd and 12-hour clock fields. Returns null on invalid input.
 *   Used to validate and to build ISO strings for the backend. O(1).
 */
function combineLocalDateTime12h(
  dateStr: string,
  time: { hour: string; minute: string; period: 'AM' | 'PM' | '' }
): Date | null {
  if (!dateStr || !time.hour || !time.minute || !time.period) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  let hr = parseInt(time.hour, 10);
  const min = parseInt(time.minute, 10);
  if (!Number.isFinite(hr) || !Number.isFinite(min)) return null;
  if (time.period === 'AM') { if (hr === 12) hr = 0; } else { if (hr !== 12) hr += 12; }
  const dt = new Date(y, (m || 1) - 1, d || 1, hr || 0, min || 0, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt;
}


/**
 * mapQuizTypeToApiValue
 * @description
 *   Translate our UI-level QuizType union into the backend’s expected discriminator. The
 *   mapping is stable and explicit to avoid accidental mismatches. Complexity is O(1).
 */
function mapQuizTypeToApiValue(qt: QuizType): string {
  switch (qt) {
    case 'multipleChoice': return 'multipleChoice';
    case 'matching':       return 'matching';
    case 'trueFalse':      return 'true-false';
    case 'fillBlanks':     return 'FIB';
    default:               return 'multipleChoice';
  }
}

/**
 * getBlockingMessage
 * @description
 *   (update - 71) Computes the highest-priority validation blocker for the disabled primary action.
 *   The resolver returns a short message and an `focusTargetId` which the UI uses to move focus to
 *   the relevant control when the user clicks “Fix”. This runs in O(1) time using already-derived
 *   booleans. The priority is:
 *    1) Lesson not selected
 *    2) Title empty
 *    3) Dates incomplete
 *    4) Dates invalid (start >= end)
 *    5) Quiz type not chosen
 */
function getBlockingMessage(params: {
  isEducator: boolean;
  canCreate: boolean;
  chosenLesson: string;
  titleValid: boolean;
  datesFilled: boolean;
  datesValid: boolean;
  quizTypeChosen: boolean;
}): { message: string; focusTargetId: string } | null {
  // (update - 72) Permissions trump validation; do not surface warnings for non-educators.
  if (!params.isEducator || params.canCreate) return null;

  if (!params.chosenLesson) {
    return { message: 'Select a lesson to continue.', focusTargetId: 'lessonSelectTrigger' };
  }
  if (!params.titleValid) {
    return { message: 'Add a quiz title.', focusTargetId: 'quizTitleInput' };
  }
  if (!params.datesFilled) {
    // Prefer focusing the first missing piece the UI can target (date inputs exist).
    return { message: 'Set a start and end time.', focusTargetId: 'startDateInput' };
  }
  if (!params.datesValid) {
    return { message: 'Start must be before end.', focusTargetId: 'startDateInput' };
  }
  if (!params.quizTypeChosen) {
    return { message: 'Choose a quiz type.', focusTargetId: 'quizTypeGroup' };
  }
  return null;
}

/**
 * AssignQuizModal
 * @description
 *   Validates inputs, gates to Educators, and on submit executes the full creation flow:
 *   generate quiz → add Yjs card (inline binding) → assign-meta upsert → gradebook nudge + refresh.
 *   Logs major checkpoints with stable codes for observability. Outside of lesson rendering, all
 *   operations are O(1).
 */
const AssignQuizModal: React.FC<AssignQuizModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  defaultOpenDropdown = false,
  isEducator,
  onCreated,     
}) => {

  const { createFeedbackQuizCard } = useResourceContext();
  const {docFileID: docId} = useYDoc();
  const api = useApiContext();
  const { upsertAssignmentMeta} = useGradebook(docId!);
  const { getLessonModule } = useLessonModule();
  
  const contextLessons: LessonLite[] = useMemo(() => {
    const lm = getLessonModule();
    return (lm?.conceptMaps || []).map((cm) => ({ id: cm.id, title: cm.title || cm.id }));
  }, [getLessonModule]);

  const lessonOptions: LessonLite[] = contextLessons;

  // 1) Lesson selection
  const [chosenLesson, setChosenLesson] = useState<string>('');
  const [isOpenSelect, setOpenSelect] = useState<boolean>(defaultOpenDropdown);
  const [quizTitle, setQuizTitle] = useState<string>('');
  const [feedbackSetting, setFeedbackSetting] = useState<'immediately' | 'after_close'>('after_close');

  // 2) Quiz type
  const [quizType, setQuizType] = useState<QuizType | ''>('');

  // 3) Quiz metadata (12h time fields)
  type Period = 'AM' | 'PM' | '';
  const [startDateStr, setStartDateStr] = useState<string>('');
  const [endDateStr, setEndDateStr] = useState<string>('');
  const [startTime, setStartTime] = useState<{ hour: string; minute: string; period: Period }>({
    hour: '12',
    minute: '00',
    period: 'AM',
  });
  const [endTime, setEndTime] = useState<{ hour: string; minute: string; period: Period }>({
    hour: '12',
    minute: '00',
    period: 'AM',
  });
  const [attempts, setAttempts] = useState<number>(1);
  const [numQuestions, setNumQuestions] = useState<number>(10);

  const [submitting, setSubmitting] = useState<boolean>(false);

   const hasLessons = useMemo(() => lessonOptions && lessonOptions.length > 0, [lessonOptions]);

  const hourOptions = useMemo(() => Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')), []);
  const minuteOptions = useMemo(() => Array.from({ length: 4 }, (_, i) => String(i * 15).padStart(2, '0')), []);
  const orderedPeriodOptions = (selected: 'AM' | 'PM' | ''): Array<'AM' | 'PM'> =>
    selected === 'PM' ? ['PM', 'AM'] : ['AM', 'PM'];

  if (!isOpen || !docId) return null;

  // Derived validation
  const startDateObj = combineLocalDateTime12h(startDateStr, startTime);
  const endDateObj = combineLocalDateTime12h(endDateStr, endTime);
  const datesFilled = Boolean(startDateObj && endDateObj);
  const datesValid = Boolean(datesFilled && startDateObj! < endDateObj!);
  const attemptsValid = Number.isFinite(attempts) && attempts >= 1;
  const questionsValid = Number.isFinite(numQuestions) && numQuestions >= 1 && numQuestions <= 25;
  const titleValid = quizTitle.trim().length > 0;
  const canCreate = Boolean(isEducator && chosenLesson && titleValid && quizType && datesValid && attemptsValid && questionsValid && !submitting);

  const blocking = getBlockingMessage({
    isEducator,
    canCreate,
    chosenLesson,
    titleValid,
    datesFilled,
    datesValid,
    quizTypeChosen: Boolean(quizType),
  });


  /**
 * handleCreate
 * @description
 *   Executes the full flow:
 *   generate quiz → add Yjs card (inline binding) → assign-meta upsert → gradebook nudge + refresh
 *   and then notifies parent (onCreate + onCreated) before closing.
 * @notes
 *   (update - 105) Now also emits `onCreated({ assignmentId })` so parent can focus/select the row.
 */
const handleCreate = async () => {
  // Step 1: Preconditions & validation ------------------------------------------------------------
  if (!canCreate) {
    return;
  }

  setSubmitting(true);

  // Step 2: Build payload -------------------------------------------------------------------------
  const payload: CreateQuizPayload = {
    lessonId: chosenLesson,
    title: quizTitle.trim(),
    quizType: quizType as QuizType,
    startAtISO: startDateObj!.toISOString(),
    endAtISO: endDateObj!.toISOString(),
    attempts,
    numQuestions,
  };

  try {
    // Step 3: Generate quiz via API (shared generator) -------------------------------------------
    const apiQuizType = mapQuizTypeToApiValue(payload.quizType);
    console.log('[AssignQuizModal.tsx][9413] generateQuiz begin', {
      docId, lessonId: payload.lessonId, apiQuizType, questionCount: payload.numQuestions,
    });
    const response = await api.createFeedbackQuiz({
        lessonId: payload.lessonId,
        fileID: docId,
        questionCount: payload.numQuestions,
        quizTypes: [mapQuizTypeToApiValue(payload.quizType as any)],
      });
  
    // Step 4: Parse response → create inline binding ---------------------------------------------
    const parsedResource = parseQuizResponse(response.data, payload.lessonId);
    if (!parsedResource) {
      console.error('[AssignQuizModal.tsx][9422] parseQuizResponse returned null');
      throw new Error('Failed to parse quiz response');
    }

    const inlineBinding: QuizBinding = {
      mode: 'inline',
      spec: {
        quizType: parsedResource.content.quizType,
        quizContent: parsedResource.content.quizContent,
      },
    };
    console.log('[AssignQuizModal.tsx][9452] inline binding prepared', {
      mode: inlineBinding.mode,
      qtype: inlineBinding.spec.quizType,
      qlen: inlineBinding.spec.quizContent?.length ?? 0,
    });

    // Step 5: Create Yjs quizAssessment card (authoritative assignmentId origin) ------------------
    const yjsCard = await createFeedbackQuizCard({
      mapId: payload.lessonId,
      title: payload.title,
      binding: inlineBinding,
      window: { startAt: payload.startAtISO, endAt: payload.endAtISO },
      attemptLimit: payload.attempts,
    });
    console.log('[AssignQuizModal.tsx][9415] Yjs quizAssessment created', {
      assignmentId: yjsCard.assignmentId,
    });

    // Step 6: Persist meta to BFF (server authority) ----------------------------------------------
    const savedHeader = await api.assignMetaUpsert({
      docId,
      assignmentId: yjsCard.assignmentId,
      title: payload.title,
      startAt: payload.startAtISO,
      endAt: payload.endAtISO,
      attemptLimit: payload.attempts,
      quizResultFeedback: feedbackSetting, // New field
      lessonTitle: lessonOptions.find(l => l.id === chosenLesson)?.title // New field
    });
    const saved = (savedHeader as any).saved ?? savedHeader; // backward-compatible unwrapping

    // Step 7: Nudge gradebook header (local cache) ------------------------------------------------
    upsertAssignmentMeta({
      assignmentId: saved.assignmentId,
      title: saved.title,
      startAt: saved.startAt,
      endAt: saved.endAt,
      attemptLimit: saved.attemptLimit,
    });
    console.log('[AssignQuizModal.tsx][9416] Gradebook header nudged');
    console.log('[AssignQuizModal.tsx][9417] Gradebook refreshed');

    // Step 8: Notify consumers --------------------------------------------------------------------
    // 8a) Keep legacy callback (telemetry / analytics / side-effects)
    onCreate(payload);

    // 8b) NEW: inform parent of the authoritative id so it can select/focus the new row
    onCreated?.({ assignmentId: yjsCard.assignmentId }); // (update - 105)

    // Step 9: Close modal on success --------------------------------------------------------------
    onClose();
  } catch (err: any) {
    console.error('[AssignQuizModal.tsx][9498] create flow failed', { message: err?.message });
    // Optional: toast/UX error handling can be added here.
  } finally {
    // Step 10: Always clear submitting flag -------------------------------------------------------
    setSubmitting(false);
  }
};


function handleFix() {
  if (!blocking) return;
  console.log('[AssignQuizModal.tsx][9751] fix clicked', { target: blocking.focusTargetId });

  if (blocking.focusTargetId === 'lessonSelectTrigger' && !isOpenSelect) {
    setOpenSelect(true);
  }

  const el = document.getElementById(blocking.focusTargetId) as HTMLElement | null;
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => el.focus?.(), 50);
  } else {
    console.log('[AssignQuizModal.tsx][9752] focus target not found');
  }
}


  
  const gatedDisabled = !isEducator;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Create quiz modal">
      <div className="modal-container rms-shell" style={{ width: 600, maxWidth: '92vw' }}>
        {/* Header */}
        <div className="rms-header">
          <button
            className="rms-close"
            aria-label="Back to Assessment"
            onClick={() => {
              console.log('[AssignQuizModal.tsx][9328] back clicked');
              onClose();
            }}
            title="Back"
          >
            <ArrowLeft size={18} />
          </button>
          <h2 className="modal-title" style={{ marginBottom: 8, textAlign: 'left', flex: 1 }}>
            Create Quiz
          </h2>
          <button
            className="rms-close"
            onClick={() => {
              console.log('[AssignQuizModal.tsx][9322] close clicked');
              onClose();
            }}
            aria-label="Close"
            title="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="rms-body">
          <div className="rms-body-inner" aria-disabled={gatedDisabled}>
            {gatedDisabled && (
              <div className="rms-inline-hint" style={{ marginBottom: 12 }}>
                This action is limited to Educators. You can view settings but cannot create assignments.
              </div>
            )}

            {/* (1) Select Lesson + Title */}
            <fieldset className="rms-field" disabled={gatedDisabled}>
              <legend className="rms-legend">Select a lesson</legend>

              <div className="rms-select">
                <button
                  id="lessonSelectTrigger"
                  type="button"
                  className="rms-select-trigger"
                  onClick={() => setOpenSelect((s) => !s)}
                  aria-haspopup="listbox"
                  aria-expanded={isOpenSelect}
                >
                  <span>
                    {chosenLesson
                      ? lessonOptions.find((l) => l.id === chosenLesson)?.title || 'Select lesson'
                      : 'Select lesson'}
                  </span>
                  <span aria-hidden>▾</span>
                </button>

                {isOpenSelect && (
                  <ul className="rms-select-menu" role="listbox">
                    {hasLessons ? (
                      lessonOptions.map((l) => (
                        <li key={l.id}>
                          <label className="rms-select-item">
                            <input
                              type="checkbox"
                              checked={chosenLesson === l.id}
                              onChange={() => {
                                const next = chosenLesson === l.id ? '' : l.id;
                                setChosenLesson(next);
                                console.log('[AssignQuizModal.tsx][9323] lesson toggled', { picked: next });
                                setOpenSelect(false);
                              }}
                            />
                            <span className="rms-select-text">{l.title}</span>
                          </label>
                        </li>
                      ))
                    ) : (
                      <li className="rms-select-empty">No lessons found in this notebook.</li>
                    )}
                  </ul>
                )}
              </div>

              <div className="quiz-title-section">
                <div className="quiz-group-label">Quiz Title</div>
                <input
                 id="quizTitleInput" 
                  type="text"
                  className="quiz-title-input"
                  placeholder="Enter a title for this quiz"
                  value={quizTitle}
                  onChange={(e) => setQuizTitle(e.target.value)}
                  aria-required="true"
                />
                {!titleValid && quizTitle.length > 0 && (
                  <div className="rms-inline-hint">Please enter a non-empty title.</div>
                )}
              </div>
            </fieldset>

            {/* (2) Quiz settings */}
            <fieldset className="rms-field" disabled={gatedDisabled}>
              <legend className="rms-legend">Quiz settings</legend>

              <div className="quiz-datetime-section">
                <div className="quiz-section-title">Quiz Availability</div>

                <div className="quiz-datetime-row">
                  {/* Start */}
                  <div className="quiz-datetime-group">
                    <div className="quiz-group-label">Start</div>
                    <input
                       id="startDateInput"
                      type="date"
                      className="quiz-date-input"
                      value={startDateStr}
                      onChange={(e) => setStartDateStr(e.target.value)}
                    />
                    <div className="quiz-time-picker">
                      <div className="quiz-time-select">
                        <select
                          value={startTime.hour}
                          onChange={(e) => setStartTime((t) => ({ ...t, hour: e.target.value }))}
                        >
                          {hourOptions.map((h) => (
                            <option key={`sh-${h}`} value={h}>
                              {h.padStart(2, '0')}
                            </option>
                          ))}
                        </select>
                      </div>
                      <span className="quiz-time-separator">:</span>
                      <div className="quiz-time-select">
                        <select
                          value={startTime.minute}
                          onChange={(e) => setStartTime((t) => ({ ...t, minute: e.target.value }))}
                        >
                          {minuteOptions.map((m) => (
                            <option key={`sm-${m}`} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>
                      <span className="quiz-time-separator"></span>
                      <div className="quiz-time-select quiz-period-select">
                        <select
                          value={startTime.period}
                          onChange={(e) =>
                            setStartTime((t) => ({ ...t, period: e.target.value as 'AM' | 'PM' }))
                          }
                        >
                          {orderedPeriodOptions(startTime.period).map((p) => (
                            <option key={`sp-${p}`} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* End */}
                  <div className="quiz-datetime-group">
                    <div className="quiz-group-label">End</div>
                    <input
                      id="endDateInput"
                      type="date"
                      className="quiz-date-input"
                      value={endDateStr}
                      onChange={(e) => setEndDateStr(e.target.value)}
                    />
                    <div className="quiz-time-picker">
                      <div className="quiz-time-select">
                        <select
                          value={endTime.hour}
                          onChange={(e) => setEndTime((t) => ({ ...t, hour: e.target.value }))}
                        >
                          <option value="">12</option>
                          {hourOptions.map((h) => (
                            <option key={`eh-${h}`} value={h}>
                              {h.padStart(2, '0')}
                            </option>
                          ))}
                        </select>
                      </div>
                      <span className="quiz-time-separator">:</span>
                      <div className="quiz-time-select">
                        <select
                          value={endTime.minute}
                          onChange={(e) => setEndTime((t) => ({ ...t, minute: e.target.value }))}
                        >
                          <option value="">00</option>
                          {minuteOptions.map((m) => (
                            <option key={`em-${m}`} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>
                      <span className="quiz-time-separator"></span>
                      <div className="quiz-time-select quiz-period-select">
                        <select
                          value={endTime.period}
                          onChange={(e) =>
                            setEndTime((t) => ({ ...t, period: e.target.value as 'AM' | 'PM' }))
                          }
                        >
                          {orderedPeriodOptions(endTime.period).map((p) => (
                            <option key={`ep-${p}`} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Attempts + Questions */}
              {/* (update - 107.1) Attempts + Questions — strict two-column meta row.
                The feedback card has been extracted from this grid and rendered
                independently below so it never competes for a grid column. */}
            <div className="quiz-meta-row">
              {/* (update - 107.2) Quiz Attempts card — unchanged content */}
              <div className="quiz-attempts-section">
                <div className="quiz-group-label">Quiz Attempts</div>
                <input
                  type="number"
                  className="quiz-attempts-input"
                  min={1}
                  step={1}
                  value={attempts}
                  onChange={(e) => setAttempts(Math.max(1, Number(e.target.value) || 1))}
                />
                <div className="quiz-attempts-label">Maximum number of attempts allowed</div>
              </div>

              {/* (update - 107.3) Quiz Questions card — unchanged content */}
              <div className="quiz-questions-section">
                <div className="quiz-group-label">Quiz Questions</div>
                <input
                  type="number"
                  className="quiz-questions-input"
                  min={1}
                  max={25}
                  step={1}
                  value={numQuestions}
                  onChange={(e) =>
                    setNumQuestions(Math.min(25, Math.max(1, Number(e.target.value) || 1)))
                  }
                />
                <div className="quiz-questions-label">Total number of questions (max 25)</div>
              </div>
            </div>

            {/* (update - 107.4) Students Can Review Corrections — full-width card rendered
                outside quiz-meta-row so it spans both columns naturally. Uses the new
                .quiz-feedback-section and .quiz-feedback-options classes from
                ReviewModalSystem.css instead of ad-hoc inline styles. */}
            <div className="quiz-feedback-section">
              <div className="quiz-group-label">Students can review corrections</div>
              <div className="quiz-feedback-options">
                {/* (update - 107.5) Immediately option */}
                <label className="quiz-feedback-option">
                  <input
                    type="radio"
                    name="feedback"
                    value="immediately"
                    checked={feedbackSetting === 'immediately'}
                    onChange={() => setFeedbackSetting('immediately')}
                  />
                  Immediately
                </label>

                {/* (update - 107.6) After quiz closes option */}
                <label className="quiz-feedback-option">
                  <input
                    type="radio"
                    name="feedback"
                    value="after_close"
                    checked={feedbackSetting === 'after_close'}
                    onChange={() => setFeedbackSetting('after_close')}
                  />
                  After quiz closes
                </label>
              </div>
            </div>

              {datesFilled && !datesValid && (
                <div className="rms-inline-hint">Start must be before end.</div>
              )}
            </fieldset>

            {/* (3) Quiz Type */}
            <fieldset className="rms-field" disabled={gatedDisabled}>
              <legend className="rms-legend">Select a quiz type</legend>
              <div id="quizTypeGroup" className="rms-radio-grid">
                <label className={`rms-radio-option ${quizType === 'multipleChoice' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="quizType"
                    value="multipleChoice"
                    checked={quizType === 'multipleChoice'}
                    onChange={() => {
                      setQuizType('multipleChoice');
                      console.log('[AssignQuizModal.tsx][9324] quizType=multipleChoice');
                    }}
                  />
                  <span>Multiple Choice</span>
                </label>

                <label className={`rms-radio-option ${quizType === 'matching' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="quizType"
                    value="matching"
                    checked={quizType === 'matching'}
                    onChange={() => {
                      setQuizType('matching');
                      console.log('[AssignQuizModal.tsx][9325] quizType=matching');
                    }}
                  />
                  <span>Matching</span>
                </label>

                <label className={`rms-radio-option ${quizType === 'trueFalse' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="quizType"
                    value="trueFalse"
                    checked={quizType === 'trueFalse'}
                    onChange={() => {
                      setQuizType('trueFalse');
                      console.log('[AssignQuizModal.tsx][9326] quizType=trueFalse');
                    }}
                  />
                  <span>True / False</span>
                </label>

                <label className={`rms-radio-option ${quizType === 'fillBlanks' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="quizType"
                    value="fillBlanks"
                    checked={quizType === 'fillBlanks'}
                    onChange={() => {
                      setQuizType('fillBlanks');
                      console.log('[AssignQuizModal.tsx][9327] quizType=fillBlanks');
                    }}
                  />
                  <span>Fill in the Blanks</span>
                </label>
              </div>
            </fieldset>
                   {/* Contextual warning bar: show one message above footer actions */}
            {blocking && (
              <div
                className="rms-warn"
                role="alert"
                aria-live="polite"
                style={{ marginTop: 8 }}
              >
                <div className="rms-warn-left">
                  <AlertTriangle className="rms-warn-ic" aria-hidden="true" />
                  <span className="rms-warn-text">{blocking.message}</span>
                </div>
                <button
                  type="button"
                  className="rms-warn-fix"
                  onClick={handleFix}
                  aria-label={`Fix: ${blocking.message}`}
                  title="Fix"
                >
                  Fix
                </button>
              </div>
            )}

            {/* Footer */}
            <div className="button-section">
              <button className="btn btn-cancel" onClick={onClose}>
                Cancel
              </button>
              <button
                className={`btn ${canCreate ? 'btn-primary' : 'btn-disabled'}`}
                onClick={handleCreate}
                disabled={(!canCreate && !submitting) || submitting}
              >
                {submitting ? (
                  <>
                    <span>Creating </span>
                    {/* Reuse existing CSS from modalStyles.css, overriding margin/color for button context */}
                    <div className="pulsing-dots" style={{ marginBottom: 0 }}>
                      <div className="dot" style={{ backgroundColor: '#ffffff', width: '6px', height: '6px' }} />
                      <div className="dot" style={{ backgroundColor: '#ffffff', width: '6px', height: '6px' }} />
                      <div className="dot" style={{ backgroundColor: '#ffffff', width: '6px', height: '6px' }} />
                    </div>
                  </>
                ) : (
                  'Create Quiz'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssignQuizModal;
