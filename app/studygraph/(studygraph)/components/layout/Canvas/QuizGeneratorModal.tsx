/**
 * QuizGeneratorModal.tsx
 *
 * Responsibilities:
 *  1) Provide a modal UI for generating a quiz.
 *  2) Let users pick topics (either preselected or via a checklist).
 *  3) Let users choose the quiz type from the supported options (radio buttons):
 *       - multipleChoice
 *       - matching
 *       - FIB
 *       - true-false
 *  4) Optionally include uploaded documents in the request.
 *  5) Export study data from selected nodes using useExportStudyData.
 *  6) Send the assembled request to the AI service endpoint and parse the response.
 *  7) Check for a dedicated review node via getReviewNode. If it does not exist, create it.
 *  8) Save the parsed quiz into the Resource Context using useCardCrudOperations.createResource.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { generateQuiz } from '@/app/Library/utils/aiServiceApi';
import { parseQuizResponse } from '@/app/studygraph/(studygraph)/components/hooks/parseQuizResponse';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { useLessonModule } from '@/app/Library/Context/LessonModuleContext';
import { useYDoc } from '@/app/Library/Context/YDocContext';
import QuizTopicSelector from './QuizTopicSelector';
import useExportStudyData from '@/app/studygraph/(studygraph)/components/utils/exportStudyData';
import useCardCrudOperations from '@/app/studygraph/(studygraph)/components/hooks/useCardCrudOperations';
import { useLayoutContext } from '@/app/Library/Context/LayoutProvider';
import { setGetLayout } from '@/app/Library/Context/LayoutActions';

interface QuizGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Preselected topic IDs from the concept map.
   */
  preselectedTopicIds: string[];
}

const QuizGeneratorModal: React.FC<QuizGeneratorModalProps> = ({
  isOpen,
  onClose,
  preselectedTopicIds,
}) => {
  // Local state for selected topics, selected quiz type, and include documents option.
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);
  const [selectedQuizType, setSelectedQuizType] = useState<string>(''); // Only one allowed
  const [includeDocuments, setIncludeDocuments] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Access context values.
  const { nodes, getReviewNode, createNewNode, getRootNode } = useNodesContext();
  const { activeConceptMapId, getModuleSummary } = useLessonModule();
  const { docFileID } = useYDoc();
  const exportStudyData = useExportStudyData();
  const { createResource } = useCardCrudOperations();
  const { dispatch: layoutDispatch } = useLayoutContext();

  // Reset fields when modal opens.
  useEffect(() => {
    if (isOpen) {
      setSelectedTopicIds(preselectedTopicIds);
      setSelectedQuizType('');
      setIncludeDocuments(false);
      setError(null);
      setIsLoading(false);
    }
  }, [isOpen, preselectedTopicIds]);

  // Close the modal (if not loading).
  const handleClose = useCallback(() => {
    if (!isLoading) {
      onClose();
    }
  }, [isLoading, onClose]);

  // Handler for changing the selected quiz type (radio selection).
  const handleQuizTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedQuizType(e.target.value);
  };

  // Handle the Generate button.
  const handleGenerateQuiz = async () => {
    if (!selectedTopicIds || selectedTopicIds.length === 0) {
      setError('Please select at least one topic.');
      return;
    }
    if (!selectedQuizType) {
      setError('Please select a quiz type.');
      return;
    }
    try {
      setIsLoading(true);
      setError(null);

      // Export study data from the selected nodes.
      const exportData = exportStudyData(selectedTopicIds);

      // Retrieve module summary.
      const { hasSummary, summary } = getModuleSummary(activeConceptMapId);

      // Build request payload.
      // Even though only one quiz type is selected, we send it as an array.
      const requestPayload = {
        topicIds: selectedTopicIds,
        quizTypes: [selectedQuizType],
        includeDocs: includeDocuments,
        fileID: docFileID || '',
        summary: summary || '',
        summaryPresent: hasSummary,
        mapID: activeConceptMapId,
        exportData, // Exported study data as JSON string.
      };

      // Call the AI service.
      const response = await generateQuiz(requestPayload);

      // Parse the quiz response.
      const parsedQuiz = parseQuizResponse(response);
      if (!parsedQuiz) {
        throw new Error("Parsed quiz is null");
      }

      // Check for a dedicated review node.
      const reviewNodeInfo = getReviewNode();
      if (!reviewNodeInfo.exist) {
        // If review node doesn't exist, create it as a child of the root node.
        // We use a fixed id "reviewNode".
        createNewNode('Review', getRootNode(), 'reviewNode');
        layoutDispatch(setGetLayout(true));
      }
      // Set the nodeId of the parsed quiz to the review node id.
      parsedQuiz.nodeId = 'reviewNode';

      // Save the parsed quiz into the resource context.
      // Map the quiz to card type 'quiz', which is translated internally to 'practiceSheet'.
      await createResource({
        nodeId: parsedQuiz.nodeId,
        type: 'quiz',
        title: parsedQuiz.title,
        content: parsedQuiz.content,
      });

      setIsLoading(false);
      onClose();
    } catch (err) {
      console.error('[QuizGeneratorModal] Error generating quiz:', err);
      setError('Failed to generate quiz. Please try again later.');
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Dimmed background */}
      <div className="absolute inset-0 bg-black opacity-50" onClick={handleClose}></div>
      {/* Modal container */}
      <div className="relative bg-white w-[500px] max-w-full rounded shadow-lg p-6 z-10 max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Generate Quiz</h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700"
            disabled={isLoading}
            aria-label="Close Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {/* Instructions */}
        <p className="text-sm text-gray-600 mb-4">
          Ready for a review session? Select your topics and quiz type, and create a quiz.
        </p>
        {/* Topic selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Select quiz topics:</label>
          <QuizTopicSelector
            selectedTopicIds={selectedTopicIds}
            onChangeSelectedTopics={setSelectedTopicIds}
          />
        </div>
        {/* Quiz type selection (radio buttons) */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Quiz type:</label>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                name="quizType"
                value="multipleChoice"
                checked={selectedQuizType === 'multipleChoice'}
                onChange={handleQuizTypeChange}
              />
              <span>Multiple Choice</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                name="quizType"
                value="matching"
                checked={selectedQuizType === 'matching'}
                onChange={handleQuizTypeChange}
              />
              <span>Matching</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                name="quizType"
                value="FIB"
                checked={selectedQuizType === 'FIB'}
                onChange={handleQuizTypeChange}
              />
              <span>Fill in the Blank</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                name="quizType"
                value="true-false"
                checked={selectedQuizType === 'true-false'}
                onChange={handleQuizTypeChange}
              />
              <span>True/False</span>
            </label>
          </div>
        </div>
        {/* Include uploaded documents */}
        <div className="mb-4 flex items-center space-x-2 text-sm">
          <input
            type="checkbox"
            checked={includeDocuments}
            onChange={(e) => setIncludeDocuments(e.target.checked)}
            id="includeDocs"
          />
          <label htmlFor="includeDocs" className="relative">
            Include uploaded documents
            <span className="ml-1 text-gray-400 cursor-pointer" title="Include related concepts from uploaded content.">?</span>
          </label>
        </div>
        {/* Error message */}
        {error && <div className="text-red-500 text-sm mb-4">{error}</div>}
        {/* Buttons */}
        <div className="flex justify-end gap-2">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleGenerateQuiz}
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700"
            disabled={isLoading}
          >
            {isLoading ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuizGeneratorModal;
