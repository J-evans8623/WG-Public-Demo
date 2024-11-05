import React, { memo, useRef, useEffect, useMemo, useCallback } from 'react';
import { useSubTreeContext } from '@/app/Library/Context/SubTreeProvider';
//import useKeepMapInView from '@/app/Library/hooks/useKeepMapInView';
import { useCompositeLayout } from '@/app/Library/utils/compositeLayout';
import ConceptNode from '@/app/Library/components/map/ConceptNode';
import Subtree from './Subtree';
import { drawHVStyleLines } from '@/app/Library/utils/drawHVStyleLines';
import { useAutoMapResize } from '@/app/Library/hooks/useAutoMapResize';
//import { useTreePositioning } from '@/app/Library/hooks/useTreePositioning';

// Import new contexts
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { useZoomContext } from '@/app/Library/Context/ZoomProvider';
import { useLayoutContext } from '@/app/Library/Context/LayoutProvider';

interface ConceptMapProps {
  centerPaneRef: React.RefObject<HTMLDivElement>;
  openModalWithResourceType: (nodeId: string | null, resourceType: 'cueCard' | 'picture' | 'practiceSheet' | undefined, op: 'resource' | 'node') => void;
  onNodeClick: (nodeId: string) => void;
}

const ConceptMap = ({
  centerPaneRef,
  openModalWithResourceType,
  onNodeClick
}: ConceptMapProps) => {
  // Use new context hooks
  const { nodes } = useNodesContext();
  const { zoomLevel } = useZoomContext();
  const { resetMapSize } = useLayoutContext();
  const { subtrees } = useSubTreeContext();

  const mapRef = useRef<HTMLDivElement>(null);

  useAutoMapResize(mapRef);

  const laidOutNodes = useCompositeLayout(nodes || new Map());

  // Ensure that nodes exist and have values
  const rootNode = useMemo(() => {
    return Array.from(nodes.values()).find((node) => node.isRoot);
  }, [nodes]);


  return (
    <div
      ref={mapRef}
      className="relative bg-[#FEFEFE] overflow-hidden w-full h-full scrollbar-thin scrollbar-thumb-gray-500 scrollbar-track-gray-200"
      style={{
        transform: `scale(${zoomLevel})`,
        transformOrigin: 'center center',
        transition:
          'transform 0.3s ease, min-height 0.3s ease, min-width 0.3s ease',
        position: 'relative',
        display: 'flex',
        boxShadow: '0px 4px 8px rgba(0, 0, 0, .5)',
      }}
    >
      <div style={{ flexGrow: 1, position: 'relative' }}>
        {/* TreeContainer */}
        <div
          style={{
            position: 'absolute',
            top: '200px',
            left: '50%', // Keep left at 0
            transform: 'translateX(-162.5px)',
            //transform: `translateX(${offset}px)`, // Use transform for horizontal movement
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
              openModalWithResourceType={openModalWithResourceType}
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
            {drawHVStyleLines(laidOutNodes, subtrees, 5)}
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
                  openModalWithResourceType={openModalWithResourceType}
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
