// bloom-maps/app/Component/ConceptMap.tsx

'use client';

import React, { useState, useRef, useEffect } from 'react';
import ConceptNode from './ConceptNode';
import { useDocumentContext } from '../Component/context/DocumentProvider';
import { CueCard, ConceptNode as ConceptNodeType } from '@/app/Definitions/Definitions';
import ContextMenu from './ContextMenu';
import { drawLines } from './utils/drawLines'; 

function ConceptMap() {
  const { nodes, selectCueCards, createNewNode, updateNode, initializeRootNode, updateGroundWidth, createSecondaryRootNode } = useDocumentContext();
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [draggedNode, setDraggedNode] = useState<ConceptNodeType | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {

    if (nodes.length === 0) {
      const rootX = window.innerWidth / 2 - 100;
      initializeRootNode('Root Concept', rootX);
      updateGroundWidth(window.innerWidth);
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (mapRef.current && !mapRef.current.contains(event.target as Node)) {
        setContextMenuPosition(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [nodes, initializeRootNode, updateGroundWidth]);

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
    const offsetX = event.clientX - (mapRect?.left ?? 0);
    const offsetY = event.clientY - (mapRect?.top ?? 0);

    const adjustedX = offsetX - 100; 
    const adjustedY = offsetY - 75; 

    updateNode(draggedNode.id, { x: adjustedX, y: adjustedY });
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
