import React, { useRef } from 'react';
import { useDocumentContext } from '@/app/Library/Context/DocumentProvider';
import { useSubTreeContext } from '@/app/Library/Tests/SubTreeProvider';
import { useResizableMap } from '@/app/Library/hooks/useResizableMap';
import useKeepMapInView from '@/app/Library/hooks/useKeepMapInView';
import { useCompositeLayout } from '@/app/Library/Tests/compositeLayout';
import ConceptNode from './ConceptNode';
import Subtree from './Subtree';
import { drawHVStyleLines } from '@/app/Library/Tests/drawHVStyleLines';
import { useAutoMapResize } from '@/app/Library/Tests/useAutoMapResize';

interface ConceptMapProps {
  groundWidth: number;
  centerPaneRef: React.RefObject<HTMLDivElement>;
  onOpenCueCardModal: (nodeId: string) => void;
}

function ConceptMap({ groundWidth, centerPaneRef, onOpenCueCardModal }: ConceptMapProps) {
  const { state } = useDocumentContext();
  const { nodes, zoomLevel } = state;
  const { subtrees } = useSubTreeContext();

  const mapRef = useRef<HTMLDivElement>(null);

  useAutoMapResize(mapRef);

  const { width, height } = useResizableMap({ mapRef, centerPaneRef });

  useKeepMapInView({
    mapRef,
    centerPaneRef,
    zoomLevel,
    width,
    height,
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
        minWidth: `${width}px`,
        minHeight: `${height}px`,
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
            left: '50%', // 163 offset?
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
            />
          )}

          {/* Draw lines between the root node and subtrees */}
          <svg
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
            style={{
              overflow: 'visible',
            }}
          >
            {drawHVStyleLines (laidOutNodes, subtrees, 5)}
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
        />
          ))}
        </div>
      </div>
    </div>
  );
}

export default ConceptMap;
