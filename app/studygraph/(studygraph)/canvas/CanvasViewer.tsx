'use client'
import React, { useState } from 'react';
import './Canvas.css';
import '../../styles/tokens.css';
import '../../styles/theme-warm-board.css';
import './Map/NodeGraph.css'; // node/row/add-button styles (verbatim)

import SlidePanel from './Slides/SlidePanel';
import { slidesMock } from '../../mocks/slides.mock';
import { Slide } from '../../types/slides';

import MapView from './Map/MapView';       // wrapper with background + container (no local css)
import MapToolbar from './Map/MapToolbar'; // toolbar (unchanged; includes its own css)

const CanvasViewer: React.FC = () => {
  const [slides] = useState<Slide[]>(slidesMock);

  return (
    <div>
      {/* Header */}
      <header className="header">
        <div className="doc-title"><span>📄</span> MyDocument.pdf</div>

        <nav className="nav-tabs">
          <button className="nav-tab">Lessons</button>
          <button className="nav-tab">Uploads</button>
        </nav>

        <div className="action-buttons">
          <button className="btn btn-primary">▶ Start Lesson</button>
          <button className="btn btn-secondary">↻ Start Review</button>
          <button className="btn btn-icon round" title="Discuss" aria-haspopup="dialog" aria-controls="forumOverlay">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
            </svg>
          </button>
        </div>

        <div className="header-right">
          <button className="btn btn-icon" title="Share" aria-haspopup="dialog">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
            </svg>
          </button>
          <button className="btn btn-icon" title="Version History">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </button>
          <button className="btn btn-icon" title="Calendar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
          </button>
        </div>
      </header>

      {/* Workspace split */}
      <div className="workspace">
        {/* Left: Map area with your existing graph/nodes.
            IMPORTANT: keep your original components; just ensure they receive the CSS classes below. */}
        <MapView>
          <div className="flowchart-nodes">
            {/* Example scaffolding. Replace with your real graph:
                - Group rows inside <div className="node-row">
                - Each node root must include className="node" (and "main" for the highlighted one)
                - Titles inside nodes should use className="node-title"
                - Optional subtitles use className="node-subtitle"
                - Add button uses className="add-button"
            */}

            {/* --- Example: main row (replace with your component(s)) --- */}
            <div className="node-row">
              {/* Your main node component should render with className="node main" and its title with className="node-title" */}
              {/* <YourMainNode className="node main" titleClassName="node-title" /> */}
            </div>

            {/* If you want the exact demo connectors, you can also render the inline SVG here.
                Otherwise, keep your existing edges/links. */}
            {/*
            <svg
              style={{ position:'absolute', width:'100%', height:'100%', top:0, left:0, zIndex:0, pointerEvents:'none' }}
              aria-hidden="true"
            >
              <line x1="50%" y1="80" x2="30%" y2="180" stroke="#D4C4B0" strokeWidth="2" />
              <line x1="50%" y1="80" x2="50%" y2="180" stroke="#D4C4B0" strokeWidth="2" />
              <line x1="50%" y1="80" x2="70%" y2="180" stroke="#D4C4B0" strokeWidth="2" />
            </svg>
            */}

            {/* --- Example: additional rows (replace with your components) --- */}
            {/* <div className="node-row">
              <YourNode className="node" titleClassName="node-title" />
              <YourNode className="node" titleClassName="node-title" />
              ...
            </div> */}

            {/* --- Example: add button row --- */}
            {/* <div className="node-row">
              <button className="add-button" aria-label="Add node">+</button>
            </div> */}
          </div>
        </MapView>

        {/* Right: Slide rail */}
        <SlidePanel
          slides={slides}
          onOpenSlideshow={(startIndex = 0) => {
            // Step 4: wire this to open SlideshowModal
            console.log('Open slideshow at index', startIndex);
          }}
        />
      </div>

      {/* Bottom toolbar (unchanged) */}
      <MapToolbar />
    </div>
  );
};

export default CanvasViewer;
