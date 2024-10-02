// bloom-maps/app/Library/ui/ConceptNodeDisplay.tsx
import React, { useState } from 'react';
import { Button, Dropdown, Menu } from 'antd';
import { DownOutlined, RightOutlined } from '@ant-design/icons';
import { useDocumentContext } from '@/app/Library/Context/DocumentProvider';

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

  const handleExpand = () => {
    setExpanded(!expanded);
  };

  // Filter child nodes by checking if their parentId matches the current node's id
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
    <div style={{ padding: '8px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {/* Expand/Collapse button if the node has children */}
        {hasChildren && (
          <Button
            type="text"
            onClick={handleExpand}
            icon={expanded ? <DownOutlined /> : <RightOutlined />}
          />
        )}
        {/* Node Title */}
        <span style={{ marginLeft: hasChildren ? 0 : 16 }}>{node.title}</span>

        {/* Actions Dropdown */}
        <Dropdown overlay={menu} trigger={['click']}>
          <Button type="text" style={{ marginLeft: 'auto' }}>Actions</Button>
        </Dropdown>
      </div>

      {/* Node Description */}
      {node.description && <p style={{ marginLeft: hasChildren ? 0 : 16 }}>{node.description}</p>}

      {/* Recursively render child nodes if expanded */}
      {expanded &&
        childNodes.map((childNode) => (
          <ConceptNodeDisplay key={childNode.id} node={childNode} />
        ))}
    </div>
  );
};

export default ConceptNodeDisplay;
