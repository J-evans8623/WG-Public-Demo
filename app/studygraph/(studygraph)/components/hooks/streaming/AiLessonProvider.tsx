// AiLessonProvider.tsx

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { generateAILesson } from '@/app/Library/utils/aiServiceApi';
import { useFileAsset } from '@/app/Library/Context/FileAssetContext';
import { useLessonModule } from '@/app/Library/Context/LessonModuleContext';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { useSubTreeContext } from '@/app/Library/Context/SubTreeProvider';
import useCardCrudOperations from '../hooks/useCardCrudOperations';
import { useYDoc } from '@/app/Library/Context/YDocContext';
import {
  ConceptMapParser,
  StreamEvent
} from '@/app/studygraph/(studygraph)/components/hooks/streaming/parseConceptMapStream';

interface AiLessonContextValue {
  generateLesson: (file: File) => Promise<void>;
  isStreaming: boolean;
  error?: Error;
}

// Define interface for the backend message format
interface LessonChunk {
  event: 'message' | 'endOfStream' | 'error';
  data: StreamEvent | Record<string, never> | { message: string };
}

const AiLessonContext = createContext<AiLessonContextValue | null>(null);

export const AiLessonProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { docFileID } = useYDoc();                            // Persistent document identifier
  const { addGeneratedLessonFile } = useFileAsset();          // Store PDF metadata
  const { addConceptMap, addLoadingLesson, removeLoadingLesson } = useLessonModule();
  const { updateNodeTitle, setNodes, getRootNode } = useNodesContext();
  const { subtrees, setSubtrees } = useSubTreeContext();
  const { createResource } = useCardCrudOperations();

  const [isStreaming, setStreaming] = useState(false);
  const [error, setError] = useState<Error>();

  // Wrap Yjs setters to support optional mapID
  const wrappedSetNodes = useCallback(
    (nodesMap: Map<string, any>, mapID?: string) => setNodes(nodesMap, undefined, mapID),
    [setNodes]
  );
  const wrappedSetSubtrees = useCallback(
    (subtreesMap: Map<string, any>, mapID?: string) => setSubtrees(subtreesMap, undefined, mapID),
    [setSubtrees]
  );

  const generateLesson = useCallback(async (file: File) => {
    if (!docFileID) {
      setError(new Error('Document not initialized: missing docFileID.'));
      return;
    }

    let currentFileId = '';
    const parsers: Record<string, ConceptMapParser> = {};

    try {
      setError(undefined);
      setStreaming(true);

      // 1) Upload file and register metadata
      const { fileId, stored } = await generateAILesson(file, docFileID);
      currentFileId = fileId;
      addGeneratedLessonFile(stored);
      addLoadingLesson(fileId);

      // 2) Open streaming endpoint
      const res = await fetch(
        `/api/stream-lesson?fileId=${encodeURIComponent(fileId)}&docId=${encodeURIComponent(docFileID)}`,
        { credentials: 'include' }
      );
      if (!res.body) {
        throw new Error('Server did not provide a streaming body.');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // 3) Read loop: log every stage
      while (true) {
        const { value, done } = await reader.read();
        console.debug('[AiLessonProvider] 🔹 raw Uint8Array chunk:', value);
        if (done) {
          console.debug('[AiLessonProvider] 🔹 reader.read() → done');
          break;
        }

        // Decode immediately
        const textChunk = decoder.decode(value, { stream: true });
        console.debug('[AiLessonProvider] 🔹 decoded text chunk:', textChunk);

        // Append and log buffer state
        buffer += textChunk;
        console.debug('[AiLessonProvider] 🔹 accumulated buffer:', buffer);

        // Split into complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          // Log raw NDJSON line
          console.debug('[AiLessonProvider] 🔹 NDJSON line:', line);

          let parsed: LessonChunk;
          try {
            parsed = JSON.parse(line);
          } catch (jsonErr) {
            console.error('[AiLessonProvider] ⚠️ invalid JSON, skipping:', line, jsonErr);
            continue;
          }

          // Match the backend format - check for event type
          if (!parsed.event) {
            console.warn('[AiLessonProvider] 🔹 skipping message without event type:', parsed);
            continue;
          }

          // Handle end of stream
          if (parsed.event === 'endOfStream') {
            console.log('[AiLessonProvider] 🔹 Received end of stream');
            continue;
          }
          
          // Handle error events
          if (parsed.event === 'error') {
            const errorData = parsed.data as { message: string };
            console.error('[AiLessonProvider] 🔹 Stream error:', errorData?.message);
            setError(new Error(errorData?.message || 'Unknown stream error'));
            continue;
          }

          // Handle message events
          if (parsed.event === 'message' && parsed.data) {
            // Type assertion to ensure we're working with a StreamEvent
            // We can confirm it's a StreamEvent if it has the required properties
            const payload = parsed.data as any;
            
            // Check if data has required StreamEvent properties
            if (!payload.id || !payload.kind) {
              console.warn('[AiLessonProvider] 🔹 Invalid StreamEvent data:', payload);
              continue;
            }
            
            console.log(`[AiLessonProvider] ✅ message — id=${payload.id}, parent=${payload.parentId ?? 'none'}, kind=${payload.kind}`);

            // Extract chapter key
            const [jobId, chapter] = payload.id.split('-');
            if (!jobId || !chapter) {
              console.warn(`[AiLessonProvider] 🔹 unexpected id format: ${payload.id}`);
              continue;
            }
            const chapterKey = `${jobId}-${chapter}`;

            // Instantiate parser on first event per chapter
            if (!parsers[chapterKey]) {
              const title = `Lesson ${chapter}`;
              const newMap = addConceptMap(title, chapterKey);
              parsers[chapterKey] = new ConceptMapParser(
                {
                  updateNodeTitle,
                  setNodes: wrappedSetNodes,
                  nodes: new Map(newMap.nodesMap.entries()),
                  createResource,
                  setSubtrees: wrappedSetSubtrees,
                  subtrees: new Map(subtrees.entries()),
                  getRootNode
                },
                chapterKey
              );
            }

            // Feed event into parser as StreamEvent (with runtime validation above)
            await parsers[chapterKey].handleEvent(payload as StreamEvent);
          } else {
            console.warn('[AiLessonProvider] 🔹 Unknown event type or missing data:', parsed);
          }
        }
      }
    } catch (e: any) {
      console.error('[AiLessonProvider] generateLesson error:', e);
      setError(e);
    } finally {
      setStreaming(false);
      if (currentFileId) removeLoadingLesson(currentFileId);
    }
  }, [
    docFileID,
    addGeneratedLessonFile,
    addLoadingLesson,
    addConceptMap,
    updateNodeTitle,
    wrappedSetNodes,
    createResource,
    wrappedSetSubtrees,
    subtrees,
    getRootNode,
    removeLoadingLesson
  ]);

  return (
    <AiLessonContext.Provider value={{ generateLesson, isStreaming, error }}>
      {children}
    </AiLessonContext.Provider>
  );
};

/** Hook to consume the AiLesson context */
export function useAiLesson() {
  const ctx = useContext(AiLessonContext);
  if (!ctx) throw new Error('useAiLesson must be used within an AiLessonProvider');
  return ctx;
}