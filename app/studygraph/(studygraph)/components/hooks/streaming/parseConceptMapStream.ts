/***************************************************************************************
 * @file parseConceptMapStream.ts
 * @description
 *   A stateful parser for lesson-stream chunks, responsible for:
 *     – Maintaining in-flight state (rendered node IDs and buffered children).
 *     – Processing each `{ kind, id, parentId, isLeaf, payload }` event in order.
 *     – Invoking createNodeAndLayout, createResources, createReviewNode, or updateNodeTitle
 *       as appropriate.
 *     – Buffering child events until their parent has been rendered.
 *
 *   Usage:
 *     const parser = new ConceptMapParser(deps, mapID);
 *     for each chunk: await parser.handleEvent(chunk);
 ***************************************************************************************/

import {
  createNodeAndLayout,
  createResources,
  createReviewNode,
} from './parseConceptMap';

export interface StreamEvent {
  kind: 'main_topic' | 'primary_subtopic' | 'secondary_subtopic' | 'quiz';
  id: string;
  parentId?: string;
  isLeaf: boolean;
  payload: any;
}

export interface ParseDependencies {
  /** Update the title of an existing node (used for main_topic). */
  updateNodeTitle: (nodeId: string, newTitle: string, mapID?: string) => void;
  /** Replace the entire nodes map (Yjs) whenever we lay out a new node. */
  setNodes: (nodes: Map<string, any>, mapID?: string) => void;
  /** Initial snapshot of nodes for reference. */
  nodes: Map<string, any>;
  /** Create auxiliary resources (images, text, etc) under a node. */
  createResource: (params: any) => Promise<void>;
  /** Replace the entire subtrees map whenever we lay out a new branch. */
  setSubtrees: (subtrees: Map<string, any>, mapID?: string) => void;
  /** Initial snapshot of subtrees for reference. */
  subtrees: Map<string, any>;
  /** Retrieve the root node ID for wiring up quiz nodes, etc. */
  getRootNode: (mapID?: string) => string;
}

export class ConceptMapParser {
  private rendered = new Set<string>();
  private buffer = new Map<string, StreamEvent[]>();

  constructor(
    private deps: ParseDependencies,
    private mapID: string
  ) {}

  /**
   * Process one StreamEvent. Buffers children until their parent has rendered.
   */
  public async handleEvent(evt: StreamEvent): Promise<void> {
    // Record arrival
    if (evt.id) {
      // mark metadata if needed later
    }

    // MAIN TOPIC → update root title
    if (evt.kind === 'main_topic') {
      const root = this.deps.getRootNode(this.mapID);
      this.deps.updateNodeTitle(root, evt.payload.title, this.mapID);
      this.rendered.add(evt.id);
      // flush any buffered children
      await this.flushBuffer(evt.id);
      return;
    }

    // CHILDREN: only render if parent already exists
    if (evt.parentId && this.rendered.has(evt.parentId)) {
      await this.renderNode(evt);
      this.rendered.add(evt.id);
      await this.flushBuffer(evt.id);
    } else {
      // Parent not ready → buffer
      const list = this.buffer.get(evt.parentId!) || [];
      list.push(evt);
      this.buffer.set(evt.parentId!, list);
    }
  }

  /** Render a single node (subtopic or quiz) under its parent. */
  private async renderNode(evt: StreamEvent): Promise<void> {
    const depth = evt.kind === 'secondary_subtopic' ? 2 : 1;

    // Create the new node in the map
    const newNodeId = createNodeAndLayout({
      title: evt.payload.title,
      parentId: evt.parentId!,
      depth,
      localNodes: new Map(this.deps.nodes),
      localSubtrees: new Map(this.deps.subtrees),
      dependencies: {
        setNodes: this.deps.setNodes,
        setSubtrees: this.deps.setSubtrees,
      },
      mapId: this.mapID,
    });

    // Attach resources (images, text, etc)
    await createResources({
      payload: evt.payload,
      nodeId: newNodeId,
      depth,
      createResource: this.deps.createResource,
      mapId: this.mapID,
    });

    // If it’s a quiz, lay down the review node under the main root
    if (evt.kind === 'quiz') {
      await createReviewNode({
        rootId: this.deps.getRootNode(this.mapID),
        quizPayload: evt.payload,
        localNodes: new Map(this.deps.nodes),
        localSubtrees: new Map(this.deps.subtrees),
        dependencies: {
          setNodes: this.deps.setNodes,
          setSubtrees: this.deps.setSubtrees,
          createResource: this.deps.createResource,
          updateNodeTitle: this.deps.updateNodeTitle,
        },
        mapId: this.mapID,
      });
    }
  }

  /** Deliver any buffered children whose parentId === key */
  private async flushBuffer(key: string): Promise<void> {
    const pending = this.buffer.get(key) || [];
    this.buffer.delete(key);
    for (const child of pending) {
      await this.handleEvent(child);
    }
  }
}
