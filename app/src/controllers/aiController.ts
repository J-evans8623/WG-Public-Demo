
// aiController.ts

/**
 * bloom-maps\app\src\controllers\aiController.ts
 *
 * This controller handles AI operations including lesson generation, quiz generation,
 * question handling, and topic generation.
 *
 * Newly added: handleQuizTool – Implements the specialized quiz generation pipeline.
 *
 * Responsibilities of handleQuizTool:
 *  1. Extracts from the request body:
 *      - topicIds: Array of selected concept node IDs.
 *      - quizTypes: Array of quiz types (supported values: multipleChoice, matching, FIB, true-false).
 *      - includeDocs: Boolean flag for using uploaded document context.
 *      - fileID, summary, summaryPresent, mapID, exportData.
 *  2. If includeDocs is true, calls getTextContext(exportData, fileID) to retrieve additional context.
 *  3. Constructs a final prompt that includes the export data, additional context (if any), and the quiz types.
 *  4. Selects the appropriate JSON schema and system prompt based on the quiz type(s).
 *  5. Invokes the AI service’s generateStructuredOutput and returns the structured quiz.
 */

import { NextApiRequest, NextApiResponse } from 'next';
import AIService from "../services/aiServiceV2";
import { lessonPrompt, predefinedPrompts, buildSubtreePromptV2, buildSubtreePrompt } from "../config/predefined-prompts";
//import OpenAIClient from "../config/openai";
import { lessonSchema, subtreeSchemaV3, topicSchema, subtreeSchemaV4, EnrichedPrimary, Citation } from "../schemas/lessonSchema";
import { MatchingQuizSchema, MultipleChoiceSchema, FillInBlankSchema, TrueFalseSchema } from "../schemas/quizSchema";
import { LessonModule } from "../services/TextPreprocessing/LessonModuleServiceV2";
import { getTextContext } from '@/app/src/services/TextPreprocessing/QuestionContextService';
import { QAschema } from '@/app/src/schemas/QASchema';
import { formatLessonMetadata } from "../services/TextPreprocessing/MetaDataFormatter";
import { formatSyllabusForPrompt, PrimaryForPrompt } from './formatSyllabus';



class AIController {
  private static aiService: AIService | null = null;

  // Returns a singleton AIService instance.
  private static getAIService(): AIService {
    if (!this.aiService) {
      console.log('[AIController] Initializing AI Service');
     // const openaiClient = OpenAIClient.getClient();
      this.aiService = new AIService();
    }
    return this.aiService;
  }

/**
   * generateLesson
   * @description
   *   Generates the full lesson content for a given LessonModule.
   *   It constructs a dynamic prompt based on the lesson module metadata,
   *   calls the AI service to generate structured lesson content, and returns
   *   the updated LessonModule with the AI-generated content attached.
   *
   * @param lessonModule - The LessonModule object containing basic metadata.
   * @returns A Promise that resolves to the updated LessonModule with full lesson content.
   */
public static async generateLesson(lessonModule: LessonModule): Promise<LessonModule> {
  try {
    // Step 1: Format the lesson metadata into a human-readable string.
    const formattedMetadata = formatLessonMetadata(lessonModule.metadata);
    // Step 2: Construct a dynamic prompt using the formatted metadata.
    const dynamicLessonPrompt = lessonPrompt(formattedMetadata);
    // Step 3: Retrieve the aggregated text from the lesson module.
    const aggregatedText = lessonModule.original_text;
    
    // Step 4: Obtain the AI service instance.
    const aiService = this.getAIService();
    
    // Step 5: Call the AI service to generate structured lesson content.
    // The generateStructuredOutput method is expected to return the full lesson content.
    const structuredResponse = await aiService.generateStructuredOutput(
      lessonSchema,
      `[start of user input]${aggregatedText}[end of user input]`,
      dynamicLessonPrompt
    );
  
    
    // Return the updated lesson module.
    return structuredResponse;
  } catch (error) {
    console.error("Error in AIController.generateLesson:", error);
    throw error;
  }
}


