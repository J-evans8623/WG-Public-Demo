/**
 * parseConceptMap.ts
 *
 * Responsibilities:
 *  - Export three pure helpers for batched concept-map rendering:
 *     1) createNodeAndLayout
 *     2) createResources
 *     3) createReviewNode
 *  - Orchestrate them in the single entrypoint parseConceptMap(), with NO logic changes.
 */

import { v4 as uuidv4 } from 'uuid';
import { compositeLayout } from '@/app/Library/components/AI/layoutUtils';
import markdownIt from 'markdown-it';

// Initialize markdown-it parser instance.
const mdParser = new markdownIt();

/**
 * createNodeAndLayout
 *  - Creates a node under `parentId` with given `title` & `depth`.
 *  - Updates the in-memory Maps, runs the compositeLayout,
 *    and emits both setNodes/setSubtrees via dependencies.
 */
export function createNodeAndLayout(
  params: {
    title: string;
    parentId: string;
    depth: number;
    localNodes: Map<string, any>;
    localSubtrees: Map<string, any>;
    dependencies: {
      setNodes: (nodes: Map<string, any>, mapID?: string) => void;
      setSubtrees: (subtrees: Map<string, any>, mapID?: string) => void;
    };
    mapId: string;
  }
): string {
  const { title, parentId, depth, localNodes, localSubtrees, dependencies, mapId } = params;
  const nodeId = uuidv4();

  // 1) Create node object
  const newNode = {
    id: nodeId,
    title,
    parentNodeId: parentId,
    childrenNodeIds: [],
    depth,
    x: undefined,
    y: undefined,
  };
  localNodes.set(nodeId, newNode);

  // 2) Hook into parent
  const parent = localNodes.get(parentId);
  if (parent) {
    parent.childrenNodeIds = [...(parent.childrenNodeIds || []), nodeId];
  }

  // 3) Run layout on local state
  compositeLayout({
    nodes: localNodes,
    localSubtrees,
    setSubtrees: dependencies.setSubtrees,
    setNodes: (updated) => {
      for (const [k, v] of updated.entries()) localNodes.set(k, v);
    },
  });

  // 4) Emit state
  dependencies.setNodes(localNodes, mapId);
  dependencies.setSubtrees(localSubtrees, mapId);

  return nodeId;
}

/**
 * createResources
 *  - Given a subtopic payload (primary or secondary) and its nodeId,
 *    emits dependencies.createResource(...) calls to stash notes, cuecards, quizzes.
 */
export async function createResources(
  params: {
    payload: any;
    nodeId: string;
    depth: number;
    createResource: (opts: any) => Promise<void>;
    mapId: string;
  }
): Promise<void> {
  const { payload, nodeId, depth, createResource, mapId } = params;

  // Primary subtopic uses payload.lesson
  if (depth === 1 && payload.lesson) {
    const { lecture_note, flash_cards, quiz } = payload.lesson;
    if (lecture_note) {
      await createResource({
        nodeId,
        type: 'note',
        title: `${payload.title} Lecture Note`,
        content: mdParser.render(lecture_note),
        mapId,
      });
    }
    if (Array.isArray(flash_cards)) {
      for (const card of flash_cards) {
        await createResource({
          nodeId,
          type: 'cuecard',
          title: card.term,
          content: mdParser.render(card.definition),
          mapId,
        });
      }
    }
    if (quiz) {
      await createResource({
        nodeId,
        type: 'quiz',
        title: `${payload.title} Quiz`,
        content: quiz,
        mapId,
      });
    }
  }
  // Secondary subtopic (depth 2) has flat fields
  else if (depth === 2) {
    const { lecture_note, flash_cards } = payload;
    if (lecture_note) {
      await createResource({
        nodeId,
        type: 'note',
        title: `${payload.title} Lecture Note`,
        content: mdParser.render(lecture_note),
        mapId,
      });
    }
    if (Array.isArray(flash_cards)) {
      for (const card of flash_cards) {
        await createResource({
          nodeId,
          type: 'cuecard',
          title: card.term,
          content: mdParser.render(card.definition),
          mapId,
        });
      }
    }
  }
}

/**
 * createReviewNode
 *  - Appends the dedicated “Review” node under root, runs layout,
 *    and emits the quiz resource.
 */
