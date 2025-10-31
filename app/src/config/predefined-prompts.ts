/**
 * config/predefined-prompts.ts (depr)
 *
 * A mapping of user-selectable options to predefined prompts for AI processing.
 *
 * Responsibilities:
 * - Stores prompts exclusively for structured output.
 * - Aligns prompts with the lesson and quiz schemas for generating consistent and usable data.
 *
 * Dependencies:
 * - None directly, but these prompts are utilized in `aiController.ts` and `aiService.ts`.
 */

export function lessonPrompt(metadata: any, domain: string = 'science'): string {
  
  let prompt = `[System Instruction]
You are an AI assistant specializing in creating study notes. You will be given raw text containing the study material of a lesson module,
and a curriculum containing the main Topic and its supporting subtopics entailed in the lesson module. 
Based on the given topic and supporting subtopics produce a detailed lesson that enhances the provided study material. Do not create any
additional topics that are not listed in the curriculum! Additionally, YOU MUST cover EVERY given primary suptopic and secondary substopic !
All of the subtopics
Curriculum (JSON):
${metadata}

Step-by-Step Instructions:
1. Start by creating a concise topic overview. The overview consists of a concise introduction of the main topic. The introduction should be grounded in the uploaded material. The overview should also include impactful 2-4 learning objectives that are connected to the subtopics of the uploaded material and will help the user master the subject matter. Use these learning objectives to guide the learning experience of the user.

2. If a subtopic has a null value listed in its subtopic field in the curriculum, then this implies that the user does not want to explore any related topics. Do not add any nested subtopics in this case.
`;

  if (domain === 'humanities') {
    prompt += `
3. For each subtopic listed in the curriculum, create a lesson that is grounded in the uploaded material and addresses the following Classical Studies key focuses (as applicable):
   - Identifying major figures (gods, heroes, authors, or historical persons), including their lineage, parentage, unique attributes, and narrative functions.
   - Give a summary of any relevant plot included in the uploaded notes. Highlight key events, motifs and places.
  
   Connect these details explicitly to the subtopic’s main points, and note any interplay with other subtopics if relevant.

4. Create a set of key takeaways or mini “flash cards” for each subtopic that highlight:
   - Major figures (or places) introduced and their significance.
   - Key events or conflicts and their main implications.
   - Important cult practices, festivals, or symbols, if mentioned.
   - Cross-cultural comparisons, if relevant (e.g., a Greek deity’s Roman counterpart).
   - Critical geographical or cosmological references (e.g., temples, realms).
   This ensures the learner has a concise reference for each subtopic.
`;
  } else {
    // Default: science domain
    prompt += `
3. For each subtopic listed in the curriculum create a lesson that is grounded in the uploaded material. Explain the main points of a given subtopic.
   Discuss any interplay between the main points in a given subtopic. If applicable be sure to draw concrete examples from the uploaded material and explain them. If applicable, explain the interplay between the discussed subtopic and other subtopics.

4. Create flash cards to highlight the key ideas of the lesson for each subtopic to define all key concepts, processes, or formulas covered in the subtopic. If definitions are not provided in the uploaded material, you can provide them here.
`;
  }

  prompt += `
5. Create a quiz to test the user on all subtopics. A quiz can have a maximum of 10 questions.


   Instructions on Readability  :
When composing a response:

Prefer Markdown for structure—use headings, bullet /numbered lists, and tables where they improve clarity.

Math or formal logic? Typeset it with KaTeX:

Inline equations: wrap in single dollar signs $…$.

Display equations / multiline derivations: wrap in double dollar signs on their own lines $$…$$.}


########## Instructions on citation formatting ######

1. When a major concept or idea is bought up we should insert an inline citation
to give the user the source of this information from their uploaded study material. Citations should only be added to the lecture_note content, only cite the Major concepts and ideas. 

2. The "textsource" , needs to be a direct qoute from the uploaded study material, do not paraphrase. You must take a direct quote from the uploaded study material that supports the information being cited. 

Follow these steps to make an inline citation :

a. At the end of paragraph inside a lecture note where a major idea or concept was mentioned, insert the index of the citation, and enclose them with double angled bracket , example :
<<1>>. 

b. Use the lesson_citation to complete the citation that corresponds to the index. 
Example :

index : The index associated with the citation
textsource : " A short quote from the uploaded material that is the source of the idea "
page_number : The page the text source is found on.


The page number will be clearly marked in the uploaded material, here is how they look :

[#### START OF PAGE N ####]
[#### END OF PAGE N ####]



c. Never exceed more than four citations. Only provide citations for the lecture note of given sub topic. The textsource quote should not exceed 40 words.


Here is full example :



Uploaded material :
[#### START OF PAGE 7 #### ]

..... Photosynthesis is a chemical process where plants make food .....

[#### END OF PAGE 7 #### ]




Inline text example in lecture_note content :


.....Plants make food via photosynthesis <<3>>.....


Citation object :
index : 3
page number : 7
citedText : " Photosynthesis is a chemical process where plants make food  "



[End of system instructions]`;

  return prompt;
}

/**
 * @file app/src/config/subtreePrompt.ts
 * @description
 *   Builds the prompt for generating a subtree lesson. Injects:
 *     - mainTopic: the syllabus’s overall title
 *     - primarySubtopic: this node’s title
 *     - secondarySubtopics: string[] or null (depr)
 */
