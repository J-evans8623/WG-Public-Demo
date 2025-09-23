/**
 * @file MapRenderer.tsx
 * @description
 *   This file implements the **canonical concept-map renderer** used in both edit and read-only views.
 *   It preserves the proven RW navigation model—one-time “fit to viewport” zoom and a ZoomContext-registered
 *   recenter handler—while keeping the scroller on the compositor fast path (no transforms on the scroller).
 *   The scroll bed is now **content-aware**: we compute its width/height from SubTreeProvider’s aggregate
 *   metrics (total widths and max height) and add a generous constant margin to ensure reachable panning.
 *
 *   Structure:
 *     1) The scroller <div> is transform-free; it only scrolls (fast path).
 *     2) An absolutely positioned **GridBackground** lives as a child of the inner bed so the browser can
 *        cache/composite it efficiently. We pass world-origin alignment so the grid remains phase-stable.
 *     3) The “world” container is positioned at 50%/50% of the bed and translated by pre-scale constants,
 *        then scaled by the current zoom. All heavy rendering (edges/nodes/subtrees) stays inside the world.
 *
 *   Responsibilities:
 *     1) Provide a content-aware scroll bed (+margin) so content is reachable with minimal dead space.
 *     2) Compute a one-time fit-to-viewport zoom (O(1)) and store it in ZoomContext.
 *     3) Register a recenter handler to snap the scroller back to bed midpoint and optionally clamp zoom.
 *     4) Keep rendering math O(N) (layout + bounds) and keep effects/handlers O(1).
 *
 *   Observability:
 *     Focused console logs (file + 4-digit codes) mark initial fit, bed-centering, and recenter actions.
 *     Logs are gated out of production to avoid hot-path noise.
 */

import React, { useRef, useMemo, useLayoutEffect, useState, useEffect, useCallback } from 'react';
import { useZoomContext } from '@/app/Library/Context/ZoomProvider';
import { ZoomActionType } from '@/app/Library/Definitions/Definitions';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { useSubTreeContext } from '@/app/Library/Context/SubTreeProvider';
import { useCompositeLayout } from '@/app/Library/utils/compositeLayout';
import { drawHVStyleLines } from '@/app/Library/utils/drawHVStyleLines';
import ConceptNode from './ConceptNode';
import Subtree from '../../Subtree';
import '@/app/studygraph/(studygraph)/components/layout/hiddenScrollbar.css';

// update - 7: Removed DAM/edit-readiness telemetry imports to keep renderer pure and reduce subscriptions.
// (Deleted imports: useAccessSnapshot, useEditReady)

// update - 2: Background component that lives inside content layer and can be cached efficiently.
import GridBackground from './GridBackground';

const MIN_ZOOM = 0.5;
const VIEWPORT_PADDING = 0.9;

// update - 11: Tunable constants for content-aware bed sizing.
const BED_EXTRA_MARGIN_PX = 0;          // extra padding around content on all sides
const BED_MIN_WIDTH_PX = 2000;             // sensible minimums to avoid cramped view
const BED_MIN_HEIGHT_PX = 2000;

// update - 8: Single source of truth for pre-scale world translation used by both transform and origin memos.
const WORLD_TX = 125;
const WORLD_TY = 200;

