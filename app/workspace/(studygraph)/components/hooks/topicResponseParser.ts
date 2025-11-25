// topicResponseParser.ts
/***************************************************************************************************
 * @file topicResponseParser.ts
 * @responsibility
 *   Parse an AI-generated "topic" response (based on topicSchema) and apply it to the current
 *   concept map by updating the target node, creating any new child nodes, and emitting study
 *   resources (notes, cue cards, and optionally a quiz).
 *
 * @purpose
 *   This module provides a focused pipeline for the Topic Generator flow. It converts the
 *   structured response into the front-end’s data shape while preserving existing behaviors:
 *     - When `merge` is true, resources from the primary subtopic attach to the target node.
 *     - When `merge` is false, a new primary node is created under the target, and resources
 *       attach there. Secondary subtopics are created as additional children accordingly.
 *     - If a quiz is included, a "Review" node is created under the target and the quiz resource
 *       attaches there.
 *
 * @math/markdown
 *   To align with the application’s canonical rendering (as in parseConceptMap.ts), this file
 *   uses a single, centralized renderer: `renderMarkdownWithMath`. All Markdown strings that may
 *   include KaTeX/MathJax delimiters (inline `\\(...\\)` and block `\\[...\\]`) are rendered
 *   through this helper. This removes local markdown-it configuration and prevents configuration
 *   drift across parsers.
 *
 *
 * @exports
 *   - parseTopicResponse(...) : Promise<{ createdNodeIds: string[] }>
 *
 * @usage
 *   Import and call `parseTopicResponse` from your topic generation pipeline. Provide the
 *   dependencies object with state setters, resource creator, and the target root node id.
 ***************************************************************************************************/

import { v4 as uuidv4 } from 'uuid';
import { compositeLayout } from '@/app/workspace/(studygraph)/components/hooks/layoutUtils';
import { renderMarkdownWithMath } from './renderMarkdownWithMath';

