/**
 * @file AskAssistantPanel.tsx (Enhanced with Centralized API Integration)
 * @description
 * Slide-in panel component for the "Ask Assistant" workflow that integrates with the enhanced
 * API service system for consistent error handling and subscription management. This updated
 * implementation replaces direct legacy API calls with the centralized EnhancedApiService
 * while maintaining the existing visual design and user interaction patterns. The component
 * follows a streamlined workflow where users enter questions, the panel closes immediately
 * upon submission, and the system processes requests through the unified API service with
 * automatic error handling and modal triggering for subscription requirements or rate limits.
 * The enhanced implementation provides backend-driven subscription validation where freemium
 * users are automatically prompted for upgrades when attempting to access premium AI assistant
 * features, while premium users receive appropriate rate limit notifications when applicable.
 * All error scenarios are handled through the event-driven system that triggers appropriate
 * modals without disrupting the core user experience or requiring manual error management.
 * 
 * Responsibilities:
 * - Provide slide-in panel interface for AI assistant question submission
 * - Integrate with enhanced API service for consistent error handling and subscription management
 * - Maintain existing visual design, accessibility, and interaction patterns
 * - Handle subscription validation through backend-driven error handling and modal triggering
 * - Process successful responses through existing card creation and slide management systems
 * - Support comprehensive logging for debugging and user interaction tracking
 * - Ensure seamless integration with centralized modal management for error scenarios
 */

import React, { useState, useCallback } from 'react';
import { useSlideShow } from '@/app/Library/Context/SlideShowContext';
import useCardCrudOperations from '@/app/studygraph/(studygraph)/components/hooks/useCardCrudOperations';
import { apiService } from '@/app/src/services/ApiService';
import { useYDoc } from '@/app/Library/Context/YDocContext';
import './AskAssistantPanel.css';
import markdownIt from 'markdown-it';

interface AskAssistantPanelProps {
  onClose: () => void;
  onLoading: (loading: boolean) => void;
}

// Initialize markdown-it parser
const mdParser = new markdownIt();

/**
 * AskAssistantPanel
 * @description
 * Enhanced slide-in panel component that integrates with the centralized API service system
 * for consistent subscription management and error handling. The component maintains existing
 * UI design while replacing legacy API calls with the unified service that automatically
 * handles subscription validation, rate limiting, and error modal triggering through the
 * event-driven architecture. This ensures consistent user experience across all AI services.
 * @param onClose Callback function executed when panel should be closed
 * @param onLoading Callback function for managing loading state in parent components
 * @returns Enhanced ask assistant panel with centralized API integration
 */
const AskAssistantPanel: React.FC<AskAssistantPanelProps> = ({
  onClose,
  onLoading,
}) => {
  const { currentSlide } = useSlideShow();
  const { createResource } = useCardCrudOperations();
  const { docFileID } = useYDoc();

  const [question, setQuestion] = useState('');

  /**
   * setLoading
   * @description
   * Wrapper function for loading state management that provides consistent interface
   * for parent component communication while maintaining existing callback patterns
   * and ensuring proper state synchronization across the component hierarchy.
   * @param v Boolean value indicating loading state for parent component updates
   * @returns Promise resolving when loading state update is complete
   */
  const setLoading = useCallback((v: boolean) => {
    onLoading(v);
  }, [onLoading]);

  /**
   * handleSend
   * @description
   * Enhanced question submission handler that integrates with the centralized API service
   * for consistent subscription management and error handling. This method replaces legacy
   * API calls with the unified service that automatically handles subscription validation,
   * rate limiting, and error modal triggering while maintaining existing slide management
   * and card creation workflows. The implementation ensures seamless user experience with
   * automatic error handling through the event-driven architecture.
   * @returns Promise resolving when question processing is complete or error handling triggered
   */
  const handleSend = useCallback(async () => {
    if (!question.trim() || !currentSlide) return;

    console.log('[AskAssistantPanel.tsx][4001] Question submission initiated', {
      hasQuestion: !!question.trim(),
      hasSlide: !!currentSlide,
      docFileID
    });

    // Step 1: Show spinner in SlideShowOverlay and close panel
    setLoading(true);
    onClose();

    try {
      // Step 2: Derive slide context for enhanced question processing
      let slideContext = '';
      switch (currentSlide.type) {
        case 'note':
        case 'cueCard':
          slideContext = (currentSlide as any).content;
          break;
        case 'practiceSheet':
          slideContext = JSON.stringify((currentSlide as any).content);
          break;
      }

      console.log('[AskAssistantPanel.tsx][4002] Slide context derived', {
        slideType: currentSlide.type,
        hasContext: !!slideContext
      });

      // Step 3: Call enhanced API service instead of legacy askQuestionAPI
      const response = await apiService.askAssistant(
        question,
        slideContext,
        docFileID!
      );

      // Step 4: Process successful response
      if (response.success && response.data) {
        const { question_title, question_response } = response.data;
        const html = mdParser.render(question_response);
        
        
        // Step 5: Create new Note card with processed response
        await createResource({
          nodeId: (currentSlide as any).nodeId,
          type: 'note',
          title: question_title,
          content: html,
        });

        console.log('[AskAssistantPanel.tsx][4004] Note card created successfully');
      } else {
        // Step 6: Error handling is managed by the enhanced API service event system
        console.log('[AskAssistantPanel.tsx][4005] API request failed, error handled by event system', {
          success: response.success,
          errorType: response.error?.type
        });
      }
    } catch (err) {
      // Step 7: Catch-all error handling for unexpected failures
      console.error('[AskAssistantPanel.tsx][4006] Unexpected error in question submission:', err);
    } finally {
      // Step 8: Always stop spinner regardless of outcome
      setLoading(false);
    }
  }, [question, currentSlide, setLoading, onClose, docFileID, createResource]);

  return (
    <div className="ask-backdrop" onClick={onClose}>
      <div className="ask-panel" onClick={e => e.stopPropagation()}>
        <div className="ask-handle" />
        <label className="ask-title">
          Ask a question about this slide
        </label>
        <textarea
          className="ask-input"
          placeholder='E.g., "Why is this important?"'
          value={question}
          onChange={e => setQuestion(e.target.value)}
        />
        <div className="ask-actions">
          <button
            className="ask-cancel"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="ask-send"
            onClick={handleSend}
            disabled={!question.trim()}
          >
            Ask
          </button>
        </div>
      </div>
    </div>
  );
};

export default AskAssistantPanel;