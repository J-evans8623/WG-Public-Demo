// bloom-maps\app\studygraph\(studygraph)\components\layout\Canvas\ReadWriteCanvas\Map\MapRenderer.tsx

/**
 * @file MapRenderer.tsx
 * @description
 *   This file implements the **canonical concept-map renderer** used in both edit and read-only views.
 *   It preserves the proven RW navigation model—fixed scroll bed, one-time “fit to viewport” zoom, and
 *   a ZoomContext-registered recenter handler—while remaining agnostic to access mode. All mutating UI
 *   continues to be owned by ConceptNode/Subtree; the renderer focuses purely on navigation and drawing:
 *   1) compose an O(N) layout from the node/subtree stores, 2) paint edges via SVG, and 3) position the
 *   “world” with a stable transform. We intentionally keep DOM structure and CSS class hooks identical
 *   to avoid style/test regressions. For observability, we log the initial fit and recenter actions using
 *   concise messages (file name + 4-digit codes). This file now serves **both RO and RW** without prop churn.
 *
 * Responsibilities:
 *   1) Provide a static, generous scroll bed so content is always reachable and center is deterministic.
 *   2) Compute a one-time fit-to-viewport zoom, store it in ZoomContext, and never upscale on recenter.
 *   3) Register a recenter handler to quickly return to the bed midpoint and optionally clamp to initial fit.
 *   4) Keep rendering math O(N) in the number of nodes/subtrees and prefer O(1) work in effects/handlers.
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
import Subtree from '../../Subtree';
import '@/app/studygraph/(studygraph)/components/layout/hiddenScrollbar.css';

// update - 1: Optional access read for observability only (no behavior changes).
import { useAccessSnapshot, useEditReady } from '@/app/src/context/ApiContext'; 

const MIN_ZOOM = 0.5;
const VIEWPORT_PADDING = 0.9;
// ❶ A fixed, generous scroll area so content never becomes unreachable.
const SCROLL_BED_PX = 8000;

const MapRenderer: React.FC = () => {
  /**
   * @function MapRenderer
   * @description
   * Render the map inside a large, static scroll bed. We compute a one-time fit zoom and then set the
   * container’s scrollLeft/scrollTop to the **bed center** once so the world (positioned at 50%/50%) is
   * visible initially. We do not touch scroll again unless user-initiated recenter is requested via
   * ZoomContext. Optional clamping reduces zoom down to the initial fit (never upscaling).
   */
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    zoomLevel,
    dispatch: zoomDispatch,
    setInitialFitZoom,
    getInitialFitZoom,
    registerMapCenterHandler,
    unregisterMapCenterHandler,
  } = useZoomContext();
  const { nodes } = useNodesContext();
  const { subtrees } = useSubTreeContext();

  // update - 2: Read DAM for telemetry; renderer behavior is unchanged.
  const { mode, status } = useAccessSnapshot(); // update - 2
  const editReady = useEditReady();     // update - 2
  useEffect(() => {
    console.log('[Canvas/MapRenderer.tsx][9700] mounted in mode:', { mode, status, editReady }); // update - 3
  }, [mode, status, editReady]); // update - 3

  // 1) Layout → absolute x/y for every node (O(N))
  const laidOutNodes = useCompositeLayout(nodes);
  const rootNode = Array.from(nodes.values()).find((n) => n.isRoot);

  // 2) Tight bounding box of subtrees + nodes (O(N))
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

  // 3) Re-run initial setup when content bounds change
  useEffect(() => {
    setDidInitialSetup(false);
  }, [mapWidth, mapHeight]);

  /**
   * 4) One-time fit-to-viewport zoom (O(1))
   * NOTE: we do not write scroll here; centering is handled below.
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
      setInitialFitZoom(targetZoom);
    } else {
      setInitialFitZoom(zoomLevel);
      console.log('MapRenderer.tsx 9721.1 › initial fit equals current zoom', { zoomLevel });
    }

    setDidInitialSetup(true);
  }, [didInitialSetup, mapWidth, mapHeight, zoomLevel, zoomDispatch, setInitialFitZoom]);

  // 5) One-time scroll to the **center of the fixed bed** (both axes).
  const [didBedCenter, setDidBedCenter] = useState(false);
  useLayoutEffect(() => {
    if (didBedCenter) return;
    const el = containerRef.current;
    if (!el) return;

    const applied = centerContainerToMidpoint(el, { bedPx: SCROLL_BED_PX });
    console.log('MapRenderer.tsx 9722 › centered to scroll bed', { bed: SCROLL_BED_PX, applied });

    setDidBedCenter(true);
  }, [didBedCenter]);

  /**
   * @function centerToBedMidpointHandler
   * @description
   * Re-center callback registered with ZoomContext. It scrolls the container to the bed midpoint
   * and, when requested, clamps the zoom level down to the initial fit (never upscaling). O(1).
   */
  const centerToBedMidpointHandler = useCallback((opts?: { clampToInitialFit?: boolean }) => {
    const el = containerRef.current;
    if (!el) return;

    const applied = centerContainerToMidpoint(el, { bedPx: SCROLL_BED_PX });
    console.log('MapRenderer.tsx 9723 › recenter applied', { applied, opts: opts ?? null });

    if (opts?.clampToInitialFit) {
      const initial = getInitialFitZoom();
      if (typeof initial === 'number' && zoomLevel > initial) {
        console.log('MapRenderer.tsx 9724 › clamping zoom to initial fit', { initial, current: zoomLevel });
        zoomDispatch({ type: ZoomActionType.SET_ZOOM_LEVEL, payload: initial });
      }
    }
  }, [getInitialFitZoom, zoomLevel, zoomDispatch]);

  // Register/unregister the handler with ZoomContext
  useEffect(() => {
    registerMapCenterHandler(centerToBedMidpointHandler);
    return () => unregisterMapCenterHandler();
  }, [registerMapCenterHandler, unregisterMapCenterHandler, centerToBedMidpointHandler]);

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

        {/* World container with stable transform */}
        <div
          data-testid="map-world"
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: `translate(${-125}px, ${-200}px) scale(${zoomLevel})`,
            transformOrigin: 'top left',
          }}
        >
          {rootNode && (
            <>
              {/* Root locked at (0,0) exactly as before */}
              <div style={{ position: 'absolute', left: 0, top: 0 }}>
                {React.createElement(
                  require('./ConceptNode').default as any,
                  { key: rootNode.id, node: { ...rootNode, x: 0, y: 0 } },
                  null
                )}
              </div>
            </>
          )}

          {/* SVG line renderer — unchanged */}
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