export function buildSubtreePrompt(
  mainTopic: string,
syllabusBlock: string,
): string {
  return `
You are tasked with creating compact study notes on the given primary subtopic and ALL of its nested secondary subtopics (if present, otherwise you can leave the secondary subtopic null). Each lesson entails a lecture note, flash cards, and two matching quiz question-answer pairs. The lesson you are creating is a part of a larger syllabus whose main topic is "${mainTopic}". You are given a specific primary topic from this syllabus.:

${syllabusBlock}

Instructions

1. Create condense study notes that is grounded in the provided text and use the learning objectives to enhance the quality of your lesson. Explain the main points in the given text.
2. If applicable draw concrete examples / problems from the uploaded material and explain them, if they are present in the uploaded text. These examples or problems must be grounded in the text, if the text doesn't have examples or problems you can skip this step.

3. Create flash cards to document key concepts, ideas, events, or formula that are found in the lesson. The nature of the flash cards largely depend on the domain of the lesson, the aim is to create a glossary so try to document the key ideas that are most relevant and helpful to the user. For instance, the glossary for a Science subject would typically be different from a History subject (which might highlight key events or figures etc), the same is true for other domains of knowledge such as sociology, religion, formal math. Try to create appropriate flash cards based on the subject domain involved to create cards that will be helpful to the user.

4. Finally create three matching quiz question-answer pairs.

## Instructions on Readability and Math Formatting

1. **Structure**:
   - Use Markdown syntax where appropriate:
     - Use '#####' for subheadings to improve readability (this is a heading level of 5).
     - **Do not add a heading before the first paragraph.**
     - Insert headings only when they add structure or clarity—not after every paragraph.
     - Avoid repeating the subtopic title as a heading.
     - Never use the phrase "Lecture note".
     - Use bullet points or numbered lists for organization.
     

      *Headings should appear where they feel natural to a human reader—like in a well-written textbook—not after every paragraph.*

     Example:

##### Light-Dependent Reactions  
Chlorophyll in the thylakoid membrane absorbs photons, exciting electrons that flow through an electron transport chain to produce ATP and NADPH.

##### Calvin Cycle  
CO₂ is fixed by RuBisCO into 3-phosphoglycerate, then reduced to G3P using ATP and NADPH; finally RuBP is regenerated to continue the cycle.

##### Pigments and Light Absorption  
- **Chlorophyll a/b** absorb primarily blue (430–450 nm) and red (640–680 nm) light.  
- **Carotenoids** extend the range by capturing green wavelengths and protecting against photooxidative damage.


     

2. **Math Formatting Rules (Critical!)**:  
   When you are creating lessons for math related subjects that involve mathematical symbols (eg algebra, calculus, formal logic, classical math, computer science, engineering, physics, chemistry etc ... ).  Please use the following formatting for mathematical notations to render the symbols in a katex environment :


 You have a MathJax render environment.
- Use '\\(' and '\\)' for inline math equations within paragraphs
- Use '\\[' and '\\]\ for block math equations on separate lines
- Always escape the backslashes in the delimiters when writing them
  


Examples:
- Inline math: "The quadratic formula \\(x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}\\) is used to solve..."
- Block math: "The energy-mass equivalence is expressed as: \\[E = mc^2\\]"
- Chemical equation: "The balanced equation is \\[2H_2 + O_2 \\rightarrow 2H_2O\\]"



3. ########## Instructions on citation formatting ######

1. When a major concept or idea is bought up we should insert an inline citation
to give the user the source of this information from their uploaded material. Citations should only be added to the lecture_note content, and this should be used conservatively , only cite the Major concepts and ideas. Follow these steps to make an inline citation

a. At the end of paragraph inside a lecture note where a major idea or concept was mentioned, insert the index of the citation, and enclose them with double angled bracket , example :
<<1>>. 

b. Use the lesson_citation to complete the citation that corresponds to the index. 
Example :

index : The index associated with the citation
textsource : " A short quote from the uploaded material that is the source of the idea "
page_number : The page the text source is found on.


The page number will be clearly marked in the uploaded material, here is how they look :

[#### START OF PAGE N ####]
[#### END OF PAGE N ####]



c. Never exceed more than four citations. Only provide citations for the lecture note of given sub topic. The textsource quote should not exceed 40 words.


Here is full example :



Uploaded material :
[#### START OF PAGE 7 #### ]

..... Photosynthesis is a chemical process where plants make food .....

[#### END OF PAGE 7 #### ]




Inline text example in lecture_note content :


.....Plants make food via photosynthesis <<3>>.....


CAVEAT :
Do not add any JSON object or array inside lecture_note—all citation objects must go into the sibling lesson_citation array.
"

  `.trim();
}


