/**
 * SkeletonNode.tsx
 *
 * Responsibilities:
 *  - Show a lightweight placeholder (gray box + pulsing) for nodes
 *    that haven’t received their real title/content yet.
 */

import React from 'react';

export const SkeletonNode: React.FC<{ width?: number; height?: number }> = ({
  width = 120,
  height = 40,
}) => (
  <div
    className="animate-pulse bg-gray-200 rounded"
    style={{ width: `${width}px`, height: `${height}px` }}
  />
);

export default SkeletonNode;
