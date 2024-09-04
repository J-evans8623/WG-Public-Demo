// bloom-maps/app/Component/hooks/useCheckTreeResize.tsx

import { useState, useEffect } from 'react';
import { ConceptNode } from '@/app/Definitions/Definitions';

interface ResizeCheckResult {
  needsVerticalResize: boolean;
  needsHorizontalResize: boolean;
}

// New hook to calculate tree dimensions and determine if resizing is needed
export function useCheckTreeResize(
  nodes: ConceptNode[],
  mapRef: React.RefObject<HTMLDivElement>
): ResizeCheckResult {
  const [treeHeight, setTreeHeight] = useState<number>(0);
  const [treeWidth, setTreeWidth] = useState<number>(0);
  const [needsVerticalResize, setNeedsVerticalResize] = useState<boolean>(false);
  const [needsHorizontalResize, setNeedsHorizontalResize] = useState<boolean>(false);

  const OFFSET = 100;
  const LINE = 100;
  const NODE_HEIGHT = 150;
  const NODE_WIDTH = 200;

  // Helper functions to calculate tree height and width
  const calculateTreeHeight = (nodes: ConceptNode[], rootId: string): number => {
    const rootNode = nodes.find(node => node.id === rootId);
    if (!rootNode) return 0;

    const getMaxDepth = (node: ConceptNode, depth: number): number => {
      if (!node.childrenNodeIds || node.childrenNodeIds.length === 0) return depth;
      const childDepths = node.childrenNodeIds.map(id => {
        const childNode = nodes.find(n => n.id === id);
        return childNode ? getMaxDepth(childNode, depth + 1) : depth;
      });
      return Math.max(...childDepths);
    };

    return getMaxDepth(rootNode, 1); // Start depth at 1 for root
  };

  const calculateTreeWidth = (nodes: ConceptNode[], rootId: string): number => {
    const levelMap: Record<number, number> = {};

    const traverse = (node: ConceptNode, level: number) => {
      levelMap[level] = (levelMap[level] || 0) + 1;
      node.childrenNodeIds?.forEach(childId => {
        const childNode = nodes.find(n => n.id === childId);
        if (childNode) traverse(childNode, level + 1);
      });
    };

    const rootNode = nodes.find(node => node.id === rootId);
    if (rootNode) traverse(rootNode, 1); // Start at level 1

    return Math.max(...Object.values(levelMap), 0); // Return the maximum number of nodes at any level
  };

  // Effect to calculate and check if resizing is needed
  useEffect(() => {
    if (nodes.length < 1) {
      setNeedsVerticalResize(false);
      setNeedsHorizontalResize(false);
      return;
    }

    const newTreeHeight = calculateTreeHeight(nodes, 'node-1'); // Assuming 'node-1' is the root ID
    const newTreeWidth = calculateTreeWidth(nodes, 'node-1');

    setTreeHeight(newTreeHeight);
    setTreeWidth(newTreeWidth);

    const TOTAL_HEIGHT = NODE_HEIGHT + LINE + OFFSET;
    const TOTAL_WIDTH = NODE_WIDTH + LINE + OFFSET;

    const VERTICAL_WORK_SPACE = newTreeHeight * TOTAL_HEIGHT;
    const HORIZONTAL_WORK_SPACE = newTreeWidth * TOTAL_WIDTH;

    const parentHeight = mapRef.current?.clientHeight || 0;
    const parentWidth = mapRef.current?.clientWidth || 0;

    setNeedsVerticalResize(VERTICAL_WORK_SPACE > 0.75 * parentHeight);
    setNeedsHorizontalResize(HORIZONTAL_WORK_SPACE > 0.75 * parentWidth);
  }, [nodes, mapRef]);

  return { needsVerticalResize, needsHorizontalResize };
}
