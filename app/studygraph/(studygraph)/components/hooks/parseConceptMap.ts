/**
 * parseConceptMap.ts
 *
 * This utility file defines the function `parseConceptMap`, which processes an AI-generated
 * structured response and converts it into a fully laid-out concept map. The implementation
 * supports both Lesson and Quiz types, based on our new schema.
 *
 * The processing steps are analogous to the legacy GenerateAIResponse.processAIResponse method:
 *
 *  -------------------------------------------------------------------------------
 *  STEP 1: Update the root node title.
 *     - Retrieve the root node ID from the dependencies.
 *     - If the AI response contains a main topic title, update the root node’s title.
 *
 *  STEP 2: Create resources for the root node.
 *     - If an introduction is provided, create a “note” resource for it.
 *     - For each learning objective, create a “cuecard” resource.
 *
 *  STEP 3: Process primary subtopics (depth 1).
 *     - For each primary subtopic in the response:
 *         a. Generate a unique ID and create a new node under the root.
 *         b. Immediately invoke the synchronous composite layout function to update positions.
 *         c. Create resources for this subtopic (lecture notes, flash cards, quizzes, etc.).
 *
 *  STEP 4: Process secondary subtopics (depth 2), if any.
 *     - For each secondary subtopic under a primary subtopic:
 *         a. Generate a unique ID and create the secondary node under its primary parent.
 *         b. Run the layout function again to update positions.
 *         c. Create resources (notes, flash cards) for the secondary subtopic.
 *
 *  STEP 5: Commit the final nodes and subtrees.
 *     - Once all nodes are processed and laid out, update the application state by calling
 *       the provided setNodes and setSubtrees callbacks.
 *
 *  Dependencies:
 *    - createNewNode: Function to create a new concept node.
 *    - updateNodeTitle: Function to update an existing node’s title.
 *    - setNodes: Callback to commit the updated nodes map.
 *    - nodes: A Map of current nodes (local copy).
 *    - createResource: Function to asynchronously create a resource (note, cuecard, quiz).
 *    - setSubtrees: Callback to update the subtree layout map.
 *    - subtrees: A Map of current subtrees (local copy).
 *    - getRootNode: Function to retrieve the root node ID.
 *
 *  Usage:
 *    Import and call this function from your lesson module mapper (or any other context) to
 *    process the AI response in one synchronous batch.
 */
/**
 * parseConceptMap.ts
 *
 * This utility file defines the function `parseConceptMap`, which processes an AI-generated
 * structured response and converts it into a fully laid-out concept map. The implementation
 * supports both Lesson and Quiz types, based on our new schema.
 *
 * The processing steps are analogous to the legacy GenerateAIResponse.processAIResponse method:
 *
 *  -------------------------------------------------------------------------------
 *  STEP 1: Update the root node title.
 *     - Retrieve the root node ID from the dependencies.
 *     - If the AI response contains a main topic title, update the root node’s title.
 *
 *  STEP 2: Create resources for the root node.
 *     - If an introduction is provided, create a “note” resource for it.
 *     - For each learning objective, create a “cuecard” resource.
 *
 *  STEP 3: Process primary subtopics (depth 1).
 *     - For each primary subtopic in the response:
 *         a. Generate a unique ID and create a new node under the root.
 *         b. Immediately invoke the synchronous composite layout function to update positions.
 *         c. Create resources for this subtopic (lecture notes, flash cards, quizzes, etc.).
 *
 *  STEP 4: Process secondary subtopics (depth 2), if any.
 *     - For each secondary subtopic under a primary subtopic:
 *         a. Generate a unique ID and create the secondary node under its primary parent.
 *         b. Run the layout function again to update positions.
 *         c. Create resources (notes, flash cards) for the secondary subtopic.
 *
 *  STEP 5: Commit the final nodes and subtrees.
 *     - Once all nodes are processed and laid out, update the application state by calling
 *       the provided setNodes and setSubtrees callbacks.
 *
 *  Dependencies:
 *    - createNewNode: Function to create a new concept node.
 *    - updateNodeTitle: Function to update an existing node’s title.
 *    - setNodes: Callback to commit the updated nodes map.
 *    - nodes: A Map of current nodes (local copy).
 *    - createResource: Function to asynchronously create a resource (note, cuecard, quiz).
 *    - setSubtrees: Callback to update the subtree layout map.
 *    - subtrees: A Map of current subtrees (local copy).
 *    - getRootNode: Function to retrieve the root node ID.
 *
 *  Usage:
 *    Import and call this function from your lesson module mapper (or any other context) to
 *    process the AI response in one synchronous batch.
 */
