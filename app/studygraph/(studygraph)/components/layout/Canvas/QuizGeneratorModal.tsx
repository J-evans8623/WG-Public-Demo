/**
 * @file QuizGeneratorModal.tsx (Enhanced with Centralized API Integration)
 * @description
 * Dual-mode quiz generation modal that integrates with the enhanced API service system for
 * consistent subscription management and error handling across both map and PDF pipelines.
 * This updated implementation replaces direct legacy API calls with the centralized
 * EnhancedApiService while maintaining the existing visual design and dual-mode functionality.
 * The component supports both map-based topic selection and PDF text attachment workflows
 * while providing backend-driven subscription validation where freemium users are automatically
 * prompted for upgrades when attempting to access premium quiz generation features. The enhanced
 * implementation ensures seamless integration with the event-driven error handling system that
 * triggers appropriate modals for subscription requirements and rate limiting scenarios without
 * disrupting the core user experience. All quiz generation operations are processed through
 * the unified API service with comprehensive error handling and user feedback mechanisms.
 * 
 * Responsibilities:
 * - Provide dual-mode interface for quiz generation from map topics or PDF text selections
 * - Integrate with enhanced API service for consistent subscription management and error handling
 * - Maintain existing visual design, accessibility, and dual-pipeline functionality
 * - Handle subscription validation through backend-driven error handling and modal triggering
 * - Process successful quiz generation through existing card creation and node management systems
 * - Support comprehensive logging for debugging and user interaction tracking
 * - Ensure seamless integration with centralized modal management for error scenarios
 */

import React, { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { apiService } from '@/app/src/services/ApiService';
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
 * @description
 * Enhanced dual-mode modal component that integrates with the centralized API service system
 * for consistent subscription management and error handling. The component maintains existing
 * dual-mode functionality (map vs PDF pipeline) while replacing legacy API calls with the
 * unified service that automatically handles subscription validation, rate limiting, and error
 * modal triggering. This ensures consistent user experience across all AI services while
 * preserving the existing topic selection and quiz generation workflows.
 * @param isOpen Boolean indicating whether the modal should be displayed
 * @param onClose Callback function executed when modal should be closed
 * @param preselectedTopicIds Array of topic IDs preselected for map pipeline quiz generation
 * @returns Enhanced quiz generator modal with centralized API integration
 */
const QuizGeneratorModal: React.FC<QuizGeneratorModalProps> = ({
  isOpen,
  onClose,
  preselectedTopicIds,
}) => {
  // Context hooks for existing functionality
  const { attachedText, clearAttachment } = useSelectionAttachment();
  const { nodes, getReviewNode, createNewNode, getRootNode } = useNodesContext();
  const { docFileID } = useYDoc();
  const exportStudyData = useExportStudyData();
  const { createResource } = useCardCrudOperations();
  const { dispatch: layoutDispatch } = useLayoutContext();
  const { groupSelect } = useNodeSelection();
  
  // Local state management
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);
  const [selectedQuizType, setSelectedQuizType] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Detect PDF vs map pipeline
  const usingPdf = attachedText.trim().length > 0;

  // Reset fields on modal open
  useEffect(() => {
    if (isOpen) {
      setSelectedTopicIds(preselectedTopicIds);
      setSelectedQuizType('');
      setError(null);
      setIsLoading(false);
    }
  }, [isOpen, preselectedTopicIds]);

  /**
   * handleClose
   * @description
   * Enhanced modal closure handler that manages PDF attachment cleanup and loading state
   * validation while maintaining existing modal closure behavior and preventing accidental
   * closure during active processing operations for optimal user experience and data integrity.
   * @returns Promise resolving when modal closure processing is complete
   */
  const handleClose = useCallback(() => {
    if (!isLoading) {
      onClose();
      if (usingPdf) clearAttachment();
    }
  }, [isLoading, onClose, usingPdf, clearAttachment]);

  /**
   * handleQuizTypeChange
   * @description
   * Quiz type selection handler that updates local state and provides comprehensive
   * logging for user interaction tracking while maintaining existing form input
   * patterns and ensuring proper state management across component lifecycle.
   * @param e React change event containing selected quiz type value
   * @returns Promise resolving when quiz type selection processing is complete
   */
  const handleQuizTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedQuizType(e.target.value);
  };

  /**
   * handleGenerateQuiz
   * @description
   * Enhanced quiz generation handler that integrates with the centralized API service
   * for consistent subscription management and error handling. This method replaces legacy
   * API calls with the unified service that automatically handles subscription validation,
   * rate limiting, and error modal triggering while maintaining existing quiz processing
   * and card creation workflows. The implementation ensures seamless user experience with
   * automatic error handling through the event-driven architecture.
   * @returns Promise resolving when quiz generation is complete or error handling triggered
   */
  const handleGenerateQuiz = async () => {
    // Step 1: Validate input requirements based on pipeline mode
    if (usingPdf && !attachedText) {
      setError('No PDF selection found.');
      return;
    }
    if (!usingPdf && selectedTopicIds.length === 0) {
      setError('Please select at least one topic.');
      return;
    }
    if (!selectedQuizType) {
      setError('Please select a quiz type.');
      return;
    }

    console.log('[QuizGeneratorModal.tsx][4007] Quiz generation initiated', {
      usingPdf,
      topicCount: selectedTopicIds.length,
      quizType: selectedQuizType,
      hasAttachment: !!attachedText
    });

    setIsLoading(true);
    setError(null);

    try {
      // Step 2: Export data for quiz context
      const exportData = exportStudyData(usingPdf ? [] : selectedTopicIds);

      console.log('[QuizGeneratorModal.tsx][4008] Study data exported for quiz generation', {
        dataLength: exportData.length
      });

      // Step 3: Call enhanced API service instead of legacy generateQuiz
      const response = await apiService.createQuiz(
        usingPdf ? [] : selectedTopicIds,
        [selectedQuizType],
        docFileID || '',
        exportData,
        usingPdf ? attachedText : undefined
      );

      // Step 4: Process successful response
      if (response.success && response.data) {
        const parsedQuiz = parseQuizResponse(response.data);
        if (!parsedQuiz) throw new Error('Received empty quiz response');

        console.log('[QuizGeneratorModal.tsx][4009] Quiz response parsed successfully', {
          hasQuiz: !!parsedQuiz,
          quizTitle: parsedQuiz?.title
        });

        // Step 5: Ensure Review node exists for quiz attachment
        const reviewInfo = getReviewNode();
        if (!reviewInfo.exist) {
          createNewNode('Review', getRootNode(), 'reviewNode');
          layoutDispatch(setGetLayout(true));
        }
        parsedQuiz.nodeId = 'reviewNode';

        // Step 6: Save quiz card and select review node
        await createResource({
          nodeId: parsedQuiz.nodeId,
          type: 'quiz',
          title: parsedQuiz.title,
          content: parsedQuiz.content,
        });

        groupSelect([parsedQuiz.nodeId]);
        
        console.log('[QuizGeneratorModal.tsx][4010] Quiz card created and node selected successfully');
        
        handleClose();
      } else {
        // Step 7: Error handling is managed by the enhanced API service event system
        console.log('[QuizGeneratorModal.tsx][4011] Quiz generation failed, error handled by event system', {
          success: response.success,
          errorType: response.error?.type
        });
        setError('Failed to generate quiz. Please try again later.');
        setIsLoading(false);
      }
    } catch (err) {
      // Step 8: Catch-all error handling for unexpected failures
      console.error('[QuizGeneratorModal.tsx][4012] Unexpected error in quiz generation:', err);
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