export function buildSubtreePromptV2(
  mainTopic: string,
syllabusBlock: string,
psAmount:number,
wordCount:number,
): string {
  return `
You are tasked with creating study notes for the given syllabus, the study notes to explain a topic to a student encountering this subject for the first time.  Your objective is to guide the user towards the learning objective so that they can get a firm grasp of the subject matter. The learning content your write must be coherent , and the primary intent of the content is to guide the user to attaining the learning goals and mastering the topic.

You are preparing study notes on a specific unit that is apart of a larger syllabus and you will be given an excerpt from this syllabus covering a specific unit. This unit consists of primary subtopics and nested secondary subtopics, you must create study notes for ALL of the given primary subtopics and their nested secondary subtopics (if present, otherwise you can leave the secondary subtopic null). Each lesson entails a lecture note, flash cards, and two matching quiz question-answer pairs. The lesson you are creating is a part of a larger syllabus whose main topic is "${mainTopic}".  :
The unit consists of exactly ${psAmount} primary subtopic(s), each with their own nested secondary subtopics. Each primary subtopic and their nested secondary subtopics (if present)  are separated woth the following delimiter #########.

####Start of Syllabus###
${syllabusBlock}
###End of Syllabus####

You will be given a schema and will return a structured output. Here are some of notable parts of the schema :

Lecture_note : This is the main body of a primary subtopic or secondary subtopic, the content here should align with the specifications in the syllabus. It is essentially a stand alone micro lesson and each lecture_note should be between ${wordCount} - ${wordCount + 50}  words. Lecture_notes should include citations where possible, please strictly adhere to the citation formating instructions below.
flash_cards : These are flash cards, please see the guidelines below on how to design effective cards. Do not exceed more than four flash cards per subtopic, you can make one to four flash cards, and the number of flash cards should be proportionate to the length of the lecture note of given subtopic . See the self assesment section for more guidelines.
quiz : You are expected to create 3 quiz questions (total) to reinforce the learning objectives of the syllabus or content of the micro lessons. See the self assesment section for more guidelines.


Instructions

1. Create study notes that is grounded in the provided text and use the learning objectives to enhance the quality of your lesson. Explain the main points in the given text.
You are tasked with writing study notes to explain a topic to a student encountering this subject for the first time.  Your objective is to guide the user towards the learning objective so that they can get a firm grasp of the subject matter. The learning content your write must be coherent , and the primary intent of the content is to guide the user to attaining the learning objectives. 
2. If applicable draw concrete examples / problems from the uploaded material and explain them, if they are present in the uploaded text. These examples or problems must be grounded in the text, if the text doesn't have examples or problems you can skip this step.

## Instructions on Readability and Math Formatting (Applies to preparing the lecture_note field of the Schema for each topic in the syllabus)

1. **Structure**:
   - Use Markdown syntax where appropriate:
     - Use '#####' for subheadings to improve readability (this is a heading level of 5). 
     - Subheadings must always be placed on a new line, use a newline character '\n' as a delimiter example :
     \n\n ##### Heading Example \n\n
     - Subheadings can either be a short phrase or they can ask a question that stages the intent of the upcoming paragraph or sets of related paragraphs. 
     - Headings must add structure or clarity.
     - Avoid repeating the subtopic title as a heading.
     - Never use the phrase "Lecture note".
     - Use bullet points or numbered lists for organization whenever a list is required.
     - Avoid large blocks of text, use regular medium size paragraphs to improve readability. 

     Example:

##### Light-Dependent Reactions  
Chlorophyll in the thylakoid membrane absorbs photons, exciting electrons that flow through an electron transport chain to produce ATP and NADPH.

##### Calvin Cycle  
CO₂ is fixed by RuBisCO into 3-phosphoglycerate, then reduced to G3P using ATP and NADPH; finally RuBP is regenerated to continue the cycle.

##### Pigments and Light Absorption  
- **Chlorophyll a/b** absorb primarily blue (430–450 nm) and red (640–680 nm) light.  
- **Carotenoids** extend the range by capturing green wavelengths and protecting against photooxidative damage.

*Writing Tone*
- Use an academic tone that you would find in a text book.
- Do not begin a lecture note with a generic openining/ filler expressions such as " This lesson focuses on ... ". Expression like these add no learning value and poses the risk of information overload which is a barrier to learning. The learning material should be straight to the point.



2. **Math Formatting Rules (Critical! Applies to lecture_note only)**:  
   When you are creating lessons for math related subjects that involve mathematical symbols (eg algebra, calculus, formal logic, classical math, computer science, engineering, physics, chemistry etc ... ).  Please use the following formatting for mathematical notations to render the symbols in a katex environment :


 You have a MathJax render environment.
- Use '\\(' and '\\)' for inline math equations within paragraphs
- Use '\\[' and '\\]\ for block math equations on separate lines
- Always escape the backslashes in the delimiters when writing them
  

Examples:
- Inline math: "The quadratic formula \\(x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}\\) is used to solve..."
- Block math: "The energy-mass equivalence is expressed as: \\[E = mc^2\\]"
- Chemical equation: "The balanced equation is \\[2H_2 + O_2 \\rightarrow 2H_2O\\]"



3. ########## Instructions on citation formatting (lecture_note only) ######

1. When a major concept or idea is bought up we should insert an inline citation
to give the user the source of this information from their uploaded material. Citations should only be added to the lecture_note content, and this should be used conservatively , only cite the Major concepts and ideas. Follow these steps to make an inline citation

a. At the end of paragraph inside a lecture note where a major idea or concept was mentioned, insert the index of the citation, and enclose them with double angled bracket , example :
<<1>>. 

b. Use the lesson_citation to complete the citation that corresponds to the index. 
Example :

index : The index associated with the citation
textsource : " A short quote from the uploaded material that is the source of the idea "
page_number : The page the text source is found on.


The page number will be clearly marked in the uploaded material, here is how they look :

[#### START OF PAGE N ####]
[#### END OF PAGE N ####]



c. Never exceed more than four citations. Only provide citations for the lecture note of given sub topic. The textsource quote should not exceed 40 words.


Here is full example :



Uploaded material :
[#### START OF PAGE 7 #### ]

..... Photosynthesis is a chemical process where plants make food .....

[#### END OF PAGE 7 #### ]



Inline text example in lecture_note content :


.....Plants make food via photosynthesis <<3>>.....


Example of multiple citations :

... Emile Durkheim posits that norms serve a purpose of fostering cohesiveness <<4>> <<5>> <<9>> ...


CAVEAT :
Do not add any JSON object or array inside lecture_note—all citation objects must go into the sibling lesson_citation array.


#### Self Assesment Resource Guidlines (Flash cards and Matching Quiz) 
General guidelines for designing self assement material :

a. Active Recall is Paramount: Force the brain to retrieve information, strengthening memory more effectively than passive review.
b. Desirable Difficulty: Questions should require effortful retrieval without being ambiguous or frustrating.
c. Precision is Key: Ambiguous questions or cues hinder learning and accurate self-assessment.
d. Alignment Matters: Resources must target specific, valuable learning objectives.


3. Create flash cards to document key concepts, ideas, events, or formula that are found in the lesson.
 The nature of the flash cards largely depend on the domain of the lesson, the aim is to create an effective set of flash cards
 that will drive active recall , reinforce long term retention and most importantly they should align with the learning objectives of the unit. A subtopic can have one to four flash cards, the number of flash cards should be proportionate to the length of the lecture_note of a given subtopic. For example if the lecture note is one paragraph only create 1-2 flash cards, if its longer than this then create 2-4 flash cards.
 In general flash cards should align with the learning objectives and key ideas or concepts from the lesson. Do not provide flash cards for insignificant details, recall that this unit is apart of a larger syllabus, we do not want to overload the user information because information overload is a barrier to learning.
 Here are some guidelines to prepare highly effective flash cards :

#### Axis for effective Flash card design 
a. Cognitive Demand Level: Design the prompt (front side of card) to require retrieval of a single, specific piece of information (fact, definition, concept) or a concise application/explanation, avoiding mere recognition.
 A proportion of cards should require applying or explaining the idea so higher order retrieval is rehearsed.

b. Contextual Precision: Provide minimal, relevant context on the question side to ground the recall task without giving away the answer or creating ambiguity. A proportion of the cards MUST ask a question that provides minimal context to frame its response, avoid overusing single term flash cards as they provide zero context. 
 
c. Answer Specificity: Ensure the correct answer is unambiguous and concise, allowing for clear self-grading.

d. Cue Effectiveness: Avoid unintentional hints within the prompt or structure that make retrieval trivial.




##### Matching Quiz instructions

4. Create three matching quiz question-answer pairs, use the following guidelines to preparing effective matching questions :

a. Association Clarity: Ensure the relationship between the items in the two columns (e.g., term-definition, cause-effect) is explicit, consistent, and directly tests a specific type of paired knowledge.

b. Column Homogeneity: Maintain consistent content type and format within each column (e.g., all terms on the left, all definitions on the right; all single words or all short phrases).

c. Match Uniqueness: Design the items so each premise (left column item) has only one unambiguous correct match in the response (right column), and vice versa (unless deliberately including unused responses).

d. Clue Minimization: Avoid formatting, wording, or logical inconsistencies that allow matches to be deduced through the process of elimination unrelated to the target knowledge.



Here is an example of an expected output for your response :

  "lesson_citation": [
    {
      "index": 1,
      "page_number": 9,
      "textsource": "One sociologist (Berger 1963, 106) has argued that the self is not ΓÇ£a solid, given entity that moves from one situation to another. It is rather a process, continuously created and recreated in each social situation that one enters.ΓÇ¥"
    },
    {
      "index": 2,
      "page_number": 9,
      "textsource": "Charles Horton Cooley (1902) captures the interdependence between individuals and society in his concept of ΓÇ£the looking-glass selfΓÇ¥ Others (society) are the mirror that reflects back an image of who we are."
    },
    {
      "index": 3,
      "page_number": 9,
      "textsource": "The ΓÇ£Me,ΓÇ¥ as Mead (1934, 175) describes it, is the ΓÇ£response of the organism to the attitudes of others.ΓÇ¥"
    },
    {
      "index": 4,
      "page_number": 10,
      "textsource": "In his classic book The Presentation of Self in Everyday Life Goffman (1959) analyzes everyday interaction using what he calls a dramaturgical approach."
    },
    {
      "index": 5,
      "page_number": 10,
      "textsource": "Reflecting a symbolic interactionist understanding of roles, Goffman distinguishes between role and role performance. For Goffman, ΓÇ£roleΓÇ¥ refers to a person's conduct if he or she did only what the norms attached to the particular position directed. By contrast, ΓÇ£role performanceΓÇÖ reflects the actual behaviour of an individual while acting out the role."
    },
    {
      "index": 6,
      "page_number": 8,
      "textsource": "Clearly, the symbolic interactionist perspective on roles emphasizes the agency of social actors over structures that constrain or determine human action and interaction."
    }
  ],
  "primary_subtopics": [
    {
      "ChronologicalOrder": 3,
      "lesson": {
        "flash_cards": [
          {
            "definition": "Charles Horton Cooley's concept that our sense of self is acquired by imagining how we appear to others, who then reflect an image of who we are.",
            "term": "Looking-Glass Self"
          },
          {
            "definition": "The 'Me' is the socialized self that considers societal norms and others' expectations, while the 'I' is the spontaneous, acting self that can choose to conform or deviate from the 'Me'.",
            "term": "Mead's 'I' and 'Me'"
          },
          {
            "definition": "Erving Goffman's perspective that views social interaction as a theatrical performance where individuals present roles and manage impressions.",
            "term": "Dramaturgical Approach"
          },
          {
            "definition": "The process by which social actors try to shape how others will define them by controlling their presentation of self in social encounters.",
            "term": "Impression Management"
          }
        ],
        "lecture_note": "##### The Self as a Social Object\nThe self is not a fixed entity but a dynamic process, continuously created and recreated through social interaction <<1>>. From a symbolic interactionist perspective, individuals define their selves as objects through ongoing interaction.\n\n##### The Looking-Glass Self\nSociologist Charles Horton Cooley's concept of the \"looking-glass self\" illustrates this interdependence between individuals and society <<2>>. It posits that our self-concept is formed by imagining how we appear to others, who then reflect back an image of who we are. Others essentially serve as a mirror through which we perceive ourselves.\n\n##### Mead's \"I\" and \"Me\"\nGeorge Herbert Mead further elaborated on the social construction of the self, proposing it comprises two interdependent components: the \"I\" and the \"Me.\" The \"Me\" represents the socialized self, encompassing the internalized attitudes and expectations of others and society, often referred to as the \"generalized other.\" It influences our thoughts by prompting consideration of social norms and how we want to be perceived. The \"I\" is the spontaneous, unorganized, and unpredictable aspect of the self, which can either conform to or challenge the \"Me's\" considerations <<3>>.\n\n##### Kuhn's Core Self\nWhile many symbolic interactionists emphasize the fluidity of the self, Manford Kuhn introduced the concept of a \"core self.\" This refers to a stable set of meanings an individual attaches to themselves. Kuhn argued that this core self provides continuity and predictability to interactions, as individuals tend to act in ways consistent with their self-perception.\n\n##### Goffman's Dramaturgical Approach\nErving Goffman's dramaturgical approach offers another lens for understanding how identity is presented through social interaction <<4>>. Goffman likens social life to a theatrical performance, where individuals are \"social actors\" presenting \"roles\" to an \"audience.\"\n\n##### Impression Management and Role Performance\nA key aspect of the dramaturgical approach is \"impression management,\" where individuals strategically try to shape how others define them through their presentations. Goffman differentiates between \"role\" (the expected conduct if one strictly followed norms attached to a position) and \"role performance\" (the actual behavior of an individual while acting out a role) <<5>>. This distinction highlights the room for individual agency within social expectations.\n\n##### Frontstage and Backstage\nGoffman also divided social reality into \"frontstage\" and \"backstage\" regions. \"Frontstage\" is where individuals carefully manage their self-presentation, aiming to create a positive impression for others. In contrast, \"backstage\" is a more relaxed space, often among trusted peers, where individuals can drop their performances and behave more genuinely, possibly revealing unflattering aspects of themselves."
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
            },
            {
              "definition": "The creative and flexible adaptation of social roles, allowing individuals to innovate beyond rigid scripts rather than merely conforming to predetermined expectations.",
              "term": "Role-Making"
            },
            {
              "definition": "The emphasis on individuals actively shaping their behavior and interactions within a fluid social context, rather than being solely determined by social structures.",
              "term": "Agency in Symbolic Interactionism"
            }
          ],
          "lecture_note": "##### Roles as Fluid Resources\nFrom a symbolic interactionist perspective, roles are not rigid, predetermined scripts but rather flexible resources that individuals employ to organize their activities <<6>>. This view emphasizes the agency of social actors, highlighting their capacity to use roles creatively rather than merely being constrained by them.\n\n##### Role-Taking\nRole-taking is a fundamental process through which individuals coordinate and align their actions with others. It involves actively \"putting oneself in the shoes of others\" to understand how they are defining a given situation, what roles they are projecting, and their likely course of action. This process also entails viewing oneself from the perspective of others and anticipating the consequences of one's own planned actions. Individuals continuously monitor others' reactions and adjust their role performance accordingly, making joint action possible.\n\n##### Role-Making\nComplementing role-taking is the concept of role-making. This describes how individuals creatively and flexibly adapt their roles, moving beyond rigid or prewritten scripts. While roles provide general guidelines, there is considerable room for innovation and personal interpretation in how one chooses to enact a role. For instance, different students will perform the \"student\" role in varied ways, reflecting their unique choices and agency.\n\n##### The Interplay of Role-Taking and Role-Making\nRole-taking and role-making are intricately linked and mutually dependent. Role-making cannot occur without the ability to engage in role-taking, as constructing a role requires the capacity to view oneself from another's vantage point. This dynamic interplay underscores that human behavior is not simply a matter of performing preset lines but rather involves organizing lines of behavior that are situationally appropriate and reflect individual agency.",
          "title": "Role-Taking and Role-Making: Agency in Action"
        }
      ],
      "title": "The Social Construction of Self and Identity"
    }
  ]

"

  `.trim();
}


