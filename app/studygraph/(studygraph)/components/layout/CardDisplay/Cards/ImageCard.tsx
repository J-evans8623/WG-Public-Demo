// src/app/studygraph/(studygraph)/components/layout/Cards/ImageCard.tsx

import React, { useState, useRef, useEffect } from 'react';
import SafeContent from '../../../utils/SafeContent';
import './ImageCard.css';

/**
 * @file ImageCard.tsx
 * @description
 *   Renders image resources in two modes:
 *     • **Preview** (default): heading + fixed thumbnail + optional caption
 *     • **Interactive** (when `interactive` is true): heading + fit‑to‑container image with zoom & pan + optional caption
 *
 * Responsibilities:
 *   - Display the resource title with the same styling as NoteCard.
 *   - Provide a preview thumbnail vs. interactive zoom/pan experience.
 *   - Render safe HTML captions via SafeContent.
 */

export interface ImageCardProps {
  /** Card title */
  title: string;
  /** Image source URL */
  imageUrl: string;
  /** Optional HTML caption */
  content?: string;
  /** Enable interactive zoom/pan mode */
  interactive?: boolean;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 2;
const ZOOM_STEP = 0.25;

const ImageCard: React.FC<ImageCardProps> = ({
  title,
  imageUrl,
  content,
  interactive = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });
  const offsetStart = useRef({ x: 0, y: 0 });

  // Fit image on load (interactive only)
  const fitImage = () => {
    if (!interactive) return;
    const img = imgRef.current;
    const container = containerRef.current;
    if (!img || !container) return;

    const { naturalWidth: iw, naturalHeight: ih } = img;
    const { width: cw, height: ch } = container.getBoundingClientRect();
    const ratio = Math.min(cw / iw, ch / ih);
    const initial = Math.max(MIN_SCALE, Math.min(MAX_SCALE, ratio));

    setScale(initial);
    setOffset({ x: 0, y: 0 });
  };

  useEffect(() => {
    if (interactive && imgRef.current?.complete) {
      fitImage();
    }
  }, [interactive]);

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!interactive || scale === 1) return;
    e.preventDefault();
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY };
    offsetStart.current = { ...offset };
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!interactive || !isPanning) return;
    e.preventDefault();
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    setOffset({ x: offsetStart.current.x + dx, y: offsetStart.current.y + dy });
  };
  const endPan = () => {
    if (interactive && isPanning) {
      setIsPanning(false);
    }
  };

  // Zoom controls
  const zoomIn = () => interactive && setScale(s => Math.min(MAX_SCALE, s + ZOOM_STEP));
  const zoomOut = () => {
    if (!interactive) return;
    setScale(s => {
      const next = Math.max(MIN_SCALE, s - ZOOM_STEP);
      if (next === 1) setOffset({ x: 0, y: 0 });
      return next;
    });
  };

  // --- Preview Mode ---
  if (!interactive) {
    return (
      <div className="preview-image-card">
        {/* Title */}
        <h3 className="text-text-title text-xl font-bold text-center mb-4">
          {title}
        </h3>

        {/* Thumbnail */}
        <div className="preview-image-container">
          <img src={imageUrl} alt={title} className="preview-image" />
        </div>

        {/* Caption */}
        {content && (
          <div className="preview-caption">
            <SafeContent html={content} className="preview-caption-content" />
          </div>
        )}
      </div>
    );
  }

  // --- Interactive Mode ---
  return (
    <div className="slideshow-image-card">
      {/* Title */}
      <h3 className="text-text-title text-xl font-bold text-center mb-4">
        {title}
      </h3>

      {/* Zoom & Pan Container */}
      <div
        className={`slideshow-image-container${isPanning ? ' panning' : ''}`}
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={endPan}
        onMouseLeave={endPan}
        role="group"
        aria-label={`Image: ${title}. Use controls to zoom and pan.`}
      >
        <img
          ref={imgRef}
          src={imageUrl}
          alt={title}
          className="slideshow-image"
          draggable={false}
          onLoad={fitImage}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            cursor: scale !== 1 ? (isPanning ? 'grabbing' : 'grab') : 'default',
          }}
        />

        {/* Zoom Controls */}
        <div className="slideshow-zoom-controls">
          <button
            type="button"
            className="zoom-btn minus"
            onClick={zoomOut}
            disabled={scale <= MIN_SCALE}
            aria-label="Zoom out"
          >
            &minus;
          </button>
          <button
            type="button"
            className="zoom-btn plus"
            onClick={zoomIn}
            disabled={scale >= MAX_SCALE}
            aria-label="Zoom in"
          >
            +
          </button>
        </div>
      </div>

      {/* Caption */}
      {content && (
        <div className="slideshow-caption-container">
          <SafeContent html={content} className="slideshow-caption-content" />
        </div>
      )}
    </div>
  );
};

export default ImageCard;
