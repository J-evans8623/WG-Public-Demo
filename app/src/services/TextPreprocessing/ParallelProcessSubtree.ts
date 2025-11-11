// app/src/services/TextPreprocessing/ParallelProcessSubtree.ts

/**
 * @file app/src/services/TextPreprocessing/ParallelProcessSubtree.ts
 * @description
 *   This file implements the core topic-level enrichment utility for a single syllabus
 *   unit. Its primary responsibility is to take one “unit” (represented by a primary
 *   topic and its associated secondary topics), construct unit-scoped syllabus context,
 *   and then fan out multiple LLM calls in parallel—one for the main topic and one for
 *   each supporting topic. Each call uses a dedicated JSON schema “head” tailored to the
 *   topic role: `subtreeMainHeadV1` for the primary topic and `subtreeSupportHeadV1` for
 *   each secondary topic. The utility then merges the responses into a single
 *   `EnrichedPrimary` object that matches the historical subtree output structure
 *   expected by the lesson pipeline and frontend. It supports both Gemini and OpenAI
 *   providers, preserves unit-level quiz semantics (quiz is attached to the primary
 *   topic only), and ensures that every topic shares the same word budget. All topic
 *   calls are executed with `Promise.all` for O(N) time in the number of topics and no
 *   additional concurrency limiting, relying on provider-specific retry logic and the
 *   existing higher-level retry wrapper to tolerate transient failures without dropping
 *   content or changing API contracts.
 */

import UsageTracker from '../../services/UsageTracker';
import { Citation, EnrichedPrimary } from '../../schemas/lessonSchema';
import { formatSyllabusForPrompt, PrimaryForPrompt } from '../../controllers/formatSyllabus';
import { subtreeMainHeadV1Gemini } from '../../schemas/gemini/subtreeMainHeadV1.gemini';
import { subtreeSupportHeadV1Gemini } from '../../schemas/gemini/subtreeSupportHeadV1.gemini';
import { subtreeMainHeadV1OpenAI } from '../../schemas/openai/subtreeMainHeadV1.openai';
import { subtreeSupportHeadV1OpenAI } from '../../schemas/openai/subtreeSupportHeadV1.openai';
import GeminiAIService from '../aiServiceV2';
import OpenAIAIService from '../aiService';
import {
  buildSystemPromptForTopic,
  TopicDescriptor
} from './ParallelSystemPromptForTopic';

type Provider = 'gemini' | 'openai';

/**
 * Lightweight secondary-node shape matching the structural syllabus output.
 */
interface SecondaryNodeLike {
  title: string;
  Learning_Objectives: string;
  LessonOutline: string;
}

/**
 * Lightweight primary-node shape used by the enrichment layer.
 * This mirrors the structural `PrimaryNode` from LessonModuleServiceV8.
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
const geminiService = new GeminiAIService();
const openaiService = new OpenAIAIService();

/**
 * callMainHead
 * @description
 *   Executes the main-topic head structured-output call for the specified provider
 *   using the appropriate JSON schema. This function abstracts away whether we are
 *   calling Gemini or OpenAI, ensuring that the rest of the pipeline only deals
 *   with provider-agnostic shapes. It always runs in batch mode (no streaming),
 *   passes through the usage tracker, and relies on provider-level retry logic to
 *   handle transient overloads. The time complexity is O(1) per topic call, since
 *   it performs a single request and a constant amount of processing on the
 *   resulting JSON object, regardless of document size.
 */
async function callMainHead(
  provider: Provider,
  systemPrompt: string,
  uploadContents: string,
  usageTracker?: UsageTracker
): Promise<any> {
  if (provider === 'openai') {
    return openaiService.generateStructuredOutput(
      subtreeMainHeadV1OpenAI,
      uploadContents,
      systemPrompt,
      { stream: false, tracker: usageTracker }
    );
  }

  // Default to Gemini.
  return geminiService.generateStructuredOutput(
    subtreeMainHeadV1Gemini,
    uploadContents,
    systemPrompt,
    { stream: false, tracker: usageTracker }
  );
}

/**
 * callSupportHead
 * @description
 *   Executes a supporting-topic head structured-output call against either Gemini
 *   or OpenAI, using the appropriate support-topic schema. Like `callMainHead`,
 *   this helper hides provider specifics so that topic-level orchestration can
 *   remain provider-agnostic. It always returns a single support-topic result
 *   object conforming to the selected schema. Each invocation is O(1) in time
 *   relative to the number of topics, and when mapped across all secondary topics
 *   in a unit the aggregate cost is O(N), where N is the number of secondary
 *   topics. All calls are suitable for parallel execution with `Promise.all`.
 */
