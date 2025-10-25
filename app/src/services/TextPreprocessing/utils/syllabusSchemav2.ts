// File: app/src/services/TextPreprocessing/utils/syllabusSchemav1.ts

/**
 * @file    app/src/services/TextPreprocessing/utils/syllabusSchemav2.ts
 * @description
 *   Defines the JSON schema for the combined unit syllabus + metadata output
 *   from a single Gemini API call (Phase 1).
 *
 * Responsibilities:
 *  - Enforce structure for:
 *      • LessonTitle: generated lesson title
 *      • Introduction: generated lesson introduction
 *      • unit_syllabus: array of primary subtopics (each with Domain, local learning objectives, outline, etc.)
 *  - Drop the redundant global LearningObjectives field in favor of per-subtopic objectives.
 */


// File: app/src/services/TextPreprocessing/utils/syllabusSchemav2.ts
/**
 * @file    app/src/services/TextPreprocessing/utils/syllabusSchemav2.ts
 * @description
 *   Defines the JSON schema for the combined unit syllabus + metadata output
 *   from a single Gemini API call (Phase 1).
 *
 * Responsibilities:
 *  - Enforce structure for:
 *      • LessonTitle: generated lesson title
 *      • Introduction: generated lesson introduction
 *      • unit_syllabus: array of primary subtopics (each with Domain, local learning objectives, outline, etc.)
 *  - Drop the redundant global LearningObjectives field in favor of per-subtopic objectives.
 */

export const unitSyllabusArray = {
  name: "unit_syllabus",
  schema: {
    type: "object",
    description: "Combined output including lesson metadata and array of primary subtopics.",
    properties: {
      LessonTitle: {
        type: "string",
        description: "The generated title of the lesson module."
      },
      Introduction: {
        type: "string",
        description: "The generated introduction for the lesson module."
      },
      CourseTitle: {
        type: "string",
        description: "Short, conventional University course name (e.g., Biology, Calculus I, World History, Pscyhology, Sosciology, Economics, Statistics, Business, Religion, Physics, Chemistry, Organic Chemistry, Algebra, Math, Computer Science)."
      },
      unit_syllabus: {
        type: "array",
        description: "An array of primary subtopic objects for the unit syllabus.",
        items: {
          type: "object",
          properties: {
            Title: {
              type: "string",
              description: "The title of the primary subtopic."
            },
            Learning_Objectives: {
              type: "string",
              description: "The learning objectives for this primary subtopic."
            },
            LessonOutline: {
              type: "string",
              description: "An outline of the lesson for this primary subtopic."
            },
            SecondarySubtopic: {
              type: "array",
              description: "Array of secondary subtopic objects supporting this primary subtopic.",
              items: {
                type: "object",
                properties: {
                  Title: {
                    type: "string",
                    description: "The title of the secondary subtopic."
                  },
                  Learning_Objectives: {
                    type: "string",
                    description: "The learning objectives for this secondary subtopic."
                  },
                  LessonOutline: {
                    type: "string",
                    description: "An outline of the lesson for this secondary subtopic."
                  }
                },
                required: [
                  "Title",
                  "Learning_Objectives",
                  "LessonOutline"
                ],
                additionalProperties: false
              }
            },
            ChronologicalOrder: {
              type: "number",
              description: "Order in which this primary subtopic is presented."
            },
            relevantPages: {
              type: "array",
              description: "Page numbers from the original document that this subtopic covers.",
              items: { type: "number" }
            }
          },
          required: [
            "Title",
            "Learning_Objectives",
            "LessonOutline",
            "SecondarySubtopic",
            "ChronologicalOrder",
          ],
          additionalProperties: false
        }
      }
    },
    required: [
      "LessonTitle",
      "Introduction",
      "unit_syllabus",
      "CourseTitle",
    ],
    additionalProperties: false
  },
  strict: true
};




