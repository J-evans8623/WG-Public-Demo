/**
 * useLessonModuleMapper.ts
 *
 * Responsibilities:
 *  - Observe active SSE streams from the global LessonStreamRegistry.
 *  - For each new stream:
 *     1) Create a concept map (one per fileId).
 *     2) Mark it loading.
 *     3) Kick off parseConceptMapStream against the existing EventSource.
 *     4) On endOfStream, clear loading flag and unregister the stream.
 *  - Ensures parallel streams each produce their own map concurrently.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useLessonModule } from '@/app/Library/Context/LessonModuleContext';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import useCardCrudOperations from '../useCardCrudOperations';
import { useSubTreeContext } from '@/app/Library/Context/SubTreeProvider';
import { useYDoc } from '@/app/Library/Context/YDocContext';
import { parseConceptMapStream } from './parseConceptMapStream';
import { useStreamRegistry } from './LessonStreamRegistry';

export function useLessonModuleMapper(): void {
  // Core contexts
  const { addConceptMap, addLoadingLesson, removeLoadingLesson } =
    useLessonModule();
  const { updateNodeTitle, setNodes, getRootNode } = useNodesContext();
  const { createResource } = useCardCrudOperations();
  const { subtrees, setSubtrees } = useSubTreeContext();
  const { getFileName, updateFileName } = useYDoc();
  const { activeStreams, removeStream } = useStreamRegistry();

  // Avoid initializing the same stream twice
  const initializedStreamsRef = useRef<Set<string>>(new Set());

  // Wrap Yjs set* APIs into the shape parseConceptMapStream expects
  const wrappedSetNodes = useCallback(
    (nodesMap: Map<string, any>, mapID?: string) =>
      setNodes(nodesMap, undefined, mapID),
    [setNodes]
  );
  const wrappedSetSubtrees = useCallback(
    (subtreesMap: Map<string, any>, mapID?: string) =>
      setSubtrees(subtreesMap, undefined, mapID),
    [setSubtrees]
  );

  useEffect(() => {
    activeStreams.forEach(({ fileId, es, meta }) => {
      if (initializedStreamsRef.current.has(fileId)) return;
      initializedStreamsRef.current.add(fileId);

      // 1) Instantiate a new concept map using fileId as its ID
      const mapTitle = meta?.title || `Lesson ${fileId}`;
      const mapId = fileId;
      const { nodesMap } = addConceptMap(mapTitle, mapId);

      // 2) Mark as loading
      addLoadingLesson(mapId);

      // 3) If the document is still untitled, use the incoming title
      if (getFileName().toLowerCase().trim() === 'untitled document') {
        updateFileName(mapTitle);
      }

      // 4) Wire up the existing EventSource for progressive rendering
      parseConceptMapStream(
        es,
        {
          updateNodeTitle,
          setNodes: wrappedSetNodes,
          nodes: new Map(nodesMap.entries()),
          createResource,
          setSubtrees: wrappedSetSubtrees,
          subtrees,
          getRootNode,
        },
        mapId
      );

      // 5) Cleanup once the stream signals completion
      es.addEventListener('endOfStream', () => {
        removeLoadingLesson(mapId);
        removeStream(fileId);
      });
    });
  }, [
    activeStreams,
    addConceptMap,
    addLoadingLesson,
    removeLoadingLesson,
    updateNodeTitle,
    wrappedSetNodes,
    wrappedSetSubtrees,
    createResource,
    subtrees,
    getRootNode,
    getFileName,
    updateFileName,
    removeStream,
  ]);
}
