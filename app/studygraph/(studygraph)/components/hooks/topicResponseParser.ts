/**
 * topicResponseParser.ts
 *
 * This utility file defines the function `parseTopicResponse`, which processes an AI-generated
 * structured response (based on the Topic Schema) and converts it into an updated concept map.
 *
 * The processing steps are analogous to the legacy GenerateAIResponse.processAIResponse method,
 * but adjusted for the Topic Schema and the merge behavior:
 *
 *  -------------------------------------------------------------------------------
 *  STEP 1: Define the LOCAL STATE.
 *     - Create local copies of the current nodes and subtrees.
 *
 *  STEP 2: Process the target node.
 *     - If merge is true and the target node’s title is one of the default values ("root concept" or "new concept"),
 *       update the target node’s title with the primary subtopic title.
 *     - If merge is false, leave the target node unchanged.
 *
 *  STEP 3: Process the primary subtopic.
 *     - Extract the primary subtopic from responseData.primary_subtopic.
 *     - If merge is false, create a new node for the primary subtopic as a child of the target node and store its ID in primarySubtopicID.
 *       Otherwise, simply create resources for the primary subtopic on the target node.
 *     - Immediately invoke the composite layout algorithm to update positions.
 *
 *  STEP 4: Process secondary subtopics (if any).
 *     - For each secondary subtopic key present (secondary_subtopic_1, _2, _3):
 *         a. Generate a unique ID and create a new node under the primary subtopic node if merge is false,
 *            otherwise attach it directly to the target node.
 *         b. Immediately call compositeLayout to update positions.
 *         c. Create resources (notes, cuecards) for the secondary subtopic.
 *
 *  STEP 5: Process quiz (if provided) and commit final nodes and subtrees.
 *     - If quiz data is present, create a review node as a child of the target node and add the quiz resource.
 *     - Finally, call setNodes, updateNodeTitle (if needed), and setSubtrees to update the global state.
 *
 *  Dependencies:
 *    - updateNodeTitle: Function to update an existing node’s title.
 *    - setNodes: Callback to commit the updated nodes map.
 *    - nodes: A Map of current nodes (local copy).
 *    - createResource: Function to asynchronously create a resource (e.g., note, cuecard).
 *    - setSubtrees: Callback to update the subtree layout map.
 *    - subtrees: A Map of current subtrees (local copy).
 *    - getRootNode: String representing the target node ID.
 *
 *  Parameters:
 *    - responseData: The AI-generated response data following the Topic Schema.
 *    - dependencies: An object containing the dependency functions and local state.
 *    - mapID: The current concept map identifier.
 *    - merge (optional): If true (default), merge the primary subtopic content into the target node;
 *                        if false, create a new primary node as a child of the target node.
 *
 *  Usage:
 *    Import and call this function from your topic generation pipeline to process the AI response
 *    and update the concept map accordingly.
 */
import { v4 as uuidv4 } from 'uuid';
import { compositeLayout } from '@/app/Library/components/AI/layoutUtils';

