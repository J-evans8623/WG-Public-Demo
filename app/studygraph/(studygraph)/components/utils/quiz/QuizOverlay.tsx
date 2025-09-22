/**
 * @file QuizOverlay.tsx (Legacy)
 * @description
 *   Enhanced quiz overlay component with per-instance portal management that eliminates DOM conflicts
 *   between multiple quiz instances across slideshow and resource display contexts. This implementation
 *   creates unique portal roots for each QuizOverlay instance, preventing shared portal cleanup issues
 *   that caused quiz launch failures after slideshow-to-resource-display transitions. The component
 *   manages the complete quiz experience lifecycle including initialization, question rendering,
 *   user interaction tracking, score computation, and comprehensive results display with detailed
 *   question analysis. Key architectural improvements include instance-specific portal isolation,
 *   enhanced cleanup mechanisms, and improved error handling to ensure reliable quiz launching
 *   across all application contexts. The portal system now guarantees that each quiz instance
 *   operates independently without interfering with other quiz instances or DOM state, resolving
 *   the critical issue where quiz buttons became non-functional after slideshow interactions.
 *
 *   In this update, we introduce a user confirmation dialog that appears when the user attempts to
 *   exit an in-progress quiz (via the header “X”, in-quiz “Cancel”, ESC key, or clicking the backdrop).
 *   The dialog clearly communicates consequences: assigned quizzes will submit early and calculate a
 *   grade treating unanswered items as incorrect, while practice quizzes will simply exit without any
 *   network calls. The dialog is fully accessible (role, aria labels, initial focus on safe action),
 *   observable through targeted console logs, and implemented with minimal O(1) state while leveraging
 *   existing O(N) partial progress data to compute answered counts and the early-exit score. This design
 *   keeps all exit logic centralized in the overlay, avoids changes to child quiz components’ visuals,
 *   and maintains the existing CSS and portal architecture for maximum reliability.  update - 10
 *
 * @responsibilities
 *   - Create unique portal roots per instance to prevent DOM conflicts between quiz instances.
 *   - Manage quiz lifecycle states including loading, active quiz, and results display phases.
 *   - Coordinate with UserData context for quiz attempt tracking and analytics integration.
 *   - Provide consistent modal backdrop and overlay styling independent of parent CSS context.
 *   - Handle quiz type routing to appropriate component implementations with proper props passing.
 *   - Implement robust cleanup and event listener management for portal-rendered content.
 *   - Ensure accessibility compliance and keyboard navigation support for modal interactions.
 *   - Manage detailed results data flow from quiz components to score display interface.
 *   - Support comprehensive educational feedback through question-by-question analysis display.
 *   - Show a confirmation dialog before early submission/exit from in-progress quizzes.
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';
import { IQuizQuestion, QuizType } from '@/app/Library/Definitions/Definitions';
import ScoreDisplay from './ScoreDisplay';
import MultipleChoiceQuiz from './MultipleChoiceQuiz';
import TrueFalseQuiz from './TrueFalseQuiz';
import FillInBlankQuiz from './FillInBlankQuiz';
import MatchingQuiz from './MatchingQuiz';
import { useUserData } from '@/app/Library/Context/UserDataContext';
import '@/app/studygraph/(studygraph)/components/utils/quiz/QuizStyles.css';

interface QuizOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  quizType: QuizType;
  title: string;
  quizData: IQuizQuestion[];
  /**
   * onSubmitResults
   * @description
   *   Optional callback used by parents (AssessmentTab) to push the computed score and
   *   per-question details to the server (gradebook submission). The overlay invokes
   *   this after computing the score so the UI remains consistent with server truth.
   *   Expected to return a Promise; failures are logged but do not block the UI.
   */
  onSubmitResults?: (scorePct: number, details: any[]) => Promise<void>;
}

