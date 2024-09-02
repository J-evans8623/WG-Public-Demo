// bloom-maps/app/Component/ConceptMap.tsx

'use client';

import React, { useState, useRef, useEffect } from 'react';
import ConceptNode from './ConceptNode';
import { useDocumentContext } from '../Component/context/DocumentProvider';
import { CueCard, ConceptNode as ConceptNodeType } from '@/app/Definitions/Definitions';
import ContextMenu from './ContextMenu';
import { drawLines } from './utils/drawLines'; 

function ConceptMap() {
  const { nodes, selectCueCards, createNewNode, updateNode } = useDocumentContext();
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [draggedNode, setDraggedNode] = useState<ConceptNodeType | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (mapRef.current && !mapRef.current.contains(event.target as Node)) {
        setContextMenuPosition(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleRightClick = (event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenuPosition({ x: event.clientX, y: event.clientY });
  };

  const handleContextMenuOption = (option: string) => {
    setContextMenuPosition(null);
    if (option === 'New Map') {
      createNewNode('New Root Concept');
    }
  };

  const handleViewConcept = (cueCards: CueCard[]) => {
    selectCueCards(cueCards);
  };

  const handleDragStart = (node: ConceptNodeType) => {
    setDraggedNode(node);
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault(); // Allow dropping
  };

  const GRID_SIZE = 20; // Define the size of each grid cell

  const snapToGrid = (value: number) => Math.round(value / GRID_SIZE) * GRID_SIZE;

const handleDrop = (event: React.DragEvent) => {
  event.preventDefault();
  if (!draggedNode) return;

  const mapRect = mapRef.current?.getBoundingClientRect();
  const offsetX = event.clientX - (mapRect?.left ?? 0);
  const offsetY = event.clientY - (mapRect?.top ?? 0);

  // Adjust positioning to center the node under the mouse pointer
  const adjustedX = offsetX - 100; // Assuming node width is 200px
  const adjustedY = offsetY - 75;  // Assuming node height is 150px

   // Snap to nearest grid point
   const snappedX = snapToGrid(adjustedX);
   const snappedY = snapToGrid(adjustedY);
 

   updateNode(draggedNode.id, { x: snappedX, y: snappedY });
  setDraggedNode(null);
};

  return (
    <div
      ref={mapRef}
      className="relative w-full h-full bg-white overflow-auto"
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

      <svg className="absolute top-0 left-0 w-full h-full pointer-events-none">
        {drawLines(nodes)}
      </svg>

      {nodes.map((node) => {
        // Ensure node is defined before rendering ConceptNode
        if (!node) return null; // Skip undefined nodes
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