  public static async handleQuestion(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    try {
      console.log("[AIController] handleQuestion called with body:", req.body);
      const { question, textSelection, fileID } = req.body;
      if (!question || !fileID) {
        res.status(400).json({ error: "Missing question, moduleID, or fileID" });
        return;
      }
      let combinedInput = question;
      if (textSelection && typeof textSelection === 'string' && textSelection.trim().length > 0) {
        combinedInput += " " + textSelection.trim();
      }
      console.log("[AIController] Combined input for QA:", combinedInput);
      let retrievedContext = "";
      // Always get text context for a given question.
      retrievedContext = await getTextContext(combinedInput, fileID);
      console.log("[AIController] Retrieved additional context:", retrievedContext);
 
      let finalPrompt = "\n User Question :" + question;
      if (retrievedContext && retrievedContext.trim().length > 0) {
        finalPrompt += "\nContext: " + retrievedContext.trim();
      }
      console.log("[AIController] Final prompt for QA:", finalPrompt);
      const systemPrompt = predefinedPrompts['QApipeline'];
      console.log("[AIController] Using system prompt for QA:", systemPrompt);
      const aiService = AIController.getAIService();
      const structuredResponse = await aiService.generateStructuredOutput(
        QAschema,
        finalPrompt,
        systemPrompt
      );
      console.log("[AIController] QA structured response:", structuredResponse);
      res.status(200).json(structuredResponse);
    } catch (error) {
      console.error("[AIController] Error in handleQuestion:", error);
      res.status(500).json({ error: "Failed to generate answer for the question." });
    }
  }

  public static async handleTopicGeneration(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    try {
      console.log("[AIController] handleTopicGeneration called with body:", req.body);
      const { userTopicRequest, exportData, fileID, textSelection } = req.body;
      if (!userTopicRequest || !fileID) {
        res.status(400).json({ error: "Missing required fields: userTopicRequest, moduleID, or fileID" });
        return;
      }

      let getContext = userTopicRequest
      if (textSelection){
        getContext += `\n ${textSelection}`
      }
      // Retrieve additional context based on the user's topic request.
      const retrievedContext = await getTextContext(getContext, fileID);
      console.log("[AIController] Retrieved context for topic generation:", retrievedContext);
      // Construct final prompt.
      let finalPrompt = "User Topic Request: " + userTopicRequest;
      finalPrompt += "\nUpload: " + (textSelection ? textSelection : exportData);
      finalPrompt += "\nContext: " + retrievedContext;
      console.log("[AIController] Final prompt for topic generation:", finalPrompt);
      const systemPrompt = predefinedPrompts['ExploreTopic'];
      console.log("[AIController] Using system prompt for topic generation:", systemPrompt);
      const aiService = AIController.getAIService();
      const structuredResponse = await aiService.generateStructuredOutput(
        topicSchema,
        finalPrompt,
        systemPrompt
      );
      console.log("[AIController] Topic generation structured response:", structuredResponse);
      res.status(200).json(structuredResponse);
    } catch (error) {
      console.error("[AIController] Error in handleTopicGeneration:", error);
      res.status(500).json({ error: "Failed to generate topic." });
    }
  }

