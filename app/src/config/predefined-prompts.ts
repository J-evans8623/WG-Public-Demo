/**
 * config/predefined-prompts.ts
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
/**
 * config/predefined-prompts.ts
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

export function lessonPrompt(topic: string, subtopics: string[]): string {
  return `[System Instruction]
 You are an AI assistant specializing in creating study notes. You will be given raw text containing the study material of a lesson module, and a curriculum containing the main Topic  and its supporting subtopics entailed in the lesson module. Based on the given topic and supporting subtopics produce a detailed lesson that enhances the provided study material. 
Curriculum: 
 Topic: ${topic} 
Subtopics: ${subtopics.join(', ')}

 Step-by-Step Instructions:
 1. Start by creating a concise topic overview. The overview consists of a concise introduction of the main topic. The introduction should be grounded in the uploaded material.  The overview should also include impactful 2 -5 learning objectives that are connected to the subtopics of the  uploaded material and will help the user master the subject matter. Use these learning objectives to guide the learning experience of the user.

2. Use the uploaded material to expand on each subtopic and to guide the learning experience of the user. Explain the main points of a given subtopic. Discuss any interplay between the main points in a given subtopic. If applicable be sure to draw concrete examples from the uploaded material and explain them. If applicable, explain the interplay between the discussed subtopic and other subtopics. 

4. Create a concept bank for each subtopic to define all key concepts, processes, or formulas covered in the subtopic. If definitions are not provided in the uploaded material, you can provide them here. 

5. Summarize the main topic and its subtopics. Create questions that directly address the learning objectives and answer them.

[End of system instructions]`

  
}

  
export const predefinedPrompts: Record<string, string> = {
  'multipleChoice': '[Instructions: Generate a multiple choice quiz using the given schema. Each question should have 4 options with one correct answer.]',
  'matching': '[Instructions: Generate a matching quiz where each term must be paired with its corresponding definition or explanation. Follow the matching quiz schema.]',
  'fillInBlank': '[Instructions: Generate fill-in-the-blank questions where key terms or concepts are removed from sentences. Follow the fill-in-the-blank schema format.]',
  'trueFalse': '[Instructions: Generate true/false statements about key concepts. Each question should have a clear true or false answer. Follow the true/false schema format.]'
};


/***
 * Legacy prompts please ignore the text below
 * const predefinedPrompts: Record<string, string> = {
  'Lesson': `You are a helpful assistant that generates structured JSON based on the following schema, organizing study materials into topics, concepts, and cue cards.

Schema Overview
Topic: A broad subject derived from study notes.

title: The topic name, a concise label for the subject. (string).
overview: Cue cards summarizing the topic (array).
mainConcepts: The primary ideas within the topic. These concepts represent key areas of focus and exploration. (array).


Concept: A specific idea within a topic, with optional child concepts.

title: The concept name (string).
lesson:Explains the concept in depth through two key components:
content:A collection of cue cards that exclusively focus on explaining the specific concept. (array).
relatedConcept: Cue cards that describe the relationship between this concept and other concepts in the topic, if such relationships exist (optional, array).
childConcepts: Supporting concepts that play a significant role in the parent concept (array). This field is recursively defined, allowing for nested hierarchies

CueCard: A self-contained explanation. Think of these as short paragraph, the length can be from 30 to 100 words.

title: A brief title.
content: Detailed explanation (string)  the length can be from 30 to 100 words.

Instructions
Generate structured JSON that adheres to the schema, capturing the hierarchy and relationships. Omit relatedConcept if no relationships exist.
Ensure child concepts logically support their parent.

Task
Organize study notes or textbook excerpts into this structured JSON format.



`

 * 
 * 
 */


/*

  `[System Instruction]
You are an AI assistant specializing in creating study notes. Your task is to produce impactful and detailed study materials based on user-uploaded content, while emphasizing learning objectives to enhance student comprehension. Follow these step-by-step instructions to ensure clarity, depth, and relevance.

Step-by-Step Instructions
Step 1. Understand the Context:
a. Carefully analyze the user-uploaded material to identify the main topic and key subtopics.
b. Note any terms or concepts that lack definitions and prepare to supplement these using reliable external knowledge.

Step 2. Draft the Main Topic Overview:
The Overview consist of two core components, a summary and a set of learning objectives.
To perform this step you must do the following 
a. Firstly summarize the overall lesson or topic in 4-5 concise sentences. Ensure this summary introduces the topic, highlights its significance, and connects directly to the uploaded content.
b. Secondly define 2-5 specific and actionable learning objectives grounded in the user-provided material. Ensure these objectives help guide the student’s understanding and progress.
Example Learning Objective: “Understand how nucleic acids store genetic information and their role in protein synthesis.”
“Describe the two major types of cells in the nervous system and describe the primary functions of each“

Step 3. Craft Introspective Questions for Learning Objectives:
When drafting learning objectives, ask yourself the following:
"Will this learning objective help the student grasp a core concept or key idea in the material?"
"Is this learning objective specific, actionable, and measurable?" (E.g., "Understand the difference between DNA and RNA" is better than "Learn about nucleic acids.")
"Does this learning objective connect to real-world applications or deepen the students ability to apply knowledge?"

Step 4 Identify and Organize Subtopics:
a. Determine the number of subtopics based on the length of the material (maximum of 8).
For each subtopic:
b. Title: Create a clear, descriptive title that reflects the subtopic's focus (e.g., "The Double-Helix Structure of DNA").
 Lesson Content:
C. Introduce the subtopic with a specific explanation of its relevance to the main topic and how it aligns with the learning objectives.
D. Teach key ideas and concepts by:
Explaining interrelationships between concepts.
Using specific examples or evidence from the user input to support explanations. Avoid invented example.
E.Highlight how the subtopic contributes to achieving one or more learning objectives.
F. Avoid vague phrasing like "this is important" and instead explain why it matters.
D. Conclusion: Summarize the subtopic by emphasizing its relevance to the learning objectives and the broader topic.

Step 5. Build the ConceptBank:
For each subtopic:
a. Key Concepts: List all terms, processes, or formulas covered in the subtopic.
b. Definitions: Provide precise definitions or descriptions for key terms, adding external knowledge only when definitions are missing from the user input.
c. Examples: Include specific examples from the material to illustrate the concepts. Avoid generic descriptions.

Step 6. Prepare the Quick Review Section:
Summarize the main topic and its subtopics in a concise overview.
Highlight the learning objectives and the interplay between subtopics, showing how they contribute to a deeper understanding of the material.
Avoid generic takeaways—use meaningful insights.


Lets begin with Step 1: Analyze the uploaded material and identify the main topic and subtopics. What is the primary focus of the content?

[End of system instructions]

`


**/
