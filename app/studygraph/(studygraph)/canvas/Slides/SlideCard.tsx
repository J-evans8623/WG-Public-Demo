import React from 'react';
import './SlideCard.css';
import { Slide } from '../../../types/slides';

type Props = {
  slide: Slide;
  index: number; // 0-based
};

const SlideCard: React.FC<Props> = ({ slide, index }) => {
  return (
    <div className="preview-slide">
      <div className="preview-slide-header">
        <div className="preview-slide-title">{slide.title}</div>
        <div className="preview-slide-actions">
          <button className="slide-action-btn" title="Edit" aria-label="Edit slide">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button className="slide-action-btn" title="More" aria-label="More actions">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="1"></circle>
              <circle cx="12" cy="5" r="1"></circle>
              <circle cx="12" cy="19" r="1"></circle>
            </svg>
          </button>
          <button className="slide-action-btn" title="Close" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      <div className="preview-slide-body">
        <div className="preview-slide-content">{slide.content}</div>
      </div>

      <div className="preview-slide-footer">
        <span className="concept-node-label">{slide.conceptNode}</span>
        <span className="slide-number">Slide {index + 1}</span>
      </div>
    </div>
  );
};

export default SlideCard;
