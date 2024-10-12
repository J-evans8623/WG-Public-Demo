// bloom-maps\app\Library\Tests\Modals\QuizInput.tsx
import React, { useState, useEffect } from 'react';
import { Input, Button, Row, Col, Alert } from 'antd';

interface QuizInputProps {
  pairs: { question: string; answer: string }[];
  onRemovePair: (index: number) => void;
  onInputChange: (index: number, key: 'question' | 'answer', value: string) => void;
  autofillText: string; // Receive autofill text as a prop
  setAutofillText: (text: string) => void; // Function to update autofill text
}

const QuizInput: React.FC<QuizInputProps> = ({ pairs, onRemovePair, onInputChange, autofillText, setAutofillText }) => {
  const [error, setError] = useState<string | null>(null);

  // Update the autofill text when pairs change (syncing)
  useEffect(() => {
    const formattedText = pairs
      .filter(pair => pair.question && pair.answer) // Ensure both question and answer exist before adding to autofill text
      .map(pair => `${pair.question}:${pair.answer}`)
      .join(',');
    setAutofillText(formattedText); // Sync the autofill text with the parent
  }, [pairs]);

  return (
    <div>
      {pairs.map((pair, index) => (
        <Row key={index} gutter={16} style={{ marginBottom: '10px' }}>
          <Col span={10}>
            <Input
              placeholder={`Question ${index + 1}`}
              value={pair.question}
              onChange={(e) => onInputChange(index, 'question', e.target.value)}
            />
          </Col>
          <Col span={10}>
            <Input
              placeholder={`Answer ${index + 1}`}
              value={pair.answer}
              onChange={(e) => onInputChange(index, 'answer', e.target.value)}
            />
          </Col>
          <Col span={4}>
            <Button danger onClick={() => onRemovePair(index)}>
              Remove
            </Button>
          </Col>
        </Row>
      ))}

      {error && <Alert type="error" message={error} style={{ marginBottom: '10px' }} />}
    </div>
  );
};

export default QuizInput;
