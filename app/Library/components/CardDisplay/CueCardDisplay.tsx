//bloom-maps\app\Library\components\CardDisplay\CueCardDisplay.tsx
import React, { useState, useCallback, useEffect, memo } from 'react';
import CueCard from '@/app/Library/components/CueCard';
import PictureCard from '@/app/Library/components/PictureCard';
import PracticeSheetCard from '@/app/Library/components/PracticeSheetCard';
import MatchingQuizModal from '@/app/Library/components/MatchingQuizModal';
import { CueCard as CueCardInterface } from '@/app/Library/Definitions/Definitions';
import { useResourceContext } from '../../Context/ResourceContext'; 
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';

// Import new context
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { parseQuizContent, scrambleArray } from '@/app/Library/utils/QuizUtils';
import ModalOverlayManager from '@/app/Library/components/CardDisplay/ModalOverlayManager';


const defaultCueCards: CueCardInterface[] = [
  {
    id: 'default',
    title: 'Add a new concept to get started!',
    content: 'Select a concept from the map',
    bloomLevel: 1,
  },
];

interface CueCardDisplayProps {
  centerPaneRef: React.RefObject<HTMLDivElement>;

}

const CueCardDisplay: React.FC<CueCardDisplayProps> = memo(({ centerPaneRef }) => {
  const { getSelectedNodeIds, clearSelection, deselectNode } = useNodeSelection();
  const { selectCueCards, selectPictures, selectPracticeSheets } = useResourceContext();

  const [dismissedResourceIds, setDismissedResourceIds] = useState<Map<string, string[]>>(new Map());
  const [openedPictureModals, setOpenedPictureModals] = useState<{ id: string; content: React.ReactNode }[]>([]);
  const [overlayContent, setOverlayContent] = useState<React.ReactNode | null>(null);
  
  // Use new context for nodes
  const { nodes } = useNodesContext();

  const selectedNodeIds = getSelectedNodeIds();

  useEffect(() => {
    setDismissedResourceIds((prev) => {
      const newMap = new Map(prev);
      const prevKeysArray = Array.from(prev.keys());
      for (const nodeId of prevKeysArray) {
        if (!selectedNodeIds.includes(nodeId)) {
          newMap.delete(nodeId);
        }
      }
      return newMap;
    });
  }, [selectedNodeIds]);

  const cueCards = selectedNodeIds.flatMap((nodeId) =>
    selectCueCards(nodeId).map((cueCard) => ({
      ...cueCard,
      conceptNodeTitle: nodes.get(nodeId)?.title || 'Untitled',
      nodeId,
    }))
  );

  const pictures = selectedNodeIds.flatMap((nodeId) =>
    selectPictures(nodeId).map((picture) => ({
      ...picture,
      conceptNodeTitle: nodes.get(nodeId)?.title || 'Untitled',
      nodeId,
    }))
  );

  const practiceSheets = selectedNodeIds.flatMap((nodeId) =>
    selectPracticeSheets(nodeId).map((practiceSheet) => ({
      ...practiceSheet,
      quizType: practiceSheet.content.quizType,
      quizContent: practiceSheet.content.quizContent,
      conceptNodeTitle: nodes.get(nodeId)?.title || 'Untitled',
      nodeId,
    }))
  );

  const visibleCueCards = cueCards.filter(
    (cueCard) => !dismissedResourceIds.get(cueCard.nodeId)?.includes(cueCard.id)
  );

  const visiblePictures = pictures.filter(
    (picture) => !dismissedResourceIds.get(picture.nodeId)?.includes(picture.id)
  );

  const visiblePracticeSheets = practiceSheets.filter(
    (practiceSheet) => !dismissedResourceIds.get(practiceSheet.nodeId)?.includes(practiceSheet.id)
  );

  const handleDismissResource = useCallback(
    (resourceId: string, nodeId: string) => {
      setDismissedResourceIds((prev) => {
        const newMap = new Map(prev);
        const dismissedForNode = newMap.get(nodeId) || [];
        newMap.set(nodeId, [...dismissedForNode, resourceId]);

        const allResourceIdsForNode = [
          ...selectCueCards(nodeId).map((card) => card.id),
          ...selectPictures(nodeId).map((pic) => pic.id),
          ...selectPracticeSheets(nodeId).map((sheet) => sheet.id),
        ];

        const allDismissedForNode = allResourceIdsForNode.every((id) =>
          newMap.get(nodeId)?.includes(id)
        );

        if (allDismissedForNode) {
          deselectNode(nodeId);
          newMap.delete(nodeId);
        }

        return newMap;
      });
    },
    [selectCueCards, selectPictures, selectPracticeSheets, deselectNode]
  );

  const handleOpenPictureModal = useCallback((pictureId: string, content: React.ReactNode) => {
    setOpenedPictureModals((prevModals) => {
      const isAlreadyOpened = prevModals.some((modal) => modal.id === pictureId);
      if (!isAlreadyOpened) {
        return [...prevModals, { id: pictureId, content }];
      }
      return prevModals;
    });
  }, []);

  const handleClosePictureModal = useCallback((pictureId: string) => {
    setOpenedPictureModals((prevModals) => prevModals.filter((modal) => modal.id !== pictureId));
  }, []);

  const handleOpenQuizModal = useCallback((quizContent: string) => {
    const parsedQuiz = parseQuizContent(quizContent);
    const scrambledAnswers = scrambleArray(parsedQuiz.map((q) => q.answer));
    setOverlayContent(
      <MatchingQuizModal
        quiz={parsedQuiz}
        scrambledAnswers={scrambledAnswers}
        onClose={handleCloseOverlay}
      />
    );
  }, []);

  const handleCloseOverlay = useCallback(() => {
    setOverlayContent(null);
  }, []);

  return (
    <div
      className="flex flex-col space-y-2 pb-8"
      style={{
        backgroundColor: '#F9FBFD',
        padding: '0px',
        overflowY: 'auto',
        height: '100%',
        minHeight: '400px',
      }}
      data-testid="cue-card-display"
    >
      <div className="flex justify-end">
        <button
          onClick={() => {
            clearSelection();
            setDismissedResourceIds(new Map());
          }}
          className="px-2 py-1 bg-gray-300 rounded hover:bg-gray-400 text-sm"
        >
          Clear All
        </button>
      </div>

      {visibleCueCards.map((cueCard) => (
        <CueCard
          key={cueCard.id}
          title={cueCard.title}
          content={cueCard.content}
          bloomLevel={cueCard.bloomLevel || 1}
          conceptNodeTitle={cueCard.conceptNodeTitle}
          onDismiss={() => handleDismissResource(cueCard.id, cueCard.nodeId)}
        />
      ))}

      {visiblePictures.map((picture) => (
        <PictureCard
          key={picture.id}
          id={picture.id}
          title={picture.title}
          image={picture.image}
          onOpenFullSize={() =>
            handleOpenPictureModal(picture.id, (
              <div>
                <h2 className="text-xl font-bold mb-2">{picture.title}</h2>
                {picture.image && (
                  <img
                    src={URL.createObjectURL(picture.image)}
                    alt={picture.title}
                    className="max-w-full h-auto mb-4"
                  />
                )}
                <button
                  onClick={() => handleClosePictureModal(picture.id)}
                  className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Close
                </button>
              </div>
            ))
          }
          onDismiss={() => handleDismissResource(picture.id, picture.nodeId)}
        />
      ))}

      {visiblePracticeSheets.map((practiceSheet) => (
        <PracticeSheetCard
          key={practiceSheet.id}
          id={practiceSheet.id}
          title={practiceSheet.title}
          quizType={practiceSheet.quizType}
          quizContent={practiceSheet.quizContent}
          onOpenFullSize={() => handleOpenQuizModal(practiceSheet.quizContent)}
          onDismiss={() => handleDismissResource(practiceSheet.id, practiceSheet.nodeId)}
        />
      ))}

      {visibleCueCards.length === 0 && visiblePictures.length === 0 && visiblePracticeSheets.length === 0 &&
        defaultCueCards.map((cueCard) => (
          <CueCard
            key={cueCard.id}
            title={cueCard.title}
            content={cueCard.content}
            bloomLevel={cueCard.bloomLevel || 1}
            conceptNodeTitle="Welcome"
          />
        ))
      }

      {/* Render modal overlay using ModalOverlayManager */}
      <ModalOverlayManager
        centerPaneRef={centerPaneRef}
        overlayContent={overlayContent}
        setOverlayContent={setOverlayContent}
        openedPictureModals={openedPictureModals}
        handleClosePictureModal={handleClosePictureModal}
      />
    </div>
  );
});

CueCardDisplay.displayName = 'CueCardDisplay';
export default CueCardDisplay;
