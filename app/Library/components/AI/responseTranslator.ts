/**
 * responseTranslator.ts
 *
 * Translates structured AI response data into application-compatible resources.
 * Supports CueCardResource and PracticeSheetResource (including Matching, Multiple Choice,
 * True/False, and Fill in the Blank quizzes).
 */

import {
    CueCardResource,
    PracticeSheetResource,
    IMultipleChoiceQuestion,
    ITrueFalseQuestion,
    IFillInBlankQuestion,
    IQuizQuestion,
    QuizType,
  } from '../../Definitions/Definitions'; // Replace with the actual path to your interfaces
  import { v4 as uuidv4 } from 'uuid';
  

  /**
   * Translates AI lesson response data into CueCardResource format.
   * @param lessonResponse - The AI service response for lessons.
   * @param nodeId - The associated node ID.
   * @returns CueCardResource[]
   */
  export function translateLessonToCueCards(lessonResponse: any, nodeId: string): CueCardResource[] {
    return lessonResponse.rootConcept.cueCards.map((cueCard: any) => ({
      id: uuidv4(),
      title: cueCard.title,
      nodeId,
      type: 'cueCard',
      content: [{ type: 'paragraph', children: [{ text: cueCard.description }] }],
    }));
  }
  
  /**
   * Translates AI quiz response data into PracticeSheetResource format.
   * @param quizResponse - The AI service response for quizzes.
   * @param nodeId - The associated node ID.
   * @returns PracticeSheetResource[]
   */
  export function translateQuizToPracticeSheets(quizResponse: any, nodeId: string): PracticeSheetResource {
    // The quiz type is now guaranteed to match what was requested
    const quizType = quizResponse.quizType as QuizType;
    
    const quizContent: IQuizQuestion[] = quizResponse.questions.map((question: any) => {
        switch (quizType) {
            case 'matching':
                return {
                    id: uuidv4(),
                    type: 'matching',
                    question: question.matchingTerm,
                    correctAnswer: question.matchingAnswer,
                };
            
            case 'multipleChoice':
                return {
                    id: uuidv4(),
                    type: 'multipleChoice',
                    question: question.question,
                    options: question.options,
                    correctAnswer: question.correctAnswer,
                };
            
            case 'true-false':
                return {
                    id: uuidv4(),
                    type: 'true-false',
                    question: question.question,
                    correctAnswer: question.correctAnswer,
                };
            
            case 'FIB':
                return {
                    id: uuidv4(),
                    type: 'FIB',
                    question: question.questionText,
                    questionText: question.questionText,
                    correctAnswer: question.correctAnswer,
                };
            
            default:
                throw new Error(`Received unexpected quiz type: ${quizType}`);
        }
    });

    return {
        id: uuidv4(),
        title: quizResponse.title,
        nodeId,
        type: 'practiceSheet',
        content: { quizType, quizContent },
    };
}
    
  /**
   * Translates a matching question into IQuizQuestion format.
   * @param question - The question object from AI response.
   * @returns IQuizQuestion
   */
  function translateMatchingQuestion(question: any): IQuizQuestion {
    return {
      id: uuidv4(),
      type: 'matching',
      question: question.matchingTerm,
      correctAnswer: question.matchingAnswer, // Should be a string
    };
  }
  
  /**
   * Translates a multiple-choice question into IMultipleChoiceQuestion format.
   * @param question - The question object from AI response.
   * @returns IMultipleChoiceQuestion
   */
  function translateMultipleChoiceQuestion(question: any): IMultipleChoiceQuestion {
    return {
      id: uuidv4(),
      type: 'multipleChoice',
      question: question.question,
      options: question.options,
      correctAnswer: question.correctAnswer, 
    };
  }
  
  /**
   * Translates a true/false question into ITrueFalseQuestion format.
   * @param question - The question object from AI response.
   * @returns ITrueFalseQuestion
   */
  function translateTrueFalseQuestion(question: any): ITrueFalseQuestion {
    return {
      id: uuidv4(),
      type: 'true-false',
      question: question.question,
      correctAnswer: question.correctAnswer, // Should be a boolean
    };
  }
  
  /**
   * Translates a fill-in-the-blank question into IFillInBlankQuestion format.
   * @param question - The question object from AI response.
   * @returns IFillInBlankQuestion
   */
  function translateFillInBlankQuestion(question: any): IFillInBlankQuestion {
    return {
      id: uuidv4(),
      type: 'FIB',
      question: question.questionText, // Add the question field
      questionText: question.questionText,
      correctAnswer: question.correctAnswer, // Add correctAnswer as an array
    };
  }
  