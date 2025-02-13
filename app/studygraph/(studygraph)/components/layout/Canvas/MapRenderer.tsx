/**
 * @file MapRenderer.tsx
 * @description Renders the map view including the root node and its subtrees.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useZoomContext } from '@/app/Library/Context/ZoomProvider';
import ConceptNode from './ConceptNode';
import Subtree from './Subtree';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { useSubTreeContext } from '@/app/Library/Context/SubTreeProvider';
import { useCompositeLayout } from '@/app/Library/utils/compositeLayout';
import { drawHVStyleLines } from '@/app/Library/utils/drawHVStyleLines';

interface MapRendererProps {
  viewportRef: React.RefObject<HTMLDivElement>;
}

const MapRenderer: React.FC<MapRendererProps> = ({ viewportRef }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const { zoomLevel } = useZoomContext();
  const { nodes } = useNodesContext();
  const { subtrees, getTotalSubtreeWidths, getMaxSubtreeHeight } = useSubTreeContext();

  //––– Note: All “base” numbers have been scaled by 0.75.
  const [isPanning, setIsPanning] = useState(false);
  const [panPosition, setPanPosition] = useState({ x: 243.75, y: 150 });
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });

  const rootRef = useRef<HTMLDivElement>(null);
  const [initialRootPosition, setInitialRootPosition] = useState<{ x: number; y: number } | null>(null);

  const laidOutNodes = useCompositeLayout(nodes);
  const rootNode = Array.from(nodes.values()).find((node) => node.isRoot);

  const SVGcontentWidth = getTotalSubtreeWidths();
  const SVGcontentHeight = getMaxSubtreeHeight();

  const centerMapOnRoot = useCallback(() => {
    const BASE_OFFSET = { x: 243.75, y: 150 };
    console.log(`Zoom level :${zoomLevel}`);
    if (!viewportRef.current) return;

    const viewportRect = viewportRef.current.getBoundingClientRect();
    const viewportCenter = {
      x: viewportRect.left + window.scrollX + viewportRect.width / 2,
      y: viewportRect.top + window.scrollY + viewportRect.height / 2,
    };

    let currentRootCenter;
    if (rootRef.current) {
      const currentRect = rootRef.current.getBoundingClientRect();
      currentRootCenter = {
        x: currentRect.left + window.scrollX + currentRect.width / 2,
        y: currentRect.top + window.scrollY + currentRect.height / 2,
      };
    } else {
      currentRootCenter = {
        x: viewportCenter.x - (BASE_OFFSET.x / 2),
        y: viewportCenter.y - (BASE_OFFSET.y / 2),
      };
    }

    if (!initialRootPosition) {
      setInitialRootPosition(currentRootCenter);
      const dx = viewportCenter.x - currentRootCenter.x;
      const dy = viewportCenter.y - currentRootCenter.y;
      setPanPosition({ x: BASE_OFFSET.x + dx, y: BASE_OFFSET.y + dy });
      return;
    }

    const dx = initialRootPosition.x - currentRootCenter.x;
    const dy = initialRootPosition.y - currentRootCenter.y;
    setPanPosition(prev => ({ x: prev.x + dx, y: prev.y + dy }));
  }, [viewportRef, initialRootPosition]);

  const centerMapInViewport = useCallback(() => {
    if (!viewportRef.current) return;
    const viewportRect = viewportRef.current.getBoundingClientRect();
    const viewportAbsolute = {
      top: viewportRect.top + window.scrollY,
      left: viewportRect.left + window.scrollX,
      width: viewportRect.width,
      height: viewportRect.height,
    };
    const viewportCenter = {
      x: viewportAbsolute.left + viewportAbsolute.width / 2,
      y: viewportAbsolute.top + viewportAbsolute.height / 2,
    };

    const intrinsicCenter = {
      x: SVGcontentWidth ? SVGcontentWidth / 2 : 243.75,
      y: SVGcontentHeight ? SVGcontentHeight / 2 : 150,
    };

    const newPanPosition = {
      x: viewportCenter.x - intrinsicCenter.x * zoomLevel,
      y: viewportCenter.y - intrinsicCenter.y * zoomLevel,
    };

    setPanPosition(newPanPosition);
  }, [viewportRef, SVGcontentWidth, SVGcontentHeight, zoomLevel]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const handleCenterMap = () => centerMapOnRoot();
    viewport.addEventListener('centerMap', handleCenterMap);
    return () => viewport.removeEventListener('centerMap', handleCenterMap);
  }, [centerMapOnRoot, viewportRef]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && mapRef.current) {
      e.preventDefault();
      setIsPanning(true);
      setStartPan({
        x: e.clientX - panPosition.x,
        y: e.clientY - panPosition.y,
      });
      mapRef.current.style.cursor = 'grabbing';
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      const newX = e.clientX - startPan.x;
      const newY = e.clientY - startPan.y;
      setPanPosition({ x: newX, y: newY });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    if (mapRef.current) {
      mapRef.current.style.cursor = 'grab';
    }
  };

  return (
    <div 
      ref={mapRef}
      className="absolute inset-0 overflow-hidden bg-[#FAFAFA] cursor-grab select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div
        ref={contentRef}
        data-testid="map-content"
        className="absolute"
        style={{
          transform: `translate(${panPosition.x / 16}rem, ${panPosition.y / 16}rem) scale(${zoomLevel})`,
          transformOrigin: 'center center',
          transition: isPanning ? 'none' : 'transform 0.3s ease',
          width: `${SVGcontentWidth / 16}rem`,
          height: `${SVGcontentHeight / 16}rem`,
        }}
      >
        {rootNode && <ConceptNode ref={rootRef} key={rootNode.id} node={rootNode} />}
        <svg
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
          style={{ overflow: 'visible' }}
        >
          {drawHVStyleLines(laidOutNodes, subtrees, 3)}
        </svg>
        {Array.from(subtrees.entries()).map(
          ([nodeId, subtreeData]) =>
            subtreeData.position && (
              <Subtree
                key={nodeId}
                rootNodeId={nodeId}
                position={subtreeData.position}
                width={subtreeData.width}
                height={subtreeData.height}
                openModalWithResourceType={(nodeId, type, op) => {
                  console.log('Open modal:', { nodeId, type, op });
                }}
                onNodeClick={(nodeId) => {
                  console.log('Node clicked:', nodeId);
                }}
              />
            )
        )}
      </div>
    </div>
  );
};

export default MapRenderer;
