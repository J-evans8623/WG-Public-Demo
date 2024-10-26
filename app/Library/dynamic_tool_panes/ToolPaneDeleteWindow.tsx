// bloom-maps/app/Library/components/ToolPaneDeleteWindow.tsx

import React from 'react';
import { useCueCardContext } from '@/app/Library/Context/CueCardContext';
import { usePictureContext } from '@/app/Library/Context/PictureContext';
import { usePracticeSheetContext } from '@/app/Library/Context/PracticeSheetContext';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { deleteNode } from '@/app/Library/Context/nodesActions';

const ToolPaneDeleteWindow = ({ nodeId }: { nodeId: string }) => {
  const { selectCueCards, removeCueCard } = useCueCardContext();
  const { selectPictures, removePicture } = usePictureContext();
  const { selectPracticeSheets, removePracticeSheet } = usePracticeSheetContext();
  const { dispatch: nodesDispatch, nodes } = useNodesContext();

  // Fetch the current node to determine if it's a root node
  const currentNode = nodes.get(nodeId);

  const cueCards = selectCueCards(nodeId);
  const pictures = selectPictures(nodeId);
  const practiceSheets = selectPracticeSheets(nodeId);

  const handleDeleteCueCard = (cueCardId: string) => {
    removeCueCard(nodeId, cueCardId);
  };

  const handleDeletePicture = (pictureId: string) => {
    removePicture(nodeId, pictureId);
  };

  const handleDeletePracticeSheet = (practiceSheetId: string) => {
    removePracticeSheet(nodeId, practiceSheetId);
  };

  const handleDeleteNode = () => {
    if (!currentNode) {
      console.error(`Delete failed: Node with ID ${nodeId} not found.`);
      return;
    }

    // **Safeguard: Prevent deletion of the root node**
    if (currentNode.isRoot) {
      alert('The root node cannot be deleted.');
      return;
    }

    // **Check if the node is a leaf**
    const isLeaf = !currentNode.childrenNodeIds || currentNode.childrenNodeIds.length === 0;

    if (!isLeaf) {
      alert('Only leaf nodes can be deleted. Please remove all child nodes before deleting this node.');
      return;
    }

    // **Confirm Deletion**
    const confirmDelete = window.confirm(`Are you sure you want to delete the node "${currentNode.title}"? This will also delete all associated data.`);
    if (!confirmDelete) {
      return;
    }

    // **Delete Associated Cue Cards**
    cueCards.forEach((card) => {
      handleDeleteCueCard(card.id);
    });

    // **Delete Associated Pictures**
    pictures.forEach((picture) => {
      handleDeletePicture(picture.id);
    });

    // **Delete Associated Practice Sheets**
    practiceSheets.forEach((sheet) => {
      handleDeletePracticeSheet(sheet.id);
    });

    // **Dispatch Delete Node Action**
    nodesDispatch(deleteNode(nodeId));

    alert(`Node "${currentNode.title}" has been deleted successfully.`);
  };

  return (
    <div>
      <h3>Delete Options</h3>

      {/* Delete Entire Node */}
      <div style={{ marginBottom: '20px' }}>
        <h4>Delete Entire Node</h4>
        <button onClick={handleDeleteNode} disabled={currentNode?.isRoot}>
          Delete Node
        </button>
        {currentNode?.isRoot && (
          <p style={{ color: 'red' }}>Cannot delete the root node.</p>
        )}
      </div>

      {/* Existing Delete Options */}
      <div>
        <h4>Cue Cards</h4>
        {cueCards.length === 0 ? (
          <p>No cue cards associated with this node.</p>
        ) : (
          <ul>
            {cueCards.map(card => (
              <li key={card.id}>
                {card.title} <button onClick={() => handleDeleteCueCard(card.id)}>Delete</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h4>Pictures</h4>
        {pictures.length === 0 ? (
          <p>No pictures associated with this node.</p>
        ) : (
          <ul>
            {pictures.map(picture => (
              <li key={picture.id}>
                {picture.title} <button onClick={() => handleDeletePicture(picture.id)}>Delete</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h4>Practice Sheets</h4>
        {practiceSheets.length === 0 ? (
          <p>No practice sheets associated with this node.</p>
        ) : (
          <ul>
            {practiceSheets.map(sheet => (
              <li key={sheet.id}>
                {sheet.title} <button onClick={() => handleDeletePracticeSheet(sheet.id)}>Delete</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ToolPaneDeleteWindow;