export async function parseTopicResponse(
  responseData: any,
  dependencies: {
    updateNodeTitle: (nodeId: string, newTitle: string, mapID?: string) => void;
    setNodes: (nodes: Map<string, any>, mapID?: string) => void;
    nodes: Map<string, any>;
    createResource: (params: any) => Promise<void>;
    setSubtrees: (subtrees: Map<string, any>, mapID?: string) => void;
    subtrees: Map<string, any>;
    /** The target node ID (string literal, not a getter). */
    getRootNode: string;
  },
  mapID: string,
  merge: boolean = true
): Promise<{ createdNodeIds: string[] }> {
  // ----------------------------------------------------------------------------
  // STEP 1: Initialize LOCAL working state.
  //   - We operate on local copies to stage changes and then commit once at the end.

  // ----------------------------------------------------------------------------
  const localNodes = new Map(dependencies.nodes);
  const localSubtrees = new Map(dependencies.subtrees);
  const createdNodeIds: string[] = [];

  // The target node is provided as a string ID on dependencies.
  const targetNodeId = dependencies.getRootNode;

  // ----------------------------------------------------------------------------
  // STEP 2: Validate response and update the target node title if merging.
  //   - If "primary_subtopic" is missing, exit early (no-op).
  //   - When merging and the target node still has a default name, update its title
  //     to the primary subtopic’s title for a clean, user-friendly map.
  // ----------------------------------------------------------------------------
  const primary = responseData?.primary_subtopic;
  if (!primary) {
    return { createdNodeIds };
  }

  const primaryTitle = primary.title;

  if (merge) {
    const targetNode = localNodes.get(targetNodeId);
    if (targetNode) {
      const currentTitle = String(targetNode.title ?? '').trim().toLowerCase();
      const isDefault = currentTitle === 'root concept' || currentTitle === 'new concept';
      if (isDefault) {
        dependencies.updateNodeTitle(targetNodeId, primaryTitle);
        // Keep local copy in sync with the title update.
        const updated = localNodes.get(targetNodeId);
        if (updated) {
          updated.title = primaryTitle;
          localNodes.set(targetNodeId, updated);
        }
      }
    }
  }

  // ----------------------------------------------------------------------------
  // STEP 3: Process the PRIMARY subtopic.
  //   - Merge mode: resources attach directly to the target node.
  //   - Non-merge mode: create a new primary node under the target; resources attach there.
  //   - All content rendering uses renderMarkdownWithMath for Markdown + LaTeX parity.
  // ----------------------------------------------------------------------------
  let primarySubtopicID: string | null = null;

  if (merge) {
    // Attach resources to the existing target node.
    if (primary.lesson) {
      // Lecture note (if present).
      if (primary.lesson.lecture_note) {
        const lectureHTML = renderMarkdownWithMath(primary.lesson.lecture_note);
        await dependencies.createResource({
          nodeId: targetNodeId,
          type: 'note',
          title: `${primary.title} Lecture Note`,
          content: lectureHTML,
          mapId: mapID,
        });
        // We include the target node id to indicate content was added to it.
        createdNodeIds.push(targetNodeId);
      }

      // Flash cards (if present).
      if (Array.isArray(primary.lesson.flash_cards)) {
        for (const card of primary.lesson.flash_cards) {
          const cardHTML = renderMarkdownWithMath(card.definition);
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
    // Create a new primary node under the current target.
    primarySubtopicID = uuidv4();
    createdNodeIds.push(primarySubtopicID);

    const primaryNode = {
      id: primarySubtopicID,
      title: primary.title,
      parentNodeId: targetNodeId,
      childrenNodeIds: [],
      depth: (localNodes.get(targetNodeId)?.depth || 0) + 1,
      x: undefined as number | undefined,
      y: undefined as number | undefined,
    };

    // Persist the new node in our local map and link it to its parent.
    localNodes.set(primarySubtopicID, primaryNode);
    const targetNode = localNodes.get(targetNodeId);
    if (targetNode) {
      targetNode.childrenNodeIds = [...(targetNode.childrenNodeIds || []), primarySubtopicID];
    }

    // Recompute layout with the new node included.
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

    // Attach resources to the newly created primary node.
    if (primary.lesson) {
      if (primary.lesson.lecture_note) {
        const lectureHTML = renderMarkdownWithMath(primary.lesson.lecture_note);
        await dependencies.createResource({
          nodeId: primarySubtopicID,
          type: 'note',
          title: `${primary.title} Lecture Note`,
          content: lectureHTML,
          mapId: mapID,
        });
      }
      if (Array.isArray(primary.lesson.flash_cards)) {
        for (const card of primary.lesson.flash_cards) {
          const cardHTML = renderMarkdownWithMath(card.definition);
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

  // ----------------------------------------------------------------------------
  // STEP 4: Process SECONDARY subtopics.
  //   - Parent for secondaries is:
  //       * target node when merging
  //       * the newly created primary node when not merging
  //   - For each secondary key present, create a node and attach its resources.
  //   - Use the same math-aware renderer for notes and flash cards.
  // ----------------------------------------------------------------------------
  const secondaryParentId: string | null = merge ? targetNodeId : primarySubtopicID;
  if (!secondaryParentId) {
    // If we couldn't determine a parent (e.g., missing primary in non-merge),
    // exit gracefully with whatever has been created so far.
    return { createdNodeIds };
  }

  const secondaryKeys = ['secondary_subtopic_1', 'secondary_subtopic_2', 'secondary_subtopic_3'] as const;

  for (const key of secondaryKeys) {
    const secondary = primary[key];
    if (!secondary) continue;

    // Create the secondary node under the computed parent.
    const secondaryNodeId = uuidv4();
    createdNodeIds.push(secondaryNodeId);

    const secondaryNode = {
      id: secondaryNodeId,
      title: secondary.title,
      parentNodeId: secondaryParentId,
      childrenNodeIds: [],
      depth: (localNodes.get(secondaryParentId)?.depth || 0) + 1,
      x: undefined as number | undefined,
      y: undefined as number | undefined,
    };

    localNodes.set(secondaryNodeId, secondaryNode);
    const parentNode = localNodes.get(secondaryParentId);
    if (parentNode) {
      parentNode.childrenNodeIds = [...(parentNode.childrenNodeIds || []), secondaryNodeId];
    }

    // Recompute layout after inserting the secondary node.
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

    // Create the secondary lecture note (if present).
    if (secondary.lecture_note) {
      const secondaryLectureHTML = renderMarkdownWithMath(secondary.lecture_note);
      await dependencies.createResource({
        nodeId: secondaryNodeId,
        type: 'note',
        title: `${secondary.title} Lecture Note`,
        content: secondaryLectureHTML,
        mapId: mapID,
      });
    }

    // Create any cue cards (if present).
    if (Array.isArray(secondary.flash_cards)) {
      for (const card of secondary.flash_cards) {
        const cardHTML = renderMarkdownWithMath(card.definition);
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

  // ----------------------------------------------------------------------------
  // STEP 5: Process QUIZ (optional).
  //   - Translate the quiz payload into the front-end’s quiz resource shape.
  //   - Create a "Review" node under the target and attach the quiz to it.
  //   - Layout is recomputed after inserting the review node.
  // ----------------------------------------------------------------------------
  if (responseData?.quiz) {
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
    createdNodeIds.push(reviewNodeId);

    const reviewNode = {
      id: reviewNodeId,
      title: 'Review',
      parentNodeId: targetNodeId,
      childrenNodeIds: [],
      depth: (localNodes.get(targetNodeId)?.depth || 0) + 1,
      x: undefined as number | undefined,
      y: undefined as number | undefined,
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

  // ----------------------------------------------------------------------------
  // STEP 6: Final COMMIT — persist the local working state back to the app.
  // ----------------------------------------------------------------------------
  dependencies.setNodes(localNodes, mapID);
  dependencies.setSubtrees(localSubtrees, mapID);

  return { createdNodeIds };
}