export function unitSyllabusPromptV2(topicAmount:string ="2",pageCount:number ): string {

 let prompt=  `You are tasked with creating a syllabus to guide a student through the provided course material. The syllabus will consist of ${topicAmount} primary subtopics and each primary subtopic may have up to a maximum of three supporting secondary subtopics ( 0 - 3 ). The syllabus must be grounded on the bloom’s taxonomy of learning. Primary subtopics target the “understand” levels of the taxonomy; in general, these primary subtopics will explain the core ideas of the uploaded material. The learning objectives of these primary subtopics must align with the “understand” level of the Bloom's Taxonomy. 

# Guidelines for defining the primary subtopics :

1. The entire set of primary subtopics must adequately cover the main ideas of the uploaded material ( typically excerpts from textbook or lecture recordings). You must define a total of  ${topicAmount} primary subtopics. 

2. The learning objectives of these primary subtopics should target the understand level of bloom taxonomy. These topics represent the “Explore” phase of the five e’s learning model. 

3. Use the lesson outline field to give a high level summary of what the topic should entail. A downstream model will use this information to create the specified lesson.

4. Indicate the chronological order of each primary subtopic , this will inform the front-end application the order in which these subtopics will be shown to the user in a slide show. Assign the chronological order of each subtopic, ranging from 1 to ${topicAmount}. 

# Secondary Subtopic :

Secondary subtopics are supplementary follow-up topics for their designated primary subtopic. The purpose of these topics are to grasp higher levels of learning to make the learning material “stick”. However 
They must not be overused; a primary goal of the syllabus is to AVOID INFORMATION OVERLOAD, as this will have negative impacts on students. This is why each primary subtopic can have from ZERO to THREE secondary subtopics. Three secondary subtopics should be awarded only to the most dense and complex primary subtopic, and only if it is necessary. Awarding ZERO subtopics should only occur in circumstances when the proposed primary subtopic has a limited scope. In most cases, ONE to TWO secondary subtopics are common, and 0 and 3 secondary subtopics represent the extreme ends of the spectrum according to the density of the provided learning material. Secondary subtopics in general fall into three categories :

A. Elaboration and Background ~ A secondary subtopic can expand on a key idea mentioned in the primary subtopic to provide further context and background. However, it should not be redundant, and it must be differentiable from the primary subtopic. This type of secondary subtopic targets the “understand” levels of Bloom's taxonomy. 


B. Apply ~ A secondary subtopic can comprise a learning objective that targets the apply level of the Bloom’s taxonomy. However, take notice that this syllabus is geared towards creating study notes for users of a learning application; This learning material is intended to be read only, do not include directives for "assignment" or "activities".


C. Analyze ~ A secondary subtopic can comprise a learning objective that targets the Analyze level of the Bloom’s taxonomy.  However, take notice that this syllabus is geared towards creating study notes for users of a learning application; This learning material is intended to be read only, do not include directives for "assignment" or "activities".


# Secondary Subtopic Guidelines :

1. Be wary of information overload (ie, 3 secondary subtopics for all primary subtopics); create an appropriate number of secondary subtopics based on the density of the respective primary subtopic. Awarding 3 secondary subtopics for all primary subtopics should be rare because it poses the risk of information overload and negative learning experiences. 

2. Be wary of creating a sparse syllabus (ie 0 secondary subtopics for all primary subtopics). Remember that awarding 0 secondary subtopics should be uncommon. This should only happen when the respective primary subtopic is sparse. 

3. For a given primary subtopic, it can only have one “Elaboration and Background” secondary subtopic; this constraint is necessary because this type of supplemental subtopic can “feel” redundant sometimes.  

4. In general best practice for defining secondary subtopics will be to have a mixed range of secondary subtopics; some primary subtopics may have 0, others might have 3, most will typically have 2 or 1. 


Finishing touches :

Give an appropriate "Course Title" that the subject material likely belongs , here are some examples of
short, conventional university course names :  Biology, Calculus I, World History, Pscyhology, Sosciology, Economics, Statistics, Business, Religion, Physics, Chemistry, Organic Chemistry, Algebra, Math, Computer Science, engineering and medicine.


 Indicate the relevant pages that each primary subtopic is based on using the 'relevantPages' property of the schema. For example if a primary subtopic lesson covers pages 1-4 and 8 , the relevant pages [1,2,3,4,8]. TAKE NOTE THAT THE ACTUAL PAGE
 NUMBER will be clearly marked in the uploaded material, here is how the MARKERS look :

[#### START OF PAGE N ####]
[#### END OF PAGE N ####]


The uploaded material for this prompt has exactly ${pageCount} pages, and thus the valid range of numbers that you can use to select the page range is 1 - ${pageCount}, and each page number is indicated by the specified page marker :

[#### START OF PAGE N ####]
[#### END OF PAGE N ####]


Lesson outline Guideline :

1. Please specify the bloom’s taxonomy level that learning objectives and lesson is supposed to target and then include a brief 100 word summary of what the lesson entails. Begin your lesson outline summary with the following phrase “This lesson targets the [ insert the bloom taxonomy level here] level of the blooms taxonomy. This lesson is about [continue your explanation of the lesson here] “ 

Example :

 "lessonOutline": "This lesson targets the Understand level of the Bloom taxonomy. This lesson is about tracing how cells extract usable energy from glucose through the four sequential stages of glycolysis, pyruvate oxidation, the citric-acid cycle, and oxidative phosphorylation. Students will follow the fate of carbon atoms, compare substrate-level versus oxidative ATP synthesis, and examine the roles of NAD⁺, FAD, and the proton-motive force in driving chemiosmosis. The lesson will link each stage’s inputs, outputs, and cellular locations, clarifying how electron transfer is coupled to ATP yield and highlighting points where metabolic pathways intersect with respiration."


Constraints : 

This syllabus will be used to construct study notes for users of an education application, the study notes will be generated by a downstream AI model, and thus the final study material returned to the user is text-based. Do not mention diagrams, imaginary exercises, or activities. The final study material will be for reading purposes only. `

return prompt
}


/**
export const finalizedSyllabusSchema= {
  "name": "lesson_metadata",
  "schema": {
    "type": "object",
    "properties": {
      "LessonTitle": {
        "type": "string",
        "description": "The title of the lesson."
      },
      "Introduction": {
        "type": "string",
        "description": "A brief introduction to the lesson content."
      },
      "LearningObjectives": {
        "type": "string",
        "description": "A list of objectives that the lesson intends to achieve.",
      }
    },
    "required": [
      "LessonTitle",
      "Introduction",
      "LearningObjectives"
    ],
    "additionalProperties": false
  },
  "strict": true
}  */

export const finalizedSyllabusPrompt = `### Instruction ###
Your task is to generate content for a formal educational module.

You are not addressing the reader. Do not use second-person pronouns (e.g., "you") or refer to the reader as a student, learner, or participant.

Instead, write in an objective and impersonal style appropriate for a textbook or formal curriculum document.

The response must include:
1. A suitable **title** for the lesson module.
2. A **comprehensive introduction** describing the topics that will be covered and the expected learning outcomes.
3. A **bullet-point list (in markdown)** of exactly 3 learning objectives, written in impersonal, declarative language.

### Constraints ###
- Do NOT refer to the reader or user.
- Do NOT use conversational or instructional tones.
- Maintain a formal and academic tone throughout.

### Output Format ###
- Title
- Introduction (text)
- Learning Objectives (markdown bullet list)
 `