export async function parseTopicResponse(
  responseData: any,
  dependencies: {
    updateNodeTitle: (nodeId: string, newTitle: string, mapID?: string) => void;
    setNodes: (nodes: Map<string, any>, mapID?: string) => void;
    nodes: Map<string, any>;
    createResource: (params: any) => Promise<void>;
    setSubtrees: (subtrees: Map<string, any>, mapID?: string) => void;
    subtrees: Map<string, any>;
    getRootNode: string; // The target node ID into which the AI-generated subtree will be merged or attached.
  },
  mapID: string,
  merge: boolean = true
): Promise<void> {
  // ---------------------------------------------------------------------------
  // STEP 1: Define the LOCAL STATE
  // ---------------------------------------------------------------------------
  const localNodes = new Map(dependencies.nodes);
  const localSubtrees = new Map(dependencies.subtrees);

  // The target node is provided by dependencies.getRootNode.
  const targetNodeId = dependencies.getRootNode;
  console.log("[topicResponseParser] Target node ID:", targetNodeId);

  // ---------------------------------------------------------------------------
  // STEP 2: Update target node title if merge is true and current title is default.
  // ---------------------------------------------------------------------------
  const primary = responseData.primary_subtopic;
  if (!primary) {
    console.error("[topicResponseParser] No primary_subtopic found in responseData");
    return;
  }
  const primaryTitle = primary.title;
  console.log('************Debugged Section**************');
  console.log(`id47 the response title is ${primaryTitle}`);
  if (merge) {
    const targetNode = localNodes.get(targetNodeId);
    if (targetNode) {
      const currentTitle = targetNode.title.trim().toLowerCase();
      console.log(`id48 The title of the node is ${currentTitle}`);
      if (currentTitle === "root concept" || currentTitle === "new concept") {
        console.log("[topicResponseParser] Updating target node title from default to primary subtopic title:", primaryTitle);
        dependencies.updateNodeTitle(targetNodeId, primaryTitle);
        const updated = localNodes.get(targetNodeId);
        if (updated) {
          updated.title = primaryTitle; // <--- Keep local copy in sync
          localNodes.set(targetNodeId, updated);
        }
        console.log('************Debugged Section**************');
      } else {
        console.log("[topicResponseParser] Target node title is custom; no update performed.");
      }
    }
  } else {
    console.log("[topicResponseParser] Merge flag false; target node title remains unchanged.");
  }

  // ---------------------------------------------------------------------------
  // STEP 3: Process the primary subtopic.
  // ---------------------------------------------------------------------------
  // Define a variable to store the primary subtopic ID.
  let primarySubtopicID: string | null = null;
  if (merge) {
    // When merging, add the primary subtopic's resources directly to the target node.
    if (primary.lesson) {
      if (primary.lesson.lecture_note) {
        await dependencies.createResource({
          nodeId: targetNodeId,
          type: 'note',
          title: primary.title + " Lecture Note",
          content: primary.lesson.lecture_note,
          mapId: mapID,
        });
      }
      if (primary.lesson.flash_cards && Array.isArray(primary.lesson.flash_cards)) {
        for (const card of primary.lesson.flash_cards) {
          await dependencies.createResource({
            nodeId: targetNodeId,
            type: 'cuecard',
            title: card.term,
            content: card.definition,
            mapId: mapID,
          });
        }
      }
    }
    // For merging, primarySubtopicID remains null.
  } else {
    // When not merging, create a new primary node as a child of the target node.
    primarySubtopicID = uuidv4();
    console.log("[topicResponseParser] Creating primary subtopic node with ID:", primarySubtopicID);
    const primaryNode = {
      id: primarySubtopicID,
      title: primary.title,
      parentNodeId: targetNodeId,
      childrenNodeIds: [],
      depth: (localNodes.get(targetNodeId)?.depth || 0) + 1,
      x: undefined,
      y: undefined,
    };
    localNodes.set(primarySubtopicID, primaryNode);
    // Attach the new primary node as a child of the target node.
    const targetNode = localNodes.get(targetNodeId);
    if (targetNode) {
      targetNode.childrenNodeIds = [...(targetNode.childrenNodeIds || []), primarySubtopicID];
    }
    // Run layout after creating the new primary node.
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
    // Create resources for the primary node.
    if (primary.lesson) {
      if (primary.lesson.lecture_note) {
        await dependencies.createResource({
          nodeId: primarySubtopicID,
          type: 'note',
          title: primary.title + " Lecture Note",
          content: primary.lesson.lecture_note,
          mapId: mapID,
        });
      }
      if (primary.lesson.flash_cards && Array.isArray(primary.lesson.flash_cards)) {
        for (const card of primary.lesson.flash_cards) {
          await dependencies.createResource({
            nodeId: primarySubtopicID,
            type: 'cuecard',
            title: card.term,
            content: card.definition,
            mapId: mapID,
          });
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // STEP 4: Process secondary subtopics from the primary subtopic.
  // ---------------------------------------------------------------------------
  // Determine the parent for secondary subtopics.
  // If merge is true, attach directly to the target node; otherwise, use the primary subtopic node.
  const secondaryParentId: string | null = merge ? targetNodeId : primarySubtopicID;
  if (!secondaryParentId) {
    console.error("[topicResponseParser] Could not determine parent node for secondary subtopics.");
    return;
  }

  const secondaryKeys = ['secondary_subtopic_1', 'secondary_subtopic_2', 'secondary_subtopic_3'];
  for (const key of secondaryKeys) {
    const secondary = primary[key];
    if (secondary) {
      const secondaryNodeId = uuidv4();
      console.log(`[topicResponseParser] Processing ${key} with generated ID:`, secondaryNodeId);
      const secondaryNode = {
        id: secondaryNodeId,
        title: secondary.title,
        parentNodeId: secondaryParentId,
        childrenNodeIds: [],
        depth: (localNodes.get(secondaryParentId)?.depth || 0) + 1,
        x: undefined,
        y: undefined,
      };
      localNodes.set(secondaryNodeId, secondaryNode);
      // Update the parent's children list.
      const parentNode = localNodes.get(secondaryParentId);
      if (parentNode) {
        parentNode.childrenNodeIds = [...(parentNode.childrenNodeIds || []), secondaryNodeId];
      }
      // Run composite layout after creating each secondary node.
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
      // Create resources for the secondary subtopic.
      await dependencies.createResource({
        nodeId: secondaryNodeId,
        type: 'note',
        title: secondary.title + " Lecture Note",
        content: secondary.lecture_note,
        mapId: mapID,
      });
      if (secondary.flash_cards && Array.isArray(secondary.flash_cards)) {
        for (const card of secondary.flash_cards) {
          await dependencies.createResource({
            nodeId: secondaryNodeId,
            type: 'cuecard',
            title: card.term,
            content: card.definition,
            mapId: mapID,
          });
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // STEP 5: Process quiz for the topic (if provided) and final commit.
  // ---------------------------------------------------------------------------
  if (responseData?.quiz) {
    console.log("[topicResponseParser] Processing quiz section");
    const aiQuiz = responseData.quiz;
    const translatedQuiz = {
      quizType: 'matching', // Hard-coded for now
      quizContent: aiQuiz.questions.map((q: any) => ({
        id: q.id,
        type: 'matching',
        question: q.matchingTerm,      // Renaming from matchingTerm to question
        correctAnswer: q.matchingAnswer // Renaming from matchingAnswer to correctAnswer
      }))
    };
    const reviewNodeId = uuidv4();
    console.log("[topicResponseParser] Creating review node with ID:", reviewNodeId);
    const reviewNode = {
      id: reviewNodeId,
      title: 'Review',
      parentNodeId: targetNodeId,
      childrenNodeIds: [],
      depth: (localNodes.get(targetNodeId)?.depth || 0) + 1,
      x: undefined,
      y: undefined,
    };
    localNodes.set(reviewNodeId, reviewNode);
    const targetNode = localNodes.get(targetNodeId);
    if (targetNode) {
      targetNode.childrenNodeIds = [...(targetNode.childrenNodeIds || []), reviewNodeId];
    }
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
    await dependencies.createResource({
      nodeId: reviewNodeId,
      type: 'quiz',
      title: 'Topic Quiz',
      content: translatedQuiz,
      mapId: mapID,
    });
  }

  // ---------------------------------------------------------------------------
  // STEP 6: Final commit: update global state.
  // ---------------------------------------------------------------------------
  console.log("[topicResponseParser] Final commit: updating nodes and subtrees for mapID:", mapID);
  dependencies.setNodes(localNodes, mapID);
  // Do not update the target node title again if merge is false.
  dependencies.setSubtrees(localSubtrees, mapID);
}