const MapRenderer: React.FC = () => {
  /**
   * @function MapRenderer
   * @description
   *   1) Build an O(N) layout and infer content bounds from subtree metrics provided by SubTreeProvider.
   *   2) Compute a one-time “fit to viewport” zoom and apply it via ZoomContext.
   *   3) Create a content-aware scroll bed sized from (contentWidth/Height + margin), recentre scroller.
   *   4) Render world content (nodes, subtrees, edges) inside an absolutely positioned container that
   *      uses a stable translate + scale transform. Keep scroller free of transforms for smooth scrolling.
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

  // Pull subtree data and aggregate sizing helpers
  const {
    subtrees,
    getTotalSubtreeWidths,
    getMaxSubtreeHeight,
  } = useSubTreeContext();

  // 1) Layout → absolute x/y for every node (O(N))
  const laidOutNodes = useCompositeLayout(nodes);
  const rootNode = Array.from(nodes.values()).find((n) => n.isRoot);

  // 2) Tight bounding box of subtrees + nodes (O(N)) for edge SVG sizing (independent of bed sizing)
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

  // update - 12: Content-aware bed sizing derived from subtree aggregate metrics (+ margins, min caps).
  const { bedWidthPx, bedHeightPx } = useMemo(() => {
    // 1) Get aggregate dimensions (O(N) inside provider callbacks based on Map iteration)
    const totalW = getTotalSubtreeWidths();
    const maxH = getMaxSubtreeHeight();

    // 2) Add generous margins on all sides
    const withMarginW = totalW + BED_EXTRA_MARGIN_PX * 2;
    const withMarginH = maxH + BED_EXTRA_MARGIN_PX * 2;

    // 3) Enforce minimums to prevent overly small beds
    const width = Math.max(withMarginW, BED_MIN_WIDTH_PX);
    const height = Math.max(withMarginH, BED_MIN_HEIGHT_PX);

    if (process.env.NODE_ENV !== 'production') {
      console.log('[Canvas/MapRenderer.tsx][9731] bed size computed', {
        totalWidth: totalW,
        maxHeight: maxH,
        width,
        height,
        margin: BED_EXTRA_MARGIN_PX
      });
    }

    return { bedWidthPx: width, bedHeightPx: height };
  }, [getTotalSubtreeWidths, getMaxSubtreeHeight]);

  // Track a one-time setup (same trigger as before)
  const [didInitialSetup, setDidInitialSetup] = useState(false);

  // 3) Re-run initial setup when content bounds or bed size changes
  useEffect(() => {
    setDidInitialSetup(false);
  }, [mapWidth, mapHeight, bedWidthPx, bedHeightPx]);

  /**
   * 4) One-time fit-to-viewport zoom (O(1)).
   * NOTE: We do not write scroll here; centering is handled after bed size is known.
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
      if (process.env.NODE_ENV !== 'production') {
        console.log('MapRenderer.tsx 9721 › initial zoom fit', { targetZoom, vw, vh, mapWidth, mapHeight });
      }
      zoomDispatch({ type: ZoomActionType.SET_ZOOM_LEVEL, payload: targetZoom });
      setInitialFitZoom(targetZoom);
    } else {
      setInitialFitZoom(zoomLevel);
      if (process.env.NODE_ENV !== 'production') {
        console.log('MapRenderer.tsx 9721.1 › initial fit equals current zoom', { zoomLevel });
      }
    }

    setDidInitialSetup(true);
  }, [didInitialSetup, mapWidth, mapHeight, zoomLevel, zoomDispatch, setInitialFitZoom]);

  // update - 13: Local O(1) helper to center the scroller to the **bed midpoint** given rectangular bed.
  const centerToBedMidpoint = useCallback((el: HTMLDivElement, bedW: number, bedH: number) => {
    const targetScrollX = Math.max(0, (bedW * 0.5) - (el.clientWidth * 0.5));
    const targetScrollY = Math.max(0, (bedH * 0.5) - (el.clientHeight * 0.5));
    el.scrollLeft = targetScrollX;
    el.scrollTop = targetScrollY;
    if (process.env.NODE_ENV !== 'production') {
      console.log('MapRenderer.tsx 9722 › centered to scroll bed', { bedW, bedH, targetScrollX, targetScrollY });
    }
    return { x: targetScrollX, y: targetScrollY };
  }, []);

  // 5) One-time scroll to the **center of the content-aware bed** (both axes).
  const [didBedCenter, setDidBedCenter] = useState(false);
  useLayoutEffect(() => {
    if (didBedCenter) return;
    const el = containerRef.current;
    if (!el) return;
    centerToBedMidpoint(el, bedWidthPx, bedHeightPx);
    setDidBedCenter(true);
  }, [didBedCenter, bedWidthPx, bedHeightPx, centerToBedMidpoint]);

  /**
   * @function centerToBedMidpointHandler
   * @description
   *   Registered with ZoomContext to support O(1) recentering. The handler scrolls the container back to
   *   the **current** bed midpoint (content-aware) and can optionally clamp the current zoom down to the
   *   initial fit level (never up). Keeps recovery consistent as content grows/shrinks.
   */
  const centerToBedMidpointHandler = useCallback((opts?: { clampToInitialFit?: boolean }) => {
    const el = containerRef.current;
    if (!el) return;

    centerToBedMidpoint(el, bedWidthPx, bedHeightPx);
    if (process.env.NODE_ENV !== 'production') {
      console.log('MapRenderer.tsx 9723 › recenter applied', { opts: opts ?? null });
    }

    if (opts?.clampToInitialFit) {
      const initial = getInitialFitZoom();
      if (typeof initial === 'number' && zoomLevel > initial) {
        if (process.env.NODE_ENV !== 'production') {
          console.log('MapRenderer.tsx 9724 › clamping zoom to initial fit', { initial, current: zoomLevel });
        }
        zoomDispatch({ type: ZoomActionType.SET_ZOOM_LEVEL, payload: initial });
      }
    }
  }, [centerToBedMidpoint, bedWidthPx, bedHeightPx, getInitialFitZoom, zoomLevel, zoomDispatch]);

  // Register/unregister the handler with ZoomContext
  useEffect(() => {
    registerMapCenterHandler(centerToBedMidpointHandler);
    return () => unregisterMapCenterHandler();
  }, [registerMapCenterHandler, unregisterMapCenterHandler, centerToBedMidpointHandler]);

  // update - 5: Compute world origin in bed coordinates to phase-align the grid background.
  //             With the world anchored at 50%/50%, subtract the pre-scale translation to get world (0,0).
  const worldOriginXPx = useMemo(() => {
    const bedCenterX = bedWidthPx * 0.5;
    const translateX = WORLD_TX; // update - 8: use constant
    const origin = bedCenterX - translateX * zoomLevel; // keeping prior math; background aligns off this
    if (process.env.NODE_ENV !== 'production') {
      console.log('[Canvas/MapRenderer.tsx][9725] worldOriginXPx computed', {
        bedCenterX, translateX, zoomLevel, worldOriginXPx: origin
      });
    }
    return origin;
  }, [bedWidthPx, zoomLevel]);

  const worldOriginYPx = useMemo(() => {
    const bedCenterY = bedHeightPx * 0.5;
    const translateY = WORLD_TY; // update - 8: use constant
    const origin = bedCenterY - translateY * zoomLevel; // keeping prior math; background aligns off this
    if (process.env.NODE_ENV !== 'production') {
      console.log('[Canvas/MapRenderer.tsx][9726] worldOriginYPx computed', {
        bedCenterY, translateY, zoomLevel, worldOriginYPx: origin
      });
    }
    return origin;
  }, [bedHeightPx, zoomLevel]);

  return (
    <div
      ref={containerRef}
      data-testid="map-renderer-container"
      className="absolute inset-0 overflow-auto hidden-scrollbar"
    >
      {/* Content-aware scroll bed: makes content reachable without excessive dead space */}
      <div
        data-testid="scroll-bed" // update - 6.1: normalized test id
        style={{
          position: 'relative',
          width: `${bedWidthPx}px`,    // update - 12
          height: `${bedHeightPx}px`,  // update - 12
        }}
      >
        {/* Phase-aligned, cached background inside the content layer (not on the scroller). */}
        <GridBackground
          spacingPx={20}
          opacity={0.7}
          align={{ worldOriginXPx, worldOriginYPx, zoom: zoomLevel }}
          data-testid="grid-bg"
        />

        {/* World container with stable transform */}
        <div
          data-testid="map-world"
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            // update - 8: use constants for translate to match origin calc.
            transform: `translate(${-WORLD_TX}px, ${-WORLD_TY}px) scale(${zoomLevel})`,
            transformOrigin: 'top left',
          }}
        >
          {rootNode && (
            <>
              {/* Root locked at (0,0) exactly as before */}
              <div style={{ position: 'absolute', left: 0, top: 0 }}>
                {/* update - 9: Static JSX for type-safety and bundling. */}
                <ConceptNode key={rootNode.id} node={{ ...rootNode, x: 0, y: 0 }} />
              </div>
            </>
          )}

          {/* SVG line renderer — unchanged; sized by computed mapWidth/Height */}
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
