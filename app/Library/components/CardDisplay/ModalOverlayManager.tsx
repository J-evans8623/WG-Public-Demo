// bloom-maps/app/Library/components/CardDisplay/ModalOverlayManager.tsx

import React, { useEffect, useState } from 'react';
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

  // State to hold initial position of the modal
  const [initialPosition, setInitialPosition] = useState<{ x: number; y: number } | null>(null);

  /**
   * Effect to calculate draggable bounds based on Tool Pane visibility.
   * Recalculates whenever toolPaneVisible or centerPaneRef changes.
   */
  useEffect(() => {
    const calculateBounds = () => {
      if (centerPaneRef.current) {
        const centerPaneRect = centerPaneRef.current.getBoundingClientRect();
        const PADDING = 32; // Padding in pixels
        const toolpaneWidth = centerPaneRect.width ;

        let newBounds;

        if (toolPaneVisible) {
          /**
           * When Tool Pane is visible:
           * Restrict bounds to the center pane's dimensions.
           */
          newBounds = {
            left: centerPaneRect.left + PADDING,
            top: centerPaneRect.top + PADDING,
            right:  toolpaneWidth - PADDING,
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
         * Calculate initial position to center the modal within the new bounds.
         * Adjust offsets (-200, -150) based on modal's width and height.
         */
        const newInitialPosition = {
          x: (newBounds.left + newBounds.right) / 2 - 200, // Center horizontally
          y: (newBounds.top + newBounds.bottom) / 2 - 150, // Center vertically
        };
        setInitialPosition(newInitialPosition);
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
  const preventImageDrag = (e: React.DragEvent<HTMLImageElement>) => {
    e.preventDefault();
  };

  /**
   * Renders the modals using React Portal.
   * Only renders if there is overlay content or open picture modals,
   * and bounds and initialPosition are set.
   */
  const renderModals = () => {
    if ((!overlayContent && openedPictureModals.length === 0) || !bounds || !initialPosition) {
      return null;
    }

    return ReactDOM.createPortal(
      <>
        {/* Overlay Content Modal */}
        {overlayContent && (
          <Draggable bounds={bounds} defaultPosition={initialPosition}>
            <div
              className="modal-overlay fixed z-[9999] pointer-events-auto rounded-lg shadow-lg max-w-[70%] w-auto bg-white"
              style={{
                position: 'fixed',
                top: 0, // Start at top-left for correct positioning
                left: 0, // Start at top-left for correct positioning
                cursor: 'move', // Change cursor to indicate draggable area
              }}
            >
              <div onDragStart={preventImageDrag}>{overlayContent}</div>
            </div>
          </Draggable>
        )}

        {/* Picture Modals */}
        {openedPictureModals.map((modal) => (
          <Draggable key={modal.id} bounds={bounds} defaultPosition={initialPosition}>
            <div
              className="modal-overlay fixed z-[9999] pointer-events-auto rounded-lg shadow-lg max-w-[70%] w-auto bg-white"
              style={{
                position: 'fixed',
                top: 0, // Start at top-left for correct positioning
                left: 0, // Start at top-left for correct positioning
                cursor: 'move', // Change cursor to indicate draggable area
              }}
            >
              <div onDragStart={preventImageDrag}>{modal.content}</div>
            </div>
          </Draggable>
        ))}
      </>,
      document.body // Render modals at the root of the document
    );
  };

  return <>{renderModals()}</>;
};

export default ModalOverlayManager;
