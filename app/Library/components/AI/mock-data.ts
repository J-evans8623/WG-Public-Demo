/**
 * mockAIResponse.ts
 *
 * Provides mock data simulating the response structure from the AI service for UI design and testing purposes.
 *
 * Responsibilities:
 * - Simulate AI service responses for lesson and quiz generation.
 * - Facilitate frontend UI component design and testing without requiring backend integration.
 */

export const mockLessonResponse = {
    rootConcept: {
      concept: "Photosynthesis",
      parent: null,
      cueCards: [
        {
          title: "Introduction to Photosynthesis",
          description: "Photosynthesis is a process by which plants convert light energy into chemical energy stored in glucose."
        },
        {
          title: "Chloroplasts",
          description: "Chloroplasts are the organelles where photosynthesis takes place."
        },
        {
          title: "Light-Dependent Reactions",
          description: "These reactions occur in the thylakoid membranes and produce oxygen, ATP, and NADPH."
        }
      ],
      subtopics: [
        {
          concept: "Light-Dependent Reactions",
          parent: "Photosynthesis",
          cueCards: [
            {
              title: "Process Overview",
              description: "Light energy is captured to split water molecules, releasing oxygen and producing energy carriers."
            }
          ],
          subtopics: []
        },
        {
          concept: "Calvin Cycle",
          parent: "Photosynthesis",
          cueCards: [
            {
              title: "Carbon Fixation",
              description: "CO2 is captured and converted into organic molecules."
            }
          ],
          subtopics: []
        }
      ]
    }
  };
  
  export const mockQuizResponse = {
    id: "photosynthesis-quiz",
    title: "Photosynthesis and Chloroplasts Quiz",
    questions: [
      {
        id: "q1",
        question: "What are chloroplasts?",
        options: ["Organelles for photosynthesis", "Cell membranes", "Mitochondria", "Ribosomes"],
        correctAnswer: ["Organelles for photosynthesis"]
      },
      {
        id: "q2",
        question: "What happens during the light-dependent reactions of photosynthesis?",
        options: [
          "Glucose is produced",
          "ATP and NADPH are generated",
          "Carbon dioxide is fixed",
          "Proteins are synthesized"
        ],
        correctAnswer: ["ATP and NADPH are generated"]
      },
      {
        id: "q3",
        question: "Where within the chloroplast do the Calvin Cycle reactions occur?",
        options: ["Thylakoid membrane", "Stroma", "Cytoplasm", "Cell wall"],
        correctAnswer: ["Stroma"]
      },
      {
        id: "q4",
        question: "Which of the following is produced as a byproduct of the light-dependent reactions?",
        options: ["Oxygen", "Carbon dioxide", "Glucose", "Water"],
        correctAnswer: ["Oxygen"]
      },
      {
        id: "q5",
        question: "Which energy carriers are produced in the light-dependent reactions?",
        options: ["ATP and NADPH", "ADP and NADP+", "FADH2 and NADH", "Glucose and Oxygen"],
        correctAnswer: ["ATP and NADPH"]
      }
    ]
  };
  
  const mockAIResponses = {
    mockLessonResponse,
    mockQuizResponse
  };
  
  export default mockAIResponses;
  