export async function createReviewNode(
  params: {
    rootId: string;
    quizPayload: any;
    localNodes: Map<string, any>;
    localSubtrees: Map<string, any>;
    dependencies: {
      setNodes: (nodes: Map<string, any>, mapID?: string) => void;
      setSubtrees: (subtrees: Map<string, any>, mapID?: string) => void;
      createResource: (opts: any) => Promise<void>;
      updateNodeTitle: (nodeId: string, newTitle: string, mapID?: string) => void;
    };
    mapId: string;
  }
): Promise<void> {
  const { rootId, quizPayload, localNodes, localSubtrees, dependencies, mapId } = params;

  // 1) Build review node
  const reviewId = 'review';
  const reviewNode = {
    id: reviewId,
    title: 'Review',
    parentNodeId: rootId,
    childrenNodeIds: [],
    depth: (localNodes.get(rootId)?.depth || 0) + 1,
    x: undefined,
    y: undefined,
  };
  localNodes.set(reviewId, reviewNode);

  // 2) Hook into root
  const root = localNodes.get(rootId);
  if (root) root.childrenNodeIds.push(reviewId);

  // 3) Layout
  compositeLayout({
    nodes: localNodes,
    localSubtrees,
    setSubtrees: dependencies.setSubtrees,
    setNodes: (upd) => upd.forEach((n, i) => localNodes.set(i, n)),
  });

  dependencies.setNodes(localNodes, mapId);

  // 4) Persist quiz resource
  const aiQuiz = quizPayload;
  const translatedQuiz = {
    quizType: 'matching',
    quizContent: aiQuiz.questions.map((q: any) => ({
      id: q.id,
      type: 'matching',
      question: q.matchingTerm,
      correctAnswer: q.matchingAnswer,
    })),
  };
  await dependencies.createResource({
    nodeId: reviewId,
    type: 'quiz',
    title: 'Module Quiz',
    content: translatedQuiz,
    mapId,
  });

  // 5) Finally update root title
  dependencies.updateNodeTitle(rootId, '', mapId);
}

/**
 * parseConceptMap
 *  - Original batch‐mode entrypoint. Uses the above helpers in order:
 *     1) root resources
 *     2) for each primary: createNodeAndLayout + createResources + recurse for secondaries
 *     3) quiz → createReviewNode
 *     4) commit all
 */
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
  // Local mutable copies
  const localNodes = new Map(dependencies.nodes);
  const localSubtrees = new Map(dependencies.subtrees);
  const rootId = dependencies.getRootNode();

  // STEP 1: Root intro & objectives
  const rt = responseData.main_topic;
  if (rt.introduction) {
    await dependencies.createResource({
      nodeId: rootId,
      type: 'note',
      title: 'Introduction',
      content: mdParser.render(rt.introduction),
      mapId: mapID,
    });
  }
  if (Array.isArray(rt.learning_objectives)) {
    for (const obj of rt.learning_objectives) {
      await dependencies.createResource({
        nodeId: rootId,
        type: 'cuecard',
        title: 'Learning Objective',
        content: mdParser.render(obj),
        mapId: mapID,
      });
    }
  }

  // STEP 2: Recursively create subtopics
  async function recurse(
    items: any[],
    parentId: string,
    depth: number
  ): Promise<void> {
    for (const it of items) {
      const newId = createNodeAndLayout({
        title: it.title,
        parentId,
        depth,
        localNodes,
        localSubtrees,
        dependencies: {
          setNodes: dependencies.setNodes,
          setSubtrees: dependencies.setSubtrees,
        },
        mapId: mapID,
      });
      await createResources({
        payload: it,
        nodeId: newId,
        depth,
        createResource: dependencies.createResource,
        mapId: mapID,
      });
      if (Array.isArray(it.secondary_subtopic) && it.secondary_subtopic.length) {
        await recurse(it.secondary_subtopic, newId, depth + 1);
      }
    }
  }

  if (Array.isArray(rt.primary_subtopics)) {
    await recurse(rt.primary_subtopics, rootId, (localNodes.get(rootId)?.depth || 0) + 1);
  }

  // STEP 3: Quiz under “Review”
  if (rt.quiz) {
    await createReviewNode({
      rootId,
      quizPayload: rt.quiz,
      localNodes,
      localSubtrees,
      dependencies: {
        setNodes: dependencies.setNodes,
        setSubtrees: dependencies.setSubtrees,
        createResource: dependencies.createResource,
        updateNodeTitle: dependencies.updateNodeTitle,
      },
      mapId: mapID,
    });
  }

  // STEP 4: Final commit of root title & state
  dependencies.setNodes(localNodes, mapID);
  dependencies.updateNodeTitle(rootId, rt.title, mapID);
  dependencies.setSubtrees(localSubtrees, mapID);
}
