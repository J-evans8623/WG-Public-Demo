// mockQuizData.ts

import { 
    IQuizQuestion, 
    IMultipleChoiceQuestion, 
    ITrueFalseQuestion, 
    IFillInBlankQuestion 
  } from '@/app/Library/Definitions/Definitions';
  
  // Matching Quiz Mock Data
  export const matchingQuizData: IQuizQuestion[] = [
    {
      id: '1',
      type: 'matching',
      question: 'Match the term with its definition',
      correctAnswer: 'Process of converting light energy to chemical energy'
    },
    {
      id: '2',
      type: 'matching',
      question: 'Match the organ with its function',
      correctAnswer: 'Pumps blood throughout the body'
    }
  ];
  
  // Multiple Choice Quiz Mock Data
  export const multipleChoiceQuizData: IMultipleChoiceQuestion[] = [
    {
      id: 'mc1',
      type: 'multipleChoice',
      question: 'What is the powerhouse of the cell?',
      options: ['Nucleus', 'Mitochondria', 'Golgi Body', 'Endoplasmic Reticulum'],
      correctAnswer: 'Mitochondria'
    },
    {
      id: 'mc2',
      type: 'multipleChoice',
      question: 'Which planet is known as the Red Planet?',
      options: ['Venus', 'Mars', 'Jupiter', 'Saturn'],
      correctAnswer: 'Mars'
    }
  ];
  
  // True/False Quiz Mock Data
  export const trueFalseQuizData: ITrueFalseQuestion[] = [
    {
      id: 'tf1',
      type: 'true-false',
      question: 'The Earth is the third planet from the Sun.',
      correctAnswer: true
    },
    {
      id: 'tf2',
      type: 'true-false',
      question: 'DNA has a single helix structure.',
      correctAnswer: false
    }
  ];
  
  // Fill in the Blank Quiz Mock Data
  export const fillInBlankQuizData: IFillInBlankQuestion[] = [
    {
      id: 'fib1',
      type: 'FIB',
      question: 'Complete the sentence',
      questionText: 'The process of {{blank}} occurs in chloroplasts.',
      correctAnswer: 'photosynthesis'
    },
    {
      id: 'fib2',
      type: 'FIB',
      question: 'Complete the sentence',
      questionText: 'Water is composed of {{blank}} and oxygen.',
      correctAnswer: 'hydrogen'
    }
  ];
  
  // Combined mock data for easy access
  export const mockQuizData = {
    matching: matchingQuizData,
    multipleChoice: multipleChoiceQuizData,
    'true-false': trueFalseQuizData,
    FIB: fillInBlankQuizData
  };