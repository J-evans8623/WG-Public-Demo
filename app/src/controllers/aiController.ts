
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
import AIService from "../services/aiService";
import { lessonPrompt, predefinedPrompts, buildSubtreePromptV2, buildSubtreePrompt,  buildQuestionCountInstruction, getQuizSystemPrompt, buildSubtreePromptV22 } from "../config/predefined-prompts";
import { subtreeSchemaV3OpenAI as subtreeSchemaV3 } from '../schemas/openai/subtreeSchemaV3.openai';
import { lessonSchema, topicSchema, subtreeSchemaV4, EnrichedPrimary, Citation } from "../schemas/lessonSchema";
import { MatchingQuizSchema, MultipleChoiceSchema, FillInBlankSchema, TrueFalseSchema } from "../schemas/quizSchema";
import { LessonModule } from "../services/TextPreprocessing/LessonModuleServiceV2";
import { getTextContext } from '@/app/src/services/TextPreprocessing/QuestionContextService';
import { QAschema } from '@/app/src/schemas/QASchema';
import { formatLessonMetadata } from "../services/TextPreprocessing/MetaDataFormatter";
import { formatSyllabusForPrompt, PrimaryForPrompt } from './formatSyllabus';
import UsageTracker from '../services/UsageTracker'; 


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


/**
   * handleQuestion (Enhanced with streamlined processing)
   * @description
   *   Processes user questions with contextual text retrieval and AI-powered response generation.
   *   This enhanced version focuses on core question processing logic with the assurance that all
   *   permission validation has been handled at the service layer. The method combines user questions
   *   with relevant context from document sources to provide comprehensive and accurate responses
   *   that leverage the full knowledge base available in uploaded educational materials.
   * @param req - API request object containing question, text selection, and file ID
   * @param res - API response object for sending structured question responses
   * @returns Promise resolving when question processing is complete
   */
  public static async handleQuestion(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    try {
      console.log('[aiController.ts][5005] Processing question request with enhanced validation');
      const { question, textSelection, fileID } = req.body;
      
      // Step 6: Validate required parameters
      if (!question || !fileID) {
        console.log('[aiController.ts][5006] Missing required parameters for question processing');
        res.status(400).json({ 
          error: 'MISSING_PARAMETERS',
          message: "Missing question or fileID parameters",
          service: 'askAssistant'
        });
        return;
      }
      
      // Step 7: Combine question with text selection for context
      let combinedInput = question;
      if (textSelection && typeof textSelection === 'string' && textSelection.trim().length > 0) {
        combinedInput += " " + textSelection.trim();
      }
      console.log('[aiController.ts][5007] Combined input prepared for context retrieval');
      
      // Step 8: Retrieve additional context from document sources
      let retrievedContext = "";
      try {
        retrievedContext = await getTextContext(combinedInput, fileID);
        console.log('[aiController.ts][5008] Context retrieval completed successfully');
      } catch (contextError) {
        console.warn('[aiController.ts][5009] Context retrieval failed, proceeding without additional context:', contextError);
      }
 
      // Step 9: Construct final prompt with question and context
      let finalPrompt = "\n User Question :" + question;
      if (retrievedContext && retrievedContext.trim().length > 0) {
        finalPrompt += "\nContext: " + retrievedContext.trim();
      }
      console.log('[aiController.ts][5010] Final prompt constructed for AI processing');
      
      // Step 10: Generate AI response using structured output
      const systemPrompt = predefinedPrompts['QApipeline'];
      const aiService = AIController.getAIService();
      const structuredResponse = await aiService.generateStructuredOutput(
        QAschema,
        finalPrompt,
        systemPrompt
      );
      
      console.log('[aiController.ts][5011] Question processing completed successfully');
      res.status(200).json(structuredResponse);
    } catch (error) {
      console.error('[aiController.ts][5012] Question processing failed:', error);
      res.status(500).json({ 
        error: 'QUESTION_PROCESSING_FAILED',
        message: "Failed to generate answer for the question.",
        service: 'askAssistant'
      });
    }
  }

