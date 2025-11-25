// QuizCard.tsx

// File: src/app/workspace/(studygraph)/components/layout/CardDisplay/Cards/QuizCard.tsx

/**
 * @file QuizCard.tsx
 * @description
 *   Enhanced responsive interactive quiz card component that serves as the entry point for quiz interactions
 *   across multiple rendering contexts. This component is designed to work seamlessly in both wide slideshow
 *   overlays and narrow resource display previews by implementing responsive design patterns and adaptive
 *   layout strategies. The component maintains professional visual design while automatically adjusting
 *   its layout, spacing, and button sizing based on the container dimensions. Key responsibilities include
 *   sampling quiz questions through shuffleAndLimit utility, maintaining selectedQuestions state for the
 *   current quiz session, and launching the QuizOverlay with properly configured question data. The enhanced
 *   responsive design ensures optimal user experience across different container sizes, providing proper
 *   vertical centering, appropriate button scaling, and contextual information display. The component preserves
 *   backwards compatibility with existing prop interfaces while implementing container-aware responsive
 *   styling that adapts to both slideshow and resource display contexts without visual distortion.
 *
 * @responsibilities
 *   - Sample quizContent via shuffleAndLimit utility for optimal quiz length.
 *   - Maintain selectedQuestions state for current quiz session.
 *   - Present responsive quiz start interface with contextual information.
 *   - Launch QuizOverlay with sampled questions and proper configuration.
 *   - Display quiz type badge and title with adaptive styling.
 *   - Provide topic-specific learning context through dynamic text content.
 *   - Handle responsive layout for both slideshow and resource display contexts.
 *   - Ensure proper vertical centering and button scaling across container sizes.
 */

import React, { useState } from 'react';
import QuizOverlay from '@/app/workspace/(studygraph)/components/layout/Canvas/ReadWriteCanvas/Overlays/QuizOverlay';
import { IQuizQuestion, QuizType } from '@/app/Library/Definitions/Definitions';
import { shuffleAndLimit } from './quizUtils';

// Badge styles per quiz type with enhanced professional styling
const QUIZ_TYPE_STYLES: Record<QuizType, { label: string; classes: string }> = {
  multipleChoice: { label: 'Multiple Choice', classes: 'bg-blue-100 text-blue-700 border-blue-200' },
  'true-false':   { label: 'True / False',    classes: 'bg-red-100 text-red-700 border-red-200' },
  FIB:            { label: 'Fill in the Blank', classes: 'bg-green-100 text-green-700 border-green-200' },
  matching:       { label: 'Matching',         classes: 'bg-purple-100 text-purple-700 border-purple-200' },
};

export interface QuizCardProps {
  /** Card title (displayed above "Start Quiz") */
  title: string;
  /** Quiz data & type */
  content: {
    quizType: QuizType;
    quizContent: IQuizQuestion[];
  };
  parentQuizId: string;
  mapId: string
  /** When true, suppress badge + title */
  hideHeader?: boolean;
  onStartQuiz?: (quizType: QuizType, title: string, questions: IQuizQuestion[]) => void;
}

const QuizCard: React.FC<QuizCardProps> = ({ title, content, hideHeader = false, mapId, parentQuizId, onStartQuiz }) => {
  // 1. Initialize component state for quiz session management
  const [isQuizOpen, setIsQuizOpen] = useState(false);
  const [selectedQuestions, setSelectedQuestions] = useState<IQuizQuestion[]>([]);
  
  // 2. Extract quiz configuration from content prop
  const { quizType, quizContent } = content;

  /**
   * handleStartQuiz - Initiates quiz session with question sampling and state setup
   * 
   * This function is responsible for preparing the quiz session by sampling questions from the full
   * quiz content, limiting to a maximum of 10 questions for optimal user experience, and configuring
   * each question with proper parent quiz and map identifiers. The function implements question
   * shuffling to ensure variety across quiz sessions while maintaining data integrity through proper
   * ID mapping. After question preparation, it opens the quiz overlay interface for user interaction.
   */
  const handleStartQuiz = () => {
    console.log('[QuizCard.tsx:1001] handleStartQuiz initiated - total questions available:', quizContent.length);
    
    // 3. Sample and configure questions with metadata for tracking
    const sample = shuffleAndLimit(quizContent, 10).map(q => ({
      ...q,
      parentQuizId: parentQuizId,   // Link question to parent practice sheet
      mapId: mapId                  // Associate with concept map for analytics
    }));
    
    console.log('[QuizCard.tsx:1002] Question sampling completed - selected questions:', sample.length);
    
    // 4. Update component state and launch quiz interface
    setSelectedQuestions(sample);
    setIsQuizOpen(true);
  };

  return (
    <>
      {/* Responsive Quiz Card Interface */}
      <div className="quiz-card-container">
        {/* Responsive Quiz Launch Interface */}
        <div className="quiz-card-content">
          <div className="quiz-card-inner">
            {/* Contextual Information Section */}
            <div className="quiz-info-section">
              <h4 className="quiz-info-title">Ready to Test Your Knowledge?</h4>
              <p className="quiz-info-description">
                This {quizType === 'matching' ? 'matching quiz' : 'quiz'} will test your understanding of key concepts in {title}. 
              </p>
            </div>            
            
            {/* Responsive Start Quiz Button */}
            <button
              onClick={handleStartQuiz}
              className="quiz-start-button"
            >
              Start Quiz
            </button>
          </div>
        </div>
      </div>

      {/* Quiz Overlay Component */}
      <QuizOverlay
        isOpen={isQuizOpen}
        onClose={() => {
          console.log('[QuizCard.tsx:1003] Quiz overlay closed by user');
          setIsQuizOpen(false);
        }}
        quizType={quizType}
        title={title}
        quizData={selectedQuestions}
        isAssessment={false}
      />

      <style jsx>{`
        /* Base container styles for responsive behavior */
        .quiz-card-container {
          width: 100%;
          height: 100%;
          background: white;
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
          background-color: #f9fafb;
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
          background: linear-gradient(to right, #059669, #047857);
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
          background: linear-gradient(to right, #047857, #065f46);
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

        /* Adjustments for very narrow containers (like resource display previews) */
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

        /* Container query support for modern browsers */
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