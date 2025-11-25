// File: src/app/workspace/(studygraph)/components/layout/CardDisplay/Cards/QuizCard.tsx

/**
 * @file QuizCard.tsx
 * @description
 *   Enhanced interactive quiz card component that serves as the entry point for quiz interactions.
 *   This component is responsible for presenting quiz information with improved visual design and
 *   professional polish. The card displays a quiz type badge, title, and an enhanced start interface
 *   that provides context about the quiz content and learning objectives. The component maintains
 *   all existing functionality while implementing a more spacious, professional design that aligns
 *   with the application's brand theme. Key responsibilities include sampling quiz questions through
 *   shuffleAndLimit utility, maintaining selectedQuestions state for the current quiz session,
 *   and launching the QuizOverlay with properly configured question data. The enhanced design
 *   provides better visual hierarchy, improved spacing, and contextual information to help users
 *   understand what they're about to engage with. The component preserves backwards compatibility
 *   with existing prop interfaces while adding enhanced visual feedback and professional styling.
 *
 * @responsibilities
 *   - Sample quizContent via shuffleAndLimit utility for optimal quiz length.
 *   - Maintain selectedQuestions state for current quiz session.
 *   - Present enhanced quiz start interface with contextual information.
 *   - Launch QuizOverlay with sampled questions and proper configuration.
 *   - Display quiz type badge and title with professional styling.
 *   - Provide topic-specific learning context through dynamic text content.
 */

import React, { useState } from 'react';
import QuizOverlay from '../../Canvas/ReadWriteCanvas/Overlays/QuizOverlay';
import { IQuizQuestion, QuizType } from '@/app/Library/Definitions/Definitions';
import { shuffleAndLimit } from '../../CardDisplay/Cards/quizUtils';

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
}

const QuizCard: React.FC<QuizCardProps> = ({ title, content, hideHeader = false, mapId, parentQuizId }) => {
  // 1. Initialize component state for quiz session management
  const [isQuizOpen, setIsQuizOpen] = useState(false);
  const [selectedQuestions, setSelectedQuestions] = useState<IQuizQuestion[]>([]);
  
  // 2. Extract quiz configuration from content prop
  const { quizType, quizContent } = content;
  const { label, classes } = QUIZ_TYPE_STYLES[quizType] || {
    label: 'Quiz', classes: 'bg-gray-100 text-gray-700 border-gray-200'
  };

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
      {/* Enhanced Quiz Card Interface */}
      <div className="bg-white rounded-xl overflow-hidden">
        {/* Enhanced Quiz Launch Interface */}
        <div className="px-8 py-10">
          <div className="text-center max-w-lg mx-auto">
            {/* Contextual Information Section */}
            <div className="bg-gray-50 rounded-lg p-6 mb-8">
              <h4 className="text-lg font-medium text-gray-900 mb-3">Ready to Test Your Knowledge?</h4>
              <p className="text-gray-600 leading-relaxed">
                This {quizType === 'matching' ? 'matching quiz' : 'quiz'} will test your understanding of key concepts in {title}. 
             </p>
            </div>            
            {/* Enhanced Start Quiz Button */}
            <button
              onClick={handleStartQuiz}
              className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 
                       text-white px-8 py-4 rounded-lg font-medium text-lg transition-all duration-200 
                       shadow-lg hover:shadow-xl transform hover:scale-[1.02] w-full sm:w-auto"
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
    </>
  );
};

export default QuizCard;