export function buildSubtreePromptV22(
  mainTopic: string,
syllabusBlock: string,
psAmount:number,
wordCount:number,
): string {
  return `
You are tasked with creating study material for the given syllabus, that will explain a topic to a student encountering this subject for the first time.  Your objective is to use the lesson outline and learning objective of each respective subtopic in the syllabus to guide the user towards attaining the learning objectives of each respective subtopic in the unit.  


The learning content your write must be coherent , and the primary intent of the content is to guide the user towards attaining the learning goals and mastering the topic.


The study material you are preparing is on a specific unit that is a part of a larger syllabus and you will be given a specific section from this syllabus covering a specific unit. This unit consists of primary subtopics and nested secondary subtopics, you must create study material for ALL of the given primary subtopics and their nested secondary subtopics (if present, otherwise you can leave the secondary subtopic null). Each lesson on a subtopic entails a lecture note, flash cards, and two - three matching quiz question-answer pairs. The lesson you are creating is a part of a larger syllabus whose main topic is "${mainTopic}".  :
This lesson consists of exactly ${psAmount} primary subtopic, and the secondary subtopics listed in the syllabus below. Each primary subtopic and their nested secondary subtopics (if present)  are separated with the following delimiter #########.


####Start of Syllabus###
${syllabusBlock}
###End of Syllabus####


You will be given a schema and will return a structured output. Here are some of notable parts of the schema :


Lecture_note : This is the main learning content of a primary subtopic or secondary subtopic, the content here should align with the lesson outline and learning objectives of the respective subtopic (primary or secondary) from the syllabus. You must use the respective lesson outline and learing objectives of a subtopic to guide the reader towards attaining the learning goals of that subtopic as specified in the syllabus. The lecture note is essentially a stand alone micro lesson and each lecture_note should be between ${wordCount} - ${wordCount + 50}  words. 

Lecture_notes should include citations where possible, please strictly adhere to the citation formating instructions below.



flash_cards : These are flash cards, please see the guidelines below on how to design effective cards. Do not exceed more than four flash cards per subtopic, you can make one to four flash cards, and the number of flash cards should be proportional to the length of the lecture note of given subtopic . See the self assesment section for more guidelines.
quiz : You are expected to create 3 quiz questions (total) to reinforce the learning objectives of the syllabus or content of the micro lessons. See the self assesment section for more guidelines.




Instructions


1. Create study notes that are grounded in the provided textbook material  and use the learning objectives to enhance the quality of your lesson. Explain the main points in the given text (ie the user provided textbook material) . The provided textbook material will be found in a section marked as followed :

######## Start of User provided textbook material ######### (...LessonText)  ############ End of user provided textbook material########


You are tasked with creating study material for the given textbook material using the syllabus. The objective is to explain the topic to a student encountering this subject for the first time.  Your objective is to use the lesson outline and learning objective of each respective subtopic in the syllabus to guide the user towards attaining the learning objectives of each respective subtopic in the unit.



2. If applicable draw concrete examples / problems from the uploaded textbook material and explain them, if they are present in the uploaded text. These examples or problems must be grounded in the text, if the text doesn't have examples or problems you can skip this step.


## Instructions on Readability and Math Formatting (Applies to preparing the lecture_note field of the Schema for each topic in the syllabus)


1. **Readability guidelines**:
   - Use Markdown syntax where appropriate:
     - Use '#####' for subheadings to improve readability (this is a heading level of 5).
     - Subheadings must always be placed on a new line, use a newline character '\n' as a delimiter example :
     \n\n ##### Heading Example \n\n
     - Subheadings can either be a short phrase or they can ask a question that stages the intent of the upcoming paragraph or sets of related paragraphs.. Please use purposeful subheadings to improve the readability of each lecture note. Consider using the lesson outline of the respective subtopic to create natural fitting sub headings for the given lecture note.
     - Avoid reusing the subtopic title as a subheading for a paragraph.
     - Never use the phrase "Lecture note".
     - Use bullet points or numbered lists for organization whenever a list is required.
     - Avoid large blocks of text, use regular medium size paragraphs with subheadings to improve readability.


     Example:


##### Light-Dependent Reactions  
Chlorophyll in the thylakoid membrane absorbs photons, exciting electrons that flow through an electron transport chain to produce ATP and NADPH.


##### Calvin Cycle  
CO₂ is fixed by RuBisCO into 3-phosphoglycerate, then reduced to G3P using ATP and NADPH; finally RuBP is regenerated to continue the cycle.


##### Pigments and Light Absorption  
- **Chlorophyll a/b** absorb primarily blue (430–450 nm) and red (640–680 nm) light.  
- **Carotenoids** extend the range by capturing green wavelengths and protecting against photooxidative damage.


*Writing Tone*
- Use an academic tone that you would find in a text book.
- Do not begin a lecture note with a generic openining/ filler expressions such as " This lesson focuses on ... ". Expression like these add no learning value and poses the risk of information overload which is a barrier to learning. The learning material should be straight to the point.






2. **Math Formatting Rules (Critical! Applies to lecture_note only)**:  
   When you are creating lessons for math related subjects that involve mathematical symbols (eg algebra, calculus, formal logic, classical math, computer science, engineering, physics, chemistry etc ... ).  Please use the following formatting for mathematical notations to render the symbols in a katex environment :




 You have a MathJax render environment.
- Use '\\(' and '\\)' for inline math equations within paragraphs
- Use '\\[' and '\\]\ for block math equations on separate lines
- Always escape the backslashes in the delimiters when writing them
 


Examples:
- Inline math: "The quadratic formula \\(x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}\\) is used to solve..."
- Block math: "The energy-mass equivalence is expressed as: \\[E = mc^2\\]"
- Chemical equation: "The balanced equation is \\[2H_2 + O_2 \\rightarrow 2H_2O\\]"






3. ########## Instructions on citation formatting (lecture_note only) ######


1. When a major concept or idea is bought up we should insert an inline citation
to give the user the source of this information from their uploaded material. Citations should only be added to the lecture_note content, and this should be used conservatively , only cite the Major concepts and ideas. Follow these steps to make an inline citation


a. At the end of paragraph inside a lecture note where a major idea or concept was mentioned, insert the index of the citation, and enclose them with double angled bracket , example :
<<1>>.


b. Use the lesson_citation to complete the citation that corresponds to the index.
Example :


index : The index associated with the citation
textsource : " A short quote from the uploaded material that is the source of the idea "
page_number : The page the text source is found on.




The page number will be clearly marked in the uploaded material, here is how they look :


[#### START OF PAGE N ####]
[#### END OF PAGE N ####]






c. Never exceed more than four citations. Only provide citations for the lecture note of given sub topic. The textsource quote should not exceed 40 words.




Here is full example :






Uploaded material :
[#### START OF PAGE 7 #### ]


..... Photosynthesis is a chemical process where plants make food .....


[#### END OF PAGE 7 #### ]






Inline text example in lecture_note content :




.....Plants make food via photosynthesis <<3>>.....




Example of multiple citations :


... Emile Durkheim posits that norms serve a purpose of fostering cohesiveness <<4>> <<5>> <<9>> ...




CAVEAT :
Do not add any JSON object or array inside lecture_note—all citation objects must go into the sibling lesson_citation array.




#### Self Assesment Resource Guidlines (Flash cards and Matching Quiz)
General guidelines for designing self assement material :


a. Active Recall is Paramount: Force the brain to retrieve information, strengthening memory more effectively than passive review.
b. Desirable Difficulty: Questions should require effortful retrieval without being ambiguous or frustrating.
c. Precision is Key: Ambiguous questions or cues hinder learning and accurate self-assessment.
d. Alignment Matters: Resources must target specific, valuable learning objectives.




3. Create flash cards to document key concepts, ideas, events, or formula that are found in the lesson.
 The nature of the flash cards largely depend on the domain of the lesson, the aim is to create an effective set of flash cards
 that will drive active recall , reinforce long term retention and most importantly they should align with the learning objectives of the unit. A subtopic can have one to four flash cards, the number of flash cards should be proportionate to the length of the lecture_note of a given subtopic. For example if the lecture note is one paragraph only create 1-2 flash cards, if its longer than this then create 2-4 flash cards.
 In general flash cards should align with the learning objectives and key ideas or concepts from the lesson. Do not provide flash cards for insignificant details, recall that this unit is apart of a larger syllabus, we do not want to overload the user information because information overload is a barrier to learning.
 Here are some guidelines to prepare highly effective flash cards :


#### Axis for effective Flash card design
a. Cognitive Demand Level: Design the prompt (front side of card) to require retrieval of a single, specific piece of information (fact, definition, concept) or a concise application/explanation, avoiding mere recognition.
 A proportion of cards should require applying or explaining the idea so higher order retrieval is rehearsed.


b. Contextual Precision: Provide minimal, relevant context on the question side to ground the recall task without giving away the answer or creating ambiguity. A proportion of the cards MUST ask a question that provides minimal context to frame its response, avoid overusing single term flash cards as they provide zero context.
 
c. Answer Specificity: Ensure the correct answer is unambiguous and concise, allowing for clear self-grading.


d. Cue Effectiveness: Avoid unintentional hints within the prompt or structure that make retrieval trivial.








##### Matching Quiz instructions


4. Create three matching quiz question-answer pairs, use the following guidelines to preparing effective matching questions :


a. Association Clarity: Ensure the relationship between the items in the two columns (e.g., term-definition, cause-effect) is explicit, consistent, and directly tests a specific type of paired knowledge.


b. Column Homogeneity: Maintain consistent content type and format within each column (e.g., all terms on the left, all definitions on the right; all single words or all short phrases).


c. Match Uniqueness: Design the items so each premise (left column item) has only one unambiguous correct match in the response (right column), and vice versa (unless deliberately including unused responses).


d. Clue Minimization: Avoid formatting, wording, or logical inconsistencies that allow matches to be deduced through the process of elimination unrelated to the target knowledge.






Here is an example of an expected output for your response :


  "lesson_citation": [
    {
      "index": 1,
      "page_number": 9,
      "textsource": "One sociologist (Berger 1963, 106) has argued that the self is not ΓÇ£a solid, given entity that moves from one situation to another. It is rather a process, continuously created and recreated in each social situation that one enters.ΓÇ¥"
    },
    {
      "index": 2,
      "page_number": 9,
      "textsource": "Charles Horton Cooley (1902) captures the interdependence between individuals and society in his concept of ΓÇ£the looking-glass selfΓÇ¥ Others (society) are the mirror that reflects back an image of who we are."
    },
    {
      "index": 3,
      "page_number": 9,
      "textsource": "The ΓÇ£Me,ΓÇ¥ as Mead (1934, 175) describes it, is the ΓÇ£response of the organism to the attitudes of others.ΓÇ¥"
    },
    {
      "index": 4,
      "page_number": 10,
      "textsource": "In his classic book The Presentation of Self in Everyday Life Goffman (1959) analyzes everyday interaction using what he calls a dramaturgical approach."
    },
    {
      "index": 5,
      "page_number": 10,
      "textsource": "Reflecting a symbolic interactionist understanding of roles, Goffman distinguishes between role and role performance. For Goffman, ΓÇ£roleΓÇ¥ refers to a person's conduct if he or she did only what the norms attached to the particular position directed. By contrast, ΓÇ£role performanceΓÇÖ reflects the actual behaviour of an individual while acting out the role."
    },
    {
      "index": 6,
      "page_number": 8,
      "textsource": "Clearly, the symbolic interactionist perspective on roles emphasizes the agency of social actors over structures that constrain or determine human action and interaction."
    }
  ],
  "primary_subtopics": [
    {
      "ChronologicalOrder": 3,
      "lesson": {
        "flash_cards": [
          {
            "definition": "Charles Horton Cooley's concept that our sense of self is acquired by imagining how we appear to others, who then reflect an image of who we are.",
            "term": "Looking-Glass Self"
          },
          {
            "definition": "The 'Me' is the socialized self that considers societal norms and others' expectations, while the 'I' is the spontaneous, acting self that can choose to conform or deviate from the 'Me'.",
            "term": "Mead's 'I' and 'Me'"
          },
          {
            "definition": "Erving Goffman's perspective that views social interaction as a theatrical performance where individuals present roles and manage impressions.",
            "term": "Dramaturgical Approach"
          },
          {
            "definition": "The process by which social actors try to shape how others will define them by controlling their presentation of self in social encounters.",
            "term": "Impression Management"
          }
        ],
        "lecture_note": "##### The Self as a Social Object\nThe self is not a fixed entity but a dynamic process, continuously created and recreated through social interaction <<1>>. From a symbolic interactionist perspective, individuals define their selves as objects through ongoing interaction.\n\n##### The Looking-Glass Self\nSociologist Charles Horton Cooley's concept of the \"looking-glass self\" illustrates this interdependence between individuals and society <<2>>. It posits that our self-concept is formed by imagining how we appear to others, who then reflect back an image of who we are. Others essentially serve as a mirror through which we perceive ourselves.\n\n##### Mead's \"I\" and \"Me\"\nGeorge Herbert Mead further elaborated on the social construction of the self, proposing it comprises two interdependent components: the \"I\" and the \"Me.\" The \"Me\" represents the socialized self, encompassing the internalized attitudes and expectations of others and society, often referred to as the \"generalized other.\" It influences our thoughts by prompting consideration of social norms and how we want to be perceived. The \"I\" is the spontaneous, unorganized, and unpredictable aspect of the self, which can either conform to or challenge the \"Me's\" considerations <<3>>.\n\n##### Kuhn's Core Self\nWhile many symbolic interactionists emphasize the fluidity of the self, Manford Kuhn introduced the concept of a \"core self.\" This refers to a stable set of meanings an individual attaches to themselves. Kuhn argued that this core self provides continuity and predictability to interactions, as individuals tend to act in ways consistent with their self-perception.\n\n##### Goffman's Dramaturgical Approach\nErving Goffman's dramaturgical approach offers another lens for understanding how identity is presented through social interaction <<4>>. Goffman likens social life to a theatrical performance, where individuals are \"social actors\" presenting \"roles\" to an \"audience.\"\n\n##### Impression Management and Role Performance\nA key aspect of the dramaturgical approach is \"impression management,\" where individuals strategically try to shape how others define them through their presentations. Goffman differentiates between \"role\" (the expected conduct if one strictly followed norms attached to a position) and \"role performance\" (the actual behavior of an individual while acting out a role) <<5>>. This distinction highlights the room for individual agency within social expectations.\n\n##### Frontstage and Backstage\nGoffman also divided social reality into \"frontstage\" and \"backstage\" regions. \"Frontstage\" is where individuals carefully manage their self-presentation, aiming to create a positive impression for others. In contrast, \"backstage\" is a more relaxed space, often among trusted peers, where individuals can drop their performances and behave more genuinely, possibly revealing unflattering aspects of themselves."
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
            },
            {
              "definition": "The creative and flexible adaptation of social roles, allowing individuals to innovate beyond rigid scripts rather than merely conforming to predetermined expectations.",
              "term": "Role-Making"
            },
            {
              "definition": "The emphasis on individuals actively shaping their behavior and interactions within a fluid social context, rather than being solely determined by social structures.",
              "term": "Agency in Symbolic Interactionism"
            }
          ],
          "lecture_note": "##### Roles as Fluid Resources\nFrom a symbolic interactionist perspective, roles are not rigid, predetermined scripts but rather flexible resources that individuals employ to organize their activities <<6>>. This view emphasizes the agency of social actors, highlighting their capacity to use roles creatively rather than merely being constrained by them.\n\n##### Role-Taking\nRole-taking is a fundamental process through which individuals coordinate and align their actions with others. It involves actively \"putting oneself in the shoes of others\" to understand how they are defining a given situation, what roles they are projecting, and their likely course of action. This process also entails viewing oneself from the perspective of others and anticipating the consequences of one's own planned actions. Individuals continuously monitor others' reactions and adjust their role performance accordingly, making joint action possible.\n\n##### Role-Making\nComplementing role-taking is the concept of role-making. This describes how individuals creatively and flexibly adapt their roles, moving beyond rigid or prewritten scripts. While roles provide general guidelines, there is considerable room for innovation and personal interpretation in how one chooses to enact a role. For instance, different students will perform the \"student\" role in varied ways, reflecting their unique choices and agency.\n\n##### The Interplay of Role-Taking and Role-Making\nRole-taking and role-making are intricately linked and mutually dependent. Role-making cannot occur without the ability to engage in role-taking, as constructing a role requires the capacity to view oneself from another's vantage point. This dynamic interplay underscores that human behavior is not simply a matter of performing preset lines but rather involves organizing lines of behavior that are situationally appropriate and reflect individual agency.",
          "title": "Role-Taking and Role-Making: Agency in Action"
        }
      ],
      "title": "The Social Construction of Self and Identity"
    }
  ]


"


  `.trim();
}

