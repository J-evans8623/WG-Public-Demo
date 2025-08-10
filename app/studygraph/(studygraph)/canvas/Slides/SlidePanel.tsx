import React from 'react';
import './SlidePanel.css';
import SlideCard from './SlideCard';
import { Slide } from '../../../types/slides';

type Props = {
  slides: Slide[];
  onOpenSlideshow?: (index?: number) => void;
};

const SlidePanel: React.FC<Props> = ({ slides, onOpenSlideshow }) => {
  return (
    <aside className="slide-preview-container" aria-label="Slide Panel">
      <div className="slide-preview-header">
        <div className="slide-preview-title">Slides</div>
        <div className="slide-header-actions">
          <button className="header-action-btn" title="Search Slides" aria-label="Search Slides">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
          </button>
          <button
            className="header-action-btn"
            title="View Slideshow"
            aria-label="View Slideshow"
            onClick={() => onOpenSlideshow?.(0)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect>
              <polyline points="17 2 12 7 7 2"></polyline>
            </svg>
          </button>
          <button className="header-action-btn" title="Chat with AI" aria-label="Chat with AI">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.39 0 2.73-.29 3.94-.82L22 22l-1.18-6.06C21.47 14.73 22 13.39 22 12c0-5.52-4.48-10-10-10z"></path>
              <circle cx="8" cy="12" r="1"></circle>
              <circle cx="12" cy="12" r="1"></circle>
              <circle cx="16" cy="12" r="1"></circle>
            </svg>
          </button>
        </div>
      </div>

      <div className="slide-preview-content">
        {slides.map((s, i) => (
          <SlideCard key={s.id} slide={s} index={i} />
        ))}
        <button className="add-slide-btn">+ Add New Slide</button>
      </div>
    </aside>
  );
};

export default SlidePanel;
