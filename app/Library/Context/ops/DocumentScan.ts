/**
 * @file app/Library/Context/ops/DocumentScan.ts
 * @description 
 * update - 81: FIXED GLOBAL AGGREGATION PATTERN
 * Refactored to mirror the lessonUnitExtractor pattern. Iterates through 
 * the lessonModule roadmap to aggregate assets across all namespaced maps.
 */

import * as Y from 'yjs';
import { ConceptMap } from '../LessonModuleContext';

export interface NotebookStats {
  lessonCount: number;
  cardCount: number;
  quizCount: number;
}

export function scanDocumentStats(ydoc: Y.Doc): NotebookStats {
  // Counters initialized globally for the entire notebook
  let cardCount = 0;
  let quizCount = 0;

  // 1. Get the Authoritative Roadmap (List of all maps/lessons)
  const lessonModule = ydoc.getMap('lessonModule');
  const conceptMapsYArray = lessonModule.get('conceptMaps') as Y.Array<ConceptMap>;
  const conceptMapList = conceptMapsYArray ? conceptMapsYArray.toArray() : [];
  
  const lessonCount = conceptMapList.length;

  // 2. Iterate through each Lesson in the Notebook (Mirror lessonUnitExtractor pattern)
  conceptMapList.forEach((cm) => {
    // Construct the specific resource namespace for this lesson
    const resourceKey = `resources:${cm.id}`;
    const nodeResourceMap = ydoc.getMap(resourceKey) as Y.Map<Y.Map<any>>;

    // 3. Tally assets within this specific Lesson
    if (nodeResourceMap && typeof nodeResourceMap.forEach === 'function') {
      nodeResourceMap.forEach((resourceMap) => {
        if (resourceMap && typeof resourceMap.forEach === 'function') {
          resourceMap.forEach((card) => {
            // Handle both Yjs Proxy and Plain Object access
            const type = typeof card.get === 'function' ? card.get('type') : card.type;
            
            if (type === 'cueCard') {
              cardCount++;
            } else if (type === 'practiceSheet') {
              quizCount++;
            }
          });
        }
      });
    }
  });

  console.log('DocumentScan.ts [7204] › Global scan complete using roadmap pattern', { 
    lessons: lessonCount, 
    flashcards: cardCount, 
    quizzes: quizCount 
  });
  
  return {
    lessonCount,
    cardCount,
    quizCount,
  };
}