// bloom-maps\app\studygraph\(studygraph)\components\layout\Canvas\ReadWriteCanvas\Cards\QuizCard.tsx

/**
 * @file QuizCard.tsx
 * @description
 * This file implements the single, unified QuizCard component that serves as the canonical entry point
 * for starting quizzes across both read-only (RO) and read/write (RW) surfaces. The component is designed
 * to be responsive and visually consistent whether it’s rendered in a wide slideshow overlay or a narrow
 * right-rail CardDisplay panel. Its primary responsibilities are: (1) sample and prepare a concise question
 * set from the source quiz content using the shuffle-and-limit utility; (2) enrich each question with the
 * contextual metadata (mapId, parentQuizId) needed for analytics and downstream flows; (3) open the unified
 * QuizOverlay with the curated questions; (4) maintain a clean, accessible UI that adapts to container width
 * without style drift; (5) emit purposeful console logs that mark major user actions for observability; and
 * (6) preserve backwards compatibility with prior props (including optional onStartQuiz). All per-interaction
 * work is O(1) and the only O(N) pass is the question sampling step, which is capped at 10 items by design.
 *
 * Responsibilities:
 *   1) Provide a single “Start Quiz” CTA that opens the unified QuizOverlay with sampled questions.
 *   2) Preserve prop compatibility across RO/RW callers, including optional onStartQuiz callback.
 *   3) Enrich questions with mapId and parentQuizId metadata for tracking/telemetry.
 *   4) Render a container-responsive layout without altering canonical CSS tokens elsewhere.
 *   5) Log high-signal state transitions (open, close, sampling) with stable 4-digit codes.
 *   6) Favor O(1)/O(N) complexity and avoid unnecessary re-renders or allocations.
 */

import React, { useState } from 'react';
// update - 1: point to the unified QuizOverlay (Phase 2 authority)
import QuizOverlay from '../Overlays/QuizOverlay';  
import { IQuizQuestion, QuizType } from '@/app/Library/Definitions/Definitions';
import { shuffleAndLimit } from '../../../CardDisplay/Cards/quizUtils';

export interface QuizCardProps {
  /** Card title (displayed above "Start Quiz") */
  title: string;
  /** Quiz data & type */
  content: {
    quizType: QuizType;
    quizContent: IQuizQuestion[];
  };
  /** Parent practice sheet id (resource id) */
  parentQuizId: string;
  /** Concept map id for analytics/telemetry */
  mapId: string;
  /** When true, suppress header (kept for compatibility) */
  hideHeader?: boolean;
  /** Optional hook for host telemetry before overlay opens */
  onStartQuiz?: (quizType: QuizType, title: string, questions: IQuizQuestion[]) => void;
}