import { v4 as uuidv4 } from 'uuid';
import { compositeLayout } from '@/app/studygraph/(studygraph)/components/hooks/layoutUtils';
import markdownIt from 'markdown-it';
import { transformPlaceholders } from '../utils/transformPlaceholders';
import { Citation } from '@/app/Library/Definitions/Definitions';
import { renderMarkdownWithMath } from './renderMarkdownWithMath';


// Initialize markdown-it parser instance.
export const mdParser = new markdownIt({
  html: true,         
  linkify: true,
  breaks: true,
})



/**
 * Generate the feed sequence to counter the alternating center-insert layout,
 * then swap the two halves so that all A/B/C groups remain contiguous.
 *
 * @param items Already sorted by lessonOrder (A→C) and any tie-breaker.
 * @returns A new array in the exact feed order you should insert.
 */
function centerAwareSequencev2<T>(items:T[]):T[]{
  let result:T[]= [];
  const src = [...items]
  if (items.length <= 2) result = [...items];
  else {
    const midPoint = Math.floor(items.length / 2);
    let leftSubtree = src.slice(0,midPoint)
    let rightSubtree = src.slice(midPoint)
    // All odd indices will be in the left tree, and even will be the right tree.
    // We need to preserve the arrangement of adjacent subtrees
    // Eg trees (1,2,3,4,5,6) becomes (1,4,2,5,3,6) 
    // Because 1,2,3 are in the odd indices they will become the left subtree
    // 4,5,6 are in the even indices, they become the right subtree
    while((leftSubtree.length > 0) && (rightSubtree.length>0)){
      // build left subtree by always inserting at the odd index
      if(leftSubtree.length > 0){
        result.push(leftSubtree.shift()!);
      }
      // build right subtree by always inserting at the even index
      if (rightSubtree.length>0){
       result.push(rightSubtree.shift()!);
      }

    }
  }
  console.log(`centerAwareSequencev2 results [2009] ${console.log(JSON.stringify(result))}`);
  return result
}

