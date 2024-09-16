// bloom-maps/app/Component/ConceptMap.tsx

'use client';

import React, { useState, useRef, useEffect,  RefObject } from 'react';
import ConceptNode from '@/app/Library/components/ConceptNode' //'./ConceptNode';
import { CueCard, ConceptNode as ConceptNodeType, colorThemes } from '@/app/Library/Definitions/Definitions'
import ContextMenu from '@/app/Library/components/ContextMenu'; // ./ContextMenu
import { drawTreeLines } from '../utils/drawTreeLines'; //'./utils/drawTreeLines';
import { useCompositeLayout } from '../utils/compositeLayout';
import { useResizableMap } from '../hooks/useResizableMap';//hooks
import SubtreeVisualizer from '@/app/Library/components/SubtreeVisualizer';   //  './SubtreeVisualizer';
import { useDocumentContext, updateNode } from '@/app/Library/Context/DocumentProvider';
import useKeepMapInView from '@/app/Library/hooks/useKeepMapInView';
import { useAutoMapResize } from '@/app/Library/hooks/useAutoMapResize';

interface ConceptMapProps {
  groundWidth: number; 
  centerPaneRef: RefObject<HTMLDivElement>; 
  onOpenCueCardModal: (nodeId: string) => void;
}


function ConceptMap({ groundWidth, centerPaneRef, onOpenCueCardModal }: ConceptMapProps & { centerPaneRef: RefObject<HTMLDivElement> }){
  const { state, dispatch } = useDocumentContext();
  const { nodes, getLayout, defaultMapWidth, defaultMapHeight, zoomLevel } = state; // zoomLevel

  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [draggedNode, setDraggedNode] = useState<ConceptNodeType | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const [isDraggingSubtree, setIsDraggingSubtree] = useState<boolean>(false); // State for subtree dragging
  const [boundingBox, setBoundingBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null); // State for bounding box

  const { width, height} = useResizableMap({ mapRef, centerPaneRef }); //handleMouseDown
  
  // Initialize offset state

  // Use the custom hook to keep the map in view
  useKeepMapInView({ 
    mapRef, 
    centerPaneRef, 
    zoomLevel, 
    width, 
    height 
  });
  // Define the state variable at the top of your component
     
  const firstNodeId = nodes.size > 0 ? nodes.values().next().value.id : 'node-1';
   //const laidOutNodes = useHVTreeLayout(nodes, firstNodeId);
  const laidOutNodes = useCompositeLayout(nodes);
  const [mapWidth ] = useState<number>(defaultMapWidth); // Set to default width
   
   // Check if map needs to resize
   useAutoMapResize(mapRef);
 
  
    const handleRightClick = (event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenuPosition({ x: event.clientX, y: event.clientY });
  };  

  {/*  Click and Drag Node events    */}
  const handleDragStart = (node: ConceptNodeType) => {
    setDraggedNode(node);
    setIsDraggingSubtree(true);

    // Calculate bounding box for the subtree
    const subtreeNodes = getSubtreeNodes(node.id);

    // Handle undefined positions by using 0 as the default
    const xPositions = subtreeNodes.map((n) => n.x ?? 0);
    const yPositions = subtreeNodes.map((n) => n.y ?? 0);

    const minX = Math.min(...xPositions);
    const minY = Math.min(...yPositions);
    const maxX = Math.max(...xPositions) + 200; // Node width
    const maxY = Math.max(...yPositions) + 150; // Node height

    setBoundingBox({
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
    });
};

  

  const getSubtreeNodes = (nodeId: string): ConceptNodeType[] => {
    const rootNode = nodes.get(nodeId); // Retrieve the node from the Map
    if (!rootNode) return []; // Return an empty array if the node does not exist
  
    const subtree: ConceptNodeType[] = [rootNode];
  
    if (rootNode.childrenNodeIds) {
      rootNode.childrenNodeIds.forEach((childId) => {
        subtree.push(...getSubtreeNodes(childId)); // Recursively get subtree nodes
      });
    }
  
    return subtree;
  };

 
  return (
    <div
      ref={mapRef}
      className="relative bg-white overflow-hidden w-full h-full scrollbar-thin scrollbar-thumb-gray-500 scrollbar-track-gray-200"
      style={{
        transform: `scale(${zoomLevel})`,
        transformOrigin: 'top left',
        minWidth: `${width}px`, // Minimum width for resizing
        minHeight: `${height}px`, // Minimum height for resizing
        transition: 'transform 0.3s ease, min-height 0.3s ease, min-width 0.3s ease',
        position: 'relative',
        display: 'flex', // Flex for content alignment
      }}
      onContextMenu={handleRightClick}
      //onDragOver={handleDragOver}
      //onDrop={handleDrop}
    >

      {/* Main content area of the map */}
      <div style={{ flexGrow: 1, position: 'relative' }}>
        {/* TreeContainer Div */}
        <div
          style={{
            position: 'absolute',
            top: '200px', // Adjust positioning as needed
            left: '50%',
            pointerEvents: 'auto', // Allows pointer events on children
            width: '100%', // Ensure the TreeContainer takes up space
            height: '100%', // Ensure the TreeContainer takes up space
          }}
        >
          {/* Render lines between nodes (black lines for the entire tree) */}
          <svg
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
            style={{
              overflow: 'visible', // Ensure overflow is visible for lines
            }}
          >
            {drawTreeLines(laidOutNodes)}
          </svg>
  
          {/* Render all nodes relative to the TreeContainer */}
          {Array.from(nodes.values()).map((node) => {
            if (!node) return null;
            return (
              <ConceptNode
                key={node.id}
                node={node}
                onDragStart={handleDragStart}
                onOpenCueCardModal={onOpenCueCardModal}
              />
            );
          })}
        </div>
      </div>
    </div>
  );  
}
  export default ConceptMap;
