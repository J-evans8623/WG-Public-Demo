/**
 * NoteCard.tsx
 *
 * Responsibilities:
 *   - Render a heading (`title`) and sanitized, math-rendered HTML (`content`).
 *   - Receive an optional `citations` array.
 *   - Open a CitationDialog when a superscript is clicked.
 */

import React, { useState } from 'react'
import SafeContent from '../../../utils/SafeContent'
import CitationDialog from '../dialog/CitationDialog'
import type { Citation } from '@/app/Library/Definitions/Definitions'

export interface NoteCardProps {
  title: string
  content: string
  /** Optional metadata array for inline citations */
  citations?: Citation[] | null
}

const NoteCard: React.FC<NoteCardProps> = ({ title, content, citations = null }) => {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Citation | null>(null)

  const handleCitationClick = (index: number) => {
    if (!citations) return
    const found = citations.find((c) => c.index === index) || null
    setSelected(found)
    setOpen(true)
  }

  return (
    <div>
      <div className="prose text-text-body text-base leading-relaxed text-start">
        <SafeContent html={content} onCitationClick={handleCitationClick} />
      </div>
      <CitationDialog
        isOpen={open}
        citation={selected}
        onClose={() => setOpen(false)}
      />
    </div>
  )
}

export default NoteCard
