import React from 'react';
import { useCueCardContext } from '@/app/Library/Context/CueCardContext';
import { usePictureContext } from '@/app/Library/Context/PictureContext';
import { usePracticeSheetContext } from '@/app/Library/Context/PracticeSheetContext';

const ToolPaneEditWindow = ({ nodeId }: { nodeId: string }) => {
  const { selectCueCards, editCueCard } = useCueCardContext();
  const { selectPictures, editPicture } = usePictureContext();
  const { selectPracticeSheets, editPracticeSheet } = usePracticeSheetContext();

  const cueCards = selectCueCards(nodeId);
  const pictures = selectPictures(nodeId);
  const practiceSheets = selectPracticeSheets(nodeId);

  const handleEditCueCard = (cueCardId: string, updatedContent: string) => {
    const updatedCueCard = { id: cueCardId, title: 'Updated Title', content: updatedContent };
    editCueCard(nodeId, updatedCueCard);
  };

  return (
    <div>
      <h3>Edit Options</h3>
      {/* Map through resources to provide edit options */}
      {/* Similar to delete, you can add form inputs for editing */}
    </div>
  );
};

export default ToolPaneEditWindow;