export async function parseConceptMap(
  responseData: any,
  dependencies: {
    updateNodeTitle: (nodeId: string, newTitle: string, mapID?: string) => void;
    setNodes: (nodes: Map<string, any>, mapID?: string) => void;
    nodes: Map<string, any>;
    createResource: (params: any) => Promise<void>;
    setSubtrees: (subtrees: Map<string, any>, mapID?: string) => void;
    subtrees: Map<string, any>;
    getRootNode: (mapID?: string) => string;
  },
  mapID: string
): Promise<void> {
  // ---------------------------------------------------------------------------
  // STEP 1: Define the LOCAL STATE
  // ---------------------------------------------------------------------------
  const localNodes = new Map(dependencies.nodes);
  const localSubtrees = new Map(dependencies.subtrees);

  // ---------------------------------------------------------------------------
  // STEP 2: Update root node title and add its study resources.
  // ---------------------------------------------------------------------------
  const rootNodeId = dependencies.getRootNode();
  const rootNodeTitle = responseData.main_topic.title;
  //const GlobalCitations = responseData.main_topic.global_citations?? []; // declare once

  // Create resources for the root node.
  if (responseData?.main_topic?.introduction) {
        console.log(`pCM-1234: rendering introduction for rootNode ${rootNodeId}`);
    const content = renderMarkdownWithMath(responseData.main_topic.introduction);
    console.log(`pCM-1234: Before : rendering introduction for rootNode ${responseData.main_topic.introduction}`);
    console.log(`pCM-1234: After : rendering introduction for rootNode ${content}`);
    await dependencies.createResource({
      nodeId: rootNodeId,
      type: 'note',
      title: 'Introduction',
      content,
      citations: null,
      mapId: mapID,
    });
  }
  if (responseData?.main_topic?.learning_objectives) {
    for (const objective of responseData.main_topic.learning_objectives) {
      await dependencies.createResource({
        nodeId: rootNodeId,
        type: 'cuecard',
        title: 'Learning Objective',
        content:mdParser.render(objective),
        citations: null,
        mapId: mapID,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // STEP 3: Process subtopics in order
  // ---------------------------------------------------------------------------
  const processSubtopicsInOrder = async (
    subtopics: any[],
    parentNodeId: string,
    depth: number,
    parentCitation?:Citation[],
  ) => {
    console.log(`\n=== PROCESSING DEPTH ${depth} NODES ===`);
    console.log(`Number of subtopics at depth ${depth}: ${subtopics.length}`);

    for (const subtopic of subtopics) {
      const subtopicNodeId = uuidv4();
      console.log(`Processing subtopic: ${subtopic.title}`);

      // Create a new node.
      const newNode = {
        id: subtopicNodeId,
        title: subtopic.title,
        parentNodeId,
        childrenNodeIds: [],
        depth,
        x: undefined,
        y: undefined,
        lessonOrder: subtopic.lessonOrder ?? null,
      };

      console.log(`220 - Processing node: ${JSON.stringify(newNode)}`);

      // Update the local state.
      localNodes.set(subtopicNodeId, newNode);

      const parentNode = localNodes.get(parentNodeId);
      if (parentNode) {
        parentNode.childrenNodeIds = [
          ...(parentNode.childrenNodeIds || []),
          subtopicNodeId,
        ];
      }

      console.log('Node created:', {
        id: subtopicNodeId,
        title: subtopic.title,
        depth,
        parentId: parentNodeId,
      });

      console.log('Updating layout...');

      // Run the composite layout algorithm on the LOCAL state.
      compositeLayout({
        nodes: localNodes,
        localSubtrees: localSubtrees,
        setSubtrees: dependencies.setSubtrees,
        setNodes: (updatedNodes) => {
          for (const [nodeId, node] of updatedNodes.entries()) {
            localNodes.set(nodeId, node);
          }
        },
      });

      console.log('Layout updated.');

      // ---------------------------------------------------------------------------
      // Create resources for the subtopic.
      // ---------------------------------------------------------------------------
      if (subtopic.lesson) {
        // Primary subtopic (depth 1) uses the "lesson" object.
        if (subtopic.lesson.lecture_note) {

            let transformedContent = transformPlaceholders(subtopic.lesson.lecture_note, subtopic.lesson_citation);//
          const content = renderMarkdownWithMath(transformedContent.content);
          console.log(`Subtopic title:  ${subtopic.title}, Before rendering content : ${transformedContent.content}`)
          console.log(`Subtopic title:  ${subtopic.title}, After rendering content : ${content}`)

          await dependencies.createResource({
            nodeId: subtopicNodeId,
            type: 'note',
            title: `Overview`,
            content,
            citations: transformedContent.citations?? null,
            mapId: mapID,
          });
        }
        if (subtopic.lesson.flash_cards && Array.isArray(subtopic.lesson.flash_cards)) {
          for (const card of subtopic.lesson.flash_cards) {
            console.log(`pCM-1234: rendering flash_card "${card.term}" for node ${subtopicNodeId}`);
          let transformedContent = transformPlaceholders(card.definition, subtopic.lesson_citation)
          const content = renderMarkdownWithMath(transformedContent.content);
            await dependencies.createResource({
              nodeId: subtopicNodeId,
              type: 'cuecard',
              title: card.term,
              content,
              citations: transformedContent.citations  ?? null,
              mapId: mapID,
            });
          }
        }
        if (subtopic.quiz) {
          const subtopicQuiz = subtopic.quiz;
          const translatedNodeQuiz = {
            quizType: 'matching',
            quizContent: subtopicQuiz.questions.map((q: any) => ({
      id: q.id,
      type: 'matching',
      question: q.matchingTerm,      // Renaming from matchingTerm to question
      correctAnswer: q.matchingAnswer // Renaming from matchingAnswer to correctAnswer
    }))
          }
          await dependencies.createResource({
            nodeId: subtopicNodeId,
            type: 'quiz',
            title: `${subtopic.title} Quiz`,
            content: translatedNodeQuiz,
            mapId: mapID,
          });
        }
      } else if (subtopic.lecture_note) {
        // Secondary subtopic (depth 2) has its properties at the root level.

          let transformedContent = transformPlaceholders(subtopic.lecture_note, parentCitation!)
          const content = renderMarkdownWithMath(transformedContent.content);
           console.log(`Subtopic title:  ${subtopic.title}, Before rendering content : ${transformedContent.content}`)
          console.log(`Subtopic title:  ${subtopic.title}, After rendering content : ${content}`)

        await dependencies.createResource({
          nodeId: subtopicNodeId,
          type: 'note',
          title: `Overview`,
          content,
          citations: transformedContent.citations ?? null,
          mapId: mapID,
        });
        if (subtopic.flash_cards && Array.isArray(subtopic.flash_cards)) {
          for (const card of subtopic.flash_cards) {

          let transformedContent = transformPlaceholders(card.definition, parentCitation!)
          const content = renderMarkdownWithMath(transformedContent.content);
            await dependencies.createResource({
              nodeId: subtopicNodeId,
              type: 'cuecard',
              title: card.term,
              content,
              citations: transformedContent.citations,
              mapId: mapID,
            });
          }
        }
      }

      // ---------------------------------------------------------------------------
      // Process secondary subtopics (depth 2) if any.
      // ---------------------------------------------------------------------------
      if (
        Array.isArray(subtopic.secondary_subtopic) &&
        subtopic.secondary_subtopic.length > 0
      ) {
        console.log(`Recursing into secondary_subtopics for "${subtopic.title}"`);
        await processSubtopicsInOrder(
          subtopic.secondary_subtopic,
          subtopicNodeId,
          depth + 1,
          subtopic.lesson_citation
        );
      }

      console.log(`=== End of PROCESSING DEPTH ${depth} NODES ===`);
    }
  };

  // ---------------------------------------------------------------------------
  // STEP 4: Start recursion over primary subtopics
  // ---------------------------------------------------------------------------
  if (responseData?.main_topic?.primary_subtopics) {
    console.log('\n=== STARTING PRIMARY SUBTOPIC PROCESSING ===');
    console.log(
      'Primary subtopics count:',
      responseData.main_topic.primary_subtopics.length
    );
    const primaries: any[] = responseData.main_topic.primary_subtopics;
    const sorted = [...primaries].sort(
  (a, b) => (a.ChronologicalOrder ?? 0) - (b.ChronologicalOrder ?? 0)
);;
    console.log('[parseConceptMap.ts][2009] processing primary subtopics in feed order', { order: sorted.map((s: any) => s.title) });
    const feedOrder = centerAwareSequencev2(sorted);
    console.log('[parseConceptMap.ts][2010] processing primary subtopics in feed order', { order: feedOrder.map((s: any) => s.title) });

    await processSubtopicsInOrder(
      feedOrder,
      rootNodeId,
      (localNodes.get(rootNodeId)?.depth || 0) + 1
    );
  }

// STEP 5: Process quiz for the main topic (if provided)
if (responseData?.main_topic?.quiz) {
  // Transform the AI response quiz into the front-end format.
  const aiQuiz = responseData.main_topic.quiz;
  const translatedQuiz = {
    quizType: 'matching', // hard-coded for now (adjust if you support multiple types)
    quizContent: aiQuiz.questions.map((q: any) => ({
      id: q.id,
      type: 'matching',
      question: q.matchingTerm,      // Renaming from matchingTerm to question
      correctAnswer: q.matchingAnswer // Renaming from matchingAnswer to correctAnswer
    }))
  };

  const reviewNodeId = 'reviewNode';
  if (!localNodes.has(reviewNodeId)) {
  const reviewNode = {
    id: reviewNodeId,
    title: 'Review',
    parentNodeId: rootNodeId,
    childrenNodeIds: [],
    depth: (localNodes.get(rootNodeId)?.depth || 0) + 1,
    x: undefined,
    y: undefined,
  };
  localNodes.set(reviewNodeId, reviewNode);
  const rootNode = localNodes.get(rootNodeId);
  if (rootNode) {
    rootNode.childrenNodeIds.push(reviewNodeId);
  }

  // Update layout after adding the review node.
  compositeLayout({
    nodes: localNodes,
    localSubtrees: localSubtrees,
    setSubtrees: dependencies.setSubtrees,
    setNodes: (updatedNodes) => {
      updatedNodes.forEach((node, nodeId) => {
        localNodes.set(nodeId, node);
      });
    },
  });

}

  // Persist the transformed quiz resource.
  await dependencies.createResource({
    nodeId: reviewNodeId,
    type: 'quiz', // This gets mapped to a 'practiceSheet' resource internally.
    title: 'Module Quiz',
    content: translatedQuiz,
    mapId: mapID,
  });
}


  // ---------------------------------------------------------------------------
  // STEP 6: Final commit
  // ---------------------------------------------------------------------------
  dependencies.setNodes(localNodes, mapID);
  dependencies.updateNodeTitle(rootNodeId, rootNodeTitle, mapID);
  dependencies.setSubtrees(localSubtrees, mapID);
}
