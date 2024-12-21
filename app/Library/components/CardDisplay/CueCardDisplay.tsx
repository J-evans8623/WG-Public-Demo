// bloom-maps/app/Library/components/CardDisplay/CueCardDisplay.tsx

import React, { useState, useCallback, useEffect, memo, forwardRef, useImperativeHandle } from 'react';
import CueCard from './CueCard';
import PictureCard from './PictureCard';
import PracticeSheetCard from './PracticeSheetCard';
import MatchingQuizModal from './MatchingQuizModal';
import ImageCard from '@/app/Library/components/CardDisplay/p1/ImageCard'; // Import the new ImageCard component
import { CueCardResource  } from '@/app/Library/Definitions/Definitions';
import { useResourceContext } from '../../Context/ResourceContext'; 
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';

// Import new context
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { parseQuizContent, scrambleArray } from '@/app/Library/utils/QuizUtils';
import ModalOverlayManager from '@/app/Library/components/CardDisplay/ModalOverlayManager';
import { Descendant } from 'slate';

/**
 * Default Cue Cards to display when no resources are visible.
 */
const defaultCueCards: CueCardResource [] = [
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


/**
 * Props for CueCardDisplay component.
 */
interface CueCardDisplayProps {
  centerPaneRef: React.RefObject<HTMLDivElement>;
  toolPaneVisible: boolean; // Prop to indicate Tool Pane visibility
}

/**
 * Interface for imperative methods exposed via ref.
 */
export interface CueCardDisplayRef {
  closeAllModals: () => void;
}

/**
 * CueCardDisplay Component
 *
 * Displays cue cards, picture cards, and practice sheet cards.
 * Manages modals for images and quizzes.
 */
const CueCardDisplay = forwardRef<CueCardDisplayRef, CueCardDisplayProps>(({ centerPaneRef, toolPaneVisible }, ref) => {
  const { getSelectedNodeIds, clearSelection, deselectNode } = useNodeSelection();
  const { selectCueCards, selectPictures, selectPracticeSheets } = useResourceContext();

  const [dismissedResourceIds, setDismissedResourceIds] = useState<Map<string, string[]>>(new Map());
  const [openedPictureModals, setOpenedPictureModals] = useState<{ id: string; content: React.ReactNode }[]>([]);
  const [overlayContent, setOverlayContent] = useState<React.ReactNode | null>(null);
  
  // Use new context for nodes
  const { nodes } = useNodesContext();

  const selectedNodeIds = getSelectedNodeIds();

  /**
   * Effect to remove dismissed resources when node selection changes.
   */
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

  /**
   * Aggregates all cue cards from selected nodes.
   */
  const cueCards = selectedNodeIds.flatMap((nodeId) =>
    selectCueCards(nodeId).map((cueCard) => ({
      ...cueCard,
      conceptNodeTitle: nodes.get(nodeId)?.title || 'Untitled',
      nodeId,
    }))
  );

  /**
   * Aggregates all picture cards from selected nodes.
   */
  const pictures = selectedNodeIds.flatMap((nodeId) =>
    selectPictures(nodeId).map((picture) => ({
      ...picture,
      conceptNodeTitle: nodes.get(nodeId)?.title || 'Untitled',
      nodeId,
    }))
  );

  /**
   * Aggregates all practice sheet cards from selected nodes.
   */
  const practiceSheets = selectedNodeIds.flatMap((nodeId) =>
    selectPracticeSheets(nodeId).map((practiceSheet) => ({
      ...practiceSheet,
      quizType: practiceSheet.content.quizType,
      quizContent: practiceSheet.content.quizContent,
      conceptNodeTitle: nodes.get(nodeId)?.title || 'Untitled',
      nodeId,
    }))
  );

  /**
   * Filters visible cue cards based on dismissed resources.
   */
  const visibleCueCards = cueCards.filter(
    (cueCard) => !dismissedResourceIds.get(cueCard.nodeId)?.includes(cueCard.id)
  );

  /**
   * Filters visible picture cards based on dismissed resources.
   */
  const visiblePictures = pictures.filter(
    (picture) => !dismissedResourceIds.get(picture.nodeId)?.includes(picture.id)
  );

  /**
   * Filters visible practice sheet cards based on dismissed resources.
   */
  const visiblePracticeSheets = practiceSheets.filter(
    (practiceSheet) => !dismissedResourceIds.get(practiceSheet.nodeId)?.includes(practiceSheet.id)
  );

  /**
   * Handles dismissal of a resource card.
   *
   * @param resourceId - The ID of the resource to dismiss.
   * @param nodeId - The ID of the node to which the resource belongs.
   */
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

  /**
   * Opens a picture modal with the provided content.
   *
   * @param pictureId - The ID of the picture.
   * @param content - The React node to display in the modal.
   */
  const handleOpenPictureModal = useCallback((pictureId: string, content: React.ReactNode) => {
    setOpenedPictureModals((prevModals) => {
      const isAlreadyOpened = prevModals.some((modal) => modal.id === pictureId);
      if (!isAlreadyOpened) {
        return [...prevModals, { id: pictureId, content }];
      }
      return prevModals;
    });
  }, []);

  /**
   * Closes a specific picture modal.
   *
   * @param pictureId - The ID of the picture modal to close.
   */
  const handleClosePictureModal = useCallback((pictureId: string) => {
    setOpenedPictureModals((prevModals) => prevModals.filter((modal) => modal.id !== pictureId));
    handleCloseOverlay();
  }, []);

  /**
   * Opens a quiz modal with the provided quiz content and title.
   *
   * @param quizTitle - The title of the quiz.
   * @param quizContent - The raw quiz content string.
   */
  const handleOpenQuizModal = useCallback((quizTitle: string, quizContent: string) => {
    const parsedQuiz = parseQuizContent(quizContent);
    const scrambledAnswers = scrambleArray(parsedQuiz.map((q) => q.answer));
    setOverlayContent(
      <MatchingQuizModal
        title={quizTitle} // Pass the quiz title
        quiz={parsedQuiz}
        scrambledAnswers={scrambledAnswers}
        onClose={handleCloseOverlay}
      />
    );
  }, []);

  /**
   * Closes the overlay content modal.
   */
  const handleCloseOverlay = useCallback(() => {
    setOverlayContent(null);
  }, []);

  /**
   * Function to close all overlay modals.
   * Resets both overlayContent and openedPictureModals.
   */
  const closeAllModals = useCallback(() => {
    setOverlayContent(null);
    setOpenedPictureModals([]);
  }, []);

  /**
   * Expose the closeAllModals function to parent via ref.
   */
  useImperativeHandle(ref, () => ({
    closeAllModals,
  }));

  /**
   * Handler to enter focus mode by setting overlayContent.
   * This will render only the focused modal and hide others.
   *
   * @param content - The React node to set as the overlay content.
   */
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
      {/* Clear All Button */}
      <div className="flex justify-end">
        <button
          onClick={() => {
            clearSelection();
            setDismissedResourceIds(new Map());
            closeAllModals(); // Also close all modals when clearing
          }}
          className="px-2 py-1 bg-gray-300 rounded hover:bg-gray-400 text-sm"
        >
          Clear All
        </button>
      </div>

      {/* Render Cue Cards */}
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

      {/* Render Picture Cards */}
      {visiblePictures.map((picture) => (
        <PictureCard
          key={picture.id}
          id={picture.id}
          title={picture.title}
          image={picture.image}
          onOpenFullSize={() =>
            handleOpenPictureModal(picture.id, (
              <ImageCard
                title={picture.title}
                description={picture.description} // Assuming description is part of picture object
                image={picture.image}
                onDismiss={() => handleClosePictureModal(picture.id)}
                onMaximize={(content) => handleOpenOverlay(content)} // New prop for maximizing
                onMinimize={handleCloseOverlay} // New prop for minimizing
              />
            ))
          }
          onDismiss={() => handleDismissResource(picture.id, picture.nodeId)}
        />
      ))}

      {/* Render Practice Sheet Cards */}
      {visiblePracticeSheets.map((practiceSheet) => (
        <PracticeSheetCard
          key={practiceSheet.id}
          id={practiceSheet.id}
          title={practiceSheet.title}
          quizType={practiceSheet.quizType}
          quizContent={practiceSheet.quizContent}
          onOpenFullSize={() => handleOpenQuizModal(practiceSheet.title, practiceSheet.quizContent)} // Pass title
          onDismiss={() => handleDismissResource(practiceSheet.id, practiceSheet.nodeId)}
        />
      ))}

      {/* Render Default Cue Cards if No Resources are Visible */}
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

      {/* Render ModalOverlayManager with Updated Props */}
      <ModalOverlayManager
        overlayContent={overlayContent}
        setOverlayContent={setOverlayContent}
        openedPictureModals={openedPictureModals}
        handleClosePictureModal={handleClosePictureModal}
        centerPaneRef={centerPaneRef} // Pass centerPaneRef to manage bounds relative to center pane
        toolPaneVisible={toolPaneVisible} // Pass Tool Pane visibility to adjust draggable bounds
      />
    </div>
  );
});

CueCardDisplay.displayName = 'CueCardDisplay';
export default CueCardDisplay;
