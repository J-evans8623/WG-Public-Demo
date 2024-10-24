import React from 'react';
import { useCueCardContext } from '@/app/Library/Context/CueCardContext';
import { usePictureContext } from '@/app/Library/Context/PictureContext';
import { usePracticeSheetContext } from '@/app/Library/Context/PracticeSheetContext';

const ToolPaneDeleteWindow = ({ nodeId }: { nodeId: string }) => {
  const { selectCueCards, removeCueCard } = useCueCardContext();
  const { selectPictures, removePicture } = usePictureContext();
  const { selectPracticeSheets, removePracticeSheet } = usePracticeSheetContext();

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

  return (
    <div>
      <h3>Delete Options</h3>
      <h4>Cue Cards</h4>
      <ul>
        {cueCards.map(card => (
          <li key={card.id}>
            {card.title} <button onClick={() => handleDeleteCueCard(card.id)}>Delete</button>
          </li>
        ))}
      </ul>
      <h4>Pictures</h4>
      <ul>
        {pictures.map(picture => (
          <li key={picture.id}>
            {picture.title} <button onClick={() => handleDeletePicture(picture.id)}>Delete</button>
          </li>
        ))}
      </ul>
      <h4>Practice Sheets</h4>
      <ul>
        {practiceSheets.map(sheet => (
          <li key={sheet.id}>
            {sheet.title} <button onClick={() => handleDeletePracticeSheet(sheet.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ToolPaneDeleteWindow;
