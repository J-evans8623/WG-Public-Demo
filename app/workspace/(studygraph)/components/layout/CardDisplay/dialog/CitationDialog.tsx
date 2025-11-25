/**
 * CitationDialog.tsx
 *
 * Responsibilities:
 *   - Render a modal dialog showing:
 *       • citation.index
 *       • citation.textsource
 *       • citation.page_number
 *   - Trap page scrolling while open.
 *   - Call `onClose` when backdrop or “Close” clicked.
 *
 * Usage:
 *   <CitationDialog
 *     isOpen={boolean}
 *     citation={Citation|null}
 *     onClose={() => void}
 *   />
 */

import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { Citation } from '@/app/Library/Definitions/Definitions'

interface CitationDialogProps {
  isOpen: boolean
  citation: Citation | null
  onClose: () => void
}

const modalRoot = typeof document !== 'undefined' && document.getElementById('modal-root')

const CitationDialog: React.FC<CitationDialogProps> = ({ isOpen, citation, onClose }) => {
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen || !modalRoot) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black opacity-50"
        onClick={onClose}
        data-testid="citation-dialog-backdrop"
      />
      {/* Dialog */}
      <div className="relative bg-white rounded-lg shadow-lg max-w-sm w-full p-6 z-10">
        <h2 className="text-lg font-semibold mb-4">Citation Details</h2>
        {citation ? (
          <div className="space-y-2">
            <p>
              <strong>Index:</strong> {citation.index}
            </p>
            <p>
              <strong>Source:</strong> {citation.textsource}
            </p>
            <p>
              <strong>Page Number:</strong> {citation.page_number}
            </p>
          </div>
        ) : (
          <p>No citation data available.</p>
        )}
        <button
          className="mt-6 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>,
    modalRoot
  )
}

export default CitationDialog