  /**
   * handleQuizTool
   *
   * Processes specialized quiz generation requests from the Quiz Tool.
   * It extracts the following fields from the request body:
   *   - topicIds: string[] (selected concept node IDs)
   *   - quizTypes: string[] (supported values: multipleChoice, matching, FIB, true-false)
   *   - includeDocs: boolean
   *   - fileID, summary, summaryPresent, mapID, exportData: exported study data
   *
   * Based on the includeDocs flag:
   *   - If true: Calls getTextContext on exportData to retrieve additional document context.
   *   - If false: Uses exportData directly.
   *
   * Constructs a final prompt including the export data, additional context (if any),
   * and a note of the selected quiz types.
   *
   * Then selects an appropriate JSON schema and system prompt based on the quiz type.
   * Finally, calls generateStructuredOutput and returns the structured quiz response.
   */
  public static async handleQuizTool(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    try {
      console.log("[AIController] handleQuizTool called with body:", req.body);
      const {
        topicIds,
        quizTypes,
        fileID,
        exportData,
        textSelection,
      } = req.body;
      
      if (!topicIds || !quizTypes || !fileID || !exportData) {
        res.status(400).json({ error: "Missing required fields for quiz generation." });
        return;
      }

      // Construct the final prompt.
      // It always includes the export data and the quiz types.
      let finalPrompt = "Context : " + (textSelection ? textSelection : exportData);

      finalPrompt += "\nQuiz Types: " + quizTypes.join(", ");
      console.log("[AIController] Final prompt for quiz generation:", finalPrompt);

      // Mapping for system prompts and schemas.
      const quizTypeMapping: { [key: string]: { promptKey: string, schema: any } } = {
        "multipleChoice": { promptKey: "multipleChoice", schema: MultipleChoiceSchema },
        "matching": { promptKey: "matching", schema: MatchingQuizSchema },
        "FIB": { promptKey: "fillInBlank", schema: FillInBlankSchema },
        "true-false": { promptKey: "trueFalse", schema: TrueFalseSchema }
      };

      let chosenSchema = MultipleChoiceSchema;
      let systemPrompt = "";

      if (quizTypes.length === 1) {
        const mapping = quizTypeMapping[quizTypes[0]];
        if (mapping) {
          chosenSchema = mapping.schema;
          systemPrompt = predefinedPrompts[mapping.promptKey] || "";
        } else {
          systemPrompt = "Generate a quiz based on the provided content.";
        }
      } else {
        // If multiple quiz types are selected, use a composite prompt.
        systemPrompt = "Generate a composite quiz that includes the following types: " + quizTypes.join(", ");
      }
      console.log("[AIController] Using system prompt:", systemPrompt);

      const aiService = AIController.getAIService();
      const structuredResponse = await aiService.generateStructuredOutput(
        chosenSchema,
        finalPrompt,
        systemPrompt
      );
      console.log("[AIController] Quiz generation structured response:", structuredResponse);
      res.status(200).json(structuredResponse);
    } catch (error) {
      console.error("[AIController] Error in handleQuizTool:", error);
      res.status(500).json({ error: "Failed to generate quiz." });
    }
  }


  /**
   * generateSubtreeLesson
   *
   * Generates detailed lesson content, flash cards, optional secondary subtree,
   * and a quiz for a single depth-1 PrimaryNode and its children.
   *
   * @param root - A PrimaryNode with .title, .aggregated_text, and optional depth2_subtopics.
   * @returns Promise resolving to the enriched PrimaryNode with:
   *   - lesson: { lecture_note, flash_cards }
   *   - secondary_subtopic: ...[]
   *   - quiz: matching_quiz object
   */
  public static async generateSubtreeLesson(root: any, mainTopic:string): Promise<any> {
    const aiService = this.getAIService();

    
      const primary: PrimaryForPrompt = {
    title: root.title!,
    Learning_Objectives: root.Learning_Objectives!,
    LessonOutline: root.LessonOutline!,
    secondary_topics: (root.depth2_subtopics || []).map((s: any) => ({
      title: s.title,
      Learning_Objectives: s.Learning_Objectives,
      LessonOutline: s.LessonOutline
    }))
  };

  
  // produce the formatted string
  const syllabusBlock = formatSyllabusForPrompt(primary);
  console.log(`[aiController 444442] ${JSON.stringify(syllabusBlock)} `);
    // System prompt to guide structured subtree output
  const systemPrompt = buildSubtreePrompt(mainTopic, syllabusBlock);

    // User content: pass the root object with its title, text, and nested children
    const userInput = JSON.stringify({
      primary_subtopics: {
        title: root.title,
        aggregated_text: root.unit_text,
        depth2_subtopics: root.depth2_subtopics || []
      }
    });

    console.log(`1111 userInput Check ${userInput}`);

    // Perform the structured call
    const response = await aiService.generateStructuredOutput(
      { name: subtreeSchemaV4.name, schema: subtreeSchemaV4.schema, strict: subtreeSchemaV4.strict },
      userInput,
      systemPrompt
    );

     const subtree = (response as any).primary_subtopics;

  // ─── Hydrate PRIMARY node ────────────────────────────────────────
  root.lesson          = subtree.lesson;
  root.lesson_citation = subtree.lesson_citation ?? null;
  root.ChronologicalOrder = root.lessonOrder;
  // ─── Hydrate SECONDARY nodes (keep citations!) ───────────────────
  root.secondary_subtopic = Array.isArray(subtree.secondary_subtopic)
    ? subtree.secondary_subtopic.map((ss: any) => ({
        title           : ss.title,
        lecture_note    : ss.lecture_note,
        flash_cards     : ss.flash_cards,
      }))
    : null;

  // ─── Quiz  ────────────────────────────────────────────────────────
  root.quiz = subtree.quiz;


  console.log(`\n\n\n ############################ \n [Aicontroller] #9292 lesson unit output ${JSON.stringify(subtree)} \n ###########################`)

  return root;
  }


