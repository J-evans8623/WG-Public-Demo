/**
 * @file useLessonModuleMapper.ts
 * @description
 *   This hook listens to the lesson module list stored in LessonDataContext.
 *   In the previous implementation, lesson modules were tracked in FileAssetContext.
 *   Now, this hook is updated to:
 *     - Listen to changes in the lesson module list provided by LessonDataContext.
 *     - For each file, if multiple lesson modules are returned (all sharing the same file id),
 *       generate unique ids for each lesson module so that they can be iterated over properly.
 *     - Once all lesson modules have been processed, call clearLessonModuleList to avoid duplication.
 *
 *   This ensures a clean separation of file metadata and lesson data.
 *
 * @author  
 * @date    
 */

import { useEffect, useCallback } from 'react';
import { useLessonData } from '@/app/Library/Context/LessonDataContext';
import { useLessonModule } from '@/app/Library/Context/LessonModuleContext';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import useCardCrudOperations from './useCardCrudOperations';
import { useSubTreeContext } from '@/app/Library/Context/SubTreeProvider';
import { useYDoc } from '@/app/Library/Context/YDocContext';
import { parseConceptMap } from './parseConceptMap';
import { v4 as uuidv4 } from 'uuid';


export function useLessonModuleMapper(): void {
  // Retrieve lesson modules from LessonDataContext.
  const { lessonModuleList, clearLessonModuleList } = useLessonData();
  const {
    updateLessonModule,
    addConceptMap,
    addLoadingLesson,
    removeLoadingLesson,
    setGeneratedLessons,
    setGeneratingLessonStatus
  } = useLessonModule();
  const { updateNodeTitle, setGeneratedNodes, getRootNode } = useNodesContext();
  const { createResource } = useCardCrudOperations();
  const { subtrees, setSubtrees } = useSubTreeContext();
  const { docFileID , updateFileName, getFileName} = useYDoc();

  // Wrap setNodes and setSubtrees to pass additional parameters if needed.
  const wrappedSetNodes = useCallback(
    (nodesMap: Map<string, any>, mapID?: string) => {
      setGeneratedNodes(nodesMap, undefined, mapID);
    },
    [setGeneratedNodes]
  );

  const wrappedSetSubtrees = useCallback(
    (subtreesMap: Map<string, any>, mapID?: string) => {
      setSubtrees(subtreesMap, undefined, mapID);
    },
    [setSubtrees]
  );

  useEffect(() => {
    setGeneratingLessonStatus('generating');
        // Iterate over each lesson module in the LessonDataContext.
    lessonModuleList.forEach(async (lessonModule, fileId) => {
      // Check if lessonModule contains an array of lessonModules.
      if (lessonModule && lessonModule.lessonModules && Array.isArray(lessonModule.lessonModules)) {
        // Iterate over each individual lesson module.
        for (let i = 0; i < lessonModule.lessonModules.length; i++) {
          const singleLessonModule = lessonModule.lessonModules[i];
          console.log(`useLessonModule mapper, here is a single lesson module for reference ${singleLessonModule}`)
          // Generate a unique id by combining the fileId with a UUID.
          const uniqueId = `map-${uuidv4()}`;
          console.log(`[useLessonModuleMapper] Processing lesson module with uniqueId: ${uniqueId}`);
          addLoadingLesson(uniqueId);
          try {
            // Create a new concept map for the individual lesson module. Use notebook title here instead
            const mapTitle =
              singleLessonModule?.main_topic?.title || 'New Lesson Module';
              if (i === 0) {
                const rawCourseTitle = singleLessonModule?.main_topic?.CourseTitle;
                const courseTitle =
                  typeof rawCourseTitle === 'string' && rawCourseTitle.trim().length > 0
                    ? rawCourseTitle.trim()
                    : null;
                const nextName = courseTitle || mapTitle;
                updateFileName(nextName);
              } 
            const newMap = addConceptMap(mapTitle, uniqueId); 
            setGeneratedLessons((prev) => [...prev, uniqueId]);
            // Parse the lesson module using parseConceptMap.
            await parseConceptMap(
              singleLessonModule,
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
            updateLessonModule(uniqueId, {
              topic: singleLessonModule.main_topic.title,
              summary: undefined,
            });
          } catch (error) {
            setGeneratingLessonStatus('error');
            console.error(`Error processing lesson module for id ${uniqueId}:`, error);
          } finally {
            removeLoadingLesson(uniqueId);
            setGeneratingLessonStatus("completed")
          }
        }
      } 
    });

    // Clear the lesson module list to prevent duplication.
    if (lessonModuleList.size > 0) {
      console.log(
        `[useLessonModuleMapper] Clearing lesson module list. Current keys: ${Array.from(
          lessonModuleList.keys()
        )}`
      );
      clearLessonModuleList();
    }
  }, [lessonModuleList, addConceptMap, updateLessonModule, updateNodeTitle, wrappedSetNodes, wrappedSetSubtrees, createResource, subtrees, getRootNode, docFileID, addLoadingLesson, removeLoadingLesson, clearLessonModuleList, getFileName, updateFileName, setGeneratingLessonStatus, setGeneratedLessons]);
}
