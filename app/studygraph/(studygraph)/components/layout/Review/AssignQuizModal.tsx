// app/studygraph/(studygraph)/components/modals/AssignQuizModal.tsx
/**
 * @file AssignQuizModal.tsx
 * @description
 *   (update - 6, 14, 16, 20, 26, 27–44)
 *   Role-gated, production-ready quiz authoring modal that lets Educators select a lesson (mapId)
 *   within a document (docId), configure assignment metadata (title, availability window, attempts),
 *   pick a quiz type, and specify the number of questions (hard-capped at 10). On submit, the modal
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

import React, { useMemo, useState } from 'react';
import '@/app/studygraph/(studygraph)/components/modals/modalStyles.css';
import './ReviewModalSystem.css';
import { ArrowLeft } from 'lucide-react';

import { useResourceContext } from '@/app/Library/Context/ResourceContext';
import { useGradebook } from '@/app/Library/hooks/useGradebook';
import { useApiContext } from '@/app/src/context/ApiContext';
import { useYDoc } from '@/app/Library/Context/YDocContext';
import { useLessonModule } from '@/app/Library/Context/LessonModuleContext';
import { parseQuizResponse } from '../../hooks/parseQuizResponse';

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
 *   (update - 13)
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
 * AssignQuizModal
 * @description
 *   (update - 8, 27–44)
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
  isEducator,      // update - 29
}) => {
  // update - 30
  const { createQuizAssignmentCard } = useResourceContext();
  const {docFileID: docId} = useYDoc();
  const api = useApiContext();
  const { upsertAssignmentMeta, refresh } = useGradebook(docId!);
  const { activeConceptMapId, getLessonModule } = useLessonModule();
  
  const contextLessons: LessonLite[] = useMemo(() => {
    const lm = getLessonModule();
    return (lm?.conceptMaps || []).map((cm) => ({ id: cm.id, title: cm.title || cm.id }));
  }, [getLessonModule]);

  const lessonOptions: LessonLite[] = contextLessons;

  // 1) Lesson selection
  const [chosenLesson, setChosenLesson] = useState<string>('');
  const [isOpenSelect, setOpenSelect] = useState<boolean>(defaultOpenDropdown);
  const [quizTitle, setQuizTitle] = useState<string>('');

  // 2) Quiz type
  const [quizType, setQuizType] = useState<QuizType | ''>('');

  // 3) Quiz metadata (12h time fields)
  type Period = 'AM' | 'PM' | '';
  const [startDateStr, setStartDateStr] = useState<string>('');
  const [endDateStr, setEndDateStr] = useState<string>('');
  const [startTime, setStartTime] = useState<{ hour: string; minute: string; period: Period }>({
    hour: '',
    minute: '',
    period: 'AM',
  });
  const [endTime, setEndTime] = useState<{ hour: string; minute: string; period: Period }>({
    hour: '',
    minute: '',
    period: 'PM',
  });
  const [attempts, setAttempts] = useState<number>(1);
  const [numQuestions, setNumQuestions] = useState<number>(10);
  // update - 32
  const [submitting, setSubmitting] = useState<boolean>(false);

   const hasLessons = useMemo(() => lessonOptions && lessonOptions.length > 0, [lessonOptions]);

  const hourOptions = useMemo(() => Array.from({ length: 11 }, (_, i) => String(i + 1).padStart(2, '0')), []);
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
  const questionsValid = Number.isFinite(numQuestions) && numQuestions >= 1 && numQuestions <= 10;
  const titleValid = quizTitle.trim().length > 0;
  const canCreate = Boolean(isEducator && chosenLesson && titleValid && quizType && datesValid && attemptsValid && questionsValid && !submitting);


  

  // update - 34
  async function upsertAssignMeta(params: {
    docId: string;
    assignmentId: string;
    title: string;
    startAtISO: string;
    endAtISO: string;
    attemptLimit: number;
  }): Promise<{ assignmentId: string; title: string; startAt: string; endAt: string; attemptLimit: number }> {
    console.log('[AssignQuizModal.tsx][9411] POST /api/gradebook/assign-meta', { docId: params.docId });
    const resp = await fetch('/api/gradebook/assign-meta', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        docId: params.docId,
        assignmentId: params.assignmentId,
        title: params.title,
        window: { startAt: params.startAtISO, endAt: params.endAtISO },
        attemptLimit: params.attemptLimit,
      }),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      console.error('[AssignQuizModal.tsx][9499] assign-meta failed', { status: resp.status, errText });
      throw new Error('assign-meta upsert failed');
    }
    const data = await resp.json();
    console.log('[AssignQuizModal.tsx][9412] assign-meta ok', data);
    // Normalize to AssignmentHeader shape
    return {
      assignmentId: data.assignmentId,
      title: data.title,
      startAt: data.window?.startAt ?? params.startAtISO,
      endAt: data.window?.endAt ?? params.endAtISO,
      attemptLimit: data.attemptLimit ?? params.attemptLimit,
    };
  }

  /**
   * handleCreate
   * @description
   *   (update - 12, 35–40)
   *   Executes the full flow:
   *     A) generate quiz (shared generator)
   *     B) create Yjs quizAssessment card (inline binding)
   *     C) upsert assignment meta to BFF
   *     D) gradebook nudge + refresh
   *   Emits precise logs at each checkpoint. Complexity is dominated by network latency; local work is O(1).
   */
  const handleCreate = async () => {
    if (!canCreate) {
      console.log('[AssignQuizModal.tsx][9320] create blocked - invalid state', {
        isEducator, chosenLesson, quizTitle, quizType, startDateStr, startTime, endDateStr, endTime,
        attempts, numQuestions, datesValid, attemptsValid, questionsValid, titleValid, submitting,
      });
      return;
    }

    setSubmitting(true);
    const payload: CreateQuizPayload = {
      lessonId: chosenLesson,
      title: quizTitle.trim(),
      quizType: quizType as QuizType,
      startAtISO: startDateObj!.toISOString(),
      endAtISO: endDateObj!.toISOString(),
      attempts,
      numQuestions,
    };
    console.log('[AssignQuizModal.tsx][9321] submitting payload', payload);

    try {
      // A) Generate quiz using the shared generator
      const apiQuizType = mapQuizTypeToApiValue(payload.quizType);
      console.log('[AssignQuizModal.tsx][9413] generateQuiz begin', { docId, lessonId: payload.lessonId, apiQuizType, questionCount: payload.numQuestions });

      const quizResponse = api.createQuiz(
        payload.lessonId,
        [apiQuizType],
        docId,
        payload.numQuestions
      );
      console.log('[AssignQuizModal.tsx][9414] generateQuiz ok');
      
      // B) Parse → inline binding (canonical spec via shared parser)
      //    We feed parser with the service payload data (or raw) and the chosen mapId.


      const parsedResource = parseQuizResponse((quizResponse as any)?.data ?? quizResponse, payload.lessonId);
      if (!parsedResource) {
        console.error('[AssignQuizModal.tsx][9422] parseQuizResponse returned null');
        throw new Error('Failed to parse quiz response');
      }

      // B) Create a Yjs global quizAssessment card with INLINE binding
      //    We provide `mapId` so the resource is stored under the correct concept map.
      const inlineBinding: any = {
        variant: 'inline',               // flexible binding shape
        quizType: parsedResource.content.quizType,
        data: parsedResource.content.quizContent,              // full JSON from the model
      };

      const yjsCard = await createQuizAssignmentCard({
        mapId: payload.lessonId,
        title: payload.title,
        binding: inlineBinding,
        window: { startAt: payload.startAtISO, endAt: payload.endAtISO },
        attemptLimit: payload.attempts,
      });
      console.log('[AssignQuizModal.tsx][9415] Yjs quizAssessment created', { assignmentId: yjsCard.assignmentId });

      // C) Persist meta to the BFF (server authority)
      const savedHeader = await api.assignMetaUpsert({
        docId,
        assignmentId: yjsCard.assignmentId,
        title: payload.title,
        startAt: payload.startAtISO,
        endAt: payload.endAtISO,
        attemptLimit: payload.attempts,
      });

      // AssignMetaUpsertRes is { saved: { assignmentId, title, startAt, endAt, attemptLimit, ... } }
      const saved = (savedHeader as any).saved ?? savedHeader; // tolerant to prior shapes

      // D) Nudge gradebook header and refresh
      upsertAssignmentMeta({
        assignmentId: saved.assignmentId,
        title: saved.title,
        startAt: saved.startAt,
        endAt: saved.endAt,
        attemptLimit: saved.attemptLimit,
      });
      console.log('[AssignQuizModal.tsx][9416] Gradebook header nudged');
      await refresh();
      console.log('[AssignQuizModal.tsx][9417] Gradebook refreshed');

      // Notify host (original callback contract preserved)
      onCreate(payload);

      // Close on success
      onClose();
    } catch (err: any) {
      console.error('[AssignQuizModal.tsx][9498] create flow failed', { message: err?.message });
      // You could surface a toast here; keeping console-only per instructions.
    } finally {
      setSubmitting(false);
    }
  };

  // Disabled view for non-Educators (update - 41)
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
                          <option value="">12</option>
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
                          <option value="">00</option>
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
              <div className="quiz-meta-row">
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

                <div className="quiz-questions-section">
                  <div className="quiz-group-label">Quiz Questions</div>
                  <input
                    type="number"
                    className="quiz-questions-input"
                    min={1}
                    max={10}
                    step={1}
                    value={numQuestions}
                    onChange={(e) =>
                      setNumQuestions(Math.min(10, Math.max(1, Number(e.target.value) || 1)))
                    }
                  />
                  <div className="quiz-questions-label">Total number of questions (max 10)</div>
                </div>
              </div>

              {datesFilled && !datesValid && (
                <div className="rms-inline-hint">Start must be before end.</div>
              )}
            </fieldset>

            {/* (3) Quiz Type */}
            <fieldset className="rms-field" disabled={gatedDisabled}>
              <legend className="rms-legend">Select a quiz type</legend>
              <div className="rms-radio-grid">
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

            {/* Footer */}
            <div className="button-section">
              <button className="btn btn-cancel" onClick={onClose}>
                Cancel
              </button>
              <button
                className={`btn ${canCreate ? 'btn-primary' : 'btn-disabled'}`}
                onClick={handleCreate}
                disabled={!canCreate}
              >
                {submitting ? 'Creating…' : 'Create Quiz'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssignQuizModal;