const readability:string = `## Instructions on Readability and Math Formatting

1. **Structure**:
   - Use Markdown syntax where appropriate:
     - Use '#####' for subheadings to improve readability (this is a heading level of 5).
     - **Do not add a heading before the first paragraph.**
     - Insert headings only when they add structure or clarity—not after every paragraph.
     - Avoid repeating the subtopic title as a heading.
     - Never use the phrase "Lecture note".
     - Use bullet points or numbered lists for organization.
     

      *Headings should appear where they feel natural to a human reader—like in a well-written textbook—not after every paragraph.*

     Example:

##### Light-Dependent Reactions  
Chlorophyll in the thylakoid membrane absorbs photons, exciting electrons that flow through an electron transport chain to produce ATP and NADPH.

##### Calvin Cycle  
CO₂ is fixed by RuBisCO into 3-phosphoglycerate, then reduced to G3P using ATP and NADPH; finally RuBP is regenerated to continue the cycle.

##### Pigments and Light Absorption  
- **Chlorophyll a/b** absorb primarily blue (430–450 nm) and red (640–680 nm) light.  
- **Carotenoids** extend the range by capturing green wavelengths and protecting against photooxidative damage.


     

2. **Math Formatting Rules (Critical!)**:  
   When you are creating lessons for math related subjects that involve mathematical symbols (eg algebra, calculus, formal logic, classical math, computer science, engineering, physics, chemistry etc ... ).  Please use the following formatting for mathematical notations to render the symbols in a katex environment :


 You have a MathJax render environment.
- Use '\\(' and '\\)' for inline math equations within paragraphs
- Use '\\[' and '\\]\ for block math equations on separate lines
- Always escape the backslashes in the delimiters when writing them
  


Examples:
- Inline math: "The quadratic formula \\(x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}\\) is used to solve..."
- Block math: "The energy-mass equivalence is expressed as: \\[E = mc^2\\]"
- Chemical equation: "The balanced equation is \\[2H_2 + O_2 \\rightarrow 2H_2O\\]"
`

