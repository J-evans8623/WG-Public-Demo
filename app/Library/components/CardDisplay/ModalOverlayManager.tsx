import React, { useState, useEffect } from 'react';
import Draggable, { DraggableProps } from 'react-draggable';

interface ModalOverlayManagerProps {
  centerPaneRef: React.RefObject<HTMLDivElement>;
  paneSizes: number[];
  overlayContent: React.ReactNode | null;
  setOverlayContent: (content: React.ReactNode | null) => void;
  openedPictureModals: { id: string, content: React.ReactNode }[]; // Track opened picture modals
  handleClosePictureModal: (pictureId: string) => void;
}

const ModalOverlayManager: React.FC<ModalOverlayManagerProps> = ({
  centerPaneRef,
  paneSizes,
  overlayContent,
  setOverlayContent,
  openedPictureModals,
  handleClosePictureModal
}) => {
  const [isCenterPaneReady, setIsCenterPaneReady] = useState<boolean>(false);
  const [bounds, setBounds] = useState<DraggableProps['bounds']>();
  const [initialPosition, setInitialPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Dynamically update bounds based on pane sizes and window size
  useEffect(() => {
    const updateBounds = () => {
      if (centerPaneRef && centerPaneRef.current) {
        const centerPaneRect = centerPaneRef.current.getBoundingClientRect();

        const leftPaneWidth = (window.innerWidth * paneSizes[0]) / 100; // Convert left pane size to pixels

        setBounds({
          left: leftPaneWidth,
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
    <>
      {isCenterPaneReady && overlayContent && bounds && (
        <Draggable
          bounds={bounds}
          defaultPosition={initialPosition}
          onStart={handleStart}
          onStop={handleStop}
        >
          <div className="fixed z-[9999] pointer-events-auto bg-white p-6 shadow-lg rounded-lg max-w-[70%] w-auto">
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
          <div className="fixed z-[9999] pointer-events-auto bg-white p-6 shadow-lg rounded-lg max-w-[70%] w-auto">
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
