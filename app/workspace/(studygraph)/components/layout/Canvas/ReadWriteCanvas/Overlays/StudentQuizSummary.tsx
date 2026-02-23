/**
 * @file StudentQuizSummary.tsx
 * @description
 * (update - 1.1)
 * This component has been refactored to integrate the specialized 'useTopicSlidePlayer' hook, 
 * effectively bridging the gap between assessment results and active remediation. The 
 * component's responsibility has been expanded from simple data visualization to active 
 * navigation orchestration. By consuming the jump-gate logic, the summary now allows scholars 
 * to click a "Review Topic" trigger on any failed question, which programmatically 
 * synchronizes the global SlideShow context to the first lecture note associated with that 
 * specific conceptual node. This update ensures that the AI-generated pedagogical metadata—explanations 
 * and verbatim citations—serves as a direct springboard for mastery. The implementation 
 * maintains strict O(N) rendering performance while coordinating with the parent QuizOverlay 
 * to manage visibility transitions, ensuring a seamless user experience that avoids 
 * document-state deadlocks or overlay stacking during the transition from quiz to review.
 */

import React from 'react';
import { BookOpen, HelpCircle, CheckCircle, FileText, ArrowRight } from 'lucide-react';
import { IQuizQuestion, QuizType } from '@/app/Library/Definitions/Definitions';
// update - 1.2: Import the jump-gate hook
import { useTopicSlidePlayer } from '@/app/Library/hooks/useTopicSlidePlayer';

export interface StudentQuizSummaryProps {
  failedQuestions: IQuizQuestion[];
  quizType: QuizType;
  /** * (update - 1.3) 
   * Prop renamed/repurposed: Now used as an internal trigger for the jump hook, 
   * though we keep it in the interface for parent-level event tracking if needed.
   */
  onReviewTopic?: (topicId: string) => void;
  onClose?: () => void;
}

/**
 * StudentQuizSummary
 * @description
 * (update - 1.4)
 * Refactored to utilize the useTopicSlidePlayer hook internally. This function now coordinates 
 * the remediation UI with the global navigation state, allowing scholars to jump directly 
 * to the source material proof for any question they answered incorrectly during the quiz.
 */
const StudentQuizSummary: React.FC<StudentQuizSummaryProps> = ({
  failedQuestions,
  quizType,
  onReviewTopic,
  onClose
}) => {
  // 1. Step 1: Initialize the jump-gate hook to enable interactive navigation
  const { jumpToTopic } = useTopicSlidePlayer();

  /**
   * handleJumpToMastery
   * @description
   * Coordinates the transition from the quiz summary to the slide player. It invokes the 
   * jump hook to set the new slide index and signals the parent to close the current 
   * overlay to ensure visual focus on the study material.
   * update - 1.5
   */
  const handleJumpToMastery = (topicId: string) => {
    // 2. Step 2: Trigger the navigation logic implemented in the hook (O(N) lookup)
    jumpToTopic(topicId);
    
    // 3. Step 3: Call the optional parent callbacks to clean up the assessment UI
    onReviewTopic?.(topicId);
    if (onClose) onClose();
    
    console.log('[StudentQuizSummary.tsx][1150] Remediation jump executed for node:', topicId);
  };

  if (!failedQuestions || failedQuestions.length === 0) {
    return (
      <div className="remediation-empty-state" style={{ textAlign: 'center', padding: '40px' }}>
        <CheckCircle size={48} color="#5B8C5A" style={{ marginBottom: '16px' }} />
        <h3 style={{ margin: 0, color: '#2C3E50' }}>Mastery Achieved!</h3>
        <p style={{ color: '#6B7280' }}>You answered everything correctly.</p>
      </div>
    );
  }

  return (
    <div className="remediation-summary-container" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="remediation-header" style={{ borderBottom: '1px solid #E5E7EB', paddingBottom: '12px' }}>
        <h3 style={{ margin: 0, color: '#2C3E50', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <HelpCircle size={20} color="#EF4444" />
          Review Your Struggles
        </h3>
        <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#6B7280' }}>
          Analyze the explanations and citations below to understand where you went wrong.
        </p>
      </div>

      <ul className="remediation-list" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {failedQuestions.map((q, index) => (
          <li 
            key={q.id} 
            className="remediation-card" 
            style={{ 
              background: '#FFF', 
              border: '1px solid #E5E7EB', 
              borderRadius: '12px', 
              padding: '16px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <span style={{ fontWeight: 600, color: '#374151', fontSize: '14px' }}>Question {index + 1}</span>
              {/* 4. Step 4: Wire the button to the new jump-gate handler */}
              {(q.topicId || q.mapId) && (
                <button 
                  onClick={() => handleJumpToMastery(q.topicId || q.mapId)}
                  className="btn-text-action"
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '4px', 
                    fontSize: '12px', 
                    color: '#3B82F6', 
                    background: 'none', 
                    border: 'none', 
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  Review Topic <ArrowRight size={14} />
                </button>
              )}
            </div>

            <p style={{ margin: '0 0 16px 0', color: '#1F2937', fontWeight: 500 }}>{q.question}</p>

            <div className="remediation-meta" style={{ display: 'grid', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <CheckCircle size={16} color="#10B981" style={{ marginTop: '2px' }} />
                <div>
                  <span style={{ fontSize: '12px', color: '#6B7280', fontWeight: 600, display: 'block', textTransform: 'uppercase' }}>Correct Answer</span>
                  <span style={{ color: '#065F46', fontSize: '14px' }}>{String(q.correctAnswer)}</span>
                </div>
              </div>

              {q.explanation && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', background: '#F9FAFB', padding: '12px', borderRadius: '8px' }}>
                  <BookOpen size={16} color="#6366F1" style={{ marginTop: '2px' }} />
                  <div>
                    <span style={{ fontSize: '12px', color: '#4F46E5', fontWeight: 600, display: 'block', textTransform: 'uppercase' }}>Explanation</span>
                    <p style={{ margin: '4px 0 0 0', color: '#4B5563', fontSize: '13px', lineHeight: '1.5' }}>{q.explanation}</p>
                  </div>
                </div>
              )}

              {q.citation?.text && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', borderLeft: '3px solid #D1D5DB', paddingLeft: '12px', marginLeft: '6px' }}>
                  <FileText size={16} color="#9CA3AF" style={{ marginTop: '2px' }} />
                  <div>
                    <span style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 600, display: 'block', textTransform: 'uppercase' }}>Proof from Source</span>
                    <blockquote style={{ margin: '4px 0 0 0', color: '#6B7280', fontSize: '13px', fontStyle: 'italic', lineHeight: '1.4' }}>
                      {q.citation.text}
                    </blockquote>
                  </div>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default StudentQuizSummary;