  /**
   * generateSubtreeLessonV2
   *
   * Generates detailed lesson content, flash cards, optional secondary subtree,
   * and a quiz for multiple depth-1 PrimaryNode and its children.
   *
   * @param root - A PrimaryNode with .title, .aggregated_text, and optional depth2_subtopics.
   * @returns Promise resolving to the enriched PrimaryNode with:
   *   - lesson: { lecture_note, flash_cards }
   *   - secondary_subtopic: ...[]
   *   - quiz: matching_quiz object
   */
  public static async generateSubtreeLessonV2(roots: any[], mainTopic:string, fullText:string): Promise<{
  primary_subtopics: EnrichedPrimary[];
  citations: Citation[];
}> {
    const aiService = this.getAIService();

    let syllabus: string = '';
    roots.forEach(root => {
      const primary: PrimaryForPrompt = {
    title: root.title!,
    Learning_Objectives: root.Learning_Objectives!,
    LessonOutline: root.LessonOutline!,
    ChronologicalOrder: root.ChronologicalOrder,
    secondary_topics: (root.depth2_subtopics || []).map((s: any) => ({
      title: s.title,
      Learning_Objectives: s.Learning_Objectives,
      LessonOutline: s.LessonOutline,
    }))
  };
    syllabus+= formatSyllabusForPrompt(primary) + '\n ######## \n';
    })
      

  
  // produce the formatted string
  //const syllabusBlock = formatSyllabusForPrompt(primary);
  console.log(`[aiController 444442] ${JSON.stringify(syllabus)} `);
    // System prompt to guide structured subtree output
  const systemPrompt = buildSubtreePromptV2(mainTopic, syllabus, roots.length);


    // Perform the structured call
    const response = await aiService.generateStructuredOutput(
      { name: subtreeSchemaV4.name, schema: subtreeSchemaV4.schema, strict: subtreeSchemaV4.strict },
      fullText,
      systemPrompt
    );


    const batch = (response as any).primary_subtopics as EnrichedPrimary[];
    const global_citations = (response as any).citations as Citation[]

    const payload = {
      primary_subtopics : batch,
      citations: global_citations,
    }
    
    return payload;
  }

  

    /**
   * generateSubtreeLessonV3
   *
   * Generates detailed lesson content, flash cards, optional secondary subtree,
   * and a quiz for multiple depth-1 PrimaryNode and its children.
   *
   * @param root - A PrimaryNode with .title, .aggregated_text, and optional depth2_subtopics.
   * @returns Promise resolving to the enriched PrimaryNode with:
   *   - lesson: { lecture_note, flash_cards }
   *   - secondary_subtopic: ...[]
   *   - quiz: matching_quiz object
   */
  public static async generateSubtreeLessonV3(roots: any[], mainTopic:string, LessonText:string, wordcount:number): Promise<{
  primary_subtopics: EnrichedPrimary[];
}> {
    const aiService = this.getAIService();

    let syllabus: string = '';
    roots.forEach(root => {
      const primary: PrimaryForPrompt = {
    title: root.title!,
    Learning_Objectives: root.Learning_Objectives!,
    LessonOutline: root.LessonOutline!,
    ChronologicalOrder: root.ChronologicalOrder,
    secondary_topics: (root.depth2_subtopics || []).map((s: any) => ({
      title: s.title,
      Learning_Objectives: s.Learning_Objectives,
      LessonOutline: s.LessonOutline,
    }))
  };
    syllabus+= formatSyllabusForPrompt(primary) + '\n ######## \n';
    })
      

  
  // produce the formatted string
  //const syllabusBlock = formatSyllabusForPrompt(primary);
  console.log(`[aiController 444442] ${JSON.stringify(syllabus)} `);
    // System prompt to guide structured subtree output
  const systemPrompt = buildSubtreePromptV2(mainTopic, syllabus, roots.length, wordcount);


    // Perform the structured call
    const response = await aiService.generateStructuredOutput(
      { name: subtreeSchemaV3.name, schema: subtreeSchemaV3.schema, strict: subtreeSchemaV3.strict },
      LessonText,
      systemPrompt
    );


    const payload = (response as any).primary_subtopics as EnrichedPrimary[];

    
    return {primary_subtopics :payload}
  }

}

export default AIController;