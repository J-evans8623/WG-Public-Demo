// CueCardDisplay.tsx
import React, { useState, useCallback, useEffect } from 'react';
import CueCard from './CueCard';
import PictureCard from './PictureCard'; 
import PracticeSheetCard from './PracticeSheetCard'; 
import { CueCard as CueCardInterface } from '@/app/Library/Definitions/Definitions';
import { useCueCardContext } from '../Context/CueCardContext';
import { usePictureContext } from '../Context/PictureContext'; 
import { usePracticeSheetContext } from '../Context/PracticeSheetContext'; 
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import { useDocumentContext } from '@/app/Library/Context/DocumentProvider';
import { Layout } from 'antd';  // Importing the Layout component from antd

const { Sider } = Layout;  // Using Sider for the fixed background layout

/**
 * New implementation
 * //bloom-maps\app\Library\Tests\CueCardDisplay.tsx
 */
const defaultCueCards: CueCardInterface[] = [
  {
    id: 'default',
    title: 'Add a new concept to get started!',
    content: 'Select a concept from the map',
    bloomLevel: 1,
  },
];

const CueCardDisplay = React.memo(() => {
  const { getSelectedNodeIds, clearSelection, deselectNode } = useNodeSelection();
  const { selectCueCards } = useCueCardContext();
  const { selectPictures } = usePictureContext();
  const { selectPracticeSheets } = usePracticeSheetContext();
  const [dismissedResourceIds, setDismissedResourceIds] = useState<Map<string, string[]>>(new Map());
  const [overlayContent, setOverlayContent] = useState<React.ReactNode | null>(null); 
  const { state } = useDocumentContext();
  const { nodes } = state;

  const selectedNodeIds = getSelectedNodeIds();

  // Clean up dismissed resources for nodes no longer selected
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

  // Retrieve cue cards, pictures, and practice sheets associated with selected nodes
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
      conceptNodeTitle: nodes.get(nodeId)?.title || 'Untitled',
      nodeId,
    }))
  );

  // Filter out dismissed resources
  const visibleCueCards = cueCards.filter(
    (cueCard) => !dismissedResourceIds.get(cueCard.nodeId)?.includes(cueCard.id)
  );

  const visiblePictures = pictures.filter(
    (picture) => !dismissedResourceIds.get(picture.nodeId)?.includes(picture.id)
  );

  const visiblePracticeSheets = practiceSheets.filter(
    (practiceSheet) => !dismissedResourceIds.get(practiceSheet.nodeId)?.includes(practiceSheet.id)
  );

  // Handle dismissing a resource
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

  // Handle opening the overlay for full-size view
  const handleOpenOverlay = (content: React.ReactNode) => {
    setOverlayContent(content);
  };

  // Handle closing the overlay
  const handleCloseOverlay = () => {
    setOverlayContent(null);
  };

  return (
    <Sider
      width="100%"  // Full width
      style={{
        backgroundColor: '#f5f5f5',  // Background color
        padding: '16px',  // Padding around the content
        overflowY: 'auto',  // Enable scrolling for long content
        height: '100%',  // Full height to ensure fixed size
        minHeight: '400px',  // Ensure the CueCardDisplay always has a minimum height
      }}
    >
      <div className="flex flex-col space-y-2 pb-8" data-testid="cue-card-display">
        {/* Clear All Button */}
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

        {/* Render Cue Cards */}
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

        {/* Render Picture Cards */}
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

        {/* Render Practice Sheet Cards */}
        {visiblePracticeSheets.map((practiceSheet) => (
          <PracticeSheetCard
            key={practiceSheet.id}
            id={practiceSheet.id}
            title={practiceSheet.title}
            content={practiceSheet.content}
            onOpenFullSize={() =>
              handleOpenOverlay(
                <div>
                  <h2 className="text-xl font-bold mb-2">{practiceSheet.title}</h2>
                  <p className="mb-4">{practiceSheet.content}</p>
                  <button
                    onClick={handleCloseOverlay}
                    className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    Close
                  </button>
                </div>
              )
            }
            onDismiss={() => handleDismissResource(practiceSheet.id, practiceSheet.nodeId)}
          />
        ))}

        {/* Render Default Cue Card if No Resources are Visible */}
        {visibleCueCards.length === 0 && visiblePictures.length === 0 && visiblePracticeSheets.length === 0 && (
          defaultCueCards.map((cueCard) => (
            <CueCard
              key={cueCard.id}
              title={cueCard.title}
              content={cueCard.content}
              bloomLevel={cueCard.bloomLevel || 1}
              conceptNodeTitle="Welcome"
            />
          ))
        )}

        {/* Overlay Window */}
        {overlayContent && (
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none">
            <div className="bg-white p-6 rounded shadow-lg pointer-events-auto max-w-lg w-full">
              {overlayContent}
            </div>
          </div>
        )}
      </div>
    </Sider>
  );
});

export default CueCardDisplay;
