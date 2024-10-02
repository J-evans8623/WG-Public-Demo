// bloom-maps/app/Library/ui/ConceptNodeDisplay.tsx
import React, { useState, useCallback } from 'react';
import { Button, Dropdown, Menu } from 'antd';
import { DownOutlined, RightOutlined } from '@ant-design/icons';
import { useDocumentContext } from '@/app/Library/Context/DocumentProvider';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';

interface ConceptNodeDisplayProps {
  node: {
    id: string;
    title: string;
    description?: string;
    parentId?: string;
  };
}

export const ConceptNodeDisplay: React.FC<ConceptNodeDisplayProps> = ({ node }) => {
  const [expanded, setExpanded] = useState(false);
  const { state } = useDocumentContext(); // Access the state to fetch child nodes
  const { nodes } = state;
  const { toggleNodeSelection, isSelected } = useNodeSelection();

  // Determine if the node is selected
  const selected = isSelected(node.id);

  // Handle node click and stop propagation to avoid affecting parent nodes
  const handleNodeClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent the click from affecting parent nodes
      toggleNodeSelection(node.id);
    },
    [node.id, toggleNodeSelection]
  );

  // Expand or collapse child nodes
  const handleExpand = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent the expand event from bubbling up
      setExpanded((prev) => !prev);
    },
    []
  );

  // Filter child nodes by checking if their parentId matches the current node's id
  const childNodes = Array.from(nodes.values()).filter((n) => n.parentNodeId === node.id);

  const hasChildren = childNodes.length > 0;

  // Action menu for each node
  const menu = (
    <Menu>
      <Menu.Item key="edit">Edit</Menu.Item>
      <Menu.Item key="delete" danger>
        Delete
      </Menu.Item>
    </Menu>
  );

  return (
    <div
      style={{
        padding: '8px 0',
        backgroundColor: selected ? '#D5E6ED' : 'transparent', // Highlight selected nodes
        borderLeft: selected ? '4px solid #3B82F6' : 'none',  // Add a visual cue for selection
        cursor: 'pointer', // Change cursor to indicate clickable area
      }}
      onClick={handleNodeClick} // Handle selection when the node is clicked
      tabIndex={0} // Make the div focusable for accessibility
    >
      {/* Main Node Row */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {/* Expand/Collapse button if the node has children */}
        {hasChildren && (
          <Button
            type="text"
            onClick={handleExpand} // Handle expand/collapse
            icon={expanded ? <DownOutlined /> : <RightOutlined />}
          />
        )}
        {/* Node Title */}
        <span style={{ marginLeft: hasChildren ? 0 : 16, fontWeight: selected ? 'bold' : 'normal' }}>
          {node.title}
        </span>

        {/* Actions Dropdown */}
        <Dropdown overlay={menu} trigger={['click']}>
          <Button type="text" style={{ marginLeft: 'auto' }}>
            Actions
          </Button>
        </Dropdown>
      </div>

      {/* Node Description */}
      {node.description && (
        <p style={{ marginLeft: hasChildren ? 0 : 16, marginTop: '4px', color: '#555' }}>
          {node.description}
        </p>
      )}

      {/* Recursively render child nodes if expanded */}
      {expanded &&
        childNodes.map((childNode) => (
          <ConceptNodeDisplay key={childNode.id} node={childNode} />
        ))}
    </div>
  );
};

export default ConceptNodeDisplay;
