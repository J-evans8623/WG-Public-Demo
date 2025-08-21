// MapRenderer.tsx (edit Mode)

/**
 * @file MapRenderer.tsx
 * @description
 *   Edit-mode renderer for the concept map. This version preserves the existing
 *   world transform and SVG line rendering while solving the “content grows out
 *   of reach” issue. We introduce a large, static **scroll bed** that provides a
 *   generous scrollable area in all directions so the map is always reachable
 *   without re-centering the camera on content changes. On first paint only, we
 *   (1) compute a one-time fit-to-viewport zoom (as before) and (2) center the
 *   container’s scroll position to the **bed midpoint on BOTH axes** so the map
 *   starts in view. We never change scroll positions after that, which avoids
 *   the previous “jumping” behaviour. Styling and the SVG line renderer remain
 *   untouched. Logging is kept purposeful for observability (unique 4-digit ids).
 *
 * Responsibilities:
 *   1) Keep current layout + SVG line rendering intact (no logic changes).
 *   2) Provide a fixed-size scroll bed to make large maps reachable.
 *   3) Center scroll to the bed midpoint once on mount; never re-center later.
 *   4) Maintain the one-time fit-to-viewport zoom logic you already had.
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
import '@/app/studygraph/(studygraph)/components/layout/hiddenScrollbar.css';

const MIN_ZOOM = 0.5;           // Never shrink below 50%
const VIEWPORT_PADDING = 0.9;   // Fit to 90% of viewport

// ❶ A fixed, generous scroll area so content never becomes unreachable.
//    Keeping this static prevents “center drift.”
const SCROLL_BED_PX = 20000;

const MapRenderer: React.FC = () => {
  /**
   * @function MapRenderer
   * @description
   *   Render the map inside a large, static scroll bed. We compute a one-time
   *   fit zoom and then set the container’s scrollLeft/scrollTop to the **bed
   *   center** once so the world (positioned at 50%/50%) is visible initially.
   *   We do not touch scroll again, preserving stability while allowing reach.
   */
  const containerRef = useRef<HTMLDivElement>(null);
  const { zoomLevel, dispatch: zoomDispatch } = useZoomContext();
  const { nodes } = useNodesContext();
  const { subtrees } = useSubTreeContext();

  // 1) Layout → absolute x/y for every node (unchanged)
  const laidOutNodes = useCompositeLayout(nodes);
  const rootNode = Array.from(nodes.values()).find((n) => n.isRoot);

  // 2) Tight bounding box of subtrees + nodes (unchanged)
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

  // Track a one-time setup (same trigger as before)
  const [didInitialSetup, setDidInitialSetup] = useState(false);

  // 3) Re-run initial setup only when content bounds change (existing behavior)
  useEffect(() => {
    setDidInitialSetup(false);
  }, [mapWidth, mapHeight]);

  /**
   * 4) One-time fit-to-viewport zoom (unchanged in spirit).
   *    NOTE: we do not write scroll here anymore; centering is handled below.
   */
  useLayoutEffect(() => {
    if (didInitialSetup) return;
    const container = containerRef.current;
    if (!container || mapWidth === 0 || mapHeight === 0) return;

    const { width: vw, height: vh } = container.getBoundingClientRect();

    const scaleX = (vw  / (mapWidth  * zoomLevel)) * VIEWPORT_PADDING;
    const scaleY = (vh  / (mapHeight * zoomLevel)) * VIEWPORT_PADDING;
    const fitScale = Math.min(scaleX, scaleY, 1);

    let targetZoom = zoomLevel;
    if (fitScale < 1) {
      targetZoom = Math.max(MIN_ZOOM, zoomLevel * fitScale);
      console.log('MapRenderer.tsx 9721 › initial zoom fit', { targetZoom, vw, vh, mapWidth, mapHeight });
      zoomDispatch({
        type:    ZoomActionType.SET_ZOOM_LEVEL,
        payload: targetZoom,
      });
    }

    setDidInitialSetup(true);
  }, [didInitialSetup, mapWidth, mapHeight, zoomLevel, zoomDispatch]);

  // 5) NEW: One-time scroll to the **center of the fixed bed** (both axes).
  const [didBedCenter, setDidBedCenter] = useState(false);
  useLayoutEffect(() => {
    if (didBedCenter) return;
    const el = containerRef.current;
    if (!el) return;

    const vw = el.clientWidth;
    const vh = el.clientHeight;

    // STEP A — horizontally center to bed midpoint
    el.scrollLeft = Math.max(0, (SCROLL_BED_PX - vw) / 2);
    // STEP B — vertically center to bed midpoint
    el.scrollTop  = Math.max(0, (SCROLL_BED_PX - vh) / 2);

    console.log('MapRenderer.tsx 9722 › centered to scroll bed', {
      bed: SCROLL_BED_PX,
      vw, vh,
      scrollLeft: el.scrollLeft,
      scrollTop:  el.scrollTop
    });

    setDidBedCenter(true);
  }, [didBedCenter]);

  return (
    <div 
      ref={containerRef}
      data-testid="map-renderer-container"
      className="absolute inset-0 overflow-auto hidden-scrollbar"
    >
      {/* 6) Static scroll bed: makes content reachable without re-centering */}
      <div
        data-testid="scroll bed"
        style={{
          position: 'relative',
          width: `${SCROLL_BED_PX}px`,
          height: `${SCROLL_BED_PX}px`,
        }}
      >
        {/* Preserve your background pattern */}
        <div 
          className="map-background-pattern" 
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '150%',
            height: '150%',
          }}
        />

        {/* Warm dotted board background (non-interactive) */}
        <div
          data-testid="map-world"
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            // Keep your existing transform EXACTLY as-is to avoid SVG regressions.
            transform: `translate(${-125}px, ${-200}px) scale(${zoomLevel})`,
            transformOrigin: 'top left',
          }}
        >
          {rootNode && (
            <React.Fragment>
              {/* Root locked at (0,0) exactly as before */}
              <div style={{ position: 'absolute', left: 0, top: 0 }}>
                {React.createElement(
                  require('./ConceptNode').default as any,
                  { key: rootNode.id, node: { ...rootNode, x: 0, y: 0 } },
                  null
                )}
              </div>
            </React.Fragment>
          )}

          {/* SVG line renderer — UNCHANGED */}
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