/**
   * handleTopicGeneration (Enhanced with streamlined processing)
   * @description
   *   Generates educational topics based on user requests with contextual document analysis and AI-powered
   *   content creation. This enhanced version focuses on core topic generation logic while leveraging the
   *   centralized validation system for permission enforcement. The method combines user topic requests
   *   with relevant document context to create comprehensive educational topics that align with learning
   *   objectives and provide meaningful exploration opportunities for students and educators.
   * @param req - API request object containing topic request, export data, file ID, and text selection
   * @param res - API response object for sending structured topic generation responses
   * @returns Promise resolving when topic generation processing is complete
   */
  public static async handleTopicGeneration(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    try {
      console.log('[aiController.ts][5013] Processing topic generation request with enhanced validation');
      const { userTopicRequest, exportData, fileID, textSelection } = req.body;
      
      // Step 11: Validate required parameters
      if (!userTopicRequest || !fileID) {
        console.log('[aiController.ts][5014] Missing required parameters for topic generation');
        res.status(400).json({ 
          error: 'MISSING_PARAMETERS',
          message: "Missing required fields: userTopicRequest or fileID",
          service: 'exploreTopic'
        });
        return;
      }

      // Step 12: Prepare context retrieval input
      let getContext = userTopicRequest;
      if (textSelection) {
        getContext += `\n ${textSelection}`;
      }
      
      // Step 13: Retrieve additional context based on the user's topic request
      let retrievedContext = "";
      try {
        retrievedContext = await getTextContext(getContext, fileID);
        console.log('[aiController.ts][5015] Context retrieval completed for topic generation');
      } catch (contextError) {
        console.warn('[aiController.ts][5016] Context retrieval failed, proceeding without additional context:', contextError);
      }
      
      // Step 14: Construct final prompt for topic generation
      let finalPrompt = "User Topic Request: " + userTopicRequest;
      finalPrompt += "\nUpload: " + (textSelection ? textSelection : exportData);
      finalPrompt += "\nContext: " + retrievedContext;
      console.log('[aiController.ts][5017] Final prompt constructed for topic generation');
      
      // Step 15: Generate AI response for topic exploration
      const systemPrompt = predefinedPrompts['ExploreTopic'];
      const aiService = AIController.getAIService();
      const structuredResponse = await aiService.generateStructuredOutput(
        topicSchema,
        finalPrompt,
        systemPrompt
      );
      
      console.log('[aiController.ts][5018] Topic generation completed successfully');
      res.status(200).json(structuredResponse);
    } catch (error) {
      console.error('[aiController.ts][5019] Topic generation failed:', error);
      res.status(500).json({ 
        error: 'TOPIC_GENERATION_FAILED',
        message: "Failed to generate topic exploration.",
        service: 'exploreTopic'
      });
    }
  }

