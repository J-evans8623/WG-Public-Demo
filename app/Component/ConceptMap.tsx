// bloom-maps/app/Component/ConceptMap.tsx

'use client';

import React, { useState, useRef, useEffect } from 'react';
import ConceptNode from './ConceptNode';
import { useDocumentContext } from '../Component/context/DocumentProvider';
import { CueCard } from '@/app/Definitions/Definitions';
import ContextMenu from './ContextMenu'; // Import the new ContextMenu component

function ConceptMap() {
  const { nodes, selectCueCards, createNewNode } = useDocumentContext();
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);
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
    // Handle other options here
  };

  const handleViewConcept = (cueCards: CueCard[]) => {
    selectCueCards(cueCards);
  };

  return (
    <div
      ref={mapRef}
      className="relative w-full h-full bg-white overflow-auto"
      onContextMenu={handleRightClick}
    >
      {/* Render context menu if position is set */}
      {contextMenuPosition && (
        <ContextMenu
          position={contextMenuPosition}
          onSelectOption={handleContextMenuOption}
        />
      )}

      {/* Render concept nodes */}
      {nodes.map((node) => (
        <ConceptNode
          key={node.id}
          node={node}
          onClick={handleViewConcept}
        />
      ))}
    </div>
  );
}

export default ConceptMap;
