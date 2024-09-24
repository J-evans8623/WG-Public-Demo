// bloom-maps/app/Library/utils/drawTreeLines.tsx

import React from 'react';
import { ConceptNode } from '@/app/Library/Definitions/Definitions';
import { drawHVStyleLines } from '../Tests/drawHVStyleLines';
import { drawIndentedStyleLines } from '../Tests/drawIndentedStyleLines';

export function drawTreeLines(nodes: Map<string, ConceptNode>): JSX.Element[] {
    const lineElements: JSX.Element[] = [];
    const lineWidth = 5; // Centralized line width control
  
    // Draw lines for HV style at depth 1
    lineElements.push(...drawHVStyleLines(nodes, lineWidth));
  
    // Draw lines for indented style at depth 2 and beyond
    lineElements.push(...drawIndentedStyleLines(nodes, lineWidth));
  
    return lineElements;
  }
  