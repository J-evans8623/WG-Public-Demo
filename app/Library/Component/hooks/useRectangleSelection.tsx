import { useState, RefObject } from 'react';
import { ConceptNode } from '@/app/Library/Definitions/Definitions';

export function useRectangleSelection(
  nodes: Map<string, ConceptNode>,
  mapRef: RefObject<HTMLDivElement>
) {
  const [selectionBox, setSelectionBox] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());

  const handleMouseDown = (event: React.MouseEvent) => {
    const mapRect = mapRef.current?.getBoundingClientRect();
    if (!mapRect) return;

    setSelectionBox({
      startX: event.clientX - mapRect.left, // Adjust for the container offset
      startY: event.clientY - mapRect.top,  // Adjust for the container offset
      endX: event.clientX - mapRect.left,
      endY: event.clientY - mapRect.top,
    });
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (selectionBox) {
      const mapRect = mapRef.current?.getBoundingClientRect();
      if (!mapRect) return;

      setSelectionBox((prev) => {
        if (!prev) return null;

        return {
          ...prev,
          endX: event.clientX - mapRect.left, // Adjust for the container offset
          endY: event.clientY - mapRect.top,  // Adjust for the container offset
        };
      });
    }
  };

  const handleMouseUp = () => {
    if (selectionBox) {
      selectNodesWithinRectangle(selectionBox);
      setSelectionBox(null);
    }
  };

  const selectNodesWithinRectangle = (box: { startX: number; startY: number; endX: number; endY: number }) => {
    const newSelectedNodes = new Set<string>();
    nodes.forEach((node) => {
      const nodeCenterX = node.x + 100; // Adjust based on node width
      const nodeCenterY = node.y + 75;  // Adjust based on node height

      if (
        nodeCenterX >= Math.min(box.startX, box.endX) &&
        nodeCenterX <= Math.max(box.startX, box.endX) &&
        nodeCenterY >= Math.min(box.startY, box.endY) &&
        nodeCenterY <= Math.max(box.startY, box.endY)
      ) {
        newSelectedNodes.add(node.id);
      }
    });

    // Ensure all selected nodes are on the same depth level
    const depthLevel = nodes.get(newSelectedNodes.values().next().value)?.y;
    const consistentDepthNodes = Array.from(newSelectedNodes).filter(
      (nodeId) => nodes.get(nodeId)?.y === depthLevel
    );

    if (consistentDepthNodes.length === newSelectedNodes.size) {
      setSelectedNodes(newSelectedNodes);
    } else {
      // Handle invalid selection (e.g., different depth levels)
      setSelectedNodes(new Set());
    }
  };

  return {
    selectionBox,
    selectedNodes,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  };
}
