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
import { lessonPrompt, predefinedPrompts } from "../config/predefined-prompts";
import OpenAIClient from "../config/openai";
import { lessonSchema, topicSchema } from "../schemas/lessonSchema";
import { MatchingQuizSchema, MultipleChoiceSchema, FillInBlankSchema, TrueFalseSchema } from "../schemas/quizSchema";
import { LessonModule, processDocument } from "../services/TextPreprocessing/LessonModuleServiceV2";
import { getTextContext } from '@/app/src/services/TextPreprocessing/QuestionContextService';
import { QAschema } from '@/app/src/schemas/QASchema';
import { formatLessonMetadata } from "../services/TextPreprocessing/MetaDataFormatter";
import { LessonChunk } from '../utils/lessonJobBus';

class AIController {
  private static aiService: AIService | null = null;

  // Returns a singleton AIService instance.
  public static getAIService(): AIService {
    if (!this.aiService) {
      console.log('[AIController] Initializing AI Service');
      const openaiClient = OpenAIClient.getClient();
      this.aiService = new AIService(openaiClient);
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
    const stream = true;
    
    // Step 5: Call the AI service to generate structured lesson content.
    // The generateStructuredOutput method is expected to return the full lesson content.
    const structuredResponse = await aiService.generateStructuredOutput(
      lessonSchema,
      `[start of user input]${aggregatedText}[end of user input]`,
      dynamicLessonPrompt,
      {stream}
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
      const stream = req.query.stream === '1' || req.query.stream === 'true';
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
        systemPrompt,
        {stream}
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

  
}

export default AIController;



/**
 * generateLessonStream
 *
 * Streams parsed lesson-schema fragments for each text segment. For every segment:
 *  1. Builds metadata & prompt.
 *  2. Calls the AIService in streaming mode.
 *  3. Extracts the JSON‐schema fragment from each token chunk’s delta.
 *  4. Accumulates fragments and, as soon as each piece of the schema becomes available,
 *     yields a LessonChunk for main_topic, primary_subtopic, secondary_subtopic, and quiz.
 *  5. After all segments, yields a single endOfStream event.
 *
 * @param segments   Array of text segments to process.
 * @param documentID The originating document/session ID.
 * @param fileId     Unique upload identifier.
 * @yields LessonChunk objects:
 *   - `{ event: 'message', data: { kind, id, parentId, isLeaf, payload } }`
 *   - `{ event: 'endOfStream', data: {} }`
 */
/**
   * generateLessonStream
   *
   * @param segments   Array of text segments to process.
   * @param documentID The originating document/session ID.
   * @param fileId     Unique upload identifier.
   * @yields LessonChunk objects:
   *   - `{ event: 'message', data: { kind, id, parentId, isLeaf, payload } }`
   *   - `{ event: 'endOfStream', data: {} }`
   */
export async function* generateLessonStream(
  segments: string[],
  documentID: string,
  fileId: string
): AsyncGenerator<LessonChunk> {
  const aiService = AIController.getAIService();

  for (let idx = 0; idx < segments.length; idx++) {
    const segment = segments[idx];
    const lessonId = `${fileId}-${idx + 1}`;

    // 1) Build metadata & prompt
    const basic = await processDocument(segment, documentID, fileId);
    const formatted = formatLessonMetadata(basic.metadata);
    const promptText = lessonPrompt(formatted);
    const userInput = `[start of user input]${basic.original_text}[end of user input]`;

    // 2) Invoke streaming LLM
    const stream = await aiService.generateStructuredOutput(
      lessonSchema,
      userInput,
      promptText,
      { stream: true }
    );

    let pushedMain = false;
    const seenPrimaries = new Set<number>();
    const seenSecondaries = new Map<number, Set<number>>();
    let pushedQuiz = false;
    const acc: any = {};

    // 3) Iterate over the OpenAI async iterable
    for await (const part of stream as AsyncIterable<any>) {
      console.debug('[generateLessonStream] raw part:', part);

      // ** New debug to inspect delta contents **
      const delta = part.choices?.[0]?.delta;
      console.debug(
        '[generateLessonStream - 82620]  delta keys and content:',
        delta ? Object.keys(delta) : 'no delta',
        delta
      );

      // Extract JSON‐schema fragment
      const fragment = part.parsed ?? delta?.parsed ?? delta;
      if (!fragment || typeof fragment !== 'object') {
        continue;
      }

      Object.assign(acc, fragment);

      if (!pushedMain && acc.main_topic) {
        yield {
          event: 'message',
          data: {
            kind: 'main_topic',
            id: lessonId,
            parentId: undefined,
            isLeaf: false,
            payload: acc.main_topic,
          },
        };
        pushedMain = true;
      }

      const primaries = acc.main_topic?.primary_subtopics || [];
      for (const [pIdx, primary] of primaries.entries()) {
        if (!seenPrimaries.has(pIdx)) {
          seenPrimaries.add(pIdx);
          yield {
            event: 'message',
            data: {
              kind: 'primary_subtopic',
              id: `${lessonId}-primary-${pIdx}`,
              parentId: lessonId,
              isLeaf: !primary.secondary_subtopic?.length,
              payload: primary,
            },
          };
        }

        const secs = primary.secondary_subtopic || [];
        if (!seenSecondaries.has(pIdx)) {
          seenSecondaries.set(pIdx, new Set());
        }
        for (const [sIdx, sec] of secs.entries()) {
          const taken = seenSecondaries.get(pIdx)!;
          if (!taken.has(sIdx)) {
            taken.add(sIdx);
            yield {
              event: 'message',
              data: {
                kind: 'secondary_subtopic',
                id: `${lessonId}-primary-${pIdx}-secondary-${sIdx}`,
                parentId: `${lessonId}-primary-${pIdx}`,
                isLeaf: true,
                payload: sec,
              },
            };
          }
        }
      }

      if (!pushedQuiz && acc.main_topic?.quiz) {
        yield {
          event: 'message',
          data: {
            kind: 'quiz',
            id: `${lessonId}-quiz`,
            parentId: lessonId,
            isLeaf: true,
            payload: acc.main_topic.quiz,
          },
        };
        pushedQuiz = true;
      }
    }
  }

  // 4) Signal completion
  yield { event: 'endOfStream', data: {} };
}

