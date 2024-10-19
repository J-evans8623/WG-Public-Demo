// Oct 13, 2024


import React, { useState, useCallback, useEffect } from 'react';
import CueCard from './CueCard';
import PictureCard from './PictureCard'; 
import PracticeSheetCard from './PracticeSheetCard';
import MatchingQuizModal from './MatchingQuizModal';  // Import the matching quiz modal
import { CueCard as CueCardInterface } from '@/app/Library/Definitions/Definitions';
import { useCueCardContext } from '../Context/CueCardContext';
import { usePictureContext } from '../Context/PictureContext'; 
import { usePracticeSheetContext } from '../Context/PracticeSheetContext'; 
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import { useDocumentContext } from '@/app/Library/Context/DocumentProvider';
import { Layout } from 'antd';
import { parseQuizContent, scrambleArray } from '@/app/Library/utils/QuizUtils';
import Draggable, { DraggableProps } from 'react-draggable';

const { Sider } = Layout;

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
  paneSizes: number[];
}

const CueCardDisplay: React.FC<CueCardDisplayProps> = React.memo(({ centerPaneRef, paneSizes }) => {
  const { getSelectedNodeIds, clearSelection, deselectNode } = useNodeSelection();
  const { selectCueCards } = useCueCardContext();
  const { selectPictures } = usePictureContext();
  const { selectPracticeSheets } = usePracticeSheetContext();
  const [dismissedResourceIds, setDismissedResourceIds] = useState<Map<string, string[]>>(new Map());
  const [overlayContent, setOverlayContent] = useState<React.ReactNode | null>(null); 
  const { state } = useDocumentContext();
  const { nodes } = state;

  const selectedNodeIds = getSelectedNodeIds();
  
  const [isCenterPaneReady, setIsCenterPaneReady] = useState<boolean>(false);
  const [bounds, setBounds] = useState<DraggableProps['bounds']>();
  const [initialPosition, setInitialPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);

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

  const handleOpenQuizModal = (quizContent: string) => {
    const parsedQuiz = parseQuizContent(quizContent);
    const scrambledAnswers = scrambleArray(parsedQuiz.map((q) => q.answer));
    setOverlayContent(
      <MatchingQuizModal
        quiz={parsedQuiz}
        scrambledAnswers={scrambledAnswers}
        onClose={handleCloseOverlay}
      />
    );
  };

  const handleOpenOverlay = (content: React.ReactNode) => {
    setOverlayContent(content);
  };

  const handleCloseOverlay = () => {
    setOverlayContent(null);
  };

  // Dynamically update bounds based on pane sizes and window size
  useEffect(() => {
    const updateBounds = () => {
      if (centerPaneRef && centerPaneRef.current) {
        const centerPaneRect = centerPaneRef.current.getBoundingClientRect();

        // Calculate the left bound as the width of the left pane
        const leftPaneWidth = (window.innerWidth * paneSizes[0]) / 100; // Convert left pane size to pixels

        setBounds({
          left: leftPaneWidth, // Account for the width of the left pane
          top: 0,
          right: centerPaneRect.width,
          bottom: centerPaneRect.height / 2, // Use half of the height for the bottom bound
        });

        // Set the initial position to start within the center pane
        setInitialPosition({
          x: leftPaneWidth + 50, // Start 50px from the left bound
          y: centerPaneRect.height / 4, // Start at a quarter of the height
        });

        setIsCenterPaneReady(true);
      } else {
        setIsCenterPaneReady(false);
      }
    };

    // Update bounds on window resize and pane size changes
    window.addEventListener('resize', updateBounds);
    updateBounds(); // Initial call

    return () => {
      window.removeEventListener('resize', updateBounds); // Cleanup listener on unmount
    };
  }, [centerPaneRef, paneSizes, window.innerHeight, window.innerWidth]);

  // Disable background scrolling when dragging starts
  const handleStart = () => {
    setIsDragging(true);
    if (centerPaneRef.current) {
      centerPaneRef.current.style.overflow = 'hidden'; // Disable scroll
    }
  };

  // Re-enable scrolling when dragging stops
  const handleStop = () => {
    setIsDragging(false);
    if (centerPaneRef.current) {
      centerPaneRef.current.style.overflow = 'auto'; // Enable scroll
    }
  };

  // Prevent default dragging behavior of images inside the modal
  const preventImageDrag = (e: React.DragEvent<HTMLImageElement>) => {
    e.preventDefault();
  };

  return (
    <Sider
      width="100%"
      style={{
        backgroundColor: '#F9FBFD',
        padding: '16px',
        overflowY: 'auto',
        height: '100%',
        minHeight: '400px',
      }}
    >
      <div className="flex flex-col space-y-2 pb-8" data-testid="cue-card-display">
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
              handleOpenOverlay(
                <div>
                  <h2 className="text-xl font-bold mb-2">{picture.title}</h2>
                  {picture.image && (
                    <img
                      src={URL.createObjectURL(picture.image)}
                      alt={picture.title}
                      className="max-w-full h-auto mb-4"
                      onDragStart={preventImageDrag} // Prevent image drag behavior
                    />
                  )}
                  <button
                    onClick={handleCloseOverlay}
                    className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    Close
                  </button>
                </div>
              )
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

        {isCenterPaneReady && overlayContent && bounds && (
          <Draggable 
            bounds={bounds} 
            defaultPosition={initialPosition} 
            onStart={handleStart} 
            onStop={handleStop}
          >
            <div className="fixed z-[9999] pointer-events-auto bg-white p-6 shadow-lg rounded-lg max-w-[70%] w-auto">
              <div>{overlayContent}</div>
            </div>
          </Draggable>
        )}
      </div>
    </Sider>
  );
});

CueCardDisplay.displayName = 'CueCardDisplay';
export default CueCardDisplay;