const QuizCard: React.FC<QuizCardProps> = ({
  title,
  content,
  hideHeader = false,
  mapId,
  parentQuizId,
  onStartQuiz,
}) => {
  // 1) Local overlay state
  const [isQuizOpen, setIsQuizOpen] = useState(false);
  const [selectedQuestions, setSelectedQuestions] = useState<IQuizQuestion[]>([]);

  // 2) Extract quiz inputs
  const { quizType, quizContent } = content;

  /**
   * @function handleStartQuiz
   * @description
   * Responsible for preparing and launching a quiz session. It selects up to 10 questions via the
   * shuffleAndLimit utility (O(N) over the provided quizContent but bounded), enriches each with
   * mapId and parentQuizId for downstream analytics, optionally notifies a host via onStartQuiz,
   * then opens the QuizOverlay. This function is designed to be deterministic, observable through
   * purposeful logs, and safe across both RO and RW render contexts.
   */
  const handleStartQuiz = () => {
    console.log('[QuizCard.tsx][1001] start-quiz clicked; available:', quizContent.length);

    // 3) Sample and tag the questions
    const sample = shuffleAndLimit(quizContent, 10).map((q) => ({
      ...q,
      parentQuizId,
      mapId,
    }));

    console.log('[QuizCard.tsx][1002] prepared questions:', sample.length);

    // 4) Optional host hook for telemetry
    if (onStartQuiz) {
      try {
        onStartQuiz(quizType, title, sample);
      } catch (err) {
        // keep logs sparse; still continue to open the overlay
        console.warn('[QuizCard.tsx][1004] onStartQuiz callback threw an error (ignored)', err);
      }
    }

    // 5) Open overlay
    setSelectedQuestions(sample);
    setIsQuizOpen(true);
  };

  return (
    <>
      {/* Responsive Quiz Card Interface */}
      <div className="quiz-card-container">
        <div className="quiz-card-content">
          <div className="quiz-card-inner">
            {!hideHeader && (
              <div className="quiz-info-section">
                <h4 className="quiz-info-title">Test your knowledge</h4>
              </div>
            )}

            <button onClick={handleStartQuiz} className="quiz-start-button">
              Start Quiz
            </button>
          </div>
        </div>
      </div>

      {/* Unified Quiz Overlay */}
      {isQuizOpen && (
        <QuizOverlay
          isOpen={isQuizOpen}
          onClose={() => {
            console.log('[QuizCard.tsx][1003] quiz overlay closed');
            setIsQuizOpen(false);
          }}
          quizType={quizType as any}
          title={title}
          quizData={
            selectedQuestions as any
          }
          resourceId={parentQuizId}
          isAssessment={false}
        />
      )}

      <style jsx>{`
        /* Base container styles for responsive behavior */
        .quiz-card-container {
          width: 100%;
          height: 100%;
          background: none;
          border-radius: 12px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        /* Content wrapper with responsive padding */
        .quiz-card-content {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
          min-height: 200px;
        }

        /* Inner content container with max width for large contexts */
        .quiz-card-inner {
          width: 100%;
          max-width: 500px;
          text-align: center;
        }

        /* Info section with responsive styling */
        .quiz-info-section {
          background-color: none;
          border-radius: 8px;
          padding: 1.5rem;
          margin-bottom: 2rem;
        }

        .quiz-info-title {
          font-size: 1.125rem;
          font-weight: 500;
          color: #111827;
          margin-bottom: 0.75rem;
          line-height: 1.4;
        }

        .quiz-info-description {
          color: #6b7280;
          line-height: 1.6;
          margin: 0;
          font-size: 0.95rem;
        }

        /* Responsive button styling */
        .quiz-start-button {
          background: linear-gradient(135deg, #5B8C5A 0%, #4a7349 100%);
          color: white;
          padding: 0.875rem 2rem;
          border-radius: 8px;
          font-weight: 500;
          font-size: 1rem;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          width: 100%;
          max-width: 200px;
        }

        .quiz-start-button:hover {
          background: linear-gradient(135deg, #6b9c6a 0%, #5a8359 100%);
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
          transform: translateY(-1px);
        }

        .quiz-start-button:active {
          transform: translateY(0);
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }

        /* Responsive adjustments for smaller containers */
        @media (max-width: 500px) {
          .quiz-card-content {
            padding: 1rem;
          }
          .quiz-info-section {
            padding: 1rem;
            margin-bottom: 1.5rem;
          }
          .quiz-info-title {
            font-size: 1rem;
          }
          .quiz-info-description {
            font-size: 0.875rem;
          }
          .quiz-start-button {
            padding: 0.75rem 1.5rem;
            font-size: 0.9rem;
          }
        }

        /* Even tighter containers (narrow cards / rails) */
        @container (max-width: 350px) {
          .quiz-card-content {
            padding: 0.75rem;
          }
          .quiz-info-section {
            padding: 0.875rem;
            margin-bottom: 1rem;
          }
          .quiz-info-title {
            font-size: 0.95rem;
            margin-bottom: 0.5rem;
          }
          .quiz-info-description {
            font-size: 0.8rem;
            line-height: 1.5;
          }
          .quiz-start-button {
            padding: 0.625rem 1.25rem;
            font-size: 0.85rem;
            max-width: 160px;
          }
        }

        /* Modern container query enablement */
        @supports (container-type: inline-size) {
          .quiz-card-container {
            container-type: inline-size;
          }
        }
      `}</style>
    </>
  );
};

export default QuizCard;
