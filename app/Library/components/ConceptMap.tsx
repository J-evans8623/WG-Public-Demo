//bloom-maps\app\Library\Components\ConceptMap.tsx
import React, { useRef, useEffect } from 'react';
import { useDocumentContext } from '@/app/Library/Context/DocumentProvider';
import { useSubTreeContext } from '@/app/Library/Context/SubTreeProvider';
import useKeepMapInView from '@/app/Library/hooks/useKeepMapInView';
import { useCompositeLayout } from '@/app/Library/utils/compositeLayout';
import ConceptNode from '@/app/Library/Tests/ConceptNode';
import Subtree from './Subtree';
import { drawHVStyleLines } from '@/app/Library/utils/drawHVStyleLines';
import { useAutoMapResize } from '@/app/Library/hooks/useAutoMapResize';
import { useTreePositioning } from '@/app/Library/hooks/useTreePositioning';

interface ConceptMapProps {
  groundWidth: number;
  centerPaneRef: React.RefObject<HTMLDivElement>;
  onOpenCueCardModal: (nodeId: string) => void;
  onOpenAddChildModal: (parentNodeId: string) => void;
}

function ConceptMap({ groundWidth, centerPaneRef, onOpenCueCardModal, onOpenAddChildModal}: ConceptMapProps) {
  const { state } = useDocumentContext();
  const { nodes, zoomLevel, resetMapSize } = state; 
  const { subtrees } = useSubTreeContext();

  const mapRef = useRef<HTMLDivElement>(null);

  useAutoMapResize(mapRef);

  const { offset } = useTreePositioning(mapRef);

  useKeepMapInView({
    mapRef,
    centerPaneRef,
    zoomLevel,
  });


  const laidOutNodes= useCompositeLayout(nodes);

  const rootNode = Array.from(nodes.values()).find((node) => node.isRoot);

  return (
    <div
      ref={mapRef}
      className="relative bg-white overflow-hidden w-full h-full scrollbar-thin scrollbar-thumb-gray-500 scrollbar-track-gray-200"
      style={{
        transform: `scale(${zoomLevel})`,
        transformOrigin: 'top left',
        transition: 'transform 0.3s ease, min-height 0.3s ease, min-width 0.3s ease',
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
            left: `${offset}px`, // Adjusted here
            pointerEvents: 'auto',
            width: '100%',
            height: '100%',
          }}
        >
          {rootNode && (
            <ConceptNode
              key={rootNode.id}
              node={rootNode}
              onOpenCueCardModal={onOpenCueCardModal}
              onOpenAddChildModal={onOpenAddChildModal}
            />
          )}

          {/* Draw lines between the root node and subtrees */}
          <svg
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
            style={{
              overflow: 'visible',
            }}
          >
            {drawHVStyleLines (laidOutNodes, subtrees, 4)}
          </svg>

          {/* Render Subtree components */}
          {Array.from(subtrees.entries()).map(([nodeId, subtreeData]) => (
          <Subtree
          key={nodeId}
          rootNodeId={nodeId}
          position={subtreeData.position}
          width={subtreeData.width}
          height={subtreeData.height}
          onOpenCueCardModal={onOpenCueCardModal}
          onOpenAddChildModal={onOpenAddChildModal}
        />
          ))}
        </div>
      </div>
    </div>
  );
}

export default ConceptMap;
