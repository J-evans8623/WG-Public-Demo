/**
 * topicResponseParser.ts
 *
 * This utility file defines the function `parseTopicResponse`, which processes an AI-generated
 * structured response (based on the topicSchema) and converts it into an updated concept map.
 *
 * Key responsibilities:
 *   - Update the target node's title if merging and the title is default.
 *   - Process primary and secondary subtopics, converting Markdown to HTML using markdown-it
 *     before creating resources.
 *   - Process a quiz section if provided.
 *   - Commit the final nodes and subtrees to update the global state.
 *
 * Dependencies:
 *   - createResource: Function to create a resource.
 *   - updateNodeTitle, setNodes, setSubtrees: Functions to update the application state.
 *   - compositeLayout: Function to compute node layouts.
 *   - markdown-it: Library to convert Markdown to HTML.
 *
 * Usage:
 *   Import and call parseTopicResponse from your topic generation pipeline.
 */

import { v4 as uuidv4 } from 'uuid';
import { compositeLayout } from '@/app/Library/components/AI/layoutUtils';
import markdownIt from 'markdown-it';

// Initialize markdown-it parser.
const mdParser = new markdownIt();

export async function parseTopicResponse(
  responseData: any,
  dependencies: {
    updateNodeTitle: (nodeId: string, newTitle: string, mapID?: string) => void;
    setNodes: (nodes: Map<string, any>, mapID?: string) => void;
    nodes: Map<string, any>;
    createResource: (params: any) => Promise<void>;
    setSubtrees: (subtrees: Map<string, any>, mapID?: string) => void;
    subtrees: Map<string, any>;
    getRootNode: string; // The target node ID.
  },
  mapID: string,
  merge: boolean = true
): Promise<void> {
  // ---------------------------------------------------------------------------
  // STEP 1: Initialize local state copies.
  // ---------------------------------------------------------------------------
  const localNodes = new Map(dependencies.nodes);
  const localSubtrees = new Map(dependencies.subtrees);

  // The target node is provided as dependencies.getRootNode.
  const targetNodeId = dependencies.getRootNode;
  console.log("[topicResponseParser] Target node ID:", targetNodeId);

  // ---------------------------------------------------------------------------
  // STEP 2: Update target node title if merging and the title is default.
  // ---------------------------------------------------------------------------
  const primary = responseData.primary_subtopic;
  if (!primary) {
    console.error("[topicResponseParser] No primary_subtopic found in responseData");
    return;
  }
  const primaryTitle = primary.title;
  if (merge) {
    const targetNode = localNodes.get(targetNodeId);
    if (targetNode) {
      const currentTitle = targetNode.title.trim().toLowerCase();
      if (currentTitle === "root concept" || currentTitle === "new concept") {
        console.log("[topicResponseParser] Updating target node title to:", primaryTitle);
        dependencies.updateNodeTitle(targetNodeId, primaryTitle);
        const updated = localNodes.get(targetNodeId);
        if (updated) {
          updated.title = primaryTitle; // Keep local copy in sync
          localNodes.set(targetNodeId, updated);
        }
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
  let primarySubtopicID: string | null = null;
  if (merge) {
    // When merging, add primary subtopic's resources directly to the target node.
    if (primary.lesson) {
      if (primary.lesson.lecture_note) {
        console.log("[topicResponseParser] (merge) Raw primary.lesson.lecture_note:", primary.lesson.lecture_note);
        const lectureHTML = mdParser.render(primary.lesson.lecture_note);
        console.log("[topicResponseParser] (merge) Converted lectureHTML:", lectureHTML);
        await dependencies.createResource({
          nodeId: targetNodeId,
          type: 'note',
          title: primary.title + " Lecture Note",
          content: lectureHTML,
          mapId: mapID,
        });
      }
      if (Array.isArray(primary.lesson.flash_cards)) {
        for (const card of primary.lesson.flash_cards) {
          console.log("[topicResponseParser] (merge) Raw card.definition:", card.definition);
          const cardHTML = mdParser.render(card.definition);
          console.log("[topicResponseParser] (merge) Converted cardHTML:", cardHTML);
          await dependencies.createResource({
            nodeId: targetNodeId,
            type: 'cuecard',
            title: card.term,
            content: cardHTML,
            mapId: mapID,
          });
        }
      }
    }
  } else {
    // Not merging: create a new primary node as a child of the target node.
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
    const targetNode = localNodes.get(targetNodeId);
    if (targetNode) {
      targetNode.childrenNodeIds = [...(targetNode.childrenNodeIds || []), primarySubtopicID];
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
    if (primary.lesson) {
      if (primary.lesson.lecture_note) {
        console.log("[topicResponseParser] (no-merge) Raw primary.lesson.lecture_note:", primary.lesson.lecture_note);
        const lectureHTML = mdParser.render(primary.lesson.lecture_note);
        console.log("[topicResponseParser] (no-merge) Converted lectureHTML:", lectureHTML);
        await dependencies.createResource({
          nodeId: primarySubtopicID,
          type: 'note',
          title: primary.title + " Lecture Note",
          content: lectureHTML,
          mapId: mapID,
        });
      }
      if (Array.isArray(primary.lesson.flash_cards)) {
        for (const card of primary.lesson.flash_cards) {
          console.log("[topicResponseParser] (no-merge) Raw card.definition:", card.definition);
          const cardHTML = mdParser.render(card.definition);
          console.log("[topicResponseParser] (no-merge) Converted cardHTML:", cardHTML);
          await dependencies.createResource({
            nodeId: primarySubtopicID,
            type: 'cuecard',
            title: card.term,
            content: cardHTML,
            mapId: mapID,
          });
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // STEP 4: Process secondary subtopics (if any).
  // ---------------------------------------------------------------------------
  const secondaryParentId: string | null = merge ? targetNodeId : primarySubtopicID;
  if (!secondaryParentId) {
    console.error("[topicResponseParser] No parent node for secondary subtopics.");
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
      const parentNode = localNodes.get(secondaryParentId);
      if (parentNode) {
        parentNode.childrenNodeIds = [...(parentNode.childrenNodeIds || []), secondaryNodeId];
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
      console.log(`[topicResponseParser] Raw ${key}.lecture_note:`, secondary.lecture_note);
      const secondaryLectureHTML = mdParser.render(secondary.lecture_note);
      console.log(`[topicResponseParser] Converted ${key}.lecture_note HTML:`, secondaryLectureHTML);
      await dependencies.createResource({
        nodeId: secondaryNodeId,
        type: 'note',
        title: secondary.title + " Lecture Note",
        content: secondaryLectureHTML,
        mapId: mapID,
      });
      if (Array.isArray(secondary.flash_cards)) {
        for (const card of secondary.flash_cards) {
          console.log(`[topicResponseParser] Raw flash card definition for ${key}:`, card.definition);
          const cardHTML = mdParser.render(card.definition);
          console.log(`[topicResponseParser] Converted flash card HTML for ${key}:`, cardHTML);
          await dependencies.createResource({
            nodeId: secondaryNodeId,
            type: 'cuecard',
            title: card.term,
            content: cardHTML,
            mapId: mapID,
          });
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // STEP 5: Process quiz section if provided.
  // ---------------------------------------------------------------------------
  if (responseData?.quiz) {
    console.log("[topicResponseParser] Processing quiz section");
    const aiQuiz = responseData.quiz;
    const translatedQuiz = {
      quizType: 'matching',
      quizContent: aiQuiz.questions.map((q: any) => ({
        id: q.id,
        type: 'matching',
        question: q.matchingTerm,
        correctAnswer: q.matchingAnswer,
      })),
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
  // STEP 6: Final commit – update global state.
  // ---------------------------------------------------------------------------
  console.log("[topicResponseParser] Final commit: updating nodes and subtrees for mapID:", mapID);
  dependencies.setNodes(localNodes, mapID);
  dependencies.setSubtrees(localSubtrees, mapID);
}
