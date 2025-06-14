// app/Library/components/layout/Canvas/QuizGeneratorModal.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { generateQuiz } from '@/app/Library/utils/aiServiceApi';
import { parseQuizResponse } from '@/app/studygraph/(studygraph)/components/hooks/parseQuizResponse';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { useYDoc } from '@/app/Library/Context/YDocContext';
import QuizTopicSelector from './QuizTopicSelector';
import useExportStudyData from '@/app/studygraph/(studygraph)/components/utils/exportStudyData';
import useCardCrudOperations from '@/app/studygraph/(studygraph)/components/hooks/useCardCrudOperations';
import { useLayoutContext } from '@/app/Library/Context/LayoutProvider';
import { setGetLayout } from '@/app/Library/Context/LayoutActions';
import { useSelectionAttachment } from '@/app/Library/Context/SelectionAttachmentContext';
import AttachedTextBubble from './AttachedTextBubble';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';

interface QuizGeneratorModalProps {
  /** Whether this modal is shown */
  isOpen: boolean;
  /** Close callback */
  onClose: () => void;
  /**
   * Preselected topic IDs for the map pipeline.
   * PDF pipeline ignores this and uses attachedText instead.
   */
  preselectedTopicIds: string[];
}

/**
 * QuizGeneratorModal
 *
 * Dual-mode modal:
 * - **Map pipeline**: shows a checklist of topics (QuizTopicSelector).
 * - **PDF pipeline** (attachedText present): replaces topic selector with an AttachedTextBubble.
 *
 * Responsibilities:
 * 1. Let user choose topics (map) or review attached text (PDF).
 * 2. Let user pick one quiz type.
 * 3. Assemble request payload, call generateQuiz, parse and insert quiz cards.
 * 4. Ensure a “Review” node exists, then attach new quiz to it.
 * 5. Clear attachment on close if PDF mode.
 */
const QuizGeneratorModal: React.FC<QuizGeneratorModalProps> = ({
  isOpen,
  onClose,
  preselectedTopicIds,
}) => {
  // Contexts
  const { attachedText, clearAttachment } = useSelectionAttachment();
  const { nodes, getReviewNode, createNewNode, getRootNode } = useNodesContext();
  const { docFileID } = useYDoc();
  const exportStudyData = useExportStudyData();
  const { createResource } = useCardCrudOperations();
  const { dispatch: layoutDispatch } = useLayoutContext();
  const { groupSelect } = useNodeSelection();
  // Local state
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);
  const [selectedQuizType, setSelectedQuizType] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Detect PDF vs map pipeline
  const usingPdf = attachedText.trim().length > 0;

  // Reset fields on open
  useEffect(() => {
    if (isOpen) {
      setSelectedTopicIds(preselectedTopicIds);
      setSelectedQuizType('');
      setError(null);
      setIsLoading(false);
    }
  }, [isOpen, preselectedTopicIds]);

  // Close handler (also clear PDF attachment)
  const handleClose = useCallback(() => {
    if (!isLoading) {
      onClose();
      if (usingPdf) clearAttachment();
    }
  }, [isLoading, onClose, usingPdf, clearAttachment]);

  // Quiz type change
  const handleQuizTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedQuizType(e.target.value);
  };

  // Generate quiz
  const handleGenerateQuiz = async () => {
    // PDF mode: require attachment (topics irrelevant)
    if (usingPdf && !attachedText) {
      setError('No PDF selection found.');
      return;
    }
    // Map mode: require at least one topic
    if (!usingPdf && selectedTopicIds.length === 0) {
      setError('Please select at least one topic.');
      return;
    }
    if (!selectedQuizType) {
      setError('Please select a quiz type.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Export data: for PDF flow we pass an empty array to export all if desired
      const exportData = exportStudyData(usingPdf ? [] : selectedTopicIds);


      // Build request
      const requestPayload: {
        topicIds: string[];
        quizTypes: string[];
        fileID: string;
        exportData: string;
        textSelection?: string;
      } = {
        topicIds: usingPdf ? [] : selectedTopicIds,
        quizTypes: [selectedQuizType],
        fileID: docFileID || '',
        exportData,
        // ← new field
        textSelection: usingPdf ? attachedText : undefined,
      };

      // Call API
      const response = await generateQuiz(requestPayload);
      const parsedQuiz = parseQuizResponse(response);
      if (!parsedQuiz) throw new Error('Received empty quiz response');

      // Ensure Review node
      const reviewInfo = getReviewNode();
      if (!reviewInfo.exist) {
        createNewNode('Review', getRootNode(), 'reviewNode');
        layoutDispatch(setGetLayout(true));
      }
      parsedQuiz.nodeId = 'reviewNode';

      // Save quiz card
      await createResource({
        nodeId: parsedQuiz.nodeId,
        type: 'quiz',
        title: parsedQuiz.title,
        content: parsedQuiz.content,
      });

      groupSelect([parsedQuiz.nodeId]);

      handleClose();
    } catch (err) {
      console.error('[QuizGeneratorModal] Error generating quiz:', err);
      setError('Failed to generate quiz. Please try again later.');
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black opacity-50"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-white w-[500px] max-w-full rounded shadow-lg p-6 z-10 max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Generate Quiz</h2>
          <button
            onClick={handleClose}
            disabled={isLoading}
            aria-label="Close Modal"
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Instruction */}
        <p className="text-sm text-gray-600 mb-4">
          {usingPdf
            ? 'You pasted text from the PDF—review below, then choose your quiz type:'
            : 'Ready for a review session? Select topics, choose a quiz type, and create a quiz.'}
        </p>

        {/* Topic selector or PDF bubble */}
        <div className="mb-4">
          {usingPdf ? (
            <AttachedTextBubble
              text={attachedText}
              onCancel={clearAttachment}
            />
          ) : (
            <>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select quiz topics:
              </label>
              <QuizTopicSelector
                selectedTopicIds={selectedTopicIds}
                onChangeSelectedTopics={setSelectedTopicIds}
              />
            </>
          )}
        </div>

        {/* Quiz type radios */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Quiz type:
          </label>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {['multipleChoice','matching','FIB','true-false'].map(type => (
              <label key={type} className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="quizType"
                  value={type}
                  checked={selectedQuizType === type}
                  onChange={handleQuizTypeChange}
                  disabled={isLoading}
                />
                <span>
                  {type === 'multipleChoice' ? 'Multiple Choice' :
                   type === 'matching'        ? 'Matching' :
                   type === 'FIB'             ? 'Fill in the Blank' :
                                               'True/False'}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && <div className="text-red-500 text-sm mb-4">{error}</div>}

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerateQuiz}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            {isLoading ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuizGeneratorModal;
