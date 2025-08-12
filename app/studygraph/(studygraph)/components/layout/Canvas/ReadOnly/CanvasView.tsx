/**
 * @file ROCanvasView.tsx
 * @description
 * Read-Only Canvas View (ROCanvasView) composes the read-only concept-map workspace with the read-only
 * resource pane into a single screen that mirrors the interactive Canvas View’s DOM structure, class
 * names, and CSS hooks. This file intentionally reuses the shared header (CanvasHeader), grid layout
 * (.canvas-panels), and panel classes (.map-column, .map-cell, .view-panel, .map-panel, .resource-cell)
 * so that spacing, borders, and theme tokens remain pixel-aligned with the original. All mutating
 * pathways (inline title edit, write operations) are disabled, while safe viewer actions—zoom via the
 * BottomToolbar and slideshow viewing via unit-order—remain available. To support future debugging,
 * purposeful console logs (tagged with file name + unique 4-digit codes) cover mount and primary user
 * intents (zoom, slideshow). This implementation also corrects a prior Rules-of-Hooks violation by
 * lifting `usePreorderTraversal()` to the component’s top level and eliminating unnecessary type casts.
 *
 * Responsibilities:
 *   1) Render the header visually identical to Canvas View while preventing inline title edits.
 *   2) Recreate the two-column grid with read-only map (left) and read-only card display (right).
 *   3) Provide zoom controls in the BottomToolbar without exposing any mutating behaviors.
 *   4) Preserve all original CSS classes and imports to guarantee style parity.
 *   5) Emit focused logs for mount and major user actions to aid observability.
 */

import React, { useCallback, useEffect } from 'react';

import MapRenderer from '../MapRenderer';
import BottomToolbar from '../toolbar/BottomToolbar';
import CanvasHeader from '../bottomUtilityBar/CanvasHeader';
import ROCardDisplay from '@/app/studygraph/(studygraph)/components/layout/ReadOnly/CardDisplay/ROcardDisplay';

import { useZoomContext } from '@/app/Library/Context/ZoomProvider';
import { ZoomActionType } from '@/app/Library/Definitions/Definitions';
import { useSlideShow } from '@/app/Library/Context/SlideShowContext';
import { usePreorderTraversal } from '@/app/studygraph/(studygraph)/components/hooks/usePreorderTraversal';
import { useResourceContext } from '@/app/Library/Context/ResourceContext';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { useColorThemeContext } from '@/app/Library/Context/ColorThemeProvider';
import { useLessonUnitOrder } from '../../../hooks/useLessonUnitOrder';
import { useVersionHistory } from '@/app/Library/Context/VersionHistoryContext';
import { useComments } from '@/app/Library/Context/CommentContext';

import './CanvasView.css';

/**
 * @function ROCanvasView
 * @description
 * Render the read-only canvas screen using the same structural layout and CSS hooks as the main Canvas
 * View. Steps: (1) mount a shared header (editing disabled by a scoped style); (2) render a two-column
 * grid with the read-only concept map on the left and read-only card display on the right; (3) attach a
 * bottom toolbar that exposes only zoom. Header callbacks are routed to safe no-ops or to non-mutating
 * viewer actions (unit-order slideshow, version history, forum). Focused console logs capture mount
 * success and key user inputs to aid production debugging without noisy output.
 */
