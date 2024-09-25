import { SubtreeData } from '@/app/Library/Tests/SubTreeProvider';

export function applyHVLayout(
  subtrees: Map<string, SubtreeData>
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();

  const verticalOffset = 225;
  const minHorizontalGap = 50;

  let cumulativeLeftWidth = 0;
  let cumulativeRightWidth = 0;

  let index = 0;

  subtrees.forEach((subtree, nodeId) => {
    const direction = index % 2 === 0 ? 1 : -1;

    let x = 0;
    if (direction > 0) {
      // Right side
      x = cumulativeRightWidth + (index > 0 ? minHorizontalGap : 0);// root debug root
      cumulativeRightWidth += subtree.width + minHorizontalGap;
    } else {
      // Left side
      x = - (cumulativeLeftWidth + subtree.width + (index > 0 ? minHorizontalGap : 0)); // debug root
      cumulativeLeftWidth += subtree.width + minHorizontalGap;
    }

    const y = verticalOffset;

    positions.set(nodeId, { x, y });
    index++;
  });

  return positions;
}
