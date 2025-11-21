
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
import { predefinedPrompts,  getQuizSystemPrompt, buildSubtreePromptV22 } from "../config/predefined-prompts";
import { subtreeSchemaV3OpenAI as subtreeSchemaV3 } from '../schemas/openai/subtreeSchemaV3.openai';
//import { subtreeSchemaV3 } from '../schemas/gemini/subtreeschemaV3.gemini';
import {topicSchema,  EnrichedPrimary} from "../schemas/lessonSchema";
import { MatchingQuizSchema, MultipleChoiceSchema, FillInBlankSchema, TrueFalseSchema } from "../schemas/quizSchema";
import { getTextContext } from '@/app/src/services/TextPreprocessing/QuestionContextService';
import { QAschema } from '@/app/src/schemas/QASchema';
import { formatSyllabusForPrompt, PrimaryForPrompt } from './formatSyllabus';
import UsageTracker from '../services/UsageTracker'; 
import { parallelProcessSubtree } from '../services/TextPreprocessing/ParallelProcessSubtree';


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
 * handleQuizTool (update - 4)
 * @purpose
 *   Deprecate `textSelection` and make `exportData` the single source of context.
 *   - Always build `userInput` from `exportData`.
 *   - If `textSelection` is present, log a deprecation notice and ignore it.
 *   - Keep schema selection, system prompt, and response shape unchanged.
 *
 * @steps
 *   1) Parse request body and validate required fields.
 *   2) Emit a one-line deprecation log if `textSelection` is provided.
 *   3) Normalize quiz type and question count.
 *   4) Choose JSON schema by quiz type.
 *   5) Build system prompt and user input (from exportData only).
 *   6) Call AI service to generate structured output and return it.
 *   7) Handle and report errors.
 */
public static async handleQuizTool(req: NextApiRequest, res: NextApiResponse): Promise<void> { // update - 4
  try {
    console.log('[aiController.ts][5312] Quiz generation request received');
    const {
      quizTypes,
      fileID,
      exportData,      
      questionCount
    } = req.body;

    // Step 1 — Validate minimal inputs
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


    // Step 3 — Normalize type & quantity
    const firstType: string = String(quizTypes[0] || 'multipleChoice').trim();
    const qty = Math.max(1, Math.floor(Number.isFinite(Number(questionCount)) ? Number(questionCount) : 10));

    // Step 4 — Schema selection (unchanged)
    const typeToSchema: Record<string, { name: string; schema: any; strict?: boolean }> = {
      multipleChoice: MultipleChoiceSchema,
      matching:       MatchingQuizSchema,
      FIB:            FillInBlankSchema,
      'true-false':   TrueFalseSchema
    };
    const chosenSchema = typeToSchema[firstType] || MultipleChoiceSchema;

    // Step 5 — Prompts & input (ALWAYS from exportData)
    const systemPrompt = getQuizSystemPrompt(firstType, qty);
    const userInput = `Context:\n${exportData}`; // update - 4

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

    // Step 6 — Structured output
    const aiService = AIController.getAIService();
    const structuredResponse = await aiService.generateStructuredOutput(
      schemaForCall,
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
    let secondary_node_count = 0;

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
    secondary_node_count = root.depth2_subtopics.length;
    syllabus+= formatSyllabusForPrompt(primary);
    })
      

  
  // produce the formatted string
  //const syllabusBlock = formatSyllabusForPrompt(primary);
  console.log(`[aiController 444442] ${JSON.stringify(syllabus)} `);
    // System prompt to guide structured subtree output
  const systemPrompt = buildSubtreePromptV22(mainTopic, syllabus, roots.length, secondary_node_count,  wordcount);
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



  /**
   * generateSubtreeLessonV3  
   *
   * @description
   *   Generates detailed lesson content for a single syllabus unit by delegating to
   *   the `parallelProcessSubtree` utility. Instead of issuing one monolithic LLM
   *   call that mixes the primary and secondary topics, this method now enriches the
   *   main topic and each supporting topic in parallel using provider-specific
   *   “head” schemas and a shared unit-level syllabus context. The public signature
   *   and return shape remain unchanged so callers such as `LessonModuleServiceV8`
   *   can continue to treat this as a black box that returns an array of
   *   `EnrichedPrimary` entries. Quiz generation is still attached to the primary
   *   topic only, and the same per-topic word budget is applied across all topics
   *   within the unit. Time complexity is O(N) in the number of supporting topics,
   *   with latency dominated by the slowest topic call thanks to parallelism.
   *
   * @param roots - Array containing a single PrimaryNode-like syllabus unit.
   * @param mainTopic - The human-readable lesson title for this unit.
   * @param LessonText - Textbook pages for this unit, joined into a single string.
   * @param wordcount - Maximum word budget for each topic’s lecture note.
   * @param usageTracker - Optional UsageTracker for recording token and retry usage.
   * @returns Promise resolving to an object with `primary_subtopics: EnrichedPrimary[]`.
   */
  public static async generateSubtreeLessonV4(roots: any[], mainTopic:string, LessonText:string, wordcount:number,  usageTracker?: UsageTracker  ): Promise<{
  primary_subtopics: EnrichedPrimary[];
}> { 
    // Step 1: Validate and normalize input roots (expect exactly one unit for this path). 
    if (!roots || roots.length === 0) { 
      throw new Error('generateSubtreeLessonV3 requires at least one root node'); 
    } 

    const unit = roots[0]; 

    // Step 2: Select provider from configuration (default to Gemini). 
    const providerEnv = process.env.LESSON_ENRICH_PROVIDER?.toLowerCase(); 
    const provider = providerEnv === 'openai' ? 'openai' : 'gemini'; 

    // Step 3: Delegate to the core parallel subtree processor. 
    const enriched = await parallelProcessSubtree( 
      unit, 
      LessonText, 
      mainTopic, 
      wordcount, 
      provider, 
      usageTracker 
    ); 

    // Step 4: Preserve historical return shape by wrapping the single enriched unit. 
    return { primary_subtopics: [enriched] }; 
  }

}

export default AIController;