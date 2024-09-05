// bloom-maps/app/Component/ConceptMap.tsx

'use client';

import React, { useState, useRef, useEffect } from 'react';
import ConceptNode from './ConceptNode';
import { useDocumentContext } from '../Component/context/DocumentProvider';
import { useTreeSizeContext } from '../Component/context/TreeSizeContext';
import { CueCard, ConceptNode as ConceptNodeType } from '@/app/Definitions/Definitions';
import ContextMenu from './ContextMenu';
import { drawLines } from './utils/drawLines';
import { reingoldTilfordLayout } from './utils/reingoldTilford';
import { useDynamicMapSize } from './hooks/useDynamicMapSize';

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
  } = useDocumentContext();
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [draggedNode, setDraggedNode] = useState<ConceptNodeType | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  const [mapWidth, setMapWidth] = useState<number>(0);
    // Calculate node positions using the Reingold-Tilford layout
    const laidOutNodes = reingoldTilfordLayout(nodes, nodes[0]?.id || 'node-1');
    const { minHeight, minWidth } = useDynamicMapSize({ mapRef, nodes });
    
  
   /** useEffect(() => {
      updateTreeSize(minX, maxX, minY, maxY); // Update state in effect to prevent infinite loop
    }, [minX, maxX, minY, maxY, updateTreeSize]);*/  

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (mapRef.current && !mapRef.current.contains(event.target as Node)) {
        setContextMenuPosition(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    // Calculate the map width dynamically
    if (mapRef.current) {
      setMapWidth(mapRef.current.offsetWidth);
    }
  }, [mapRef.current]); // Runs when the map reference changes

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

  const handleDragStart = (node: ConceptNodeType) => {
    setDraggedNode(node);
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    if (!draggedNode) return;

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
      ref={mapRef}// Testing 
      className="relative bg-white overflow-x-auto w-full h-full scrollbar-thin scrollbar-thumb-gray-500 scrollbar-track-gray-200" // Consider Removing auto flow
      style={{ transform: `scale(${zoomLevel})`, minHeight: `${minHeight}px`, minWidth: `${minWidth}px` }} // Dynamically adjust the size
      onContextMenu={handleRightClick}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
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
            onDragStart={handleDragStart}
          />
        );
      })}
    </div>
  );
}

export default ConceptMap;
