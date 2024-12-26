// bloom-maps/app/Library/components/QuizInput.tsx

import React, { useState } from 'react';
import { Input, Button, Row, Col, Alert } from 'antd';
import { IQuizQuestion } from '@/app/Library/Definitions/Definitions'; // Import the interface
import { v4 as uuidv4 } from 'uuid';

interface QuizInputProps {
  quizContent: IQuizQuestion[];
  onRemoveQuestion: (id: string) => void;
  onInputChange: (id: string, key: keyof IQuizQuestion, value: string) => void;
}

const QuizInput: React.FC<QuizInputProps> = ({ quizContent, onRemoveQuestion, onInputChange }) => {
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      {quizContent.map((question, index) => (
        <Row key={question.id} gutter={16} style={{ marginBottom: '10px' }}>
          <Col span={10}>
            <Input
              placeholder={`Question ${index + 1}`}
              value={question.question}
              onChange={(e) => onInputChange(question.id, 'question', e.target.value)}
            />
          </Col>
          <Col span={10}>
            <Input
              placeholder={`Answer ${index + 1}`}
              value={question.correctAnswer}
              onChange={(e) => onInputChange(question.id, 'correctAnswer', e.target.value)}
            />
          </Col>
          <Col span={4}>
            <Button danger onClick={() => onRemoveQuestion(question.id)}>
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
