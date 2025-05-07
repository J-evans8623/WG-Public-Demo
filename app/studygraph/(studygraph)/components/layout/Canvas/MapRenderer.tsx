// MapRenderer.tsx

/**
 * @file MapRenderer.tsx
 * @description
 *   Renders the concept-map canvas, applies a one-time “fit-to-viewport” zoom,
 *   then programmatically centers both horizontal and vertical scrollbars
 *   in a single useLayoutEffect. After this initial setup, all zoom and pan
 *   controls remain entirely in the user’s hands.
 *
 *   A `data-testid="map-renderer-container"` attribute is present for easy
 *   querying in tests or the browser’s dev tools.
 *
 * Responsibilities:
 *   1. Compute composite layout & tight bounding box of nodes + subtrees.
 *   2. Apply one-time fit-to-viewport zoom & center scrollbars using actual
 *      scrollWidth/scrollHeight of the container.
 *   3. Expose a test-id on the container for external automation or debugging.
 *   4. Render ConceptNode and Subtree components.
 */

import React, { useRef, useMemo, useLayoutEffect, useState, useEffect } from 'react';
import { useZoomContext } from '@/app/Library/Context/ZoomProvider';
import { ZoomActionType } from '@/app/Library/Definitions/Definitions';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { useSubTreeContext } from '@/app/Library/Context/SubTreeProvider';
import { useCompositeLayout } from '@/app/Library/utils/compositeLayout';
import { drawHVStyleLines } from '@/app/Library/utils/drawHVStyleLines';
import ConceptNode from './ConceptNode';
import Subtree from './Subtree';
import '@/app/studygraph/(studygraph)/components/layout/mapTheme.css';
import '@/app/studygraph/(studygraph)/components/layout/hiddenScrollbar.css';


const MIN_ZOOM = 0.5;           // Never shrink below 50%
const VIEWPORT_PADDING = 0.9;   // Fit to 90% of viewport

const MapRenderer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { zoomLevel, dispatch: zoomDispatch } = useZoomContext();
  const { nodes } = useNodesContext();
  const { subtrees } = useSubTreeContext();

  // 1. Compute composite layout → absolute x/y for every node
  const laidOutNodes = useCompositeLayout(nodes);
  const rootNode = Array.from(nodes.values()).find((n) => n.isRoot);

  // 2. Compute the tight bounding box of all subtrees + nodes
  const { minX, maxX, minY, maxY } = useMemo(() => {
    let _minX = Infinity, _maxX = -Infinity;
    let _minY = Infinity, _maxY = -Infinity;

    subtrees.forEach(({ position, width, height }) => {
      if (!position) return;
      _minX = Math.min(_minX, position.x);
      _maxX = Math.max(_maxX, position.x + width);
      _minY = Math.min(_minY, position.y);
      _maxY = Math.max(_maxY, position.y + height);
    });
    laidOutNodes.forEach(({ x, y }) => {
      if (x != null && y != null) {
        _minX = Math.min(_minX, x);
        _maxX = Math.max(_maxX, x);
        _minY = Math.min(_minY, y);
        _maxY = Math.max(_maxY, y);
      }
    });

    return {
      minX: isFinite(_minX) ? _minX : 0,
      maxX: isFinite(_maxX) ? _maxX : 0,
      minY: isFinite(_minY) ? _minY : 0,
      maxY: isFinite(_maxY) ? _maxY : 0,
    };
  }, [laidOutNodes, subtrees]);

  const mapWidth  = maxX - minX;
  const mapHeight = maxY - minY;

  // track that we’ve done our one-time fit & center
  const [didInitialSetup, setDidInitialSetup] = useState(false);

  // ─── RESET ON CONTENT CHANGE ────────────────────────────────────────────────
  // Whenever the computed dimensions change (e.g. on first load of a new file),
  // clear the “didInitialSetup” flag so the centering logic runs again.
  useEffect(() => {
    setDidInitialSetup(false);
  }, [mapWidth, mapHeight]);
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * useLayoutEffect #1
   * • Compute and dispatch the one-time “fit-to-viewport” zoom.
   * • Immediately center scrollbars using actual scrollWidth/scrollHeight.
   * • Flip didInitialSetup so we never run again until content changes.
   */
  useLayoutEffect(() => {
    if (didInitialSetup) return;
    const container = containerRef.current;
    if (!container || mapWidth === 0 || mapHeight === 0) return;

    // viewport dimensions
    const { width: vw, height: vh } = container.getBoundingClientRect();

    // compute how much to scale down to fit into 90% of viewport
    const scaleX = (vw  / (mapWidth  * zoomLevel)) * VIEWPORT_PADDING;
    const scaleY = (vh  / (mapHeight * zoomLevel)) * VIEWPORT_PADDING;
    const fitScale = Math.min(scaleX, scaleY, 1);

    let targetZoom = zoomLevel;
    if (fitScale < 1) {
      targetZoom = Math.max(MIN_ZOOM, zoomLevel * fitScale);
      zoomDispatch({
        type:    ZoomActionType.SET_ZOOM_LEVEL,
        payload: targetZoom,
      });
    }

    // — CENTER BASED ON ACTUAL SCROLL DIMENSIONS —
    const contentW = container.scrollWidth * targetZoom;
    const contentH = container.scrollHeight * targetZoom;

    container.scrollLeft = Math.max(0, (contentW / 2) - (200 * targetZoom));
    container.scrollTop  = 0

    setDidInitialSetup(true);
  }, [didInitialSetup, mapWidth, mapHeight, zoomLevel, zoomDispatch]);

  return (
    <div
      ref={containerRef}
      data-testid="map-renderer-container"
      className="absolute inset-0 overflow-auto map-canvas hidden-scrollbar"
    >
      <div
        style={{
          position: 'relative',
          margin:   '150px auto 0',
          width:    `${mapWidth}px`,
          height:   `${mapHeight}px`,
        }}
        data-testid="map-renderer-container-2"
      >
        <div
        data-testid="map-renderer-container-3"
          style={{
            position:        'absolute',
            transform:       `translate(${-minX}px, ${-minY}px) scale(${zoomLevel})`,
            transformOrigin: 'top left',
            width:           `${mapWidth}px`,
            height:          `${mapHeight}px`,
          }}
        >
          {rootNode && <ConceptNode key={rootNode.id} node={rootNode} />}
          <svg
            className="absolute top-0 left-0 pointer-events-none"
            width={mapWidth}
            height={mapHeight}
            style={{ overflow: 'visible' }}
          >
            {drawHVStyleLines(laidOutNodes, subtrees, 3)}
          </svg>
          {Array.from(subtrees.entries()).map(([nodeId, sd]) =>
            sd.position ? (
              <Subtree
                key={nodeId}
                rootNodeId={nodeId}
                position={sd.position}
                width={sd.width}
                height={sd.height}
                openModalWithResourceType={() => {}}
                onNodeClick={() => {}}
              />
            ) : null
          )}
        </div>
      </div>
    </div>
  );
};

export default MapRenderer;
