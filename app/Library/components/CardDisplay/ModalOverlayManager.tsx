// bloom-maps/app/Library/components/CardDisplay/ModalOverlayManager.tsx

import React, { useEffect, useState, useCallback } from 'react';
import Draggable from 'react-draggable';
import ReactDOM from 'react-dom';

/**
 * Props for ModalOverlayManager component.
 */
interface ModalOverlayManagerProps {
  overlayContent: React.ReactNode | null;
  setOverlayContent: (content: React.ReactNode | null) => void;
  openedPictureModals: { id: string; content: React.ReactNode }[];
  handleClosePictureModal: (pictureId: string) => void;
  centerPaneRef: React.RefObject<HTMLDivElement>; // Reference to the center pane
  toolPaneVisible: boolean; // Visibility state of the Tool Pane
}

/**
 * ModalOverlayManager Component
 *
 * Renders draggable modals within the specified bounds.
 * Adjusts bounds based on the visibility of the Tool Pane.
 * Manages z-index to ensure the most recently interacted modal is on top.
 */
const ModalOverlayManager: React.FC<ModalOverlayManagerProps> = ({
  overlayContent,
  setOverlayContent,
  openedPictureModals,
  handleClosePictureModal,
  centerPaneRef,
  toolPaneVisible,
}) => {
  // State to hold draggable bounds
  const [bounds, setBounds] = useState<{
    left: number;
    top: number;
    right: number;
    bottom: number;
  } | null>(null);

  // State to hold base initial position of the modals
  const [baseInitialPosition, setBaseInitialPosition] = useState<{ x: number; y: number } | null>(null);

  // State to manage z-indices of modals
  const [modalZIndices, setModalZIndices] = useState<Record<string, number>>({});
  const [currentMaxZIndex, setCurrentMaxZIndex] = useState<number>(1000); // Starting z-index

  /**
   * Effect to calculate draggable bounds based on Tool Pane visibility.
   * Recalculates whenever toolPaneVisible or centerPaneRef changes.
   */
  useEffect(() => {
    const calculateBounds = () => {
      if (centerPaneRef.current) {
        const centerPaneRect = centerPaneRef.current.getBoundingClientRect();
        const PADDING = 32; // Padding in pixels

        let newBounds;

        if (toolPaneVisible) {
          /**
           * When Tool Pane is visible:
           * Restrict bounds to the center pane's dimensions.
           */
          newBounds = {
            left: centerPaneRect.left + PADDING,
            top: centerPaneRect.top + PADDING,
            right: centerPaneRect.right - PADDING,
            bottom: centerPaneRect.bottom - PADDING,
          };
        } else {
          /**
           * When Tool Pane is hidden:
           * Allow bounds to extend to the right edge of the viewport.
           */
          newBounds = {
            left: centerPaneRect.left + PADDING,
            top: centerPaneRect.top + PADDING,
            right: window.innerWidth - PADDING,
            bottom: centerPaneRect.bottom - PADDING,
          };
        }

        setBounds(newBounds);

        /**
         * Calculate base initial position to center the modal within the new bounds.
         * This will be adjusted for each modal to stagger them.
         */
        const newBaseInitialPosition = {
          x: (newBounds.left + newBounds.right) / 2 - 200, // Adjust offsets based on modal size
          y: (newBounds.top + newBounds.bottom) / 2 - 150,
        };
        setBaseInitialPosition(newBaseInitialPosition);
      }
    };

    // Initial calculation
    calculateBounds();

    // Recalculate bounds on window resize to maintain responsiveness
    window.addEventListener('resize', calculateBounds);
    return () => window.removeEventListener('resize', calculateBounds);
  }, [toolPaneVisible, centerPaneRef]);

  /**
   * Prevents default dragging behavior of images inside the modal.
   * This ensures that dragging the modal isn't interrupted by image drag events.
   *
   * @param e - The drag event on the image.
   */
  const preventImageDrag = useCallback((e: React.DragEvent<HTMLImageElement>) => {
    e.preventDefault();
  }, []);

  /**
   * Brings the specified modal to the front by updating its z-index.
   *
   * @param modalId - The ID of the modal to bring to front.
   */
  const bringToFront = useCallback(
    (modalId: string) => {
      setCurrentMaxZIndex((prevMax) => {
        const newZIndex = prevMax + 1;
        setModalZIndices((prevZIndices) => ({
          ...prevZIndices,
          [modalId]: newZIndex,
        }));
        return newZIndex;
      });
    },
    []
  );

  /**
   * Assigns a z-index to a modal when it's first rendered.
   *
   * @param modalId - The ID of the modal.
   */
  const assignZIndex = useCallback(
    (modalId: string) => {
      setCurrentMaxZIndex((prevMax) => {
        const newZIndex = prevMax + 1;
        setModalZIndices((prevZIndices) => ({
          ...prevZIndices,
          [modalId]: newZIndex,
        }));
        return newZIndex;
      });
    },
    []
  );

  /**
   * Effect to assign z-indices to newly opened picture modals.
   */
  useEffect(() => {
    openedPictureModals.forEach((modal) => {
      if (!modalZIndices[modal.id]) {
        assignZIndex(modal.id);
      }
    });
  }, [openedPictureModals, modalZIndices, assignZIndex]);

  /**
   * Renders the modals using React Portal.
   * Only renders if there is overlay content or open picture modals,
   * and bounds and baseInitialPosition are set.
   */
  const renderModals = () => {
    // If overlayContent is present, prioritize rendering it and hide openedPictureModals
    if (overlayContent) {
      if (!bounds || !baseInitialPosition) return null;

      return ReactDOM.createPortal(
        <>
          {/* Overlay Content Modal */}
          <Draggable
            bounds={bounds}
            defaultPosition={baseInitialPosition}
            onStart={() => {
              // Assign a higher z-index when overlayContent is interacted with
              // Assuming overlayContent has a unique identifier if needed
              // Since overlayContent is singular, we can assign a fixed high z-index
              setModalZIndices((prevZIndices) => ({
                ...prevZIndices,
                overlay: currentMaxZIndex + 1,
              }));
              setCurrentMaxZIndex((prevMax) => prevMax + 1);
            }}
          >
            <div
              className="modal-overlay pointer-events-auto rounded-lg shadow-lg max-w-[70%] w-auto bg-white"
              style={{
                position: 'fixed',
                top: 0, // Start at top-left for correct positioning
                left: 0, // Start at top-left for correct positioning
                cursor: 'move', // Change cursor to indicate draggable area
                zIndex: modalZIndices['overlay'] || currentMaxZIndex + 1,
              }}
            >
              <div onDragStart={preventImageDrag}>{overlayContent}</div>
            </div>
          </Draggable>
        </>,
        document.body // Render modals at the root of the document
      );
    }

    // If no overlayContent, render all openedPictureModals
    if (openedPictureModals.length > 0 && bounds && baseInitialPosition) {
      return ReactDOM.createPortal(
        <>
          {/* Picture Modals */}
          {openedPictureModals.map((modal, index) => {
            // Calculate staggered initial positions
            const OFFSET = 30; // Offset in pixels
            let initialX = baseInitialPosition.x + OFFSET * index;
            let initialY = baseInitialPosition.y + OFFSET * index;

            // Ensure modals stay within bounds
            const maxX = bounds.right - 400; // Assuming modal width is approx 400px
            const maxY = bounds.bottom - 300; // Assuming modal height is approx 300px

            initialX = Math.min(initialX, maxX);
            initialY = Math.min(initialY, maxY);

            return (
              <Draggable
                key={modal.id}
                bounds={bounds}
                defaultPosition={{ x: initialX, y: initialY }}
                onStart={() => bringToFront(modal.id)} // Bring modal to front on interaction
              >
                <div
                  className="modal-overlay pointer-events-auto rounded-lg shadow-lg max-w-[70%] w-auto bg-white"
                  style={{
                    position: 'fixed',
                    top: 0, // Start at top-left for correct positioning
                    left: 0, // Start at top-left for correct positioning
                    cursor: 'move', // Change cursor to indicate draggable area
                    zIndex: modalZIndices[modal.id] || 1000 + index, // Assign z-index
                  }}
                  onClick={() => bringToFront(modal.id)} // Bring modal to front on click
                >
                  <div onDragStart={preventImageDrag}>{modal.content}</div>
                </div>
              </Draggable>
            );
          })}
        </>,
        document.body // Render modals at the root of the document
      );
    }

    return null;
  };

  return <>{renderModals()}</>;
};

export default ModalOverlayManager;
