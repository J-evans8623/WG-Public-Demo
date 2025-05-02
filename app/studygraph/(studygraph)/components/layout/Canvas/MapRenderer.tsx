import React, { useRef, useMemo } from 'react';
import { useZoomContext } from '@/app/Library/Context/ZoomProvider';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { useSubTreeContext } from '@/app/Library/Context/SubTreeProvider';
import { useCompositeLayout } from '@/app/Library/utils/compositeLayout';
import { drawHVStyleLines } from '@/app/Library/utils/drawHVStyleLines';
import ConceptNode from './ConceptNode';
import Subtree from './Subtree';
import '@/app/studygraph/(studygraph)/components/layout/hiddenScrollbar.css';
import '@/app/studygraph/(studygraph)/components/layout/mapTheme.css'

interface MapRendererProps {
}

const MapRenderer: React.FC<MapRendererProps> = () => {
  const scrollableRef = useRef<HTMLDivElement>(null);
  const { zoomLevel } = useZoomContext();
  const { nodes } = useNodesContext();
  const { subtrees } = useSubTreeContext();

  const laidOutNodes = useCompositeLayout(nodes);
  const rootNode = Array.from(nodes.values()).find((node) => node.isRoot);

  const { minX, maxX, minY, maxY } = useMemo(() => {
    let minX_ = Infinity,
      maxX_ = -Infinity;
    let minY_ = Infinity,
      maxY_ = -Infinity;

    subtrees.forEach((subtree) => {
      if (!subtree.position) return;
      const left = subtree.position.x;
      const right = subtree.position.x + subtree.width;
      const top = subtree.position.y;
      const bottom = subtree.position.y + subtree.height;
      if (left < minX_) minX_ = left;
      if (right > maxX_) maxX_ = right;
      if (top < minY_) minY_ = top;
      if (bottom > maxY_) maxY_ = bottom;
    });

    laidOutNodes.forEach((node) => {
      if (node.x != null && node.y != null) {
        if (node.x < minX_) minX_ = node.x;
        if (node.x > maxX_) maxX_ = node.x;
        if (node.y < minY_) minY_ = node.y;
        if (node.y > maxY_) maxY_ = node.y;
      }
    });

    if (minX_ === Infinity) minX_ = 0;
    if (maxX_ === -Infinity) maxX_ = 0;
    if (minY_ === Infinity) minY_ = 0;
    if (maxY_ === -Infinity) maxY_ = 0;

    return { minX: minX_, maxX: maxX_, minY: minY_, maxY: maxY_ };
  }, [laidOutNodes, subtrees]);

  const mapWidth = maxX - minX;
  const mapHeight = maxY - minY;

  return (
    <div
      ref={scrollableRef}
      className="absolute inset-0 overflow-auto map-canvas hidden-scrollbar"
    >
      <div
        style={{
          position: 'relative',
          margin: '200px auto 0',
          width: `${mapWidth}px`,
          height: `${mapHeight}px`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            transform: `translate(${-minX}px, ${-minY}px) scale(${zoomLevel})`,
            transformOrigin: 'top left',
            width: `${mapWidth}px`,
            height: `${mapHeight}px`,
          }}
        >
          {rootNode && <ConceptNode key={rootNode.id} node={rootNode} />}
          <svg
            className="absolute top-0 left-0 pointer-events-none"
            width={mapWidth}
            height={mapHeight}
            style={{ overflow: 'visible' }}
          >
            {drawHVStyleLines(laidOutNodes, subtrees, 3)}
          </svg>
          {Array.from(subtrees.entries()).map(([nodeId, subtreeData]) => {
            if (!subtreeData.position) return null;
            return (
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
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MapRenderer;