const ROCanvasView: React.FC = () => {
  // 1) View-only contexts
  const { dispatch: zoomDispatch, zoomLevel } = useZoomContext();
  const { openCustom } = useSlideShow();
  const { getReviewNode, getNodeTitle } = useNodesContext();
  const { selectCueCards } = useResourceContext();
  const { colorTheme } = useColorThemeContext();
  const unitOrderSlides = useLessonUnitOrder();
  const { openHistory } = useVersionHistory();
  const { openForum } = useComments();

  // 2) Pre-compute traversal at top level (Rules of Hooks compliant)
  //    NOTE: Even if not used by header today, keeping top-level traversal available is cheap and safe.
  const preorder = usePreorderTraversal(); // string[]

  // For parity we keep a concept-map-only view in read-only mode
  const activeView: 'conceptMap' = 'conceptMap';

  // 3) Mount log
  useEffect(() => {
    console.log('[ROCanvasView.tsx][5201] mounted: read-only canvas view initialized');
  }, []);

  // 4) Header handlers (read-only safe)
  const handleMenuToggle = useCallback(() => {
    console.log('[ROCanvasView.tsx][5202] header menu toggle requested (no-op in read-only)');
  }, []);

  const handleStartLesson = useCallback(() => {
    console.log('[ROCanvasView.tsx][5203] start lesson → opening unit-order slideshow, slides:', unitOrderSlides.length);
    openCustom(unitOrderSlides);
  }, [openCustom, unitOrderSlides]);

  const handleStartReview = useCallback(() => {
    console.log('[ROCanvasView.tsx][5204] start review (read-only) → opening unit-order slideshow, slides:', unitOrderSlides.length);
    openCustom(unitOrderSlides);
  }, [openCustom, unitOrderSlides]);

  const handleBookmark = useCallback(() => {
    console.log('[ROCanvasView.tsx][5205] bookmark button pressed (no-op in read-only)');
  }, []);

  const handleShare = useCallback(() => {
    console.log('[ROCanvasView.tsx][5206] share button pressed (no-op in read-only)');
  }, []);

  const handleHistory = useCallback(() => {
    console.log('[ROCanvasView.tsx][5207] version history button pressed → opening history UI');
    openHistory();
  }, [openHistory]);

  const handleOpenCalendar = useCallback(() => {
    console.log('[ROCanvasView.tsx][5208] calendar button pressed (no-op placeholder in read-only)');
  }, []);

  // 5) Optional viewer helper: build cue-card slideshow from traversal (non-mutating)
  const openTraversalCueCards = useCallback(() => {
    console.log('[ROCanvasView.tsx][5209] building flashcard slideshow from preorder traversal; nodes:', preorder.length);
    const reviewInfo = getReviewNode();
    const reviewId = reviewInfo.exist ? reviewInfo.id : null;

    // Step 1: Compose final order (append review node last if present)
    const mainOrder = preorder.filter((id) => id !== reviewId);
    const ordered = reviewId ? [...mainOrder, reviewId] : mainOrder;

    // Step 2: Collect cue-card slides in display order
    const cueSlides: any[] = [];
    ordered.forEach((nodeId) => {
      const title = getNodeTitle(nodeId) || 'Untitled';
      selectCueCards(nodeId).forEach((raw) =>
        cueSlides.push({ ...raw, conceptNodeTitle: title })
      );
    });

    console.log('[ROCanvasView.tsx][5210] opening traversal slideshow; slideCount:', cueSlides.length);
    openCustom(cueSlides);
  }, [preorder, getReviewNode, getNodeTitle, selectCueCards, openCustom]);

  // 6) Zoom handlers (read-only)
  const handleZoomIn = useCallback(() => {
    console.log('[ROCanvasView.tsx][5211] zoom in requested; preZoom:', zoomLevel);
    zoomDispatch({ type: ZoomActionType.ZOOM_IN });
  }, [zoomDispatch, zoomLevel]);

  const handleZoomOut = useCallback(() => {
    console.log('[ROCanvasView.tsx][5212] zoom out requested; preZoom:', zoomLevel);
    zoomDispatch({ type: ZoomActionType.ZOOM_OUT });
  }, [zoomDispatch, zoomLevel]);

  // 7) Render
  return (
    <div
      className={`flex-1 flex flex-col map-canvas map-border rounded-md relative ${colorTheme} ro-canvas-view`}
      data-testid="ro-canvas-viewer"
    >
      {/* Step A: Header identical to interactive view, but editing disabled by scoped CSS below */}
      <CanvasHeader
        isSaving={false}
        onMenuToggle={handleMenuToggle}
        onDiscuss={openForum}
        onStartLesson={handleStartLesson}
        onStartReview={handleStartReview}
        onBookmark={handleBookmark}
        onShare={handleShare}
        onVersionHistory={handleHistory}
        onOpenCalendar={handleOpenCalendar}
      />

      {/* Step B: Two-column layout matching CanvasView */}
      <div className="canvas-panels flex-1">
        {/* Left column: read-only map viewport */}
        <div className="map-column flex flex-col relative">
          <div className="map-cell flex-1 relative overflow-hidden">
            <div className={`view-panel map-panel ${activeView !== 'conceptMap' ? 'hidden' : ''}`}>
              <div className={colorTheme}>
                <MapRenderer />
              </div>
            </div>
          </div>

          {/* Bottom Toolbar: zoom only */}
          <BottomToolbar
            activeView={activeView}
            zoomLevel={zoomLevel}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
          />
        </div>

        {/* Right column: read-only card display */}
        <div className="resource-cell">
          <ROCardDisplay />
        </div>
      </div>

      {/* Step C: Scoped style to disable the inline title editor while preserving header visuals */}
      <style jsx global>{`
        .ro-canvas-view .canvas-header__titlewrap {
          pointer-events: none;
        }
        .ro-canvas-view .canvas-header button,
        .ro-canvas-view .canvas-header .ch-nav__trigger,
        .ro-canvas-view .canvas-header .ch-menu__item {
          pointer-events: auto;
        }
      `}</style>
    </div>
  );
};

export default ROCanvasView;
