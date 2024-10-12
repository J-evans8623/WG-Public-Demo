import React, { useState, useEffect } from 'react';
import { Input, Select, Divider, Button } from 'antd';
import QuizInput from './QuizInput';
import './PracticeSheetStyles.css'; // Updated styles

const { Option } = Select;

interface PracticeSheetInputProps {
  practiceSheetTitle: string;
  practiceContent: { quizType: 'matching' | 'multipleChoice' | 'wordProblem'; quizContent: string };
  setPracticeSheetTitle: (title: string) => void;
  setPracticeContent: (content: { quizType: 'matching' | 'multipleChoice' | 'wordProblem'; quizContent: string }) => void;
}

const MAX_ENTRIES = 10;

const PracticeSheetInput: React.FC<PracticeSheetInputProps> = ({
  practiceSheetTitle,
  practiceContent,
  setPracticeSheetTitle,
  setPracticeContent,
}) => {
  const [quizType, setQuizType] = useState<'matching' | 'multipleChoice' | 'wordProblem'>(
    practiceContent.quizType || 'matching'
  );
  const [autofillText, setAutofillText] = useState<string>('');
  const [pairs, setPairs] = useState<{ question: string; answer: string }[]>([{ question: '', answer: '' }]);

  const handleQuizTypeChange = (value: 'matching' | 'multipleChoice' | 'wordProblem') => {
    setQuizType(value);
    setPairs([{ question: '', answer: '' }]); // Reset pairs if the quiz type changes
    setAutofillText(''); // Clear autofill text
  };

  const handleAutofillChange = (text: string) => {
    // Ensure that text ends with a comma
    let updatedText = text;
    if (!text.endsWith(',')) {
      updatedText += ',';
    }
    setAutofillText(updatedText);

    // Parse the text and update pairs
    if (updatedText) {
      const regex = /([^:,\n]+):([^:,\n]+),?/g; // Adjusted regex to handle trailing commas
      let match;
      const newPairs = [];
      while ((match = regex.exec(updatedText)) !== null) {
        newPairs.push({ question: match[1].trim(), answer: match[2].trim() });
      }
      setPairs(newPairs.slice(0, MAX_ENTRIES)); // Enforce MAX_ENTRIES limit
    } else {
      setPairs([{ question: '', answer: '' }]); // Reset pairs if autofillText is empty
    }
  };

  const handleAddPair = () => {
    if (pairs.length >= MAX_ENTRIES) {
      return; // You can show an error message here if needed
    }
    setPairs([...pairs, { question: '', answer: '' }]);
  };

  const handleRemovePair = (index: number) => {
    const updatedPairs = pairs.filter((_, i) => i !== index);
    setPairs(updatedPairs);
    // Update the autofillText accordingly
    const formattedAutofillText = updatedPairs
      .filter((pair) => pair.question && pair.answer)
      .map((pair) => `${pair.question}:${pair.answer}`)
      .join(', ');
    setAutofillText(formattedAutofillText ? formattedAutofillText + ',' : '');
  };

  const handleInputChange = (index: number, key: 'question' | 'answer', value: string) => {
    const updatedPairs = [...pairs];
    updatedPairs[index][key] = value;
    setPairs(updatedPairs);
    // Update the autofillText accordingly
    const formattedAutofillText = updatedPairs
      .filter((pair) => pair.question && pair.answer)
      .map((pair) => `${pair.question}:${pair.answer}`)
      .join(', ');
    setAutofillText(formattedAutofillText ? formattedAutofillText + ',' : '');
  };

  useEffect(() => {
    const formattedContent = pairs
      .filter((pair) => pair.question && pair.answer)
      .map((pair) => `${pair.question}:${pair.answer}`)
      .join(', '); // No extra comma at the end

    setPracticeContent({ quizType, quizContent: formattedContent });
    // Do not update setAutofillText(formattedContent);
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
