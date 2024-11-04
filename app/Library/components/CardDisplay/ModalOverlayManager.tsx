// bloom-maps/app/Library/components/CardDisplay/ModalOverlayManager.tsx

import React, { useState, useEffect } from 'react';
import Draggable, { DraggableProps } from 'react-draggable';
import { calculateDraggableBounds, calculateInitialPosition } from './draggleBounds'; // Adjust the path as needed

interface ModalOverlayManagerProps {
  centerPaneRef: React.RefObject<HTMLDivElement>;
  overlayContent: React.ReactNode | null;
  setOverlayContent: (content: React.ReactNode | null) => void;
  openedPictureModals: { id: string; content: React.ReactNode }[]; // Track opened picture modals
  handleClosePictureModal: (pictureId: string) => void;
}

const ModalOverlayManager: React.FC<ModalOverlayManagerProps> = ({
  centerPaneRef,
  overlayContent,
  setOverlayContent,
  openedPictureModals,
  handleClosePictureModal,
}) => {
  const [isCenterPaneReady, setIsCenterPaneReady] = useState<boolean>(false);
  const [bounds, setBounds] = useState<DraggableProps['bounds']>();
  const [initialPosition, setInitialPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Define fixed left pane width
  const LEFT_PANE_WIDTH = 336; // in pixels

  // Define padding to prevent overlap with edges
  const PADDING = 32; // in pixels

  // Dynamically update bounds based on pane sizes and window size
  useEffect(() => {
    const updateBounds = () => {
      if (centerPaneRef && centerPaneRef.current) {
        const centerPaneRect = centerPaneRef.current.getBoundingClientRect();

        // Calculate new bounds with padding
        const newBounds = calculateDraggableBounds(centerPaneRect, LEFT_PANE_WIDTH, 200, 0.5, PADDING);
        setBounds(newBounds);

        // Calculate new initial position with padding
        const newInitialPosition = calculateInitialPosition(centerPaneRect, LEFT_PANE_WIDTH, 50, 0.25, PADDING);
        setInitialPosition(newInitialPosition);

        setIsCenterPaneReady(true);
      } else {
        setIsCenterPaneReady(false);
      }
    };

    window.addEventListener('resize', updateBounds);
    updateBounds(); // Initial call

    return () => {
      window.removeEventListener('resize', updateBounds); // Cleanup listener on unmount
    };
  }, [centerPaneRef]);

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
    <>
      {isCenterPaneReady && overlayContent && bounds && (
        <Draggable
          bounds={bounds}
          defaultPosition={initialPosition}
          onStart={handleStart}
          onStop={handleStop}
        >
          {/* Modal container with styling */}
          <div className="fixed z-[9999] pointer-events-auto rounded-lg shadow-lg max-w-[70%] w-auto">
            <div onDragStart={preventImageDrag}>
              {overlayContent}
            </div>
          </div>
        </Draggable>
      )}

      {/* Render multiple picture modals */}
      {openedPictureModals.map((modal) => (
        <Draggable
          key={modal.id}
          bounds={bounds}
          defaultPosition={initialPosition}
          onStart={handleStart}
          onStop={handleStop}
        >
          {/* Modal container with styling */}
          <div className="fixed z-[9999] pointer-events-auto rounded-lg shadow-lg max-w-[70%] w-auto">
            <div onDragStart={preventImageDrag}>
              {modal.content}
            </div>
          </div>
        </Draggable>
      ))}
    </>
  );
};

export default ModalOverlayManager;