'use client';

import React, { useState, useEffect } from 'react';
import { useDocumentContext } from '@/app/Library/Context/DocumentProvider';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import { ConceptNode } from '@/app/Library/Definitions/Definitions';
import { FaChevronDown, FaChevronRight } from 'react-icons/fa';

const ConceptBank: React.FC = () => {
  const { state } = useDocumentContext();
  const { nodes } = state;
  const { isSelected, selectNode, deselectNode } = useNodeSelection();
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Confine content to a scrollable box
  const containerStyle: React.CSSProperties = {
    maxHeight: '400px', // Adjust height as needed
    overflowY: 'auto',
  };

  const toggleNodeExpansion = (nodeId: string) => {
    const newExpandedNodes = new Set(expandedNodes);
    if (newExpandedNodes.has(nodeId)) {
      newExpandedNodes.delete(nodeId);
    } else {
      newExpandedNodes.add(nodeId);
    }
    setExpandedNodes(newExpandedNodes);
  };

  const handleNodeClick = (nodeId: string) => {
    if (isSelected(nodeId)) {
      deselectNode(nodeId);
    } else {
      selectNode(nodeId);
    }
  };

  const renderNode = (node: ConceptNode) => {
    const hasChildren = node.childrenNodeIds && node.childrenNodeIds.length > 0;
    const isExpanded = expandedNodes.has(node.id);
    const selected = isSelected(node.id);

    return (
      <div key={node.id} className="mb-2">
        {/* Node Header */}
        <div className="flex items-center">
          <button
            onClick={() => toggleNodeExpansion(node.id)}
            className="focus:outline-none"
          >
            {hasChildren ? (
              isExpanded ? (
                <FaChevronDown />
              ) : (
                <FaChevronRight />
              )
            ) : (
              <div className="w-4"></div>
            )}
          </button>
          <button
            onClick={() => handleNodeClick(node.id)}
            className={`ml-2 flex-1 text-left ${
              selected ? 'font-bold text-blue-500' : ''
            }`}
          >
            {node.title}
          </button>
        </div>

        {/* Children Nodes */}
        {isExpanded && hasChildren && (
          <div className="mt-2">
            {node.childrenNodeIds!.map((childId) => {
              const childNode = nodes.get(childId);
              return childNode ? renderNode(childNode) : null;
            })}
          </div>
        )}

        {/* Atomic Operations */}
        {isExpanded && (
          <div className="ml-6 mt-2 flex space-x-2">
            {/* Placeholder for atomic operation buttons */}
            <button className="text-sm text-blue-500 hover:underline">Cut</button>
            <button className="text-sm text-blue-500 hover:underline">Copy</button>
            <button className="text-sm text-blue-500 hover:underline">Paste</button>
            <button className="text-sm text-blue-500 hover:underline">Edit</button>
            <button className="text-sm text-blue-500 hover:underline">Delete</button>
            <button className="text-sm text-blue-500 hover:underline">Undo</button>
            <button className="text-sm text-blue-500 hover:underline">Add</button>
          </div>
        )}
      </div>
    );
  };

  const rootNode = Array.from(nodes.values()).find((node) => node.isRoot);

  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Concept Bank</h2>
      <div style={containerStyle} className="pr-2">
        {rootNode ? renderNode(rootNode) : <p>No concepts available.</p>}
      </div>
    </div>
  );
};

export default ConceptBank;