async function callSupportHead(
  provider: Provider,
  systemPrompt: string,
  uploadContents: string,
  usageTracker?: UsageTracker
): Promise<any> {
  if (provider === 'openai') {
    return openaiService.generateStructuredOutput(
      subtreeSupportHeadV1OpenAI,
      uploadContents,
      systemPrompt,
      { stream: false, tracker: usageTracker }
    );
  }

  // Default to Gemini.
  return geminiService.generateStructuredOutput(
    subtreeSupportHeadV1Gemini,
    uploadContents,
    systemPrompt,
    { stream: false, tracker: usageTracker }
  );
}

/**
 * parallelProcessSubtree
 * @description
 *   Orchestrates topic-level enrichment for a single syllabus unit by: (1) building
 *   a unit-scoped syllabus block from the primary and secondary topics, (2)
 *   constructing a main-topic descriptor and one descriptor per secondary topic,
 *   (3) issuing the main-topic head call and all support-topic head calls in
 *   parallel using the selected provider and equal per-topic word budgets, and
 *   (4) merging the responses into a single `EnrichedPrimary` object that matches
 *   the legacy subtree structure. This function enforces unit-local context,
 *   preserves quizzes on the primary topic only, and optionally merges citations
 *   from all heads. Its complexity is O(N) in the number of secondary topics, with
 *   all external latency dominated by the slowest provider call thanks to
 *   `Promise.all` parallelism.
 */
export async function parallelProcessSubtree(
  unit: PrimaryNodeLike,
  lessonSegmentText: string,
  lessonTitle: string,
  wordcount: number,
  provider: Provider,
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
  const descriptors: TopicDescriptor[] = [];

  // 2.1 Main-topic descriptor.
  descriptors.push({
    role: 'main',
    index: 0,
    title: unit.title,
    learningObjectives: unit.Learning_Objectives,
    lessonOutline: unit.LessonOutline
  });

  // 2.2 Support-topic descriptors (preserve original ordering).
  (unit.depth2_subtopics || []).forEach((secondary, idx) => {
    descriptors.push({
      role: 'support',
      index: idx,
      title: secondary.title,
      learningObjectives: secondary.Learning_Objectives,
      lessonOutline: secondary.LessonOutline
    });
  });

  // Step 3: Prepare shared upload contents wrapper for the textbook material.
  const uploadContents =
    `######## Start of User provided textbook material ######### ` +
    `${lessonSegmentText}` +
    ` ############ End of user provided textbook material########`;

  // Step 4: Build per-topic system prompts and launch all calls in parallel.
  const mainDescriptor = descriptors[0];
  const supportDescriptors = descriptors.slice(1);

  const mainSystemPrompt = buildSystemPromptForTopic(
    lessonTitle,
    syllabusBlock,
    mainDescriptor,
    wordcount
  );

  const mainPromise = callMainHead(
    provider,
    mainSystemPrompt,
    uploadContents,
    usageTracker
  );

  const supportPromises = supportDescriptors.map((desc) => {
    const supportPrompt = buildSystemPromptForTopic(
      lessonTitle,
      syllabusBlock,
      desc,
      wordcount
    );
    return callSupportHead(provider, supportPrompt, uploadContents, usageTracker);
  });

  // Step 5: Await all topic calls concurrently.
  const allResults = await Promise.all([mainPromise, ...supportPromises]);
  const mainResult = allResults[0];
  const supportResults = allResults.slice(1);

  // Step 6: Normalise and merge main-topic output into EnrichedPrimary fields.
    const mainPrimaryTopic = (mainResult as any).primary_topic;
  const mainCitations = (mainResult as any).lesson_citation ?? null;

  const secondary_subtopic = supportResults.map((support) => {
    const supportTopic = (support as any).support_topic;
    return {
      title: supportTopic.title,
      lecture_note: supportTopic.lesson.lecture_note,
      flash_cards: supportTopic.lesson.flash_cards
    };
  });

  // Step 7: Citations come from the main-topic head only. Supporting-topic heads
  // are instructed not to emit citations even though the schema allows them.
  const combinedCitations: Citation | null =
    Array.isArray(mainCitations) && mainCitations.length > 0
      ? (mainCitations[0] as Citation)   // <-- pick first citation
      : null;

  // Step 8: Construct final EnrichedPrimary object, keeping chronological order
  //         sourced from the structural pipeline rather than the model.
  const enriched: EnrichedPrimary = {
    ChronologicalOrder: unit.lessonOrder ?? 0,
    title: mainPrimaryTopic.title,
    lesson: mainPrimaryTopic.lesson,
    secondary_subtopic,
    quiz: mainPrimaryTopic.quiz,
    lesson_citation: combinedCitations    // <-- now matches Citation | null
  };

  return enriched;
}
