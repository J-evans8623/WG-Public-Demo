/**
 * @file ROCanvasView.tsx
 * @description
 * Read-Only Canvas View (ROCanvasView) composes the read-only concept-map workspace with the read-only
 * resource pane into a single screen that mirrors the interactive Canvas View's DOM structure, class
 * names, and CSS hooks. This file intentionally reuses the shared header (CanvasHeader), grid layout
 * (.canvas-panels), and panel classes (.map-column, .map-cell, .view-panel, .map-panel, .resource-cell)
 * so that spacing, borders, and theme tokens remain pixel-aligned with the original. All mutating
 * pathways (inline title edit, write operations) are disabled, while safe viewer actions—zoom via the
 * BottomToolbar and slideshow viewing via unit-order—remain available. To support future debugging,
 * purposeful console logs (tagged with file name + unique 4-digit codes) cover mount and primary user
 * intents (zoom, slideshow). This implementation also corrects a prior Rules-of-Hooks violation by
 * lifting `usePreorderTraversal()` to the component's top level and eliminating unnecessary type casts.
 *
 * Responsibilities:
 *   1) Render the header visually identical to Canvas View while preventing inline title edits.
 *   2) Recreate the two-column grid with read-only map (left) and read-only card display (right).
 *   3) Provide zoom controls in the BottomToolbar without exposing any mutating behaviors.
 *   4) Preserve all original CSS classes and imports to guarantee style parity.
 *   5) Emit focused logs for mount and major user actions to aid observability.
 */

import React, { useCallback, useEffect, useState } from 'react';

import MapRenderer from '@/app/studygraph/(studygraph)/components/layout/ReadOnly/map/MapRenderer';
import BottomToolbar from '../toolbar/BottomToolbar';
import CanvasHeader from '../bottomUtilityBar/RoCanvasHeader';
import ROCardDisplay from '@/app/studygraph/(studygraph)/components/layout/ReadOnly/CardDisplay/ROcardDisplay';

import { useZoomContext } from '@/app/Library/Context/ZoomProvider';
import { ZoomActionType } from '@/app/Library/Definitions/Definitions';
import { useSlideShow } from '@/app/Library/Context/ROSlideShowContext';
import { usePreorderTraversal } from '@/app/studygraph/(studygraph)/components/hooks/usePreorderTraversal';
import { useResourceContext } from '@/app/Library/Context/ResourceContext';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { useColorThemeContext } from '@/app/Library/Context/ColorThemeProvider';
import { useLessonUnitOrder } from '../../../hooks/useLessonUnitOrder';
import { useVersionHistory } from '@/app/Library/Context/VersionHistoryContext';
import { useComments } from '@/app/Library/Context/CommentContext';
import { useSelectionAttachment } from '@/app/Library/Context/SelectionAttachmentContext';
import { useSearchContext } from '@/app/Library/Context/SearchContext';

import '../CanvasView.css';


type Mode = 'note' | 'edit' | 'chat';

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
  const preorder = usePreorderTraversal();

  // For parity we keep a concept-map-only view in read-only mode
  const activeView: 'conceptMap' = 'conceptMap';

  // 3) CardDisplay mode state (matching CanvasView)
  const [CardDisplaymode, setCardDisplayMode] = useState<Mode>('note');
  
  // 4) Handle attachment context for CardDisplay
  const { isAskOpen, isExploreOpen, isQuizOpen } = useSelectionAttachment();
  const { selectedResultIds } = useSearchContext();

  // Auto-switch CardDisplay mode based on context (matching CanvasView behavior)
  useEffect(() => {
    if (isAskOpen) setCardDisplayMode('chat');
    else if (isExploreOpen || isQuizOpen) setCardDisplayMode('note');
  }, [isAskOpen, isExploreOpen, isQuizOpen]);

  useEffect(() => {
    if (selectedResultIds.length > 0) setCardDisplayMode('note');
  }, [selectedResultIds]);

  // 5) Mount log
  useEffect(() => {
    console.log('[ROCanvasView.tsx][5201] mounted: read-only canvas view initialized');
  }, []);

  // 6) Header handlers (read-only safe)
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

  // 7) Zoom handlers (read-only)
  const handleZoomIn = useCallback(() => {
    console.log('[ROCanvasView.tsx][5211] zoom in requested; preZoom:', zoomLevel);
    zoomDispatch({ type: ZoomActionType.ZOOM_IN });
  }, [zoomDispatch, zoomLevel]);

  const handleZoomOut = useCallback(() => {
    console.log('[ROCanvasView.tsx][5212] zoom out requested; preZoom:', zoomLevel);
    zoomDispatch({ type: ZoomActionType.ZOOM_OUT });
  }, [zoomDispatch, zoomLevel]);

  // 8) CardDisplay tab change handlers (matching CanvasView)
  const handleCardDisplayTabChange = (mode: Mode) => {
    setCardDisplayMode(mode);
  };

  const handleCardDisplayTabChangeChat = () => {
    setCardDisplayMode('chat');
  };

  // 9) Render - Match CanvasView structure exactly
  return (
    <div
      className={`flex-1 flex flex-col map-canvas map-border rounded-md relative ${colorTheme}`}
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

      {/* Step B: Two-column layout matching CanvasView with canvas-panels class */}
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
            // Read-only: no undo/redo
            canUndo={false}
            canRedo={false}
            onUndo={() => console.log('[ROCanvasView.tsx][5213] undo disabled in read-only')}
            onRedo={() => console.log('[ROCanvasView.tsx][5214] redo disabled in read-only')}
          />
        </div>

        {/* Right column: CardDisplay (matching CanvasView) */}
        <div className="resource-cell">
          <ROCardDisplay askHandler={handleCardDisplayTabChangeChat}/>
        </div>
      </div>
    </div>
  );
};

export default ROCanvasView;