const ExploreTopicInstructions:string = `
You are a helpful AI assistant that creates study notes, the user will upload text and a specific request for a topic. Your task is to create one primary topic based on the users request and uploaded content, and then create a variable number of secondary subtopics , it can be one, two, or three.  Avoid creating trivial secondary subtopics , the overall lesson should be impactful. The primary topic should be based on the user’s request; the uploaded content that accompanies the user’s request is to be used as secondary supplemental context. Because you are creating study notes, you should use a Bloom's taxonomy framework to structure the learning material. Please adhere to the following guidelines on how to create a primary subtopic and secondary subtopics..

`

const eploreTopicBase:string =
`

# Guidelines for defining the primary subtopics :


1. The primary subtopic must adequately cover the main idea(s) central to the user’s requested topic. The uploaded material ( typically excerpts from a textbook or lecture recordings) will provide supplementary context on the user’s requested topic. 


2. The learning content of the primary subtopic should target the understand level of bloom taxonomy. However, you should never mention bloom’s taxonomy or its levels in the returned response to the user, you are simply using it to structure the learning content of the study notes you are creating.




# Secondary Subtopic :


Secondary subtopics are supplementary follow-up topics for their designated primary subtopic. The purpose of these topics are to grasp higher levels of learning to make the learning material “stick”. However
They must not be overused; a primary goal of crafting these study notes is to AVOID INFORMATION OVERLOAD, as this will have negative impacts on the user’s learning experience. This is why a primary subtopic can have from ZERO to THREE secondary subtopics. Three secondary subtopics should be awarded only to the most dense and complex primary subtopic, and only if it is necessary. Awarding ZERO subtopics should only occur in circumstances when the proposed primary subtopic has a limited scope. In most cases, ONE to TWO secondary subtopics are common, and 0 and 3 secondary subtopics represent the extreme ends of the spectrum according to the complexity of the user’s requested topic and supplemental uploaded materials. Secondary subtopics in general fall into three categories :


A. Elaboration and Background ~ A secondary subtopic can expand on a key idea mentioned in the primary subtopic to provide further context and background. However, it should not be redundant, and it must be differentiable from the primary subtopic. This type of secondary subtopic targets the “understand” levels of Bloom's taxonomy.




B. Apply ~ A secondary subtopic can compose learning content that targets the apply level of the Bloom’s taxonomy. However, take note that you are creating study notes for users of a learning application; This learning material is intended to be read only, do not include directives for "assignment" or "activities". 


C. Analyze ~ A secondary subtopic can comprise a learning content that targets the Analyze level of the Bloom’s taxonomy.  However, take note that you are creating study notes for users of a learning application; This learning material is intended to be read only, do not include directives for "assignment" or "activities".

Finally, do not mention anything about Bloom’s taxonomy in the returned response to the user. You are creating study notes that will be read by a user.




# Secondary Subtopic Guidelines :


1. Be wary of information overload (ie, 3 secondary subtopics for all primary subtopics); create an appropriate number of secondary subtopics based on the density of the respective primary subtopic. Awarding 3 secondary subtopics to a primary subtopic should be rare because it poses the risk of information overload and negative learning experiences.


2. Remember that awarding 0 secondary subtopics should be uncommon. This should only happen when the respective primary subtopic can be adequately explained in a concise response.


3. For a given primary subtopic, it can only have one “Elaboration and Background” secondary subtopic; this constraint is necessary because this type of supplemental subtopic can “feel” redundant sometimes.  



`

