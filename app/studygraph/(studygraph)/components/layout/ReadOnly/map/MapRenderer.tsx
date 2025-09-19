// app/studygraph/(studygraph)/components/layout/ReadOnly/map/MapRenderer.tsx

/**
 * @file MapRenderer.tsx
 * @description
 *   Renders the concept-map canvas (read-only), applies a one-time “fit-to-viewport”
 *   zoom, then programmatically centers the scrollbars for the initial paint. After
 *   this setup, control stays with the user. Phase 1 wires this renderer into the
 *   ZoomContext’s new imperative re-center API without changing layout or styling.
 *
 *   What’s new in Phase 1:
 *   1) On first fit we call setInitialFitZoom(targetZoom) so ZoomContext can remember
 *      the baseline. This enables safe, “never upscale” clamp behavior later.
 *   2) We register a DOM-owned re-center handler with ZoomContext. When invoked,
 *      it scrolls the container back to its content midpoint. If requested, it
 *      clamps the current zoom down to the initial fit value.
 *   3) We keep this code O(1) with useRef and no additional re-renders.
 *
 *   Logging:
 *   - Logs capture first-fit zoom, registration success, and recenter application.
 */

import React, { useRef, useMemo, useLayoutEffect, useState, useEffect, useCallback } from 'react';
import { useZoomContext } from '@/app/Library/Context/ZoomProvider';
import { ZoomActionType } from '@/app/Library/Definitions/Definitions';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { useSubTreeContext } from '@/app/Library/Context/SubTreeProvider';
import { useCompositeLayout } from '@/app/Library/utils/compositeLayout';
import { drawHVStyleLines } from '@/app/Library/utils/drawHVStyleLines';
import { centerContainerToMidpoint } from '@/app/Library/utils/map/centerUtils';
import ConceptNode from './ConceptNode';
import Subtree from './Subtree';
import '@/app/studygraph/(studygraph)/components/layout/hiddenScrollbar.css';

const MIN_ZOOM = 0.5;           // Never shrink below 50%
const VIEWPORT_PADDING = 0.9;   // Fit to 90% of viewport
const WORLD_ANCHOR_OFFSET = { x: 125, y: 200 };

const MapRenderer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    zoomLevel,
    dispatch: zoomDispatch,
    setInitialFitZoom,            // update - 2
    getInitialFitZoom,            // update - 3
    registerMapCenterHandler,     // update - 4
    unregisterMapCenterHandler,   // update - 5
  } = useZoomContext();

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
      setInitialFitZoom(targetZoom); // update - 6
      console.log('[MapRenderer(RO).tsx][9725] initial fit computed', { targetZoom, vw, vh, mapWidth, mapHeight });
    } else {
      // In cases where zoom stays the same, record the current level as baseline once
      setInitialFitZoom(zoomLevel);  // update - 7
      console.log('[MapRenderer(RO).tsx][9726] initial fit equals current zoom', { zoomLevel });
    }

    // — CENTER BASED ON CONTENT DIMENSIONS —
    const { left, top } = centerContainerToMidpoint(container); // update - 8
    console.log('[MapRenderer(RO).tsx][9727] centered to content midpoint', { left, top });

    setDidInitialSetup(true);
  }, [didInitialSetup, mapWidth, mapHeight, zoomLevel, zoomDispatch, setInitialFitZoom]);

  /**
   * @function centerToMidpointHandler
   * @description
   *   Re-center callback registered with ZoomContext. It scrolls the container to the
   *   content midpoint and, when requested, clamps zoom down to the initial fit zoom
   *   (never upscaling). The math is O(1) and relies on the utility helper.
   */
  const centerToMidpointHandler = useCallback((opts?: { clampToInitialFit?: boolean }) => { // update - 9
    const el = containerRef.current;
    if (!el) return;

    const applied = centerContainerToMidpoint(el);
    console.log('[MapRenderer(RO).tsx][9728] recenter applied', { applied, opts: opts ?? null });

    if (opts?.clampToInitialFit) {
      const initial = getInitialFitZoom();
      if (typeof initial === 'number' && zoomLevel > initial) {
        console.log('[MapRenderer(RO).tsx][9729] clamping zoom to initial fit', { initial, current: zoomLevel });
        zoomDispatch({ type: ZoomActionType.SET_ZOOM_LEVEL, payload: initial });
      }
    }
  }, [getInitialFitZoom, zoomLevel, zoomDispatch]);

  // Register/unregister handler with ZoomContext (O(1))  // update - 10
  useEffect(() => {
    registerMapCenterHandler(centerToMidpointHandler);
    return () => unregisterMapCenterHandler();
  }, [registerMapCenterHandler, unregisterMapCenterHandler, centerToMidpointHandler]);

  return (
    <div
      ref={containerRef}
      data-testid="map-renderer-container"
      className="absolute inset-0 overflow-auto hidden-scrollbar"
    >
      {/* Warm dotted board background (non-interactive) - matching edit mode */}
      <div 
        className="map-background-pattern" 
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: `${Math.max(mapWidth + 400, window.innerWidth)}px`,
          height: `${Math.max(mapHeight + 300, window.innerHeight)}px`,
          minWidth: '100%',
          minHeight: '100%',
        }}
      />
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
