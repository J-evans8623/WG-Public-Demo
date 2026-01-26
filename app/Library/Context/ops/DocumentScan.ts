/**
 * @file app/Library/Context/ops/DocumentScan.ts
 * @description 
 * This utility provides a high-efficiency scanner for WiseGraph's collaborative Y.Doc. 
 * Its primary responsibility is to calculate the "Information Density" of a notebook 
 * by traversing the Yjs shared types. It counts the total number of lessons defined 
 * in the LessonModule and aggregates all resources (Cue Cards and Quiz Assessments) 
 * across every concept map namespace (keys starting with "resources:"). This logic 
 * is decoupled from the React lifecycle to allow for pure, high-speed computation 
 * during the save process. By providing a single point of truth for asset counting, 
 * it ensures that the Firestore metadata and subsequent Dynamic OG images are 
 * always synchronized with the user's actual content.
 */

import * as Y from 'yjs';

export interface NotebookStats {
  lessonCount: number;
  cardCount: number;
  quizCount: number;
}

/**
 * @function scanDocumentStats
 * @description 
 * Performs a global scan of the provided Y.Doc to aggregate content metrics.
 * It iterates over the 'lessonModule' for lesson counts and loops through 
 * all 'resources:' namespaces to totalize cards and quizzes.
 * @param {Y.Doc} ydoc - The live Yjs document instance to scan.
 * @returns {NotebookStats} - An object containing the aggregated totals.
 */
export function scanDocumentStats(ydoc: Y.Doc): NotebookStats {
  let lessonCount = 0;
  let cardCount = 0;
  let quizCount = 0;

  // 1. Calculate Lesson Count from the LessonModule shared type
  const lessonModule = ydoc.getMap('lessonModule');
  const conceptMaps = lessonModule.get('conceptMaps') as Y.Array<any>;
  lessonCount = conceptMaps ? conceptMaps.length : 0;

  // 2. Aggregate Resources across all map-specific namespaces
  // We iterate through the top-level 'share' map of the Y.Doc
  ydoc.share.forEach((abstractType, key) => {
    // Only process keys that house resource maps (e.g., resources:map-1, resources:map-2)
    if (key.startsWith('resources:')) {
      const nodeResourceMap = abstractType as unknown as Y.Map<Y.Map<any>>;
      
      // Navigate: Concept Map -> Node ID -> Resource Card
      nodeResourceMap.forEach((resourceMap) => {
        resourceMap.forEach((card) => {
          // Identify resource type based on established WiseGraph Definitions
          if (card.type === 'cueCard') {
            cardCount++;
          } else if (card.type === 'quizAssessment') {
            quizCount++;
          }
        });
      });
    }
  });

  console.log('DocumentScan.ts [7201] › Scan complete', { lessonCount, cardCount, quizCount });
  
  return {
    lessonCount,
    cardCount,
    quizCount,
  };
}