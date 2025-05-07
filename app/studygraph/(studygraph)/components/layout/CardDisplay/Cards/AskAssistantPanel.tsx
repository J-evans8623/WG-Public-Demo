// File: app/studygraph/(studygraph)/components/layout/CardDisplay/Cards/AskAssistantPanel.tsx
import React, { useState, useCallback } from 'react';
import { useSlideShow } from '@/app/Library/Context/SlideShowContext';
import useCardCrudOperations from '@/app/studygraph/(studygraph)/components/hooks/useCardCrudOperations';
import { askQuestionAPI } from '@/app/Library/utils/aiServiceApi';
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
 * @file AskAssistantPanel.tsx
 * @description
 *   Slide-in panel for the “Ask Assistant” flow:
 *     1. Enter question → Send calls API.
 *     2. Immediately close panel & enable spinner in SlideShowOverlay.
 *     3. Persist new Note on success.
 *     4. SlideShowOverlay will auto-advance to the new slide.
 */
const AskAssistantPanel: React.FC<AskAssistantPanelProps> = ({
  onClose,
  onLoading,
}) => {
  const { currentSlide } = useSlideShow();
  const { createResource } = useCardCrudOperations();
  const { docFileID } = useYDoc();

  const [question, setQuestion] = useState('');

  const setLoading = (v: boolean) => {
    onLoading(v);
  };

  const handleSend = useCallback(async () => {
    if (!question.trim() || !currentSlide) return;

    // show spinner in SlideShowOverlay, then close panel
    setLoading(true);
    onClose();

    try {
      // derive slide context
      let slideContext = '';
      switch (currentSlide.type) {
        case 'picture':
          {
            const desc = (currentSlide as any).description;
            slideContext = typeof desc === 'string' ? desc : '';
          }
          break;
        case 'note':
        case 'cueCard':
          slideContext = (currentSlide as any).content;
          break;
        case 'practiceSheet':
          slideContext = JSON.stringify((currentSlide as any).content);
          break;
      }

      // ask the backend
      const { question_title, question_response } = await askQuestionAPI(
        question,
        slideContext,
        docFileID!
      );

      const html = mdParser.render(question_response);
      
      // persist new Note card
      await createResource({
        nodeId: (currentSlide as any).nodeId,
        type: 'note',
        title: question_title,
        content: html,
      });
    } catch (err) {
      console.error('AskAssistantPanel error:', err);
    } finally {
      // stop spinner; SlideShowOverlay’s effect will advance to new slide
      setLoading(false);
    }
  }, [question, currentSlide, createResource, docFileID, onClose]);

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
