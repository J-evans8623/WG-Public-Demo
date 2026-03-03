/***************************************************************************************************
 * @file StudentQuizDetail.tsx
 * @description
 *   View ② in the QuizFeedback feature. Renders the per-question correction breakdown for a
 *   scholar after they click "View Feedback →" on a grade list row. For each incorrect question
 *   the component displays: the original question text, the student's incorrect answer, the
 *   correct answer, an AI-generated explanation, a supporting source quote from the lesson, and
 *   a "Review Topic" button that deep-links into the lesson slides at the relevant topic.
 *
 *   Data source: quizFeedbackDetail is read directly from QuizFeedbackDataContext. The fetch
 *   that populates it is triggered imperatively by StudentGradesModal when the user clicks a
 *   feedback row — fetchFeedbackDetail is called with the selected attemptId before this
 *   component mounts. This component only reads; it never calls a fetch itself.
 *
 *   Unmount behaviour (Sprint 3 latency fix):
 *   The previous implementation called clearFeedbackDetail() in a useEffect cleanup function.
 *   That was the direct cause of the re-fetch loop: clearing the data on unmount nullified the
 *   context cache, so navigating back and reopening the same detail view triggered another BFF
 *   round-trip. The cleanup call has been removed entirely. clearFeedbackDetail now only runs
 *   when StudentGradesModal fully closes, at which point the provider itself is unmounted and
 *   the state is discarded anyway. The fetchFeedbackDetail call in QuizFeedbackDataContext is
 *   now cached by attemptId, so reopening the same detail view within a session is instant.
 *
 *   Hydration: integrates useQuizFeedbackHydration to reconcile lean performance records from
 *   Firestore with rich curriculum metadata from the Resource Context (Yjs Sentinel Nodes).
 ***************************************************************************************************/

'use client';

import React, { useEffect, useMemo } from 'react';
import './quizFeedbackStyles.css';
import { useQuizFeedback } from '@/app/Library/Context/QuizFeedbackDataContext';
import type { FeedbackItem } from '@/app/src/quizFeedback/quizFeedback.types';
import { useQuizFeedbackHydration } from '@/app/workspace/(studygraph)/components/hooks/useQuizFeedbackHydration';
import { useTopicSlidePlayer } from '@/app/Library/hooks/useTopicSlidePlayer';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';

// ─────────────────────────────────────────────────────────────────────────────
// [Section 1] Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * HydratedFeedbackItem
 * @description
 *   Extends the lean FeedbackItem record stored in Firestore with rich curriculum
 *   strings sourced from the Yjs Resource Context. The hydration hook reconciles
 *   the relational questionId pointer to live Sentinel Node metadata.
 */
interface HydratedFeedbackItem extends FeedbackItem {
  questionText:  string;
  explanation:   string;
  sourceQuote:   string;
  correctAnswer: string;
}

