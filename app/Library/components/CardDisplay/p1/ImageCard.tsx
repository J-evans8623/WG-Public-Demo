// bloom-maps/app/Library/components/ImageCard.tsx

import React, { useState, useRef, useCallback, useEffect } from 'react';
import ReactDOM from 'react-dom'; // Import ReactDOM for portals
import './ImageCard.css';
import { FaSearchPlus, FaSearchMinus, FaTimes, FaExpand, FaCompress } from 'react-icons/fa';

interface ImageCardProps {
  title: string;
  image: File | null;
  description?: string;
  onDismiss?: () => void;
}

const ImageCard: React.FC<ImageCardProps> = ({ title, image, description, onDismiss }) => {
  // State to manage zoom level, panning, and maximization
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [startPan, setStartPan] = useState<{ x: number; y: number } | null>(null);
  const [translate, setTranslate] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isMaximized, setIsMaximized] = useState<boolean>(false); // State for maximization

  const imageContainerRef = useRef<HTMLDivElement>(null);

  // Handler to toggle zoom
  const handleZoomIn = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    setZoomLevel((prev) => Math.min(prev + 0.5, 3)); // Max zoom level 3x
    setTranslate({ x: 0, y: 0 }); // Reset panning on zoom
  }, []);

  const handleZoomOut = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    setZoomLevel((prev) => Math.max(prev - 0.5, 1)); // Min zoom level 1x
    setTranslate({ x: 0, y: 0 }); // Reset panning on zoom
  }, []);

  // Handlers for panning
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (zoomLevel <= 1) return; // Disable panning if not zoomed
    setIsPanning(true);
    setStartPan({ x: e.clientX - translate.x, y: e.clientY - translate.y });
  }, [zoomLevel, translate]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning || !startPan) return;
    const newX = e.clientX - startPan.x;
    const newY = e.clientY - startPan.y;

    // Calculate boundaries to prevent excessive panning
    const container = imageContainerRef.current;
    if (container) {
      const { width, height } = container.getBoundingClientRect();
      const maxTranslateX = ((zoomLevel - 1) * width) / 2;
      const maxTranslateY = ((zoomLevel - 1) * height) / 2;

      setTranslate({
        x: Math.max(-maxTranslateX, Math.min(newX, maxTranslateX)),
        y: Math.max(-maxTranslateY, Math.min(newY, maxTranslateY)),
      });
    }
  }, [isPanning, startPan, zoomLevel]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsPanning(false);
    setStartPan(null);
  }, []);

  const handleMouseLeave = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsPanning(false);
    setStartPan(null);
  }, []);

  // Handlers for maximizing and restoring the card
  const handleMaximize = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    setIsMaximized(true);
  }, []);

  const handleRestore = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    setIsMaximized(false);
  }, []);

  // Handler to close the ImageCard when clicking on the backdrop
  const handleBackdropClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    setIsMaximized(false);
  }, []);

  // Prevent scrolling when maximized
  useEffect(() => {
    if (isMaximized) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }, [isMaximized]);

  // Card Content
  const cardContent = (
    <div className={`image-card ${isMaximized ? 'maximized' : ''}`}>
      {/* Image Section */}
      <div
        className="image-section"
        ref={imageContainerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        style={{
          cursor: isPanning ? 'grabbing' : zoomLevel > 1 ? 'grab' : 'default',
        }}
      >
        {image && image instanceof File ? (
          <img
            src={URL.createObjectURL(image)}
            alt={title}
            className="card-image"
            draggable={false}
            style={{
              transform: `scale(${zoomLevel}) translate(${translate.x / zoomLevel}px, ${translate.y / zoomLevel}px)`,
              transition: isPanning ? 'none' : 'transform 0.3s ease',
              transformOrigin: 'center center',
            }}
          />
        ) : (
          <div className="image-placeholder">No image available</div>
        )}
        {/* Interactive Tools */}
        <div className="image-tools" onClick={(e) => e.stopPropagation()}>
          {zoomLevel < 3 && (
            <button onClick={handleZoomIn} className="tool-button" title="Zoom In">
              <FaSearchPlus />
            </button>
          )}
          {zoomLevel > 1 && (
            <button onClick={handleZoomOut} className="tool-button" title="Zoom Out">
              <FaSearchMinus />
            </button>
          )}
          {!isMaximized ? (
            <button onClick={handleMaximize} className="tool-button" title="Maximize">
              <FaExpand />
            </button>
          ) : (
            <button onClick={handleRestore} className="tool-button" title="Restore">
              <FaCompress />
            </button>
          )}
          {onDismiss && (
            <button onClick={onDismiss} className="tool-button dismiss-button" title="Dismiss">
              <FaTimes />
            </button>
          )}
        </div>
      </div>

{/* Text Section */}
<div className="text-section">
  {description ? (
    <>
      <h3 className="description-title">{title}</h3>
      <p className="description-text">{description}</p>
    </>
  ) : (
    <p className="placeholder-text">
      No description available. Add content to enhance this card.
    </p>
  )}
</div>

    </div>
  );

  return (
    <>
      {isMaximized
        ? ReactDOM.createPortal(
            <>
              {/* Backdrop when maximized */}
              <div className="image-card-backdrop" onClick={handleBackdropClick}></div>
              {cardContent}
            </>,
            document.body
          )
        : cardContent}
    </>
  );
};

export default ImageCard;
