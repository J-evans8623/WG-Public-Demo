import React, { useState, useEffect } from 'react';
import { Input, Select, Divider, Button } from 'antd';
import QuizInput from './QuizInput';
import './PracticeSheetStyles.css'; // Updated styles

const { Option } = Select;

interface PracticeSheetInputProps {
  practiceSheetTitle: string;
  practiceContent: { quizType: 'matching' | 'multipleChoice' | 'wordProblem'; quizContent: string }; // Ensure specific union types
  setPracticeSheetTitle: (title: string) => void;
  setPracticeContent: (content: { quizType: 'matching' | 'multipleChoice' | 'wordProblem'; quizContent: string }) => void; // Ensure specific union types
}

const MAX_ENTRIES = 10;

const PracticeSheetInput: React.FC<PracticeSheetInputProps> = ({
  practiceSheetTitle,
  practiceContent,
  setPracticeSheetTitle,
  setPracticeContent,
}) => {
  // Now, quizType is typed specifically to the allowed values
  const [quizType, setQuizType] = useState<'matching' | 'multipleChoice' | 'wordProblem'>(practiceContent.quizType || 'matching'); 
  const [autofillText, setAutofillText] = useState<string>('');
  const [pairs, setPairs] = useState<{ question: string; answer: string }[]>([{ question: '', answer: '' }]); // For matching quiz

  const handleQuizTypeChange = (value: 'matching' | 'multipleChoice' | 'wordProblem') => {
    setQuizType(value);
    setPairs([{ question: '', answer: '' }]); // Reset pairs if the quiz type changes
    setAutofillText(''); // Clear autofill text
  };

  // Autofill logic passed to the QuizInput component
  const handleAutofillChange = (text: string) => {
    setAutofillText(text);
  };

  // Add a new empty pair
  const handleAddPair = () => {
    if (pairs.length >= MAX_ENTRIES) {
      return; // You can show an error message here if needed
    }
    setPairs([...pairs, { question: '', answer: '' }]);
  };

  // Remove a pair
  const handleRemovePair = (index: number) => {
    setPairs(pairs.filter((_, i) => i !== index));
  };

  // Handle change in question or answer input
  const handleInputChange = (index: number, key: 'question' | 'answer', value: string) => {
    const updatedPairs = [...pairs];
    updatedPairs[index][key] = value;
    setPairs(updatedPairs);
  };

  // This effect will update the practiceContent whenever pairs change or quizType changes
  useEffect(() => {
    const formattedContent = pairs
      .filter(pair => pair.question && pair.answer) // Ensure both question and answer exist
      .map(pair => `${pair.question}:${pair.answer}`) // Concatenate question and answer as Q:A
      .join(', '); // Join pairs with a comma for a single content string

    setPracticeContent({ quizType, quizContent: formattedContent }); // Update practiceContent as an object
  }, [pairs, quizType, setPracticeContent]);

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
            pairs={pairs}
            onRemovePair={handleRemovePair}
            onInputChange={handleInputChange}
            autofillText={autofillText}
            setAutofillText={handleAutofillChange}
          />
        )}
        {quizType === 'multipleChoice' && <div>Multiple Choice Quiz Input (Coming Soon)</div>}
        {quizType === 'wordProblem' && <div>Word Problem Input (Coming Soon)</div>}
      </div>

      {/* "Add Question" button */}
      <div className="add-question-btn">
        <Button type="dashed" onClick={handleAddPair} style={{ marginBottom: '10px' }}>
          Add Question
        </Button>
      </div>

      {/* Autofill text input at the bottom */}
      <div className="autofill-field">
        <label htmlFor="autofill-text">Autofill Text</label>
        <Input
          id="autofill-text"
          placeholder="Enter autofill text (e.g., Q1:A1,Q2:A2)"
          value={autofillText}
          onChange={(e) => handleAutofillChange(e.target.value)}
        />
      </div>
    </div>
  );
};

export default PracticeSheetInput;