interface StudentQuizDetailProps {
  docId:     string;
  attemptId: string;
  onBack:    () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// [Section 2] Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/**
 * FeedbackCard
 * @description
 *   Renders a single incorrect-question correction card. Consumes a HydratedFeedbackItem
 *   to display data reconciled from the Resource Context alongside the lean Firestore
 *   record. Each card includes the question, answer comparison, explanation, source
 *   quote, and a "Review Topic" deep-link button.
 */
function FeedbackCard({
  item,
  index,
  onReviewTopic,
}: {
  item:          HydratedFeedbackItem;
  index:         number;
  onReviewTopic: (topicId: string) => void;
}) {

  const {getNodeTitle} = useNodesContext();
  const TopicTitle = getNodeTitle(item.topicId);
  return (
    <div className="qf-card qf-feedback-card">
      <div className="qf-feedback-card__topic-row">
        <span className="qf-tag qf-tag--blue">{TopicTitle}</span>
        <span className="qf-feedback-card__q-index">Question {index + 1}</span>
      </div>

      <p className="qf-feedback-card__question">{item.questionText}</p>

      <div className="qf-answer-grid">
        <div className="qf-answer-box qf-answer-box--wrong">
          <p className="qf-answer-box__label">Your Answer</p>
          <p className="qf-answer-box__text">{item.yourAnswer}</p>
        </div>
        <div className="qf-answer-box qf-answer-box--correct">
          <p className="qf-answer-box__label">Correct Answer</p>
          <p className="qf-answer-box__text">{item.correctAnswer}</p>
        </div>
      </div>

      <div className="qf-explanation-box">
        <p className="qf-explanation-box__label">Explanation</p>
        <p className="qf-explanation-box__text">{item.explanation}</p>
      </div>

      <div className="qf-source-quote">
        <p className="qf-source-quote__label">From the Lesson</p>
        <p className="qf-source-quote__text">&quot;{item.sourceQuote}&quot;</p>
      </div>

      <div className="qf-cta-row">
        <button
          className="qf-btn qf-btn--primary qf-btn--small"
          onClick={() => onReviewTopic(item.topicId)}
          aria-label={`Review ${item.topicLabel} starting at slide ${item.topicId}`}
        >
          📖 Review Topic
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// [Section 3] Main component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * StudentQuizDetail
 * @description
 *   Reads quizFeedbackDetail from QuizFeedbackDataContext and passes it through the
 *   hydration engine to produce HydratedFeedbackItems. Does not call any fetch or
 *   clear method — data lifecycle is entirely managed by the context provider and
 *   the imperative fetchFeedbackDetail call made by StudentGradesModal before this
 *   component mounts.
 */
export default function StudentQuizDetail({
  docId,
  attemptId,
  onBack,
}: StudentQuizDetailProps) {
  const {
    quizFeedbackDetail: leanDetail,
    fetchFeedbackDetail,
    isLoading,
    error,
  } = useQuizFeedback();

  // Step 1: Initialise the hydration engine using the assignmentId from the lean detail.
  const { hydrate } = useQuizFeedbackHydration(leanDetail?.assignmentId || '');

  const { jumpToTopic } = useTopicSlidePlayer();

  // Step 2: Perform Just-in-Time Hydration — reconcile Firestore records with Yjs metadata.
  const hydratedDetail = useMemo(() => {
    return hydrate(leanDetail);
  }, [leanDetail, hydrate]);

  // Step 3: Trigger the detail fetch when this view mounts.
  //         fetchFeedbackDetail is cached by attemptId in the context — if the scholar
  //         returns to this same attempt in the same session, the cache hit returns
  //         immediately with no network call.
  //
  //         NOTE: There is intentionally NO cleanup return calling clearFeedbackDetail.
  //         Clearing on unmount was the source of the re-fetch loop. The context cache
  //         keeps the data alive across scene transitions within the same modal session.
  useEffect(() => {
    fetchFeedbackDetail(docId, attemptId);
  }, [docId, attemptId, fetchFeedbackDetail]);

  // Step 4: Loading state.
  if (isLoading) {
    return (
      <div className="qf-state-wrapper">
        <div className="qf-spinner" aria-label="Loading feedback" />
        <span>Loading feedback…</span>
      </div>
    );
  }

  // Step 5: Error state.
  if (error) {
    return (
      <div>
        <div className="qf-back-row">
        </div>
        <div className="qf-error-banner" role="alert">
          Could not load feedback: {error}
        </div>
      </div>
    );
  }

  // Step 6: Guard against render before hydration resolves.
  if (!hydratedDetail) return null;

  const {
    quizTitle,
    lessonTitle,
    scorePct,
    totalQuestions,
    incorrectCount,
    incorrectItems,
  } = hydratedDetail;

  const gradeVariant =
    scorePct >= 85 ? 'green' :
    scorePct >= 70 ? 'blue'  :
    scorePct >= 55 ? 'amber' : 'red';

  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }} className="quiz-scrollbar">

      <div className="qf-view-header--spaced">
        <div>
          <h2 className="qf-view-title">{quizTitle}</h2>
          <p className="qf-view-subtitle qf-view-subtitle--tight">{lessonTitle}</p>
        </div>
        <div className="qf-badges-row">
          <span className={`qf-tag qf-tag--${gradeVariant}`}>{scorePct}%</span>
          <span className="qf-tag qf-tag--amber">
            {incorrectCount} incorrect of {totalQuestions}
          </span>
        </div>
      </div>

      <p className="qf-section-label">Incorrect Answers — Review &amp; Learn</p>

      {incorrectItems.length === 0 ? (
        <div className="qf-state-wrapper">
          <span>🎉 Perfect score — no incorrect answers to review.</span>
        </div>
      ) : (
        incorrectItems.map((item, idx) => (
          <FeedbackCard
            key={item.questionId}
            item={item as HydratedFeedbackItem}
            index={idx}
            onReviewTopic={jumpToTopic}
          />
        ))
      )}
    </div>
  );
}