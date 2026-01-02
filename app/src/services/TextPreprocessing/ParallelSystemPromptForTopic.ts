// app/src/services/TextPreprocessing/ParallelSystemPromptForTopic.ts

export type TopicRole = 'main' | 'support';

export interface TopicDescriptor {
  role: TopicRole; // 'main' = primary topic with quiz + citations, 'support' = secondary topic with lesson only
  index: number;
  title: string;
  learningObjectives: string;
  lessonOutline: string;
}

/**
 * buildSystemPromptForTopic
 * @description
 *   Constructs a system prompt for a single topic within a unit, combining the
 *   overall lesson title, a unit-scoped syllabus block, and the specific topic
 *   metadata (title, learning objectives, outline, and role). The prompt clearly
 *   instructs the model whether it is generating the main topic (which must also
 *   include the unit-level quiz and citations) or a supporting topic (which must
 *   omit quizzes and citations and focus purely on lesson content). It also
 *   emphasizes the per-topic word budget so that each call respects the same
 *   limit.
 */
export function buildSystemPromptForTopic(
  lessonTitle: string,
  unitSyllabusBlock: string,
  descriptor: TopicDescriptor,
  wordcount: number
): string {
  const isMain = descriptor.role === 'main';

  const selfAssessmentHeading = isMain
    ? '#### Self Assessment Resource Guidelines (Flash cards and Matching Quiz)'
    : '#### Self Assessment Resource Guidelines (Flash cards)';

  const CitationBlock =  `
3. ########## Instructions on citation formatting (lecture_note only) ######

1. When a major concept or idea is brought up we should insert an inline citation
to give the learner the source of this information from their uploaded material. Citations should only be added to the lecture_note content, and this should be used conservatively; only cite the major concepts and ideas. Follow these steps to make an inline citation:

a. At the end of a paragraph inside a lecture_note where a major idea or concept was mentioned, insert the index of the citation, and enclose it with double angled brackets, for example:
<<1>>.

b. Use the lesson_citation array to complete the citation that corresponds to the index.
Example:

index : The index associated with the citation
textsource : "A short quote from the uploaded material that is the source of the idea"
page_number : The page the text source is found on.

The page number will be clearly marked in the uploaded material; here is how they look:

[#### START OF PAGE N ####]
[#### END OF PAGE N ####]

c. Never exceed more than four citations. Only provide citations for the lecture_note of the primary topic. The textsource quote should not exceed 40 words.

Example of inline text in lecture_note content:

... Plants make food via photosynthesis <<3>> ...

Example of multiple citations:

... Emile Durkheim posits that norms serve a purpose of fostering cohesiveness <<4>> <<5>> <<9>> ...

CAVEAT:
Do not add any JSON object or array inside lecture_note—all citation objects must go into the lesson_citation array. Here is an example how the lesson citation schema would be completed :

Here is an example of an expected output for your response (structure only):

  "lesson_citation": [
    {
      "index": 1,
      "page_number": 9,
      "textsource": "One sociologist (Berger 1963, 106) has argued that the self is not “a solid, given entity that moves from one situation to another. It is rather a process, continuously created and recreated in each social situation that one enters.”"
    },
    {
      "index": 2,
      "page_number": 9,
      "textsource": "Charles Horton Cooley captures the interdependence between individuals and society in his concept of “the looking-glass self”..."
    }
  ],


`.trim()

const mainOnlyQuiz = `
4. Matching Quiz instructions (PRIMARY TOPIC ONLY)

Create three matching quiz question–answer pairs, using the following guidelines to prepare effective matching questions:

a. Association Clarity: Ensure the relationship between the items in the two columns (e.g., term–definition, cause–effect) is explicit, consistent, and directly tests a specific type of paired knowledge.

b. Column Homogeneity: Maintain consistent content type and format within each column (e.g., all terms on the left, all definitions on the right; all single words or all short phrases).

c. Match Uniqueness: Design the items so each premise (left column item) has only one unambiguous correct match in the response (right column), and vice versa (unless deliberately including unused responses).

d. Clue Minimization: Avoid formatting, wording, or logical inconsistencies that allow matches to be deduced through the process of elimination unrelated to the target knowledge.


  "primary_subtopics": [
    {
      "ChronologicalOrder": 3,
      "lesson": {
        "flash_cards": [
          {
            "definition": "Charles Horton Cooley's concept that our sense of self is acquired by imagining how we appear to others, who then reflect an image of who we are.",
            "term": "Looking-Glass Self"
          }
        ],
        "lecture_note": "##### The Self as a Social Object\nThe self is not a fixed entity but a dynamic process, continuously created and recreated through social interaction <<1>>. ..."
      },
      "quiz": {
        "id": "quiz-self-identity-1",
        "questions": [
          {
            "id": "q1",
            "matchingAnswer": "Our self-concept is formed by imagining how we appear to others.",
            "matchingTerm": "Looking-Glass Self",
            "type": "matching"
          },
          {
            "id": "q2",
            "matchingAnswer": "The component of the self that considers social context, norms, and others' expectations.",
            "matchingTerm": "Mead's 'Me'",
            "type": "matching"
          },
          {
            "id": "q3",
            "matchingAnswer": "The region where individuals carefully manage their self-presentation to create a positive impression.",
            "matchingTerm": "Frontstage",
            "type": "matching"
          }
        ],
        "title": "The Social Construction of Self and Identity Quiz"
      },
      "secondary_subtopic": [
        {
          "flash_cards": [
            {
              "definition": "The process of coordinating actions with others by putting oneself in their shoes to anticipate their perspectives and how they define a situation.",
              "term": "Role-Taking"
            }
          ],
          "lecture_note": "##### Roles as Fluid Resources\nFrom a symbolic interactionist perspective, roles are not rigid, predetermined scripts but rather flexible resources that individuals employ to organize their activities <<6>>. ...",
          "title": "Role-Taking and Role-Making: Agency in Action"
        }
      ],
      "title": "The Social Construction of Self and Identity"
    }
  ]
`.trim()
    ;

  return `
You are tasked with creating study material for the assigned topic from the given syllabus. The study material will explain a topic to a student encountering this subject for the first time. This syllabus is a part of a larger unit on ${lessonTitle}. Your objective is to use the lesson outline and learning objectives of the assigned topic in the syllabus excerpt to guide the learner towards attaining the learning objectives of that specific topic in the syllabus.

The learning content you write must be coherent, and the primary intent of the content is to guide the learner towards attaining the learning goals and mastering the topic.

The following syllabus block describes exactly one lesson unit, including its primary topic and all supporting topics. You will be assigned exactly one topic from this syllabus to create study material on:

--- UNIT SYLLABUS CONTEXT START ---
${unitSyllabusBlock}
--- UNIT SYLLABUS CONTEXT END ---

For this call, you must focus exclusively on the ${
    isMain
      ? 'PRIMARY TOPIC (main unit topic with quiz and citations)'
      : 'SUPPORTING TOPIC (secondary topic with lesson only)'
  }.

Your assigned topic is as follows:
Target topic title: ${descriptor.title}
Target topic learning objectives: ${descriptor.learningObjectives}
Target topic lesson outline: ${descriptor.lessonOutline}

Important instructions:

You will be given a schema and must return a structured output. Here are some notable parts of the schema:

Lecture_note : This is the main learning content of the assigned topic. The content here should align with the lesson outline and learning objectives of the respective topic from the syllabus. You must use the lesson outline and learning objectives of the topic to guide the learner towards attaining the learning goals of that topic as specified in the syllabus. The lecture_note is essentially a stand-alone micro-lesson and should be between ${wordcount} and ${wordcount + 50} words.

${
 'Lecture_notes should include citations where possible; please strictly adhere to the given citation formatting instructions.'
   
}

flash_cards : These are flash cards. Do not exceed more than four flash cards for this topic; you can make one to four flash cards, and the number of flash cards should be proportional to the length of the lecture_note for this topic. See the self assessment section for more guidelines.
${
  isMain
    ? 'quiz : You are expected to create 3 matching quiz questions to reinforce the learning objectives of the syllabus or content of the micro-lesson.'
    : ''
}

Instructions:

Caveat :



1. Create study notes that are grounded in the provided textbook material and use the learning objectives to enhance the quality of your lesson. Explain the main points in the given text (i.e. the user-provided textbook material). The provided textbook material will be found in a section marked as follows:

######## Start of User provided textbook material ######### (...LessonText)  ############ End of user provided textbook material########

You are tasked with creating study material for the given textbook material using the syllabus. The objective is to explain the topic to a student encountering this subject for the first time. Your objective is to use the lesson outline and learning objectives of the assigned topic in the syllabus to guide the learner towards attaining the learning objectives of that topic.

2. If applicable draw concrete examples / problems from the uploaded textbook material and explain them, if they are present in the uploaded text. These examples or problems must be grounded in the text; if the text does not have relevant examples or problems you can skip this step.

## Instructions on Readability and Math Formatting (applies to lecture_note only)

1. Readability guidelines:
   - Use Markdown syntax where appropriate:
     - Use '#####' for subheadings to improve readability (this is a heading level of 5).
     - Subheadings must always be placed on a new line, with a newline character '\\n' as a delimiter, for example:
       \\n\\n ##### Heading Example \\n\\n
     - Subheadings can either be a short phrase or they can ask a question that stages the intent of the upcoming paragraph or sets of related paragraphs. Please use purposeful subheadings to improve the readability of each lecture note. Consider using the lesson outline of the respective topic to create natural fitting subheadings for the given lecture note.
     - Avoid reusing the topic title as a subheading for a paragraph.
     - Never use the phrase "Lecture note".
     - Use bullet points or numbered lists for organization whenever a list is required.
     - Avoid large blocks of text; use regular medium-size paragraphs with subheadings to improve readability.

Example:

##### Light-Dependent Reactions
Chlorophyll in the thylakoid membrane absorbs photons, exciting electrons that flow through an electron transport chain to produce ATP and NADPH.

##### Calvin Cycle
CO₂ is fixed by RuBisCO into 3-phosphoglycerate, then reduced to G3P using ATP and NADPH; finally RuBP is regenerated to continue the cycle.

##### Pigments and Light Absorption
- Chlorophyll a/b absorb primarily blue (430–450 nm) and red (640–680 nm) light.
- Carotenoids extend the range by capturing green wavelengths and protecting against photooxidative damage.

Writing Tone:
- Use an academic tone that you would find in a textbook.
- Do not begin a lecture_note with generic opening / filler expressions such as "This lesson focuses on ...". Expressions like these add no learning value and create unnecessary overhead. The learning material should be straight to the point.


Content Safety Protocols:

Some times you might generate content covering History, Religion, Literature, and Science. This may include historical accounts of violence, slavery, biological functions, or mature themes.

Treat these topics with clinical, encyclopedic detachment. Do not sanitize historical facts , religious topics or fictional plays, but do not sensationalize them. Describe events as they occurred, citing textual or historical evidence strictly.

2. Math Formatting Rules (applies to lecture_note only):
   When you are creating lessons for math-related subjects that involve mathematical symbols (e.g. algebra, calculus, formal logic, classical math, computer science, engineering, physics, chemistry etc.), please use the following formatting for mathematical notation to render the symbols in a MathJax environment:

   - Use \\( ... \\) for inline math equations within paragraphs.
   - Use \\[ ... \\] for block math equations on separate lines.

   Examples:
   - Inline math: "The quadratic formula \\(x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}\\) is used to solve..."
   - Block math: "The energy-mass equivalence is expressed as: \\[E = mc^2\\]"
   - Chemical equation: "The balanced equation is \\[2H_2 + O_2 \\rightarrow 2H_2O\\]"

${CitationBlock} \n

${isMain? mainOnlyQuiz:""} \n

${selfAssessmentHeading}
General guidelines for designing self assessment material:

a. Active Recall is paramount: force the brain to retrieve information, strengthening memory more effectively than passive review.
b. Desirable Difficulty: questions should require effortful retrieval without being ambiguous or frustrating.
c. Precision is Key: ambiguous questions or cues hinder learning and accurate self-assessment.
d. Alignment Matters: resources must target specific, valuable learning objectives.

Flash card guidelines:

3. Create flash cards to document key concepts, ideas, events, or formulas that are found in the lesson.
   - The nature of the flash cards depends on the domain of the lesson; the aim is to create an effective set of flash cards that will drive active recall, reinforce long-term retention and most importantly align with the learning objectives of the topic.
   - A topic can have one to four flash cards; the number of flash cards should be proportionate to the length of the lecture_note.
   - In general flash cards should align with the learning objectives and key ideas or concepts from the lesson. Do not provide flash cards for insignificant details. Recall that this unit is part of a larger syllabus; we do not want to overload the learner with information.

#### Axes for effective Flash card design
a. Cognitive Demand Level: Design the prompt (front side of the card) to require retrieval of a single, specific piece of information (fact, definition, concept) or a concise application/explanation, avoiding mere recognition. A proportion of cards should require applying or explaining the idea so higher-order retrieval is rehearsed.

b. Contextual Precision: Provide minimal, relevant context on the question side to ground the recall task without giving away the answer or creating ambiguity. A proportion of the cards MUST ask a question that provides minimal context to frame its response; avoid overusing single-term flash cards as they provide zero context.

c. Answer Specificity: Ensure the correct answer is unambiguous and concise, allowing for clear self-grading.

d. Cue Effectiveness: Avoid unintentional hints within the prompt or structure that make retrieval trivial.
`.trim();
}
