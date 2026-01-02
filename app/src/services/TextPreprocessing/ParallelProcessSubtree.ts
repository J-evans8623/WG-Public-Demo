// app/src/services/TextPreprocessing/ParallelProcessSubtree.ts

/**
 * @file app/src/services/TextPreprocessing/ParallelProcessSubtree.ts
 * @description
 * This file implements the core topic-level enrichment utility for a single syllabus
 * unit. Its primary responsibility is to take one “unit” (represented by a primary
 * topic and its associated secondary topics), construct unit-scoped syllabus context,
 * and then fan out multiple LLM calls in parallel—one for the main topic and one for
 * each supporting topic. 
 * * Phase 2 Update: Now supports Granular Context Injection. Instead of receiving a 
 * pre-joined string, it receives the FullTextArray. It dynamically slices the text
 * based on the `pageSequence` of the specific topic (Main or Secondary) being processed,
 * ensuring strict context adherence and reducing token usage.
 */

import UsageTracker from '../../services/UsageTracker';
import { Citation, EnrichedPrimary } from '../../schemas/lessonSchema';
import { formatSyllabusForPrompt, PrimaryForPrompt } from '../../controllers/formatSyllabus';
import { subtreeMainHeadV1Gemini } from '../../schemas/gemini/subtreeMainHeadV1.gemini';
import { subtreeSupportHeadV1Gemini } from '../../schemas/gemini/subtreeSupportHeadV1.gemini';
import { subtreeMainHeadV1OpenAI } from '../../schemas/openai/subtreeMainHeadV1.openai';
import { subtreeSupportHeadV1OpenAI } from '../../schemas/openai/subtreeSupportHeadV1.openai';
import UnifiedAIService from '../UnifiedAIService';
import {
  buildSystemPromptForTopic,
  TopicDescriptor
} from './ParallelSystemPromptForTopic';
import { sanitizeCitations } from './citationSanitizer'; 



/**
 * Lightweight secondary-node shape matching the structural syllabus output.
 * update - 1 : Added pageSequence
 */
interface SecondaryNodeLike {
  title: string;
  Learning_Objectives: string;
  LessonOutline: string;
  pageSequence: number[]; 
}

/**
 * Lightweight primary-node shape used by the enrichment layer.
 * This mirrors the structural `PrimaryNode` from LessonModuleServiceV8.
 * update - 1 : Added pageSequence
 */
interface PrimaryNodeLike {
  title: string;
  Learning_Objectives: string;
  LessonOutline: string;
  depth2_subtopics: SecondaryNodeLike[];
  lessonOrder: number;
  pageSequence: number[];
}

// Step 1: Initialise provider-specific AI service singletons for reuse.
const unifiedService = new UnifiedAIService();

/**
 * callMainHead
 * @description
 * Executes the main-topic head structured-output call using UnifiedAIService.
 * It passes a DualSchema containing both OpenAI and Gemini schemas.
 */
async function callMainHead(
  systemPrompt: string,
  uploadContents: string,
  usageTracker?: UsageTracker
): Promise<any> { // update - 3
  
  // update - 3: Construct DualSchema and delegate to Unified Service
  return unifiedService.generateStructuredOutput(
    { 
      openai: subtreeMainHeadV1OpenAI, 
      gemini: subtreeMainHeadV1Gemini 
    },
    uploadContents,
    systemPrompt,
    { 
      stream: false, 
      tracker: usageTracker, 
      model: "gpt-5-nano", 
      modeleffort: "low"
    }
  );
}

/**
 * callSupportHead
 * @description
 * Executes a supporting-topic head structured-output call using UnifiedAIService.
 * It passes a DualSchema containing both OpenAI and Gemini schemas.
 */
async function callSupportHead(
  systemPrompt: string,
  uploadContents: string,
  usageTracker?: UsageTracker
): Promise<any> { // update - 4

  // update - 4: Construct DualSchema and delegate to Unified Service
  return unifiedService.generateStructuredOutput(
    { 
      openai: subtreeSupportHeadV1OpenAI, 
      gemini: subtreeSupportHeadV1Gemini 
    },
    uploadContents,
    systemPrompt,
    { 
      stream: false, 
      tracker: usageTracker, 
      model: "gpt-5-nano", 
      modeleffort: "low"
    }
  );
}

/**
 * parallelProcessSubtree
 * @description
 * Orchestrates topic-level enrichment. 
 * update - 2: Now accepts FullTextArray (string[]) instead of pre-joined text.
 * Logic slices the text array based on pageSequence for Main and Support topics independently.
 */
