// bloom-maps/app/Component/ConceptMap.tsx

'use client';

import React, { useState, useRef, useEffect } from 'react';
import ConceptNode from './ConceptNode';
import { useDocumentContext } from './DocumentProvider';
import { CueCard, ConceptNode as ConceptNodeType, colorThemes } from '@/app/Archived/Definitions/Definitions';
import ContextMenu from './ContextMenu';
import { drawLines } from './utils/drawLines';
import { useHVTreeLayout } from './utils/hvTreeLayout';
import { usePositionTracking } from '@/app/Archived/PositionTrackingContext'; // Import the context
import { useResizableMap } from './hooks/useResizableMap';
import SubtreeVisualizer from './SubtreeVisualizer'; // Import SubtreeVisualizer

interface ConceptMapProps {
  groundWidth: number; 
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
    getLayout,
    initializeNewDocument,
    setGetLayout,
    colorTheme,
  } = useDocumentContext();

  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [draggedNode, setDraggedNode] = useState<ConceptNodeType | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const [isDraggingSubtree, setIsDraggingSubtree] = useState<boolean>(false); // State for subtree dragging
  const [boundingBox, setBoundingBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null); // State for bounding box

  const { width, height, handleMouseDown, offset } = useResizableMap({
    mapRef,
    initialWidth: 2000,
    initialHeight: 1400, // Default initial height and width
  });

     
   // Calculate node positions using the Reingold-Tilford layout
    const laidOutNodes = useHVTreeLayout(nodes, nodes[0]?.id || 'node-1');



  const [mapWidth ] = useState<number>(defaultMapWidth); // Set to default width
  
  /**Helper function for subtree operations */
  function updateSubtreePositions(parentNode: ConceptNodeType, deltaX: number, deltaY: number) {
    const updateChildPositions = (nodeId: string) => {
      const currentNode = nodes.find((n) => n.id === nodeId);
      if (!currentNode) return;
  
      // Calculate new positions
      const newX = currentNode.x + deltaX;
      // Apply vertical delta if the parent node is a root; otherwise, keep the y position unchanged
      const newY = parentNode.isRoot ? currentNode.y + deltaY : currentNode.y;
  
      // Use the updateNode function to update the global state
      updateNode(currentNode.id, { x: newX, y: newY });


      // Check if the current node has exactly one child
    if (currentNode.childrenNodeIds && currentNode.childrenNodeIds.length === 1) {
      const childNodeId = currentNode.childrenNodeIds[0];
      const childNode = nodes.find((n) => n.id === childNodeId);
      
      if (childNode) {
        // Assign the child node the same x-coordinate as the parent to align them
        updateNode(childNode.id, { x: newX }); // Align child node x with parent
      }
    }

  
      // Recursively update child nodes
      currentNode.childrenNodeIds?.forEach(updateChildPositions);
    };
  
    // Update the positions for the subtree starting from the parent node
    updateChildPositions(parentNode.id);
  }
  
  
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
    setIsDraggingSubtree(true);
  
    // Calculate bounding box for the subtree
    const subtreeNodes = getSubtreeNodes(node.id);
    const xPositions = subtreeNodes.map((n) => n.x);
    const yPositions = subtreeNodes.map((n) => n.y);
  
    const minX = Math.min(...xPositions);
    const minY = Math.min(...yPositions);
    const maxX = Math.max(...xPositions) + 200; // Node width
    const maxY = Math.max(...yPositions) + 150; // Node height
  
    /** Convert to viewport coordinates using zoom level
    const adjustedMinX = minX * zoomLevel;
    const adjustedMinY = minY * zoomLevel;
    const adjustedWidth = (maxX - minX) * zoomLevel;
    const adjustedHeight = (maxY - minY) * zoomLevel;*/
  
    setBoundingBox({
      x: minX,
      y: minY,
      width:  maxX - minX,
      height: maxY - minY,
    });
  };
  

  const getSubtreeNodes = (nodeId: string): ConceptNodeType[] => {
    const rootNode = nodes.find((node) => node.id === nodeId);
    if (!rootNode) return [];

    const subtree: ConceptNodeType[] = [rootNode];
    if (rootNode.childrenNodeIds) {
      rootNode.childrenNodeIds.forEach((childId) => {
        subtree.push(...getSubtreeNodes(childId));
      });
    }

    return subtree;
  };

  const handleDragOver = (event: React.DragEvent) => {
    if (!draggedNode) return;
  
    event.preventDefault();
  
    const mapRect = mapRef.current?.getBoundingClientRect();
    const offsetX = (event.clientX - (mapRect?.left ?? 0)) / zoomLevel; // Adjust for zoom level
    const offsetY = (event.clientY - (mapRect?.top ?? 0)) / zoomLevel; // Adjust for zoom level
  
    if (boundingBox) {
      // Update bounding box position dynamically during drag
      setBoundingBox({
        ...boundingBox,
        x: offsetX - boundingBox.width / 2,
        y: offsetY - 75, // vertical offset  
      });
    }
  };
  

    {/** Dragged node control with incoporated zoom level scale */}
    const handleDrop = (event: React.DragEvent) => {
      event.preventDefault();
    
      if (!draggedNode) return;
    
      const mapRect = mapRef.current?.getBoundingClientRect();
      const offsetX = (event.clientX - (mapRect?.left ?? 0)) / zoomLevel; // Adjust for zoom level
      const offsetY = (event.clientY - (mapRect?.top ?? 0)) / zoomLevel; // Adjust for zoom level
    
      const adjustedX = offsetX - 100; 
      const adjustedY = draggedNode.isRoot ? (offsetY - 75) : draggedNode.y;
    
      const deltaX = adjustedX - draggedNode.x;
      const deltaY = adjustedY - draggedNode.y;
    
      // Update the subtree positions and use updateNode for each
      updateSubtreePositions(draggedNode, deltaX, draggedNode.isRoot ? deltaY : 0);
      setDraggedNode(null);
      setIsDraggingSubtree(false);
      setBoundingBox(null);
    };


    // Determine line color based on dragging state
    const lineColor = isDraggingSubtree ? colorThemes[colorTheme][5] : 'black';
  {/** End of click and drag events */}
  

  return (
   <div
   ref={mapRef}
   className="relative bg-white overflow-hidden w-full h-full scrollbar-thin scrollbar-thumb-gray-500 scrollbar-track-gray-200"
   style={{
     transform: `scale(${zoomLevel}) translate(${offset.x}px, ${offset.y}px)`,
     minWidth: `${width}px`, // Minimum height for resizing
     minHeight: `${height}px`, // Minimum width for resizing
     transition: 'min-height 0.3s ease, min-width 0.3s ease',
     position: 'relative',
     display: 'flex', // Flex for content alignment
     
   }}
   onContextMenu={handleRightClick}
   onDragOver={handleDragOver}
   onDrop={handleDrop}
 >
  {/* Render the Subtree Visualizer when dragging */}
  {isDraggingSubtree && draggedNode && <SubtreeVisualizer movingNodeId={draggedNode.id} />}

{/* Resizable Handles */}
<div
        className="absolute w-4 h-4 bg-gray-800 cursor-se-resize"
        style={{ bottom: 0, right: 0, zIndex: 10 }}
        onMouseDown={handleMouseDown('both')}
      />
      <div
        className="absolute w-4 h-4 bg-gray-800 cursor-ew-resize"
        style={{ bottom: '50%', right: 0, transform: 'translateY(50%)', zIndex: 10 }}
        onMouseDown={handleMouseDown('horizontal')}
      />
      <div
        className="absolute w-4 h-4 bg-gray-800 cursor-ns-resize"
        style={{ bottom: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}
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
 
     {/* Render lines between nodes (black lines for the entire tree) */}
     <svg className="absolute top-0 left-0 w-full h-full pointer-events-none">
        {drawLines(nodes, 'black')}
      </svg>


       { isDraggingSubtree && draggedNode && <SubtreeVisualizer movingNodeId={draggedNode.id} /> }

            {/* Render the dashed bounding box for the subtree */}
            {isDraggingSubtree && boundingBox && (
         <div
         style={{
          position: 'absolute',
          left: `${boundingBox.x}px`,
          top: `${boundingBox.y}px`,
          width: `${boundingBox.width}px`,
          height: `${boundingBox.height}px`,
          border: '2px dashed #1E90FF', // Use a brighter color
          borderWidth: '3px', // Increase stroke width for better visibility
          borderStyle: 'dashed', // Ensure the border is dashed
          borderColor: '#1E90FF', // Set a more contrasting color
          pointerEvents: 'none',
          opacity: 1, // Ensure full opacity
          zIndex: 10, // Ensure the box is above other elements
         }}
       />
      )}

      {/* Render the Subtree Visualizer when dragging (highlighted lines for the subtree) */}
     
 

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
