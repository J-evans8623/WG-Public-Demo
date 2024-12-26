// bloom-maps/app/Library/components/PracticeSheetInput.tsx

import React, { useState, useEffect } from 'react';
import { Input, Select, Divider, Button } from 'antd';
import QuizInput from './QuizInput';
import './PracticeSheetStyles.css';
import { IQuizQuestion, QuizType } from '@/app/Library/Definitions/Definitions'; // Import the interface
import { v4 as uuidv4 } from 'uuid';

const { Option } = Select;

interface PracticeSheetInputProps {
  practiceSheetTitle: string;
  practiceContent: { quizType: QuizType; quizContent: IQuizQuestion[] };
  setPracticeSheetTitle: (title: string) => void;
  setPracticeContent: (content: { quizType: QuizType; quizContent: IQuizQuestion[] }) => void;
}

const MAX_ENTRIES = 10;

const PracticeSheetInput: React.FC<PracticeSheetInputProps> = ({
  practiceSheetTitle,
  practiceContent,
  setPracticeSheetTitle,
  setPracticeContent,
}) => {
  const [quizType, setQuizType] = useState<QuizType>(
    practiceContent.quizType || 'matching'
  );

  // Initialize quizContent based on practiceContent or default to one empty question
  const [quizContent, setQuizContent] = useState<IQuizQuestion[]>(() =>
    Array.isArray(practiceContent.quizContent) && practiceContent.quizContent.length > 0
      ? practiceContent.quizContent
      : [{ id: uuidv4(), type: 'matching', question: '', correctAnswer: '' }]
  );
  

  const handleQuizTypeChange = (value: QuizType) => {
    setQuizType(value);
    setQuizContent([{ id: uuidv4(), type: value, question: '', correctAnswer: '' }]); // Reset questions
  };

  const handleAddQuestion = () => {
    if (quizContent.length >= MAX_ENTRIES) {
      return; // Optionally, display an error message
    }
    setQuizContent([...quizContent, { id: uuidv4(), type: quizType, question: '', correctAnswer: '' }]);
  };

  const handleRemoveQuestion = (id: string) => {
    const updatedQuestions = quizContent.filter((q) => q.id !== id);
    setQuizContent(updatedQuestions);
    // Update the practice content in parent component
    setPracticeContent({ quizType, quizContent: updatedQuestions });
  };

  const handleInputChange = (id: string, key: keyof IQuizQuestion, value: string) => {
    const updatedQuestions = quizContent.map((q) =>
      q.id === id ? { ...q, [key]: value } : q
    );
    setQuizContent(updatedQuestions);
    // Update the practice content in parent component
    setPracticeContent({ quizType, quizContent: updatedQuestions });
  };

  useEffect(() => {
    setPracticeContent({ quizType, quizContent });
  }, [quizType, quizContent, setPracticeContent]);

  return (
    <div className="practice-sheet-container">
      {/* Fixed fields: title and quiz type */}
      <div className="fixed-fields">
        <Input
          placeholder="Practice Sheet Title"
          value={practiceSheetTitle}
          onChange={(e) => setPracticeSheetTitle(e.target.value)}
        />
        <Select value={quizType} onChange={handleQuizTypeChange} style={{ width: '100%', marginBottom: '10px' }}>
          <Option value="matching">Matching Quiz</Option>
          <Option value="multipleChoice">Multiple Choice Quiz</Option>
          <Option value="wordProblem">Word Problem</Option>
        </Select>
        <Divider />
      </div>

      {/* Scrollable quiz content */}
      <div className="scrollable-quiz-content">
        {quizType === 'matching' && (
          <QuizInput
            quizContent={quizContent}
            onRemoveQuestion={handleRemoveQuestion}
            onInputChange={handleInputChange}
          />
        )}
        {quizType === 'multipleChoice' && <div>Multiple Choice Quiz Input (Coming Soon)</div>}
        {quizType === 'wordProblem' && <div>Word Problem Input (Coming Soon)</div>}
      </div>

      {/* "Add Question" button */}
      <div className="add-question-btn">
        <Button type="dashed" onClick={handleAddQuestion} style={{ marginBottom: '10px' }}>
          Add Question
        </Button>
      </div>
    </div>
  );
};

export default PracticeSheetInput;