export async function parallelProcessSubtree(
  unit: PrimaryNodeLike,
  FullTextArray: string[], // update - 2
  lessonTitle: string,
  wordcount: number,
  usageTracker?: UsageTracker
): Promise<EnrichedPrimary> {
  // Step 1: Build unit-level syllabus context from the primary node and its secondaries.
  const primaryForPrompt: PrimaryForPrompt = {
    title: unit.title,
    Learning_Objectives: unit.Learning_Objectives,
    LessonOutline: unit.LessonOutline,
    secondary_topics: unit.depth2_subtopics || [],
    ChronologicalOrder: unit.lessonOrder
  };

  const syllabusBlock = formatSyllabusForPrompt(primaryForPrompt);

  // Step 2: Build topic descriptors (one main + N support).
  // We attach the pageSequence locally here to use in the loop below
  interface ExtendedDescriptor extends TopicDescriptor {
    pageSequence: number[];
  }

  const descriptors: ExtendedDescriptor[] = [];

  // 2.1 Main-topic descriptor.
  descriptors.push({
    role: 'main',
    index: 0,
    title: unit.title,
    learningObjectives: unit.Learning_Objectives,
    lessonOutline: unit.LessonOutline,
    pageSequence: unit.pageSequence // update - 3
  });

  // 2.2 Support-topic descriptors (preserve original ordering).
  (unit.depth2_subtopics || []).forEach((secondary, idx) => {
    descriptors.push({
      role: 'support',
      index: idx,
      title: secondary.title,
      learningObjectives: secondary.Learning_Objectives,
      lessonOutline: secondary.LessonOutline,
      pageSequence: secondary.pageSequence // update - 3
    });
  });

  // Step 3: Define Helper to extract text from page sequence
  // Logic: 1-based pageSequence -> 0-based array index
  const extractContext = (pages: number[]) => {
    return `######## Start of User provided textbook material ######### ` +
           pages.map(p => FullTextArray[p - 1] || '').join('\n\n') +
           ` ############ End of user provided textbook material########`;
  };

  // Step 4: Build per-topic system prompts and launch all calls in parallel.
  // Note: We intentionally slice descriptors to handle Main vs Support separately 
  // to use the correct 'callHead' function, but we dynamically generate text for each.

  const mainDescriptor = descriptors[0];
  const supportDescriptors = descriptors.slice(1);

  // 4.1 Prepare Main Topic Call
  const mainSystemPrompt = buildSystemPromptForTopic(
    lessonTitle,
    syllabusBlock,
    mainDescriptor,
    wordcount
  );

  // update - 3: Generate Main-specific context
  const mainUploadContents = extractContext(mainDescriptor.pageSequence);

  const mainPromise = callMainHead(
    mainSystemPrompt,
    mainUploadContents,
    usageTracker
  );

  // 4.2 Prepare Support Topic Calls
  const supportPromises = supportDescriptors.map((desc) => {
    const supportPrompt = buildSystemPromptForTopic(
      lessonTitle,
      syllabusBlock,
      desc,
      wordcount
    );
    
    // update - 3: Generate Support-specific context
    const supportUploadContents = extractContext(desc.pageSequence);

    return callSupportHead(supportPrompt, supportUploadContents, usageTracker);
  });

  // Step 5: Await all topic calls concurrently.
  const allResults = await Promise.all([mainPromise, ...supportPromises]);
  const mainResult = allResults[0];
  const supportResults = allResults.slice(1);

  // Step 6: Normalise and merge main-topic output into EnrichedPrimary fields.
  const mainPrimaryTopic = (mainResult as any).primary_topic;
   
  // Check if it is an array, if so cast it, otherwise null.
  const mainCitations: Citation[] | null = 
    Array.isArray((mainResult as any).lesson_citation) 
      ? (mainResult as any).lesson_citation as Citation[] 
      : null;

  // Sanitize main topic lecture note
  if (mainPrimaryTopic?.lesson?.lecture_note) {
    mainPrimaryTopic.lesson.lecture_note = sanitizeCitations(
      mainPrimaryTopic.lesson.lecture_note, 
      mainCitations
    );
  }

   //console.log(`After citation sanitizer h8h8 mainprimarytopic lecture note ${JSON.stringify(mainPrimaryTopic.lesson.lecture_note )}`)

  // Sanitize support topic lecture note citations
  const secondary_subtopic = supportResults.map((support) => {
    const supportTopic = (support as any).support_topic;
    
    // Extract Support Citations
    const supportCitationsRaw = (support as any).lesson_citation;
    const supportCitations: Citation[] | null = 
      Array.isArray(supportCitationsRaw) ? supportCitationsRaw as Citation[] : null;

    // Sanitize support note using ITS SPECIFIC valid citations
    const cleanLectureNote = sanitizeCitations(
      supportTopic.lesson.lecture_note || "", 
      supportCitations
    );

    console.log(`After citation sanitizer h8h8 support topic lecture note ${JSON.stringify(cleanLectureNote)}`)

    return {
      title: supportTopic.title,
      lecture_note: cleanLectureNote,
      flash_cards: [supportTopic.lesson.flash_cards], // turn to array
      lesson_citation: supportCitations 
    };
  });

  // Step 7: Process main topic citations.
  const combinedCitations: Citation[] | null = mainCitations;

  // Step 8: Construct final EnrichedPrimary object.
  const enriched: EnrichedPrimary = {
    ChronologicalOrder: unit.lessonOrder ?? 0,
    title: mainPrimaryTopic.title,
    lesson: mainPrimaryTopic.lesson,
    secondary_subtopic,
    quiz: mainPrimaryTopic.quiz,
    lesson_citation: combinedCitations  
  };

  console.log(`Test-1234 Citation object parallelization method (fixed)\n    ${JSON.stringify(combinedCitations)}`);

  return enriched;
}