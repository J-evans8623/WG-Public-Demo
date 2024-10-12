// bloom-maps\app\Library\utils\QuizUtils.ts
// Utility function to parse quiz content encoded as 'Question1:AnswerA,Question2:AnswerB,...'
export function parseQuizContent(quizContent: string): { question: string, answer: string }[] {
    const pairs = quizContent.split(',');
    return pairs.map(pair => {
      const [question, answer] = pair.split(':');
      return { question, answer };
    });
  }
  
  // Utility function to scramble the answers
  export function scrambleAnswers(quiz: { question: string, answer: string }[]): { question: string, scrambledAnswer: string }[] {
    const answers = quiz.map(q => q.answer);
    
    // Fisher-Yates shuffle algorithm
    for (let i = answers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [answers[i], answers[j]] = [answers[j], answers[i]];
    }
  
    return quiz.map((q, i) => ({
      question: q.question,
      scrambledAnswer: answers[i],
    }));
  }
  
  // Utility function to calculate the score by comparing user answers with the correct answers
  export function calculateScore(userAnswers: string[], answerKey: { question: string, answer: string }[]): number {
    let score = 0;
  
    userAnswers.forEach((userAnswer, index) => {
      if (userAnswer === answerKey[index].answer) {
        score++;
      }
    });
  
    return score;
  }
  
  // Utility function to scramble an array
export function scrambleArray<T>(array: T[]): T[] {
    const scrambled = [...array];
    for (let i = scrambled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [scrambled[i], scrambled[j]] = [scrambled[j], scrambled[i]];
    }
    return scrambled;
  }
  