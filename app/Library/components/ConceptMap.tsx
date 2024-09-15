// bloom-maps/app/Component/ConceptMap.tsx

'use client';

import React, { useState, useRef, useEffect,  RefObject } from 'react';
import ConceptNode from './ConceptNode';
import { CueCard, ConceptNode as ConceptNodeType, colorThemes } from '@/app/Library/Definitions/Definitions'
import ContextMenu from './ContextMenu';
import { drawTreeLines } from '../utils/drawTreeLines'; //'./utils/drawTreeLines';
import { useCompositeLayout } from '../utils/compositeLayout';
import { useResizableMap } from '../hooks/useResizableMap';
import SubtreeVisualizer from './SubtreeVisualizer';
import { useDocumentContext, updateNode } from '@/app/Library/Context/DocumentProvider';


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

  const { width, height, handleMouseDown, offset, } = useResizableMap({ mapRef, centerPaneRef });

  // Define the state variable at the top of your component
     
   // Calculate node positions using the Reingold-Tilford layout
  const firstNodeId = nodes.size > 0 ? nodes.values().next().value.id : 'node-1';
   //const laidOutNodes = useHVTreeLayout(nodes, firstNodeId);
  const laidOutNodes = useCompositeLayout(nodes);
  const [mapWidth ] = useState<number>(defaultMapWidth); // Set to default width
   // Use the rectangle selection hook

  
  /**Helper function for subtree operations */
  function updateSubtreePositions(parentNode: ConceptNodeType, deltaX: number, deltaY: number) {
    const updateChildPositions = (nodeId: string) => {
      const currentNode = nodes.get(nodeId); // Retrieve the current node from the Map
      if (!currentNode) return;

      const newX = (currentNode.x ?? 0) + deltaX;
      const newY = parentNode.isRoot ? (currentNode.y ?? 0) + deltaY : (currentNode.y ?? 0);

      dispatch(updateNode(currentNode.id, { x: newX, y: newY })); // Update node positions via dispatch

      if (currentNode.childrenNodeIds && currentNode.childrenNodeIds.length === 1) {
        const childNodeId = currentNode.childrenNodeIds[0];
        const childNode = nodes.get(childNodeId); // Retrieve the child node from the Map

        if (childNode) {
          dispatch(updateNode(childNode.id, { x: newX })); // Align child node x with parent
        }
      }

      currentNode.childrenNodeIds?.forEach(updateChildPositions);
    };

    updateChildPositions(parentNode.id);
  }
  
  
    const handleRightClick = (event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenuPosition({ x: event.clientX, y: event.clientY });
  };  


  /**const handleViewConcept = (cueCards: CueCard[]) => {
    dispatch(selectCueCards(cueCards)); 
  }; * */

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
  
      // Calculate adjusted positions
      const adjustedX = offsetX - 100; 
      const adjustedY = draggedNode.isRoot ? (offsetY - 75) : (draggedNode.y ?? 0); // Default to 0 if undefined
  
      // Calculate deltas with defaults for undefined positions
      const deltaX = adjustedX - (draggedNode.x ?? 0); // Default to 0 if undefined
      const deltaY = adjustedY - (draggedNode.y ?? 0); // Default to 0 if undefined
  
      // Update the subtree positions and use updateNode for each
      updateSubtreePositions(draggedNode, deltaX, draggedNode.isRoot ? deltaY : 0);
      setDraggedNode(null);
      setIsDraggingSubtree(false);
      setBoundingBox(null);
  };
  

    // Determine line color based on dragging state
   // const lineColor = isDraggingSubtree ? colorThemes[colorTheme][5] : 'black';
  {/** End of click and drag events */}
  

  return (
   <div
   ref={mapRef}
   className="relative bg-white overflow-hidden w-full h-full scrollbar-thin scrollbar-thumb-gray-500 scrollbar-track-gray-200"
   style={{
     transform: `scale(${zoomLevel}) translate(${offset.x}px, ${offset.y}px)`,
     minWidth: `${width}px`, // Minimum height for resizing
     minHeight: `${height}px`, // Minimum width for resizing
     transition: 'transform 0.3s ease, min-height 0.3s ease, min-width 0.3s ease',
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
        className="absolute w-6 h-6 bg-gray-800 cursor-se-resize"
        style={{ bottom: 0, right: 0, zIndex: 10 }}
        onMouseDown={handleMouseDown('both')}
      />
      <div
        className="absolute w-6 h-6 bg-gray-800 cursor-ew-resize"
        style={{ bottom: '50%', right: 0, transform: 'translateY(50%)', zIndex: 10 }}
        onMouseDown={handleMouseDown('horizontal')}
      />
      <div
        className="absolute w-6 h-6 bg-gray-800 cursor-ns-resize"
        style={{ bottom: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}
        onMouseDown={handleMouseDown('vertical')}
      />
      {/* Bottom side handle */}
 
   {/* Main content area of the map */}
   <div style={{ flexGrow: 1, position: 'relative' }}> 
     {/* Render lines between nodes (black lines for the entire tree) */}
     <svg className="absolute top-0 left-0 w-full h-full pointer-events-none">
        {drawTreeLines(laidOutNodes)}
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
  );
}

export default ConceptMap;