export const FlashCardAssesment:string = `#### Self Assesment Resource Guidlines (Flash cards and Matching Quiz) 
General guidelines for designing self assement material :

a. Active Recall is Paramount: Force the brain to retrieve information, strengthening memory more effectively than passive review.
b. Desirable Difficulty: Questions should require effortful retrieval without being ambiguous or frustrating.
c. Precision is Key: Ambiguous questions or cues hinder learning and accurate self-assessment.
d. Alignment Matters: Resources must target specific, valuable learning objectives.


3. Create flash cards to document key concepts, ideas, events, or formula that are found in the lesson.
 The nature of the flash cards largely depend on the domain of the lesson, the aim is to create an effective set of flash cards
 that will drive active recall , reinforce long term retention and most importantly they should align with the learning objectives of the unit. A subtopic can have one to four flash cards, the number of flash cards should be proportionate to the length of the lecture_note of a given subtopic. For example if the lecture note is one paragraph only create 1-2 flash cards, if its longer than this then create 2-4 flash cards.
 In general flash cards should align with the learning objectives and key ideas or concepts from the lesson. Do not provide flash cards for insignificant details, recall that this unit is apart of a larger syllabus, we do not want to overload the user information because information overload is a barrier to learning.
 Here are some guidelines to prepare highly effective flash cards :

#### Axis for effective Flash card design 
a. Cognitive Demand Level: Design the prompt (front side of card) to require retrieval of a single, specific piece of information (fact, definition, concept) or a concise application/explanation, avoiding mere recognition.
 A proportion of cards should require applying or explaining the idea so higher order retrieval is rehearsed.

b. Contextual Precision: Provide minimal, relevant context on the question side to ground the recall task without giving away the answer or creating ambiguity. A proportion of the cards MUST ask a question that provides minimal context to frame its response, avoid overusing single term flash cards as they provide zero context. 
 
c. Answer Specificity: Ensure the correct answer is unambiguous and concise, allowing for clear self-grading.

d. Cue Effectiveness: Avoid unintentional hints within the prompt or structure that make retrieval trivial.

`



