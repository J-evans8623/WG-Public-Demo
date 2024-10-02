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
  const { state } = useDocumentContext();
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
  const handleExpand = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent the expand event from bubbling up
    setExpanded(!expanded);
  };

  // Get child nodes
  const childNodes = Array.from(nodes.values()).filter((n) => n.parentNodeId === node.id);

  const hasChildren = childNodes.length > 0;

  // Action menu for each node
  const menu = (
    <Menu>
      <Menu.Item>Edit</Menu.Item>
      <Menu.Item danger>Delete</Menu.Item>
    </Menu>
  );

  return (
    <div
      style={{
        padding: '8px 0',
        backgroundColor: selected ? '#D5E6ED' : 'transparent', // Highlight selected nodes
        borderLeft: selected ? '4px solid #3B82F6' : 'none',  // Add a visual cue for selection
      }}
      onClick={handleNodeClick} // Only handle the click for the specific node
      tabIndex={0}
    >
      {/* Main Node Row */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {hasChildren && (
          <Button
            type="text"
            onClick={handleExpand} // Handle expand/collapse
            icon={expanded ? <DownOutlined /> : <RightOutlined />}
          />
        )}
        <span style={{ marginLeft: hasChildren ? 0 : 16 }}>{node.title}</span>
        <Dropdown overlay={menu} trigger={['click']}>
          <Button type="text" style={{ marginLeft: 'auto' }}>Actions</Button>
        </Dropdown>
      </div>

      {node.description && <p style={{ marginLeft: hasChildren ? 0 : 16 }}>{node.description}</p>}

      {/* Render child nodes if expanded */}
      {expanded && (
        <div style={{ marginLeft: '20px' }}>
          {childNodes.map((childNode) => (
            <ConceptNodeDisplay key={childNode.id} node={childNode} />
          ))}
        </div>
      )}
    </div>
  );
};

export default ConceptNodeDisplay;
