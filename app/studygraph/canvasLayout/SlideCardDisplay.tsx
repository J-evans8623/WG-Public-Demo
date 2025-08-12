// File: src/app/studygraph/canvaslayout/SlideCardDisplay.tsx

import React, { useEffect, useState } from 'react'
import { Search, MoreHorizontal, ExternalLink, X } from 'lucide-react'
import './SlideCardDisplay.css'

/**
 * @file SlideCardDisplay.tsx
 * @description
 * This component renders the floating slide/card display panel for Studygraph. It is
 * responsible for presenting a searchable list of lesson slides in a modern card UI
 * that matches the branding theme. It receives slide data via props, tracks the
 * search term, filters the slides accordingly, and logs critical lifecycle and
 * user‐interaction events for observability. By exporting the Slide interface and
 * accepting an array of Slide objects, this file cleanly separates data concerns
 * from presentation and allows Canvas.tsx (or any parent) to supply dynamic content
 * without modifying the component internals.
 */

/**
 * @interface Slide
 * @description
 * Defines the shape of a single slide object used by SlideCardDisplay.
 * Includes the title, preview content, topic tag, and pagination label.
 */
export interface Slide {
  title: string
  content: string
  topic: string
  page: string
}

/**
 * SlideCardDisplay
 * @description
 * This function component renders a search‐able panel of slide previews. It
 * accepts slides via props, initializes mount logging, manages a searchTerm
 * state, filters the provided slides, and renders each as a styled card with
 * header actions and a footer. Console logs mark key events such as mount and
 * data receipt to aid debugging.
 */
export default function SlideCardDisplay({ slides }: { slides: Slide[] }) {
  // 1. Mount logging
  useEffect(() => {
    console.log('[SlideCardDisplay.tsx][1001] Mounted SlideCardDisplay with slides:', slides)
  }, [slides])

  // 2. State: search term
  const [searchTerm, setSearchTerm] = useState<string>('')

  // 3. Filter slides based on search term
  const filtered = slides.filter(s =>
    (s.title + s.content + s.topic).toLowerCase().includes(searchTerm.toLowerCase())
  )
  console.log('[SlideCardDisplay.tsx][1002] filteredSlides count:', filtered.length)

  return (
    <aside className="slide-card-display">
      {/* 4. Search header */}
      <div className="scd-header">
        <div />
        <div className="scd-search-container">
         
          <input
            type="text"
            className="scd-search-input"
            placeholder="Search slides and content..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* 5. Cards grid */}
      <div className="scd-slides-container">
        {filtered.map((slide, idx) => (
          <div key={idx} className="slide-card">
            <div className="card-header">
              <div className="card-title">{slide.title}</div>
              <div className="card-actions">
                <button className="action-btn"><MoreHorizontal size={16} /></button>
                <button className="action-btn"><ExternalLink size={16} /></button>
                <button className="action-btn"><X size={16} /></button>
              </div>
            </div>
            <div className="card-content">
              <p>{slide.content}</p>
            </div>
            <div className="card-footer">
              <span className="topic-tag">{slide.topic}</span>
              <span>{slide.page}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 6. Add‐new‐slide button */}
      <button
        className="add-card-btn"
        onClick={() => console.log('[SlideCardDisplay.tsx][1003] Add New Slide clicked')}
      >
        <span>+</span>Add New Slide
      </button>
    </aside>
  )
}
