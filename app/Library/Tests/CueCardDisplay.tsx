import React, { useState, useCallback, useEffect } from 'react';
import CueCard from '@/app/Library/components/CueCard';
import { CueCard as CueCardInterface } from '@/app/Library/Definitions/Definitions';
import { useCueCardContext } from '../Context/CueCardContext';
import { usePictureContext } from '../Context/PictureContext'; // Import PictureContext
import { usePracticeSheetContext } from '../Context/PracticeSheetContext'; // Import PracticeSheetContext
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import { useDocumentContext } from '@/app/Library/Context/DocumentProvider';

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
  const { selectPictures } = usePictureContext(); // Retrieve pictures
  const { selectPracticeSheets } = usePracticeSheetContext(); // Retrieve practice sheets
  const [dismissedCueCardIds, setDismissedCueCardIds] = useState<Map<string, string[]>>(new Map());
  const [overlayContent, setOverlayContent] = useState<React.ReactNode | null>(null); // New state for displaying the overlay
  const { state } = useDocumentContext();
  const { nodes } = state;

  const selectedNodeIds = getSelectedNodeIds();

  // Clean up dismissed resources for nodes that are no longer selected
  useEffect(() => {
    setDismissedCueCardIds((prev) => {
      const newMap = new Map(prev);
  
      // Convert prev.keys() to an array to avoid iteration issues
      const prevKeysArray = Array.from(prev.keys());
  
      for (const nodeId of prevKeysArray) {
        if (!selectedNodeIds.includes(nodeId)) {
          newMap.delete(nodeId);
        }
      }
      return newMap;
    });
  }, [selectedNodeIds]);

  // Retrieve cue cards, pictures, and practice sheets associated with the selected node IDs
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

  // Filter out dismissed resources (cue cards, pictures, practice sheets)
  const visibleResources = [
    ...cueCards,
    ...pictures,
    ...practiceSheets,
  ].filter(
    (resource) => !dismissedCueCardIds.get(resource.nodeId)?.includes(resource.id)
  );

  // Handle dismissing a card
  const handleDismissResource = useCallback(
    (resourceId: string, nodeId: string) => {
      setDismissedCueCardIds((prev) => {
        const newMap = new Map(prev);
        const dismissedForNode = newMap.get(nodeId) || [];
        newMap.set(nodeId, [...dismissedForNode, resourceId]);

        const allResourcesForNode = [
          ...selectCueCards(nodeId).map((card) => card.id),
          ...selectPictures(nodeId).map((pic) => pic.id),
          ...selectPracticeSheets(nodeId).map((sheet) => sheet.id),
        ];

        const allDismissedForNode = allResourcesForNode.every((id) =>
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

  // Handle opening the overlay window for pictures and practice sheets
  const handleOpenOverlay = (content: React.ReactNode) => {
    setOverlayContent(content);
  };

  // Handle closing the overlay window
  const handleCloseOverlay = () => {
    setOverlayContent(null);
  };

  return (
    <div className="flex flex-col space-y-2 pb-8" data-testid="cue-card-display">
      {/* Clear All Button */}
      <div className="flex justify-end">
        <button
          onClick={() => {
            clearSelection();
            setDismissedCueCardIds(new Map());
          }}
          className="px-2 py-1 bg-gray-300 rounded hover:bg-gray-400 text-sm"
        >
          Clear All
        </button>
      </div>

      {visibleResources.length > 0 ? (
        visibleResources.map((resource) => {
          if ('content' in resource) {
            // This is a CueCard
            return (
              <CueCard
                key={resource.id}
                title={resource.title}
                content={resource.content}
                bloomLevel={resource.bloomLevel || 1}
                conceptNodeTitle={resource.conceptNodeTitle}
                onDismiss={() => handleDismissResource(resource.id, resource.nodeId)}
                source={resource.source}
              />
            );
          } else if ('image' in resource) {
            // This is a Picture
            return (
              <div
                key={resource.id}
                className="bg-gray-200 p-4 border rounded shadow-sm cursor-pointer"
                onClick={() =>
                  handleOpenOverlay(
                    <div>
                      <h2>{resource.title}</h2>
                      <img src={URL.createObjectURL(resource.image)} alt={resource.title} />
                      <p>{resource.description}</p>
                      <button onClick={handleCloseOverlay}>Close</button>
                    </div>
                  )
                }
              >
                <p>{resource.title}</p>
              </div>
            );
          } else {
            // This is a PracticeSheet
            return (
              <div
                key={resource.id}
                className="bg-gray-200 p-4 border rounded shadow-sm cursor-pointer"
                onClick={() =>
                  handleOpenOverlay(
                    <div>
                      <h2>{resource.title}</h2>
                      <p>{resource.content}</p>
                      <button onClick={handleCloseOverlay}>Close</button>
                    </div>
                  )
                }
              >
                <p>{resource.title}</p>
              </div>
            );
          }
        })
      ) : (
        // Display a default message if no resources are selected
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-4 rounded shadow-lg">{overlayContent}</div>
        </div>
      )}
    </div>
  );
});

export default CueCardDisplay;
