// File: src/app/studygraph/canvaslayout/Canvas.tsx

'use client'

import React, { useEffect } from 'react'
import './canvas.css'
import './warm-map-theme.css'
import SlideCardDisplay, { Slide } from './SlideCardDisplay'
import './SlideCardDisplay.css'
import { Bookmark, Share2, History, CalendarDays, MessageCircle } from 'lucide-react'

/**
 * @file Canvas.tsx
 * @description
 * This Canvas.tsx file is the central React component of the Studygraph application,
 * responsible for rendering the entire canvas layout including its sticky header
 * and interactive controls. In this file, we implement three distinct header regions:
 * (1) the left group showing the file title and basic navigation ("Lessons", "Uploads"),
 * (2) the middle group containing core actions ("Start Lesson", "Start Review", "Discussion", "Bookmark"),
 * separated by visual dividers, and (3) the right group hosting utility actions
 * ("Calendar", "Share", "History"). Each button has a dedicated click handler that logs
 * a unique event code for observability. We also define a mock slide dataset here
 * and pass it down to the SlideCardDisplay component to render the floating slide preview panel.
 * Console logs are strategically placed to trace mounting, mock data initialization, and
 * user interactions, facilitating future debugging without cluttering core logic.
 */
export default function Canvas() {
  // 1. Local state: the title of the loaded document
  const fileTitle = 'MyDocument.pdf'

  // 2. Lifecycle logging: mount, file title, and static concept map initialization
  useEffect(() => {
    console.log('[Canvas.tsx][0001] Canvas component mounted')
    console.log(`[Canvas.tsx][0002] fileTitle = ${fileTitle}`)
    console.log('[Canvas.tsx][0012] Static concept map initialized')
  }, [fileTitle])

  /** 
   * 3. Define the Slide interface and mock slide data 
   *    We use the same shape SlideCardDisplay expects.
   */
  const mockSlides: Slide[] = [
    {
      title: 'Overview',
      content:
        'Despite a widespread increase in educational participation and attainment rates across the Canadian population, significant inequalities persist across various dimensions of educational experience and outcomes.',
      topic: 'Persistent Educational Inequalities and Opportunities',
      page: 'Slide 1 of 12'
    },
    {
      title: 'Key Concepts',
      content:
        'The sociology of education examines how social institutions, cultural practices, and power structures influence learning processes and educational outcomes.',
      topic: 'Classical Sociological Theories',
      page: 'Slide 2 of 12'
    },
    {
      title: 'Global Perspectives',
      content:
        'International comparative studies reveal that educational systems reflect and reproduce the cultural values and social hierarchies of their respective societies.',
      topic: 'The Evolving Landscape of Form',
      page: 'Slide 3 of 12'
    }
  ]
  console.log('[Canvas.tsx][0013] mockSlides initialized', mockSlides)

  /** All click handlers unchanged… **/
  function handleLessonsClick() { console.log('[Canvas.tsx][0003] Lessons button clicked') }
  function handleUploadsClick() { console.log('[Canvas.tsx][0004] Uploads button clicked') }
  function handleStartLesson() { console.log('[Canvas.tsx][0005] Start Lesson button clicked') }
  function handleStartReview() { console.log('[Canvas.tsx][0006] Start Review button clicked') }
  function handleDiscussion() { console.log('[Canvas.tsx][0007] Discussion button clicked') }
  function handleBookmark() { console.log('[Canvas.tsx][0008] Bookmark button clicked') }
  function handleCalendar() { console.log('[Canvas.tsx][0009] Calendar button clicked') }
  function handleShare()    { console.log('[Canvas.tsx][0010] Share button clicked') }
  function handleHistory()  { console.log('[Canvas.tsx][0011] History button clicked') }

  const btnBase   = 'flex items-center gap-1 px-3 py-1 text-sm font-medium rounded transition'
  const btnBorder = 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'

  return (
    <div className="canvas-container">
      {/* ─── HEADER BAR ─── */}
      <header className="canvas-header">
        {/* 1. LEFT GROUP */}
        <div className="header-left">
          <span className="header-title">{fileTitle}</span>
          <button className="primary-button" onClick={handleLessonsClick}>Lessons</button>
          <button className="primary-button" onClick={handleUploadsClick}>Uploads</button>
        </div>
        {/* 2. DIVIDER */}
        <div className="header-divider" aria-hidden="true" />
        {/* 3. MIDDLE GROUP */}
        <div className="header-actions">
          <button className="primary-button btn-primary" onClick={handleStartLesson}>▶ Start Lesson</button>
          <button className="primary-button btn-secondary" onClick={handleStartReview}>▶ Start Review</button>
          <button className={`${btnBase} ${btnBorder}`} title="Open Forums" onClick={handleDiscussion}>
            <MessageCircle size={16} /> Discuss
          </button>
          <button className={`${btnBase} ${btnBorder}`} title="Bookmarks" onClick={handleBookmark}>
            <Bookmark size={16} />
          </button>
        </div>
        {/* 4. DIVIDER */}
        <div className="header-divider" aria-hidden="true" />
        {/* 5. RIGHT GROUP */}
        <div className="header-right">
          <button className={`${btnBase} ${btnBorder}`} title="Planner" onClick={handleCalendar}>
            <CalendarDays size={16} />
          </button>
          <button className={`${btnBase} ${btnBorder}`} title="Share" onClick={handleShare}>
            <Share2 size={16} />
          </button>
          <button className={`${btnBase} ${btnBorder}`} title="History" onClick={handleHistory}>
            <History size={16} />
          </button>
        </div>
      </header>

      {/* ─── MAIN CONTENT ─── */}
      <div className="canvas-main">
        <div className="canvas-area">
          {/* 3. STATIC CONCEPT MAP (unchanged) */}
          {/* … */}
          {/* 4. Floating toolbar (unchanged) */}
          {/* … */}
        </div>

        {/* 6. Slide/Card Display: pass our mockSlides */}
        <SlideCardDisplay slides={mockSlides} />
      </div>
    </div>
  )
}
