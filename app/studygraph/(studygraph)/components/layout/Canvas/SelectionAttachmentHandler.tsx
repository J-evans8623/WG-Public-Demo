// app/Library/components/SelectionAttachmentHandler.tsx

/**
 * @file SelectionAttachmentHandler.tsx
 * @description
 *   Listens to the SelectionAttachmentContext for any PDF-triggered flows:
 *     - When “Explore” is triggered, opens the TopicGeneratorModal.
 *     - When “Quiz” is triggered, opens the QuizGeneratorModal.
 *
 * Responsibilities:
 *   - Centralize rendering of Explore & Quiz modals.
 *   - Clean up (clearAttachment) when any modal closes.
 */

import React from 'react';
import { useSelectionAttachment } from '@/app/Library/Context/SelectionAttachmentContext';
import TopicGeneratorModal from './TopicGeneratorModal';
import QuizGeneratorModal from './QuizGeneratorModal';

const SelectionAttachmentHandler: React.FC = () => {
  const {
    attachedText,
    isExploreOpen,
    isQuizOpen,
    clearAttachment,
  } = useSelectionAttachment();

  return (
    <>
      {isExploreOpen && (
        <TopicGeneratorModal
          isOpen={true}
          onClose={clearAttachment}
          // For PDF-based Explore we pass no targetNodeId; 
          // the modal can read attachedText from context if desired.
          targetNodeId={''}
        />
      )}

      {isQuizOpen && (
        <QuizGeneratorModal
          isOpen={true}
          onClose={clearAttachment}
          preselectedTopicIds={[]}
        />
      )}
    </>
  );
};

export default SelectionAttachmentHandler;
