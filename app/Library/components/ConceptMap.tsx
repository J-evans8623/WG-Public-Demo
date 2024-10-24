import React, { memo, useRef, useEffect, useMemo, useCallback } from 'react';
import { useSubTreeContext } from '@/app/Library/Context/SubTreeProvider';
import useKeepMapInView from '@/app/Library/hooks/useKeepMapInView';
import { useCompositeLayout } from '@/app/Library/utils/compositeLayout';
import ConceptNode from '@/app/Library/components/ConceptNode';
import Subtree from '@/app/Library/components/Subtree';
import { drawHVStyleLines } from '@/app/Library/utils/drawHVStyleLines';
import { useAutoMapResize } from '@/app/Library/hooks/useAutoMapResize';
import { useTreePositioning } from '@/app/Library/hooks/useTreePositioning';

// Import new contexts
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { useZoomContext } from '@/app/Library/Context/ZoomProvider';
import { useLayoutContext } from '@/app/Library/Context/LayoutProvider';

interface ConceptMapProps {
  groundWidth: number;
  centerPaneRef: React.RefObject<HTMLDivElement>;
  onOpenCueCardModal: (nodeId: string) => void;
  onOpenAddChildModal: (parentNodeId: string) => void;
  onNodeClick: (nodeId: string) => void; // New prop
}

const ConceptMap = ({
  groundWidth,
  centerPaneRef,
  onOpenCueCardModal,
  onOpenAddChildModal,
  onNodeClick
}: ConceptMapProps) => {
  // Use new context hooks
  const { nodes } = useNodesContext();
  const { zoomLevel } = useZoomContext();
  const { resetMapSize } = useLayoutContext();
  const { subtrees } = useSubTreeContext();

  const mapRef = useRef<HTMLDivElement>(null);

  useAutoMapResize(mapRef);

  const { offset } = useTreePositioning(mapRef);

  useKeepMapInView({
    mapRef,
    centerPaneRef,
    zoomLevel,
  });

  const laidOutNodes = useCompositeLayout(nodes || new Map());

  // Ensure that nodes exist and have values
  const rootNode = useMemo(() => {
    return Array.from(nodes.values()).find((node) => node.isRoot);
  }, [nodes]);

  // Memoized handler functions to avoid unnecessary re-renders
  const handleOpenCueCardModal = useCallback(
    (nodeId: string) => {
      onOpenCueCardModal(nodeId);
    },
    [onOpenCueCardModal]
  );

  const handleOpenAddChildModal = useCallback(
    (parentNodeId: string) => {
      onOpenAddChildModal(parentNodeId);
    },
    [onOpenAddChildModal]
  );

  return (
    <div
      ref={mapRef}
      className="relative bg-white overflow-hidden w-full h-full scrollbar-thin scrollbar-thumb-gray-500 scrollbar-track-gray-200"
      style={{
        transform: `scale(${zoomLevel})`,
        transformOrigin: 'top left',
        transition:
          'transform 0.3s ease, min-height 0.3s ease, min-width 0.3s ease',
        position: 'relative',
        display: 'flex',
      }}
    >
      <div style={{ flexGrow: 1, position: 'relative' }}>
        {/* TreeContainer */}
        <div
          style={{
            position: 'absolute',
            top: '200px',
            left: '0px', // Keep left at 0
            transform: `translateX(${offset}px)`, // Use transform for horizontal movement
            transition: 'transform 0.3s ease', // Add transition for smooth movement
            pointerEvents: 'auto',
            width: '100%',
            height: '100%',
          }}
        >
          {rootNode && (
            <ConceptNode
              key={rootNode.id}
              node={rootNode}
              onOpenCueCardModal={handleOpenCueCardModal}
              onOpenAddChildModal={handleOpenAddChildModal}
              onNodeClick={onNodeClick}
            />
          )}

          {/* Draw lines between the root node and subtrees */}
          <svg
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
            style={{
              overflow: 'visible',
            }}
          >
            {drawHVStyleLines(laidOutNodes, subtrees, 4)}
          </svg>

          {/* Render Subtree components */}
          {Array.from(subtrees.entries()).map(
            ([nodeId, subtreeData]) =>
              subtreeData.position && (
                // Only render Subtree if position is not null or undefined
                <Subtree
                  key={nodeId}
                  rootNodeId={nodeId}
                  position={subtreeData.position}
                  width={subtreeData.width}
                  height={subtreeData.height}
                  onOpenCueCardModal={handleOpenCueCardModal}
                  onOpenAddChildModal={handleOpenAddChildModal}
                  onNodeClick={onNodeClick}
                  
                />
              )
          )}
        </div>
      </div>
    </div>
  );
};

ConceptMap.displayName = 'ConceptMap';
ConceptMap.whyDidYouRender = true;

export default memo(ConceptMap);