/**
   * handleQuizTool
   * @description
   *   Simplified quiz generation endpoint. Treats any incoming array of quiz types as a single quiz
   *   request by honoring only the first type. Builds an authoritative system prompt with
   *   getQuizSystemPrompt(quizType, questionCount), passes lesson/user text as the user input, and
   *   selects the JSON schema by type. Composite behavior can be added later exclusively in the
   *   prompts module without expanding controller complexity. Time complexity is O(1).
   */
  public static async handleQuizTool(req: NextApiRequest, res: NextApiResponse): Promise<void> { // update - 2
    try {
      console.log('[aiController.ts][5312] Quiz generation request received');
      const {
        quizTypes,
        fileID,
        exportData,
        textSelection,
        questionCount
      } = req.body;

      // 1) Validate minimal inputs
      if (!fileID || !exportData || !Array.isArray(quizTypes) || quizTypes.length === 0) {
        console.log('[aiController.ts][5313] Missing parameters for quiz generation', {
          hasFile: !!fileID, hasExport: !!exportData, typesLen: Array.isArray(quizTypes) ? quizTypes.length : 0
        });
        res.status(400).json({
          error: 'MISSING_PARAMETERS',
          message: 'fileID, exportData, and at least one quiz type are required.',
          service: 'createQuiz'
        });
        return;
      }

      // 2) Honor only the first quiz type
      const firstType: string = String(quizTypes[0] || 'multipleChoice').trim();
      const qty = Math.max(1, Math.floor(Number.isFinite(Number(questionCount)) ? Number(questionCount) : 10));

      // 3) Determine schema by type (strategy preserved)
      const typeToSchema: Record<string, { name: string; schema: any; strict?: boolean }> = {
        multipleChoice: MultipleChoiceSchema,
        matching:       MatchingQuizSchema,
        FIB:            FillInBlankSchema,
        'true-false':   TrueFalseSchema
      };
      const chosenSchema = typeToSchema[firstType] || MultipleChoiceSchema;

      // 4) Build authoritative system prompt
      const systemPrompt = getQuizSystemPrompt(firstType, qty); // update - 3

      // 5) Build user input (the content to base the quiz on)
      const userInput = `Context:\n${textSelection ? textSelection : exportData}`;

      // update - 3: Ensure strict is a concrete boolean to satisfy JSONSchemaValidation
      const schemaForCall = {
        name: chosenSchema.name,
        schema: chosenSchema.schema,
        strict: chosenSchema.strict ?? true
      };

      console.log('[aiController.ts][5314] Quiz config', {
        fileID,
        firstType,
        questionCount: qty,
        schema: schemaForCall.name || 'unknown'
      });

      // 6) Call the model for structured output
      const aiService = AIController.getAIService();
      const structuredResponse = await aiService.generateStructuredOutput(
        schemaForCall, // update - 3
        userInput,
        systemPrompt
      );

      console.log('[aiController.ts][5315] Quiz generation complete');
      res.status(200).json(structuredResponse);
    } catch (error) {
      console.error('[aiController.ts][5394] Quiz generation failed', error);
      res.status(500).json({
        error: 'QUIZ_GENERATION_FAILED',
        message: 'Failed to generate quiz content.',
        service: 'createQuiz'
      });
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
  public static async generateSubtreeLessonV3(roots: any[], mainTopic:string, LessonText:string, wordcount:number,  usageTracker?: UsageTracker  ): Promise<{
  primary_subtopics: EnrichedPrimary[];
}> {
    const aiService = this.getAIService();

    let syllabus: string = '';

    roots.forEach(root => {
      const primary: PrimaryForPrompt = {
    title: root.title!,
    Learning_Objectives: root.Learning_Objectives!,
    LessonOutline: root.LessonOutline!,
    ChronologicalOrder: root.lessonOrder,
    secondary_topics: (root.depth2_subtopics || []).map((s: any) => ({
      title: s.title,
      Learning_Objectives: s.Learning_Objectives,
      LessonOutline: s.LessonOutline,
    }))
  };
    syllabus+= formatSyllabusForPrompt(primary);
    })
      

  
  // produce the formatted string
  //const syllabusBlock = formatSyllabusForPrompt(primary);
  console.log(`[aiController 444442] ${JSON.stringify(syllabus)} `);
    // System prompt to guide structured subtree output
  const systemPrompt = buildSubtreePromptV22(mainTopic, syllabus, roots.length, wordcount);
  const uploadContents = `######## Start of User provided textbook material ######### ${LessonText}  ############ End of user provided textbook material########`


    // Perform the structured call
    const response = (await aiService.generateStructuredOutput(
      { name: subtreeSchemaV3.name, schema: subtreeSchemaV3.schema, strict: subtreeSchemaV3.strict },
      uploadContents,
      systemPrompt,
      { stream: false, tracker: usageTracker }  
    ) ) as any;

    const {
      primary_subtopic: rawPrimary,
      lesson_citation: citations = null
    } = response


      // 5️⃣ Translate into your EnrichedPrimary shape
  const enriched: EnrichedPrimary = {
    ChronologicalOrder: roots[0]?.lessonOrder ?? 0,
    title:              rawPrimary.title,
    lesson:             rawPrimary.lesson,
    secondary_subtopic: rawPrimary.secondary_subtopic,
    quiz:               rawPrimary.quiz,
    lesson_citation:    citations
  };
   
    return {primary_subtopics:[enriched]}
  }

}

export default AIController;