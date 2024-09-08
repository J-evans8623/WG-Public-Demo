// bloom-maps/app/Component/ConceptMap.tsx

'use client';

import React, { useState, useRef, useEffect } from 'react';
import ConceptNode from '@/app/Component/ConceptNode';
import { useDocumentContext } from '@/app/Archived/DocumentProvider';
import { CueCard, ConceptNode as ConceptNodeType } from '@/app/Archived/Definitions/Definitions';
import ContextMenu from '@/app/Component/ContextMenu';
import { drawLines } from '@/app/Component/drawLines';
import  hvTreeLayoutLayout from '@/app/Component/utils/hvTreeLayout';
import { useDynamicMapSize } from '@/app/Component/hooks/useDynamicMapSize';

interface ConceptMapProps {
  groundWidth: number; // New prop for the width of the center pane
}
function ConceptMap({ groundWidth }: ConceptMapProps) {
  const { 
    nodes, 
    selectCueCards,
    updateNode,
    primaryRootNode,
    createSecondaryRootNode,
    zoomLevel,
    defaultMapWidth,
    defaultMapHeight,
  } = useDocumentContext();
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [draggedNode, setDraggedNode] = useState<ConceptNodeType | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  
    // Calculate node positions using the Reingold-Tilford layout
    const laidOutNodes = hvTreeLayoutLayout(nodes, nodes[0]?.id || 'node-1');
    const { minHeight, minWidth, handleMouseDown } = useDynamicMapSize({ mapRef});


const [mapWidth ] = useState<number>(defaultMapWidth); // Set to default width
  /**useEffect(() => {
    // Calculate the map width dynamically
    if (mapRef.current) {
      setMapWidth(mapRef.current.offsetWidth);
    }
  }, [mapRef.current]); // Runs when the map reference changes **/

  useEffect(() => {
    // Initialize root node when the component mounts and mapWidth is available
    if (nodes.length === 0 && mapWidth > 0) {
      primaryRootNode('Root Concept', mapWidth); // Use map width to center the root node
    }
  }, [nodes, mapWidth, primaryRootNode]);

  const handleRightClick = (event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenuPosition({ x: event.clientX, y: event.clientY });
  };

  // Dysfunctional SecondaryMap
  const handleContextMenuOption = (option: string) => {
    setContextMenuPosition(null);
    if (option === 'New Map') {
      if (contextMenuPosition) {
        createSecondaryRootNode('New Root Concept', contextMenuPosition.x, contextMenuPosition.y);
      }
    }
  };

  const handleViewConcept = (cueCards: CueCard[]) => {
    selectCueCards(cueCards);
  };

  {/*  Click and Drag Node events    */}
  const handleDragStart = (node: ConceptNodeType) => {
    setDraggedNode(node);
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    if (!draggedNode) return;



    {/** Map Zoom control */}
    const mapRect = mapRef.current?.getBoundingClientRect();
    const offsetX = (event.clientX - (mapRect?.left ?? 0)) / zoomLevel; // Adjust for zoom level
    const offsetY = (event.clientY - (mapRect?.top ?? 0)) / zoomLevel; // Adjust for zoom level

    const adjustedX = offsetX - 100; 
    const adjustedY = offsetY - 75; 

    updateNode(draggedNode.id, { x: adjustedX, y: adjustedY });
    setDraggedNode(null);

  };

  return (
   <div
   ref={mapRef}
   className="relative bg-white overflow-hidden w-full h-full scrollbar-thin scrollbar-thumb-gray-500 scrollbar-track-gray-200"
   style={{
     transform: `scale(${zoomLevel})`,
     minHeight: `${minHeight}px`, // Minimum height for resizing
     minWidth: `${minWidth}px`, // Minimum width for resizing
     /**
      *      width: `${minWidth}px`,
     height: `${minHeight}px`
      * 
      */
     transition: 'min-height 0.3s ease, min-width 0.3s ease',
     position: 'relative',
     display: 'flex', // Flex for content alignment
     paddingLeft: '0px', // Add extra padding on the left to create additional scroll space
   }}
   onContextMenu={handleRightClick}
   onDragOver={handleDragOver}
   onDrop={handleDrop}
 >
   {/* Visual cues for resizing */}

   <div
        className="absolute w-4 h-4 bg-gray-800 cursor-se-resize"
        style={{ bottom: 0, right: 0, zIndex: 10 }} // Ensure the handle is above other elements
        onMouseDown={handleMouseDown('both')}
      />
      <div
        className="absolute w-4 h-4 bg-gray-800 cursor-ew-resize"
        style={{ bottom: '50%', right: 0, transform: 'translateY(50%)', zIndex: 10 }} // Ensure the handle is above other elements
        onMouseDown={handleMouseDown('horizontal')}
      />
      <div
        className="absolute w-4 h-4 bg-gray-800 cursor-ns-resize"
        style={{ bottom: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }} // Ensure the handle is above other elements
        onMouseDown={handleMouseDown('vertical')}
      />
      {/* Bottom side handle */}
 
   {/* Main content area of the map */}
   <div style={{ flexGrow: 1, position: 'relative' }}>
     {contextMenuPosition && (
       <ContextMenu
         position={contextMenuPosition}
         onSelectOption={handleContextMenuOption}
       />
     )}
 
     {/* Render lines between nodes */}
     <svg className="absolute top-0 left-0 w-full h-full pointer-events-none">
       {drawLines(nodes)}
     </svg>
 
     {nodes.map((node) => {
       if (!node) return null;
       return (
         <ConceptNode
           key={node.id}
           node={node}
           onClick={handleViewConcept}
           onDragStart={handleDragStart}/>
      );
    })}
  </div>
</div>
  );
}

export default ConceptMap;
