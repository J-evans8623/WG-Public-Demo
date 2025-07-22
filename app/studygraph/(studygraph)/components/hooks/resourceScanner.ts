/***********************************************************************************************
 * @file resourceScanner.ts
 * @description
 *   A React hook for scanning *all* Yjs “resources:${mapId}” maps in the current LessonModule,
 *   extracting cue‑cards (flash‑cards) and practice‑sheets (quizzes) in a flat, two‑phase order.
 *
 * Responsibilities:
 *   • Enumerate active concept‑map IDs via LessonModuleContext.
 *   • For each, grab the outer `resources:${mapId}` map, then iterate each inner Y.Map<ResourceCard>
 *     to collect:
 *       – cueCard → flash‑cards
 *       – practiceSheet → quizzes
 *   • Expose `getAllFlashCards()` and `getAllQuizzes()` for consumers.
 *
 * @author
 * @date
 ***********************************************************************************************/
import * as Y from 'yjs';
import type { ResourceCard } from '@/app/Library/Definitions/Definitions';
import { useYDoc } from '@/app/Library/Context/YDocContext';
import { useLessonModule } from '@/app/Library/Context/LessonModuleContext';


export function useResourceScanner() {
  const { ydoc } = useYDoc();
  const { getLessonModule } = useLessonModule();

  /**
   * Scan every map in lessonModule.conceptMaps and return all cueCard resources.
   */
  const getAllFlashCards = (): ResourceCard[] => {
    console.log('[resourceScanner.ts][0001] › Scanning for all flash‑cards');
    const { conceptMaps } = getLessonModule();
    const flashCards: ResourceCard[] = [];

    conceptMaps.forEach(({ id: mapId }) => {
      const outer = ydoc.getMap<Y.Map<ResourceCard>>(`resources:${mapId}`);
      outer.forEach((inner, nodeId) => {
        inner.forEach(card => {
          if (card.type === 'cueCard') {
            flashCards.push({ ...card, mapId, nodeId });
          }
        });
      });
    });

    console.log(
      '[resourceScanner.ts][0002] › Found flash‑cards count=',
      flashCards.length
    );
    return flashCards;
  };

  /**
   * Scan every map in lessonModule.conceptMaps and return all practiceSheet resources.
   */
  const getAllQuizzes = (): ResourceCard[] => {
    console.log('[resourceScanner.ts][0003] › Scanning for all quizzes');
    const { conceptMaps } = getLessonModule();
    const quizzes: ResourceCard[] = [];

    conceptMaps.forEach(({ id: mapId }) => {
      const outer = ydoc.getMap<Y.Map<ResourceCard>>(`resources:${mapId}`);
      outer.forEach((inner, nodeId) => {
        inner.forEach(card => {
          if (card.type === 'practiceSheet') {
            quizzes.push({ ...card, mapId, nodeId });
          }
        });
      });
    });

    console.log(
      '[resourceScanner.ts][0004] › Found quizzes count=',
      quizzes.length
    );
    return quizzes;
  };

  return { getAllFlashCards, getAllQuizzes };
}
