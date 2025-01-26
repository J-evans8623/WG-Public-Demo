import React, { useState, useCallback, useEffect, memo, forwardRef, useImperativeHandle } from 'react';
import CueCard from './CueCard';
import PictureCard from './PictureCard';
import PracticeSheetCard from './PracticeSheetCard';
import MatchingQuizModal from './MatchingQuizModal';
import ImageCard from '@/app/Library/components/CardDisplay/p1/ImageCard';
import { CueCardResource, IFillInBlankQuestion, IMultipleChoiceQuestion, IQuizQuestion, ITrueFalseQuestion, QuizType, PictureResource, PictureResourceResult } from '@/app/Library/Definitions/Definitions';
import { useResourceContext } from '@/app/Library/Context/ResourceContext';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { scrambleArray } from '@/app/Library/utils/QuizUtils';
import ModalOverlayManager from '@/app/Library/components/CardDisplay/ModalOverlayManager';
import { Descendant } from 'slate';
import FillInBlankQuiz from './quiz/FillInBlankQuiz';
import MultipleChoiceQuiz from './quiz/MultipleChoiceQuiz';
import TrueFalseQuiz from './quiz/TrueFalseQuiz';

const defaultCueCards: CueCardResource[] = [
  {
    title: 'Add a new concept to get started!',
    content: [
      {
        type: 'paragraph',
        children: [{ text: 'Select a concept from the map' }],
      },
    ] as Descendant[],
    type: 'cueCard',
    id: '',
    nodeId: ''
  },
];

interface CueCardDisplayProps {
  centerPaneRef: React.RefObject<HTMLDivElement>;
  toolPaneVisible: boolean;
}

export interface CueCardDisplayRef {
  closeAllModals: () => void;
}

