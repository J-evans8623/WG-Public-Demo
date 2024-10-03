import React, { useState, useCallback } from 'react';
import { Button, Dropdown, Menu } from 'antd';
import { DownOutlined, RightOutlined } from '@ant-design/icons';
import { useDocumentContext } from '@/app/Library/Context/DocumentProvider';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import { useCueCardContext } from '@/app/Library/Context/CueCardContext';
import CueCardEntry from './CueCardEntry';

interface ConceptNodeDisplayProps {
  node: {
    id: string;
    title: string;
    description?: string;
    parentNodeId?: string;
  };
  selectedCueCardId: string | null;
  cutCueCardId: string | null;
  onCueCardSelect: (cueCardId: string, nodeId: string) => void;
  onCueCardCut: (cueCardId: string, nodeId: string) => void;
  onNodeSelect: (nodeId: string) => void;
}

export const ConceptNodeDisplay: React.FC<ConceptNodeDisplayProps> = ({
  node,
  selectedCueCardId,
  cutCueCardId,
  onCueCardSelect,
  onCueCardCut,
  onNodeSelect,
}) => {
  const [expanded, setExpanded] = useState(false);
  const { state } = useDocumentContext();
  const { nodes } = state;
  const { toggleNodeSelection, isSelected } = useNodeSelection();
  const { selectCueCards } = useCueCardContext();

  // Determine if the node is selected
  const selected = isSelected(node.id);

  // Handle node click and stop propagation to avoid affecting parent nodes
  const handleNodeClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      toggleNodeSelection(node.id);
      onNodeSelect(node.id);
    },
    [node.id, toggleNodeSelection, onNodeSelect]
  );

  // Expand or collapse child nodes
  const handleExpand = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setExpanded((prev) => !prev);
    },
    []
  );

  // Fetch cue cards dynamically using the node's ID
  const cueCards = selectCueCards(node.id);

  // Filter child nodes by checking if their parentId matches the current node's id
  const childNodes = Array.from(nodes.values()).filter((n) => n.parentNodeId === node.id);

  // Check if the node has either children (supporting concepts) or cue cards
  const hasChildrenOrCueCards = childNodes.length > 0 || cueCards.length > 0;

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
    <div className="node-container">
      {/* Apply selected-node-tile only to the node's "tile" row */}
      <div
        className={`flex items-center node-tile ${selected ? 'selected-node-tile' : ''}`}
        onClick={handleNodeClick}
        tabIndex={0}
      >
        {hasChildrenOrCueCards && (
          <Button
            type="text"
            onClick={handleExpand}
            icon={expanded ? <DownOutlined /> : <RightOutlined />}
          />
        )}
        <span style={{ marginLeft: hasChildrenOrCueCards ? 0 : 16, fontWeight: selected ? 'bold' : 'normal' }}>
          {node.title}
        </span>
        <Dropdown overlay={menu} trigger={['click']}>
          <Button type="text" style={{ marginLeft: 'auto' }}>
            Actions
          </Button>
        </Dropdown>
      </div>

      {/* Render CueCardEntry for each cue card */}
      {expanded && cueCards.length > 0 && (
        <div className="pl-5">
          {cueCards.map((cueCard) => (
            <CueCardEntry
              key={cueCard.id}
              cueCard={cueCard}
              isSelected={selectedCueCardId === cueCard.id}
              isCut={cutCueCardId === cueCard.id}
              onSelect={(cueCardId) => onCueCardSelect(cueCardId, node.id)}
              onCut={(cueCardId) => onCueCardCut(cueCardId, node.id)}
            />
          ))}
        </div>
      )}

      {/* Supporting Concepts Header */}
      {expanded && childNodes.length > 0 && (
        <div className="child-node-container">
          <strong>Supporting Concepts</strong>
        </div>
      )}

      {expanded &&
        childNodes.map((childNode) => (
          <ConceptNodeDisplay
            key={childNode.id}
            node={childNode}
            selectedCueCardId={selectedCueCardId}
            cutCueCardId={cutCueCardId}
            onCueCardSelect={onCueCardSelect}
            onCueCardCut={onCueCardCut}
            onNodeSelect={onNodeSelect}
          />
        ))}
    </div>
  );
};

export default ConceptNodeDisplay;
