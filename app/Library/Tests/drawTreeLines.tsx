// bloom-maps/app/Library/utils/drawTreeLines.tsx

import React from 'react';
import { ConceptNode } from '@/app/Library/Definitions/Definitions';
import { drawHVStyleLines } from '../Tests/drawHVStyleLines';

export function drawTreeLines(nodes: Map<string, ConceptNode>): JSX.Element[] {
  const lineElements: JSX.Element[] = [];
  const lineWidth = 5; // Centralized line width control

  // Draw lines between the root node and subtrees
  lineElements.push(...drawHVStyleLines(nodes, lineWidth));

  return lineElements;
}
