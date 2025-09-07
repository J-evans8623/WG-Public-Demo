/**
 * @file RoCanvasView.tsx
 * @description
 *   Renders the canvas view containing either a concept-map or a PDF.
 *   Wraps the concept-map renderer in a div whose class equals the current theme.
 *
 * Responsibilities:
 *   • Render TopToolbar and BottomToolbar.
 *   • Wrap `<MapRenderer />` in a `<div className={colorTheme}>` so CSS can theme nodes.
 *   • Preserve existing zoom, pan, and other behaviors.
 *   • Manage and render the ShareModal on demand.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

import MapRenderer from './MapRenderer';
import { useZoomContext } from '@/app/Library/Context/ZoomProvider';
import { ZoomActionType } from '@/app/Library/Definitions/Definitions';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import { useSearchContext } from '@/app/Library/Context/SearchContext';
import BottomToolbar from '../../Canvas/toolbar/BottomToolbar';
import { useSlideShow } from '@/app/Library/Context/ROSlideShowContext';
import { usePreorderTraversal } from '@/app/studygraph/(studygraph)/components/hooks/usePreorderTraversal';
import { useResourceContext } from '@/app/Library/Context/ResourceContext';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import type { ResourceCard } from '@/app/Library/Definitions/Definitions';
import { useColorThemeContext } from '@/app/Library/Context/ColorThemeProvider';
import '@/app/studygraph/(studygraph)/components/layout/Canvas/CanvasView.css';
import { useLessonUnitOrder } from '../../../hooks/useLessonUnitOrder';
import './StatusBanner.css';
import { useVersionHistory } from '@/app/Library/Context/VersionHistoryContext';

export const VHCanvasView: React.FC = ({
}) => {
  /* ───────────────────────────── Context hooks ──────────────────────────── */
 
  
  const { dispatch: zoomDispatch, zoomLevel } = useZoomContext();
  const { multiSelectEnabled, toggleMultiSelectEnabled } = useNodeSelection();
  const { open: openSearchModal } = useSearchContext();
  const { openCustom } = useSlideShow();
  const preorder = usePreorderTraversal();
  const { getReviewNode, getNodeTitle } = useNodesContext();
  const {
    selectCueCards,
  } = useResourceContext();
  const { colorTheme } = useColorThemeContext();
  const { statusMessage, clearStatus } = useVersionHistory();



  const activeView = "conceptMap"

  const UnitOrderslides = useLessonUnitOrder();


  const handleZoomIn = useCallback(() => {
    if (activeView === 'conceptMap') {
      zoomDispatch({ type: ZoomActionType.ZOOM_IN });
    } 
  }, [activeView, zoomDispatch]);

  const handleZoomOut = useCallback(() => {
      zoomDispatch({ type: ZoomActionType.ZOOM_OUT });
  }, [ zoomDispatch]);



  /* ─────────────────────── Slideshow handlers ───────────────────────────── */
  const handleViewAllSlides = () => {
    openCustom(UnitOrderslides);
  };

  const handleViewFlashCards = () => {
    const reviewInfo = getReviewNode();
    const reviewId = reviewInfo.exist ? reviewInfo.id : null;

    const mainNodeOrder = preorder.filter((id) => id !== reviewId);
    const nodeOrder = reviewId
      ? [...mainNodeOrder, reviewId]
      : mainNodeOrder;

    const cueSlidesInOrder: ResourceCard[] = [];
    nodeOrder.forEach((nodeId) => {
      const nodeTitle = getNodeTitle(nodeId) || 'Untitled';

      selectCueCards(nodeId).forEach((raw) =>
        cueSlidesInOrder.push({ ...raw, conceptNodeTitle: nodeTitle })
      );
    });

    openCustom(cueSlidesInOrder);
  };


    useEffect(() => {
    if (!statusMessage) return;
    const timer = window.setTimeout(clearStatus, 3000);
    return () => window.clearTimeout(timer);
  }, [statusMessage, clearStatus]);

  /* ─────────────────────────────── Render ──────────────────────────────── */
  return (
    <div
      className="flex-1 flex flex-col map-canvas map-border rounded-md relative"
      data-testid="canvas-viewer"
    >

{statusMessage && (
  <div className="simple-status-message">
    {statusMessage}
  </div>
)}

      {/* ── Panels container ─────────────────────────────────────────────── */}
      <div className="relative flex-1">
        {/* Concept-Map panel */}
        <div
          className={`view-panel map-panel ${
            activeView !== 'conceptMap' ? 'hidden' : ''
          }`}
        >
          <div className={colorTheme}>
            <MapRenderer/>
          </div>
        </div>

      </div>

      

      {/* ── Bottom Toolbar ─────────────────────────────────────────────────── */}
      <BottomToolbar
        activeView={activeView}
        zoomLevel={ zoomLevel}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
      />
    </div>
  );
};

export default VHCanvasView;