const QuizOverlay: React.FC<QuizOverlayProps> = ({
  isOpen,
  onClose,
  quizType,
  title,
  quizData,
  onSubmitResults,
}) => {
  // 1. Initialize component state for quiz progression and score management
  const { recordQuizAttempt, recordQuizSession } = useUserData();
  const [showScore, setShowScore] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [detailedResults, setDetailedResults] = useState<any[]>([]);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  // 2. Create unique instance identifier to prevent portal conflicts
  const instanceId = useRef(`quiz-modal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  const [partialResults, setPartialResults] = useState<{ id: string; correct: boolean }[]>([]); // update - 11
  const [partialDetails, setPartialDetails] = useState<any[]>([]); // update - 12

  // 2a. State for confirmation dialog and processing
  const [isConfirmOpen, setIsConfirmOpen] = useState(false); // update - 13
  const [confirmSource, setConfirmSource] = useState<'x' | 'cancel' | 'esc' | 'backdrop' | null>(null); // update - 14
  const [isSubmittingEarly, setIsSubmittingEarly] = useState(false); // update - 15
  const keepWorkingBtnRef = useRef<HTMLButtonElement | null>(null); // update - 16

  /**
   * initializeInstancePortalRoot - Creates unique portal root per QuizOverlay instance
   * @description
   *   Creates and manages a dedicated DOM node for this instance’s portal content to ensure
   *   isolation from other overlays. Also toggles pointer-events based on visibility. This
   *   function runs once per mount and cleans up on unmount. Complexity O(1) DOM operations.
   */
  useEffect(() => {
    console.log('[QuizOverlay.tsx:4001] Initializing per-instance portal root with ID:', instanceId.current);

    // 3. Create unique portal root element for this specific instance
    const uniquePortalId = instanceId.current;
    let modalRoot = document.getElementById(uniquePortalId);

    if (!modalRoot) {
      console.log('[QuizOverlay.tsx:4002] Creating new unique portal root:', uniquePortalId);
      modalRoot = document.createElement('div');
      modalRoot.id = uniquePortalId;
      modalRoot.style.position = 'fixed';
      modalRoot.style.top = '0';
      modalRoot.style.left = '0';
      modalRoot.style.width = '100%';
      modalRoot.style.height = '100%';
      modalRoot.style.zIndex = '2000'; // Higher than slideshow z-index (1001)
      modalRoot.style.pointerEvents = 'none'; // Allow clicks through when no modal content
      document.body.appendChild(modalRoot);
    }

    // 4. Enable pointer events when modal content is present
    modalRoot.style.pointerEvents = isOpen ? 'auto' : 'none';

    setPortalRoot(modalRoot);

    // 5. Cleanup function to remove only this instance's portal root
    return () => {
      console.log('[QuizOverlay.tsx:4003] Cleaning up instance-specific portal:', uniquePortalId);
      const portalElement = document.getElementById(uniquePortalId);

      if (portalElement && portalElement.parentNode === document.body) {
        try {
          document.body.removeChild(portalElement);
          console.log('[QuizOverlay.tsx:4004] Successfully removed instance portal root');
        } catch (error) {
          console.warn('[QuizOverlay.tsx:4005] Failed to remove instance portal root:', error);
        }
      }
    };
  }, [isOpen]); // Only run once per component instance

  // 6. Update portal pointer events based on open state
  useEffect(() => {
    if (portalRoot) {
      portalRoot.style.pointerEvents = isOpen ? 'auto' : 'none';
      console.log('[QuizOverlay.tsx:4006] Updated portal pointer events:', isOpen ? 'auto' : 'none');
    }
  }, [isOpen, portalRoot]);

  // 7. Reset quiz state when overlay closes to ensure clean state for next quiz session
  useEffect(() => {
    if (!isOpen) {
      console.log('[QuizOverlay.tsx:4007] Resetting quiz state on overlay close');
      setShowScore(false);
      setScore({ correct: 0, total: 0 });
      setDetailedResults([]);
      setPartialResults([]);
      setPartialDetails([]);
      setIsConfirmOpen(false); // update - 17
      setConfirmSource(null); // update - 18
      setIsSubmittingEarly(false); // update - 19
    }
  }, [isOpen]);

  /**
   * handleScoreSubmit - Processes quiz completion and manages analytics recording with detailed results flow
   * @description
   *   Records per-question attempts and the overall session, computes an aggregate score in O(N),
   *   updates local UI to show the ScoreDisplay, and (if provided) calls onSubmitResults with
   *   percent and details for backend gradebook submission. All key checkpoints are logged.
   */
  const handleScoreSubmit = async (
    results: { id: string; correct: boolean }[],
    detailed?: any[]
  ) => {
    console.log('[QuizOverlay.tsx:4008] Processing quiz score submission with', results.length, 'results');
    console.log('[QuizOverlay.tsx:4009] Detailed results received:', detailed ? detailed.length : 0, 'items');

    // 8. Record individual quiz attempts for analytics and progress tracking
    results.forEach(result =>
      recordQuizAttempt(result.id, quizType, result.correct)
    );

    // 9. Record overall quiz session for engagement metrics
    recordQuizSession();

    // 10. Compute aggregate score with O(n) time complexity
    const correctCount = results.filter(result => result.correct).length;
    const finalScore = { correct: correctCount, total: results.length };
    const scorePct = Math.round((correctCount / Math.max(1, results.length)) * 100);
    console.log('[QuizOverlay.tsx:4010] Quiz completion - Score:', correctCount, '/', results.length);

    // 11. Update component state to display results with detailed information
    setScore(finalScore);
    setDetailedResults(detailed || []);
    setShowScore(true);

    console.log('[QuizOverlay.tsx:4011] State updated - showScore:', true, 'detailedResults length:', (detailed || []).length);

    if (typeof onSubmitResults === 'function') {
      try {
        await onSubmitResults(scorePct, detailed || []);
        console.log('[QuizOverlay.tsx:4012] onSubmitResults ok');
      } catch (e) {
        console.warn('[QuizOverlay.tsx:4013] onSubmitResults failed', e);
      }
    }
  };

  /**
   * handleTryAgain
   * @description
   *   Clears in-memory quiz state for a new attempt when the results screen is visible.
   *   Complexity O(1).
   */
  const handleTryAgain = () => {
    console.log('[QuizOverlay.tsx][4013] try again → reset state');
    setShowScore(false);
    setScore({ correct: 0, total: 0 });
    setDetailedResults([]);
    setPartialResults([]); // update - 20
    setPartialDetails([]); // update - 21
  };

  /**
   * handleExit
   * @description
   *   Leaves the overlay after the results view, resetting state and delegating to parent close.
   *   Complexity O(1).
   */
  const handleExit = () => {
    console.log('[QuizOverlay.tsx][4014] exit after results');
    setShowScore(false);
    setScore({ correct: 0, total: 0 });
    setDetailedResults([]);
    setPartialResults([]);
    setPartialDetails([]);
    onClose();
  };

  /**
   * handleProgress
   * @description
   *   Receives in-progress correctness from child components. This fuels early-exit grading.
   *   Children should call this on any answer change. Complexity O(N) at worst when mapping.
   */
  const handleProgress = (partial: { id: string; correct: boolean }[], details?: any[]) => { // update - 22
    setPartialResults(partial || []);
    setPartialDetails(details || []);
    console.log('[QuizOverlay.tsx][4021] progress tap →', { answered: details?.filter?.((d: any) => d?.userAnswer !== null).length ?? 0, total: quizData.length });
  };

  /**
   * buildEarlyExitDetails
   * @description
   *   Constructs a details array representing the current state when a user exits early.
   *   Answered items use the child-provided correctness; unanswered are marked incorrect.
   *   Fields are minimal and backend-agnostic: { id, isCorrect, userAnswer }. Complexity O(N).
   */
  const buildEarlyExitDetails = (): any[] => { // update - 23
    const answeredMap = new Map(partialResults.map((r) => [r.id, r.correct]));
    // Prefer richer partialDetails if child provided them; ensure all items are present
    if (partialDetails.length > 0) {
      const normalized = partialDetails.map((d: any) => ({
        ...d,
        id: d.id,
        isCorrect: typeof d.isCorrect === 'boolean' ? d.isCorrect : !!answeredMap.get(d.id),
        userAnswer: typeof d.userAnswer === 'undefined' ? null : d.userAnswer,
      }));
      const missing = quizData
        .filter((q) => !normalized.some((d: any) => d.id === q.id))
        .map((q) => ({ id: q.id, isCorrect: false, userAnswer: null }));
      return [...normalized, ...missing];
    }

    // Minimal fallback with correctness only
    return quizData.map((q) => ({
      id: q.id,
      isCorrect: !!answeredMap.get(q.id),
      userAnswer: null,
    }));
  };

  /**
   * getAnsweredCount
   * @description
   *   Computes how many questions have a user selection so we can show “You’ve answered N of M.”
   *   Primary source is partialDetails.userAnswer; if not present, we conservatively infer from
   *   partialResults correctness flags. Operates in O(N) time over quiz length.
   */
  const getAnsweredCount = (): number => { // update - 24
    if (partialDetails && partialDetails.length > 0) {
      return partialDetails.reduce((acc: number, d: any) => acc + (d && d.userAnswer !== null ? 1 : 0), 0);
    }
    if (partialResults && partialResults.length > 0) {
      return partialResults.reduce((acc, r) => acc + (typeof r.correct === 'boolean' ? 1 : 0), 0);
    }
    return 0;
  };

  /**
   * performEarlyExit
   * @description
   *   Executes early-exit behavior after the user confirms. For assigned quizzes (onSubmitResults present),
   *   we compute the score by treating unanswered items as incorrect and submit to gradebook using the
   *   existing callback. For practice quizzes, we simply close without any network calls. The function is
   *   idempotent per click via a guarded “isSubmittingEarly” flag and logs key checkpoints for observability.
   */
  const performEarlyExit = async () => { // update - 25
    if (isSubmittingEarly) return;
    const isAssigned = typeof onSubmitResults === 'function';
    if (!showScore && isAssigned) {
      try {
        setIsSubmittingEarly(true);
        const total = Math.max(1, quizData?.length || 0);
        const details = buildEarlyExitDetails();
        const answered = details.filter((d) => d.userAnswer !== null).length;
        const correctSoFar = details.filter((d) => d.isCorrect).length;
        const scorePct = Math.round((correctSoFar / total) * 100);
        console.log('[QuizOverlay.tsx:5007] early-exit', { answered, total, scorePct, detailsLen: details.length });
        await onSubmitResults!(scorePct, details);
        console.log('[QuizOverlay.tsx:5003] confirm-submit-assigned');
      } catch (e) {
        console.warn('[QuizOverlay.tsx:4024] early-exit submit failed', e);
      } finally {
        setIsSubmittingEarly(false);
        setIsConfirmOpen(false);
        onClose();
      }
    } else {
      console.log('[QuizOverlay.tsx:5004] confirm-exit-practice');
      setIsConfirmOpen(false);
      onClose();
    }
  };

  /**
   * handleRequestClose
   * @description
   *   Intercepts the user clicking the close/Cancel while the quiz is active (not on results).
   *   Instead of immediately exiting, we open a small confirmation dialog. If the quiz is already
   *   on the results screen, we bypass the dialog and close immediately. Complexity O(1).
   */
  const handleRequestClose = useCallback((source: 'x' | 'cancel' | 'esc' | 'backdrop' = 'x') => { // update - 26
    if (showScore) {
      onClose();
      return;
    }
    setConfirmSource(source);
    setIsConfirmOpen(true);
    console.log('[QuizOverlay.tsx:5001] confirm-open source=', source);
  }, [onClose, showScore]);

  /**
   * Keyboard: ESC handling
   * @description
   *   Adds a keydown listener while the overlay is open. When ESC is pressed:
   *   - If the confirm dialog is open, it closes the dialog only (safe action).
   *   - If the quiz is active and the dialog is not open, it opens the confirmation dialog.
   *   - If the results are showing, it closes the overlay directly.
   *   The listener is cleaned up on unmount to avoid leaks.
   */
  useEffect(() => { // update - 27
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (isConfirmOpen) {
        setIsConfirmOpen(false);
        console.log('[QuizOverlay.tsx:5002] confirm-cancel (ESC)');
        return;
      }
      if (!showScore) {
        console.log('[QuizOverlay.tsx:5005] confirm-open-esc');
        handleRequestClose('esc');
      } else {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, isConfirmOpen, showScore, onClose, handleRequestClose]); // update - 28

  /**
   * Focus management for confirm dialog
   * @description
   *   When the confirm dialog opens, we focus the non-destructive “Keep working” button to reduce
   *   accidental submissions and support keyboard users. Complexity O(1).
   */
  useEffect(() => { // update - 29
    if (isConfirmOpen && keepWorkingBtnRef.current) {
      keepWorkingBtnRef.current.focus();
    }
  }, [isConfirmOpen]);

  // 15. Early return if overlay is closed or portal root not ready
  if (!isOpen || !portalRoot) {
    return null;
  }

  /**
   * renderQuizContent - Dynamically renders appropriate quiz component based on type with detailed results support
   * @description
   *   Renders the appropriate quiz implementation by type, passes through the submit, progress, and
   *   close handlers, and shows the ScoreDisplay if results are available. Uses O(1) selection logic.
   */
  const renderQuizContent = () => {
    // 12. Handle results display state with detailed analysis support
    if (showScore) {
      console.log('[QuizOverlay.tsx:4015] Rendering ScoreDisplay with detailed results:', detailedResults.length, 'items');
      return (
        <ScoreDisplay
          score={score.correct}
          total={score.total}
          onExit={handleExit}
          results={detailedResults}
          onTryAgain={handleTryAgain}
        />
      );
    }

    // 13. Validate quiz data availability
    if (!quizData || quizData.length === 0) {
      console.log('[QuizOverlay.tsx:4016] No quiz questions available for rendering');
      return <div>No quiz questions available</div>;
    }

    // 14. Route to appropriate quiz component based on type with O(1) lookup
    console.log('[QuizOverlay.tsx:4017] Rendering quiz type:', quizType, 'with', quizData.length, 'questions');

    switch (quizType) {
      case 'multipleChoice':
        return (
          <MultipleChoiceQuiz
            quizData={quizData}
            onSubmit={handleScoreSubmit}
            onClose={() => handleRequestClose('cancel')} // update - 30
            onProgress={handleProgress} // update - 31
          />
        );
      case 'true-false':
        return (
          <TrueFalseQuiz
            quizData={quizData}
            onSubmit={handleScoreSubmit}
            onClose={() => handleRequestClose('cancel')} // update - 32
            onProgress={handleProgress} // update - 33
          />
        );
      case 'FIB':
        return (
          <FillInBlankQuiz
            quizData={quizData}
            onSubmit={handleScoreSubmit}
            onClose={() => handleRequestClose('cancel')} // update - 34
            onProgress={handleProgress} // update - 35
          />
        );
      case 'matching':
        return (
          <MatchingQuiz
            title={title}
            quizData={quizData}
            onSubmit={handleScoreSubmit}
            onClose={() => handleRequestClose('cancel')} // update - 36
            onProgress={handleProgress} // update - 37
          />
        );
      default:
        console.log('[QuizOverlay.tsx:4018] Unsupported quiz type encountered:', quizType);
        return <div>Unsupported quiz type</div>;
    }
  };

  // 16. Render quiz modal through instance-specific React portal for complete DOM isolation
  console.log('[QuizOverlay.tsx:4019] Rendering quiz overlay through instance portal:', instanceId.current, 'showScore:', showScore);

  const isAssigned = typeof onSubmitResults === 'function'; // update - 38
  const answeredCount = getAnsweredCount(); // update - 39
  const totalCount = quizData.length; // update - 40

  return ReactDOM.createPortal(
    <div
      className="quiz-overlay"
      onClick={(e) => {
        // Backdrop detection: only when clicking directly on the overlay background
        if (e.target === e.currentTarget) {
          if (showScore) {
            onClose();
          } else {
            console.log('[QuizOverlay.tsx:5006] confirm-open-backdrop');
            handleRequestClose('backdrop'); // update - 41
          }
        }
      }}
    >
      <div className="quiz-modal">
        {!showScore && (
          <div className="quiz-header">
            <h2 className="quiz-title">{title}</h2>
            <button
              onClick={() => handleRequestClose('x')} // update - 42 (fix: wrap to match MouseEventHandler signature)
              className="quiz-close-btn"
              aria-label="Close Quiz"
            >
              <X size={20} />
            </button>
          </div>
        )}
        <div className="quiz-content" style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
          {renderQuizContent()}
        </div>
      </div>

      {isConfirmOpen && (
        // Lightweight confirm dialog: accessible and minimal, no CSS changes required
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="quiz-confirm-title"
          aria-describedby="quiz-confirm-desc"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2100,
          }}
          onClick={(e) => {
            // Clicking the dim background should close the confirm, not the quiz
            if (e.target === e.currentTarget) {
              setIsConfirmOpen(false);
              console.log('[QuizOverlay.tsx:5002] confirm-cancel (backdrop)');
            }
          }}
        >
          <div
            style={{
              background: '#fff',
              width: 'min(520px, 92vw)',
              borderRadius: '10px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
              <h3 id="quiz-confirm-title" style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>
                {isAssigned ? 'Submit quiz now?' : 'Exit quiz?'} {/* update - 43 */}
              </h3>
            </div>
            <div id="quiz-confirm-desc" style={{ padding: '16px 20px', color: '#374151', lineHeight: 1.5 }}>
              <p style={{ marginBottom: 8 }}>
                {isAssigned
                  ? 'Closing now will submit your quiz.'
                  : 'Closing now will exit without submitting a grade.'}
              </p>
              <p style={{ marginBottom: 8 }}>
                Unanswered questions will be marked incorrect.
              </p>
              <p style={{ margin: 0 }}>
                You’ve answered <strong>{answeredCount}</strong> of <strong>{totalCount}</strong> questions.
              </p>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
                padding: '14px 20px',
                background: '#f9fafb',
                borderTop: '1px solid #e5e7eb',
              }}
            >
              <button
                ref={keepWorkingBtnRef}
                onClick={() => {
                  setIsConfirmOpen(false);
                  console.log('[QuizOverlay.tsx:5002] confirm-cancel');
                }}
                className="quiz-btn quiz-btn-secondary"
              >
                Keep working
              </button>
              <button
                onClick={performEarlyExit}
                disabled={isSubmittingEarly}
                className="quiz-btn quiz-btn-primary"
              >
                {isAssigned ? 'Submit now' : 'Exit quiz'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    portalRoot
  );
};

export default QuizOverlay;