export const predefinedPrompts: Record<string, string> = {
  'ExploreTopic':`
  ${ExploreTopicInstructions}   
  \n ####################
  ${eploreTopicBase}
  \n ##################
  
${readability}

\n #####################
${FlashCardAssesment}
 `,
  'QApipeline' : `You are an expert tutor who assists users studying a particular topic. Your responses should guide the user through a logical reasoning process rather than simply providing direct answers. If applicable break down complex ideas into step-by-step explanations. If the users question requires reasoning, follow a structured approach, explaining your thought process step by step before arriving at a conclusion. If the user appears to misunderstand a concept, gently correct them and provide additional context or examples.   
  
  ${readability}`,
  'multipleChoice': '[Instructions: Generate a multiple choice quiz using the given schema. Each question should have 4 options with one correct answer.]',
  'matching': '[Instructions: Generate a matching quiz where each term must be paired with its corresponding definition or explanation. Follow the matching quiz schema. The matchingQuestion indicates the question text, while the matching answer is the corresponding term that is the correct answer for the question]',
  'fillInBlank': '[Instructions: Generate fill-in-the-blank questions where key terms or concepts are removed from sentences. Follow the fill-in-the-blank schema format.]',
  'trueFalse': '[Instructions: Generate true/false statements about key concepts. Each question should have a clear true or false answer. Follow the true/false schema format.]'
};


/**
 * buildQuestionCountInstruction
 * @description
 *   Construct a concise instruction that enforces target quantity and, for multiple types,
 *   a roughly even distribution across types. The controller appends this to its system prompt.
 *   Complexity: O(T) for T types.
 */
/**
 * buildQuestionCountInstruction
 * @description
 *   Builds a concise instruction that enforces a specific number of quiz items. It can be reused
 *   by other builders to ensure consistent count semantics. If quizType is provided, it clarifies
 *   the target format, otherwise it only enforces the total item count.
 */
export function buildQuestionCountInstruction(questionCount: number, quizType?: string): string { // update - 1
  const qty = Math.max(1, Math.floor(Number.isFinite(questionCount) ? questionCount : 10));
  if (quizType) {
    return `Generate exactly ${qty} ${quizType} question(s). If any item would be ambiguous, replace it to preserve count and clarity.`;
  }
  return `Generate exactly ${qty} question(s). If any item would be ambiguous, replace it to preserve count and clarity.`;
}



/**
 * getQuizSystemPrompt
 * @description
 *   Authoritative system prompt builder for quiz generation. It accepts a single quiz type and a
 *   question count, reuses the internal base maps, and returns a complete instruction block. The
 *   controller will pass the lesson/user text as the user input for the model to base questions on.
 *   We intentionally enforce a single quiz type for now; composite behavior can be added later
 *   without changing controller code by expanding this function. Output must strictly follow the
 *   JSON schema provided to the model call (no extra fields, no commentary).
 */
export function getQuizSystemPrompt(quizType: string, questionCount: number): string { // update - 2
  // 1) Normalize type: only the first/primary type is honored.
  const normalized = (quizType || 'multipleChoice').trim();

  // 2) Select a baseline. Fall back to multipleChoice if unknown.
  const base =
    predefinedPrompts[normalized] ??
    predefinedPrompts.multipleChoice;

  // 3) Add a strict count instruction.
  const countLine = buildQuestionCountInstruction(questionCount, normalized);

  // 4) Append enforcement lines for schema-only output.
  return [
    base,
    countLine,
  ].join('\n');
}