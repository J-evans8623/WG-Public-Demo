// app/studygraph/(studygraph)/components/Canvas/ReadWriteCanvas/Overlays/QuizOverlay.tsx
/**
 * @file QuizOverlay.tsx (Unified / RO-authority with conditional exit warning + early-exit partial grading)
 * @description
 *   This file renders the full-screen Quiz Overlay used by multiple entry points across the
 *   application (QuizCard, ResourceDisplay, and the AssessmentTab graded flow). It mounts into
 *   a dedicated portal root to isolate interactions from the rest of the DOM and hosts all quiz
 *   states: in-progress, submission, and score review. The overlay composes concrete quiz types
 *   (MCQ, T/F, FIB, Matching) and standardizes the submission pathway. NEW IN THIS UPDATE:
 *   1) the “exit with unanswered questions” warning is **conditionally shown only for assessed
 *      (graded) quizzes**—that is, when `isAssessment === true`. Practice sessions close immediately.
 *   2) the overlay can now compute and **submit a partial score on early exit** using a pure scoring
 *      utility (`scoreByType`). Each quiz child exposes `getProgress()` via `forwardRef`, allowing
 *      the overlay to snapshot a defensible progress state (unanswered counts as incorrect) and submit
 *      it when the user confirms exit during an assessment. This submission follows the existing
 *      `onSubmitResults(scorePct, details)` contract so upstream Gradebook logic remains untouched.
 *   The component keeps prior CSS hooks and DOM structure, adds sparse console logs for observability
 *   (file-qualified with unique 4-digit codes), and favors O(1) control logic, with O(N) passes only
 *   when scoring (bounded by quiz length). No visual or CSS changes were introduced.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';
import { IQuizQuestion, QuizType } from '@/app/Library/Definitions/Definitions';
import ScoreDisplay from '../../../../utils/quiz/ScoreDisplay';
import MultipleChoiceQuiz from './quiz/MultipleChoiceQuiz';
import TrueFalseQuiz from './quiz/TrueFalseQuiz';
import FillInBlankQuiz from './quiz/FillInBlankQuiz';
import MatchingQuiz from './quiz/MatchingQuiz';
import { useUserData } from '@/app/Library/Context/UserDataContext';
import QuizExitWarningModal from './QuizExitWarningModal';
import '@/app/studygraph/(studygraph)/components/utils/quiz/QuizStyles.css';
// update - 1
import {
  scoreByType,
  type ProgressHandle,
  type ProgressSnapshot,
  type ScoreResult,
} from './quiz/scoringUtils';

interface QuizOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  quizType: QuizType;
  title: string;
  quizData: IQuizQuestion[];
  isAssessment: boolean;
  onSubmitResults?: (scorePct: number, details: any[]) => Promise<void>;
   attemptsRemaining?: number;
}

type ProgressDetail = { id: string; isCorrect: boolean; userAnswer: any | null };

const QuizOverlay: React.FC<QuizOverlayProps> = ({
  isOpen,
  onClose,
  quizType,
  title,
  quizData,
  onSubmitResults,
  isAssessment = false,
  attemptsRemaining = 0,
}) => {
  const { recordQuizAttempt, recordQuizSession } = useUserData();
  const [showScore, setShowScore] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [detailedResults, setDetailedResults] = useState<any[]>([]);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  // ===== Separate confirm layer state + root (conceptual nesting) =====
  const [confirmOpen, setConfirmOpen] = useState(false);
  // update - 2: progressDetails remains for legacy parity but incomplete check now uses a snapshot getter.
  const [progressDetails, setProgressDetails] = useState<ProgressDetail[] | null>(null);
  const PORTAL_ROOT_ID = 'ro-quiz-modal-root';
  const CONFIRM_ROOT_ID = 'ro-quiz-confirm-root';

  // update - 3: child progress handle (single child mounted at a time)
  const childRef = useRef<ProgressHandle | null>(null);

  // ===== Mount / ensure both portal roots exist =====
  useEffect(() => {
    console.log('[QuizOverlay.tsx][7301] mount: ensuring portal roots', {
      PORTAL_ROOT_ID,
      CONFIRM_ROOT_ID,
    });

    let quizRoot = document.getElementById(PORTAL_ROOT_ID);
    if (!quizRoot) {
      quizRoot = document.createElement('div');
      quizRoot.id = PORTAL_ROOT_ID;
      quizRoot.style.position = 'relative';
      quizRoot.style.zIndex = '2000';
      document.body.appendChild(quizRoot);
    }
    setPortalRoot(quizRoot);

    let confirmRoot = document.getElementById(CONFIRM_ROOT_ID);
    if (!confirmRoot) {
      confirmRoot = document.createElement('div');
      confirmRoot.id = CONFIRM_ROOT_ID;
      confirmRoot.style.position = 'relative';
      confirmRoot.style.zIndex = '2300';
      document.body.appendChild(confirmRoot);
    }

    return () => {
      console.log('[QuizOverlay.tsx][7302] unmount: attempt cleanup of empty portal roots');
      const tryRemove = (node: HTMLElement | null) => {
        if (!node) return;
        if (node.parentNode === document.body && node.childElementCount === 0) {
          try {
            document.body.removeChild(node);
          } catch (error) {
            console.warn('[QuizOverlay.tsx][7399] portal cleanup failed', error);
          }
        }
      };
      tryRemove(quizRoot as HTMLElement);
      tryRemove(confirmRoot as HTMLElement);
    };
  }, []);

  // Reset overlay state when it closes
  useEffect(() => {
    if (!isOpen) {
      setShowScore(false);
      setScore({ correct: 0, total: 0 });
      setDetailedResults([]);
      setConfirmOpen(false);
      setProgressDetails(null);
    }
  }, [isOpen]);

  // update - 4: helper to inspect a ProgressSnapshot and decide if any answers are missing
  const isSnapshotIncomplete = useCallback(
    (snap?: ProgressSnapshot<any>): boolean => {
      if (!snap || typeof snap.answers === 'undefined' || snap.answers === null) return true;

      switch (quizType) {
        case 'multipleChoice': {
          const map = (snap.answers || {}) as Record<string, string | undefined>;
          // Incomplete if not every question id has a non-empty selected option
          for (const q of quizData) {
            const v = map[q.id];
            if (v === undefined || v === null || v === '') return true;
          }
          return false;
        }
        case 'true-false': {
          const map = (snap.answers || {}) as Record<string, boolean | null | undefined>;
          for (const q of quizData) {
            const v = map[q.id];
            if (typeof v !== 'boolean') return true;
          }
          return false;
        }
        case 'FIB': {
          const arr = (snap.answers || []) as string[];
          if (arr.length < quizData.length) return true;
          for (let i = 0; i < quizData.length; i++) {
            if (!arr[i] || arr[i].trim() === '') return true;
          }
          return false;
        }
        case 'matching': {
          const letters = (snap.answers || []) as string[];
          if (letters.length < quizData.length) return true;
          for (let i = 0; i < quizData.length; i++) {
            const v = letters[i];
            if (!v || v.trim() === '') return true;
          }
          return false;
        }
        default:
          return true;
      }
    },
    [quizData, quizType]
  );

  // update - 5: compute and submit partial score (assessment early-exit path)
  const computeAndSubmitPartialScore = useCallback(async () => {
    try {
      const snap = childRef.current?.getProgress();
      console.log('[QuizOverlay.tsx][7310] partial-score: snapshot pulled', {
        hasSnap: !!snap,
      });

      const result: ScoreResult = scoreByType(quizType, quizData, snap || { answers: {} });
      const pct = result.total ? Math.round((result.correct / result.total) * 100) : 0;
      console.log('[QuizOverlay.tsx][7311] partial-score: computed', {
        correct: result.correct,
        total: result.total,
        pct,
      });

      if (onSubmitResults) {
        await onSubmitResults(pct, result.detailed);
        console.log('[QuizOverlay.tsx][7312] partial-score: onSubmitResults ok');
      }
    } catch (e: any) {
      console.warn('[QuizOverlay.tsx][7397] partial-score: failed', e?.message);
    }
  }, [onSubmitResults, quizData, quizType]);

  /**
   * @function handleScoreSubmit
   * @description
   *   Computes the final score from per-question correctness, records the attempt and the session,
   *   updates local score state, and transitions the overlay to the ScoreDisplay view. This keeps
   *   observability focused with a single success log and defers any upstream submission to the
   *   parent when applicable. Complexity: O(N) over results, bounded by quiz length.
   */
  const handleScoreSubmit = (
    results: { id: string; correct: boolean }[],
    detailed?: any[]
  ) => {
    results.forEach((r) => recordQuizAttempt(r.id, quizType, r.correct));
    recordQuizSession();

    const correctCount = results.filter((r) => r.correct).length;
    const finalScore = { correct: correctCount, total: results.length };

    setScore(finalScore);
    setDetailedResults(detailed || []);
    setShowScore(true);
    console.log('[QuizOverlay.tsx][7303] submit: local score computed', {
      correct: finalScore.correct,
      total: finalScore.total,
    });

    if (onSubmitResults) {
      const pct = results.length ? Math.round((correctCount / results.length) * 100) : 0;
      onSubmitResults(pct, detailed || []).catch((e) => {
        console.warn('[QuizOverlay.tsx][7398] onSubmitResults failed (non-blocking)', e?.message);
      });
    }
  };

  /**
   * @function handleTryAgain
   * @description
   *   Resets score state and returns the overlay to an in-progress state without closing it.
   *   Used for practice / review flows. Complexity: O(1).
   */
  const handleTryAgain = () => {
    setShowScore(false);
    setScore({ correct: 0, total: 0 });
    setDetailedResults([]);
    console.log('[QuizOverlay.tsx][7304] try-again: reset local score state');
  };

  /**
   * @function requestExit
   * @description
   *   Centralized exit handler for close button and backdrop clicks. NEW BEHAVIOR:
   *   - If `isAssessment === false` (practice), exit **immediately** with no warning.
   *   - If `isAssessment === true` (graded):
   *       • If already showing score → close immediately.
   *       • If in-progress and **incomplete** → open confirm dialog.
   *       • Else → close immediately.
   *   Complexity: O(1). Logs report the gating decision for observability.
   */
  const requestExit = useCallback(() => {
    // update - 6: compute incompleteness using current child snapshot
    const snap = childRef.current?.getProgress();
    const incomplete = isSnapshotIncomplete(snap);
    console.log('[QuizOverlay.tsx][7305] request-exit', {
      isAssessment,
      showScore,
      incomplete,
    });

    if (!isAssessment) {
      onClose();
      return;
    }

    if (showScore) {
      onClose();
      return;
    }

    if (incomplete) {
      setConfirmOpen(true);
      console.log('[QuizOverlay.tsx][7306] assessment exit guarded → confirmOpen=true');
    } else {
      onClose();
    }
  }, [isAssessment, isSnapshotIncomplete, onClose, showScore]);

  /**
   * @function confirmExit
   * @description
   *   Confirms exiting an assessed quiz with unanswered questions. NEW: computes and submits
   *   a partial score before closing, applying the “unanswered = incorrect” policy centrally.
   *   Complexity: O(N) due to scoring (bounded). Purposeful logs surround lifecycle.
   */
  const confirmExit = useCallback(async () => {
    setConfirmOpen(false);
    console.log('[QuizOverlay.tsx][7307] confirm-exit: assessment exit confirmed (partial submit begin)');
    // update - 7
    if (isAssessment) {
      await computeAndSubmitPartialScore();
    }
    onClose();
  }, [computeAndSubmitPartialScore, isAssessment, onClose]);

  /**
   * @function cancelExit
   * @description
   *   Cancels the exit from the confirm dialog and returns the user to the quiz. Complexity: O(1).
   */
  const cancelExit = useCallback(() => {
    setConfirmOpen(false);
    console.log('[QuizOverlay.tsx][7308] cancel-exit: resumed quiz');
  }, []);

  // ===== Render quiz content and pass progress handle + guarded close =====
  const renderQuizContent = () => {
    if (showScore) {
      return (
        <ScoreDisplay
          score={score.correct}
          total={score.total}
          onExit={requestExit}
          results={detailedResults}
          onTryAgain={handleTryAgain}
        />
      );
    }

    if (!quizData || quizData.length === 0) {
      return <div>No quiz questions available</div>;
    }

    switch (quizType) {
      case 'multipleChoice':
        return (
          // update - 8
          <MultipleChoiceQuiz
            ref={childRef}
            quizData={quizData}
            onSubmit={handleScoreSubmit}
            onClose={requestExit}
          />
        );
      case 'true-false':
        return (
          // update - 9
          <TrueFalseQuiz
            ref={childRef}
            quizData={quizData}
            onSubmit={handleScoreSubmit}
            onClose={requestExit}
          />
        );
      case 'FIB':
        return (
          // update - 10
          <FillInBlankQuiz
            ref={childRef}
            quizData={quizData}
            onSubmit={handleScoreSubmit}
            onClose={requestExit}
          />
        );
      case 'matching':
        return (
          // update - 11
          <MatchingQuiz
            ref={childRef}
            title={title}
            quizData={quizData}
            onSubmit={handleScoreSubmit}
            onClose={requestExit}
          />
        );
      default:
        return <div>Unsupported quiz type</div>;
    }
  };

  if (!isOpen || !portalRoot) {
    return null;
  }

   // Inline chip style to avoid new CSS files — O(1). // update - 2003
  const attemptsChip =
    isAssessment ? (
      <div style={{ position: 'absolute', right: 12, top: 12 }}>
        <span
          style={{
            display: 'inline-block',
            border: '1px solid #E5E7EB',
            background: '#FFFFFF',
            color: '#374151',
            borderRadius: 999,
            padding: '2px 8px',
            fontSize: 12,
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          Attempts remaining: {Math.max(0, Number(attemptsRemaining || 0))}
        </span>
      </div>
    ) : null;


  // Confirm message with attempts remaining for assessments. /
  const confirmMessage = isAssessment
    ? `You have unanswered questions. You have ${Math.max(
        0,
        Number(attemptsRemaining || 0)
      )} attempts remaining. Submit and exit now?`
    : 'You have unanswered questions. Submit and exit now?';


  return ReactDOM.createPortal(
    <>
      <div
        className="quiz-overlay"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) requestExit();
        }}
      >
        <div className="quiz-modal">
          {!showScore && (
            <div className="quiz-header">
              <h2 className="quiz-title">{title}</h2>
              {attemptsChip /* update - 2005 */}
              <button
                onClick={requestExit}
                className="quiz-close-btn"
                aria-label="Close Quiz"
              >
                <X size={20} />
              </button>
            </div>
          )}
          <div
            className="quiz-content"
            style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}
          >
            {renderQuizContent()}
          </div>
        </div>
      </div>

      {/* update - 12: visibility controlled by confirmOpen & isAssessment */}
      <QuizExitWarningModal
        open={confirmOpen && isAssessment}
        title="Submit quiz now?"
        message={confirmMessage}
        confirmLabel="Submit & Exit"
        cancelLabel="Keep working"
        onCancel={cancelExit}
        onConfirm={confirmExit}
        containerId={CONFIRM_ROOT_ID}
      />
    </>,
    portalRoot
  );
};

export default QuizOverlay;
