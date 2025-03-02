/**
 * @file useLessonModuleMapper.ts
 * @description
 *   This hook maps lesson module metadata obtained from file uploads to the current
 *   lesson module state. It creates a new concept map for each lesson module and then
 *   asynchronously triggers the backend AI service to generate the lesson module details.
 *
 *   Responsibilities:
 *     - For each lesson module summary (from file uploads), if not already present,
 *       create a new concept map by invoking addConceptMap.
 *     - Set each module’s loading status via addLoadingLesson before processing and remove
 *       it using removeLoadingLesson once processing is complete.
 *     - Parse and layout the AI-generated concept map, then update the lesson module with metadata.
 *
 *   This implementation supports multiple loading lesson modules concurrently.
 *
 * @author  
 * @date    
 */

import { useEffect, useCallback } from 'react';
import { useFileAsset } from '@/app/Library/Context/FileAssetContext';
import { generateAILesson } from '@/app/Library/utils/aiServiceApi';
import { useLessonModule } from '@/app/Library/Context/LessonModuleContext';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import useCardCrudOperations from './useCardCrudOperations';
import { useSubTreeContext } from '@/app/Library/Context/SubTreeProvider';
import { useYDoc } from '@/app/Library/Context/YDocContext';
import { parseConceptMap } from './parseConceptMap';

export function useLessonModuleMapper(): void {
  const { lessonModuleLists } = useFileAsset();
  const {
    updateLessonModule,
    addConceptMap,
    getExistingLessonModules,
    addLoadingLesson,
    removeLoadingLesson,
  } = useLessonModule();
  const { updateNodeTitle, setNodes, getRootNode } = useNodesContext();
  const { createResource } = useCardCrudOperations();
  const { subtrees, setSubtrees } = useSubTreeContext();
  const { docFileID } = useYDoc();

  // Wrap these in useCallback to maintain stable references.
  const wrappedSetNodes = useCallback(
    (nodesMap: Map<string, any>, mapID?: string) => {
      setNodes(nodesMap, undefined, mapID);
    },
    [setNodes]
  );

  const wrappedSetSubtrees = useCallback(
    (subtreesMap: Map<string, any>, mapID?: string) => {
      setSubtrees(subtreesMap, undefined, mapID);
    },
    [setSubtrees]
  );

  useEffect(() => {
    // Get existing module IDs from the persisted concept maps.
    const existingModuleIDs = new Set(getExistingLessonModules());

    // Iterate over each lesson module summary from the file asset.
    lessonModuleLists.forEach((lessonModules) => {
      lessonModules.forEach(async (moduleSummary) => {
        // If the module already exists (has been processed), skip it.
        if (existingModuleIDs.has(moduleSummary.moduleID)) {
          return;
        }

        // Mark the module as loading.
        addLoadingLesson(moduleSummary.moduleID);

        try {
          // Always create a new concept map for the module.
          console.log(
            `useLessonModuleMapper: invoking addConceptMap for module ID: ${moduleSummary.moduleID}`
          );
          const newMap = addConceptMap(
            moduleSummary.mainTopicTitle || 'New Lesson Module',
            moduleSummary.moduleID
          );

          console.log(
            `Processing new lesson module: ${moduleSummary.moduleID}`
          );
          const aiLessonResponse = await generateAILesson(
            docFileID!,
            moduleSummary.moduleID
          );

          // Parse and layout the AI-generated concept map.
          await parseConceptMap(
            aiLessonResponse,
            {
              updateNodeTitle,
              setNodes: wrappedSetNodes,
              nodes: new Map(newMap.nodesMap.entries()),
              createResource,
              setSubtrees: wrappedSetSubtrees,
              subtrees,
              getRootNode,
            },
            newMap.id
          );

          // Update the lesson module with additional metadata.
          updateLessonModule(moduleSummary.moduleID, {
            topic: moduleSummary.mainTopicTitle,
            summary: moduleSummary.summary,
          });
        } catch (error) {
          console.error(
            `Error processing lesson module ${moduleSummary.moduleID} for file ${docFileID}:`,
            error
          );
        } finally {
          // Remove the module from the loading set regardless of success or error.
          removeLoadingLesson(moduleSummary.moduleID);
        }
      });
    });
  }, [
    lessonModuleLists,
    addConceptMap,
    updateLessonModule,
    updateNodeTitle,
    wrappedSetNodes,
    wrappedSetSubtrees,
    createResource,
    subtrees,
    getRootNode,
    docFileID,
    getExistingLessonModules,
    addLoadingLesson,
    removeLoadingLesson,
  ]);
}