const CueCardDisplay = forwardRef<CueCardDisplayRef, CueCardDisplayProps>(({ centerPaneRef, toolPaneVisible }, ref) => {
  const { getSelectedNodeIds, clearSelection, deselectNode } = useNodeSelection();
  const { selectCueCards, selectPictures, selectPracticeSheets } = useResourceContext();
  const { nodes } = useNodesContext();

  const [dismissedResourceIds, setDismissedResourceIds] = useState<Map<string, string[]>>(new Map());
  const [openedPictureModals, setOpenedPictureModals] = useState<{ id: string; content: React.ReactNode }[]>([]);
  const [overlayContent, setOverlayContent] = useState<React.ReactNode | null>(null);
  const [pictureResults, setPictureResults] = useState<Map<string, PictureResourceResult[]>>(new Map());

  const selectedNodeIds = getSelectedNodeIds();

  useEffect(() => {
    const loadPictures = async () => {
      const newPictureResults = new Map<string, PictureResourceResult[]>();
      
      for (const nodeId of selectedNodeIds) {
        const results = await selectPictures(nodeId);
        newPictureResults.set(nodeId, results);
      }
      
      setPictureResults(newPictureResults);
    };

    loadPictures();
  }, [selectedNodeIds, selectPictures]);

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

  const visiblePictures = Array.from(pictureResults.entries()).flatMap(([nodeId, results]) =>
    results
      .filter((result) => !dismissedResourceIds.get(nodeId)?.includes(result.status === 'ready' ? (result.data as PictureResource).id : ''))
      .map((result) => ({
        ...result,
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
          ...practiceSheets.filter(sheet => sheet.nodeId === nodeId).map((sheet) => sheet.id),
          ...Array.from(pictureResults.get(nodeId) || [])
            .filter(result => result.status === 'ready')
            .map(result => (result.data as PictureResource).id)
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
    [selectCueCards, practiceSheets, pictureResults, deselectNode]
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
    handleCloseOverlay();
  }, []);

  const handleOpenQuizModal = useCallback((
    quizTitle: string, 
    quizQuestions: IQuizQuestion[], 
    quizType: QuizType
  ) => {
    let QuizComponent;
    
    switch (quizType) {
      case 'FIB':
        QuizComponent = (
          <FillInBlankQuiz
            title={quizTitle}
            questions={quizQuestions as IFillInBlankQuestion[]}
            onClose={handleCloseOverlay}
            onComplete={(score) => {
              alert(`Your score: ${score}/${quizQuestions.length}`);
              handleCloseOverlay();
            }}
          />
        );
        break;

      case 'multipleChoice':
        QuizComponent = (
          <MultipleChoiceQuiz
            title={quizTitle}
            questions={quizQuestions as IMultipleChoiceQuestion[]}
            onClose={handleCloseOverlay}
            onComplete={(score) => {
              alert(`Your score: ${score}/${quizQuestions.length}`);
              handleCloseOverlay();
            }}
          />
        );
        break;

      case 'true-false':
        QuizComponent = (
          <TrueFalseQuiz
            title={quizTitle}
            questions={quizQuestions as ITrueFalseQuestion[]}
            onClose={handleCloseOverlay}
            onComplete={(score) => {
              alert(`Your score: ${score}/${quizQuestions.length}`);
              handleCloseOverlay();
            }}
          />
        );
        break;

      case 'matching':
      default:
        QuizComponent = (
          <MatchingQuizModal
            title={quizTitle}
            quiz={quizQuestions}
            scrambledAnswers={scrambleArray(quizQuestions.map((q) => q.correctAnswer)) as string[]}
            onClose={handleCloseOverlay}
          />
        );
    }

    setOverlayContent(QuizComponent);
  }, []);

  const handleCloseOverlay = useCallback(() => {
    setOverlayContent(null);
  }, []);

  const closeAllModals = useCallback(() => {
    setOverlayContent(null);
    setOpenedPictureModals([]);
  }, []);

  useImperativeHandle(ref, () => ({
    closeAllModals,
  }));

  const handleOpenOverlay = useCallback((content: React.ReactNode) => {
    setOverlayContent(content);
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
            closeAllModals();
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
          conceptNodeTitle={cueCard.conceptNodeTitle}
          source={cueCard.source}
          onDismiss={() => handleDismissResource(cueCard.id, cueCard.nodeId)}
        />
      ))}

      {visiblePictures.map((picture) => (
        <PictureCard
          key={picture.status === 'ready' ? (picture.data as PictureResource).id : 'pending'}
          id={picture.status === 'ready' ? (picture.data as PictureResource).id : 'pending'}
          title={picture.status === 'ready' ? (picture.data as PictureResource).title : 'Loading...'}
          pictureResult={picture}
          source={picture.status === 'ready' ? (picture.data as PictureResource).source || '' : ''}
          onOpenFullSize={() => {
            if (picture.status === 'ready') {
              const pictureData = picture.data as PictureResource;
              handleOpenPictureModal(
                pictureData.id,
                <ImageCard
                  title={pictureData.title}
                  description={pictureData.description}
                  image={pictureData.image}
                  onDismiss={() => handleClosePictureModal(pictureData.id)}
                  onMaximize={(content) => handleOpenOverlay(content)}
                  onMinimize={handleCloseOverlay}
                />
              );
            }
          }}
          onDismiss={() => picture.status === 'ready' && 
            handleDismissResource((picture.data as PictureResource).id, picture.nodeId)}
        />
      ))}

      {visiblePracticeSheets.map((practiceSheet) => (
        <PracticeSheetCard
          key={practiceSheet.id}
          id={practiceSheet.id}
          title={practiceSheet.title}
          quizType={practiceSheet.quizType}
          quizQuestions={practiceSheet.quizContent}
          onOpenFullSize={() => handleOpenQuizModal(practiceSheet.title, practiceSheet.quizContent, practiceSheet.quizType)}
          onDismiss={() => handleDismissResource(practiceSheet.id, practiceSheet.nodeId)}
        />
      ))}

      {visibleCueCards.length === 0 && visiblePictures.length === 0 && visiblePracticeSheets.length === 0 &&
        defaultCueCards.map((cueCard) => (
          <CueCard
            key={cueCard.id}
            title={cueCard.title}
            content={cueCard.content}
            conceptNodeTitle="Welcome"
          />
        ))
      }

      <ModalOverlayManager
        overlayContent={overlayContent}
        setOverlayContent={setOverlayContent}
        openedPictureModals={openedPictureModals}
        handleClosePictureModal={handleClosePictureModal}
        centerPaneRef={centerPaneRef}
        toolPaneVisible={toolPaneVisible}
      />
    </div>
  );
});

CueCardDisplay.displayName = 'CueCardDisplay';
export default CueCardDisplay;