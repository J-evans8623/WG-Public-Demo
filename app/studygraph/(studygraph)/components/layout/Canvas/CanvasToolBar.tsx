/**
 * CanvasToolBar.tsx
 *
 * Responsibilities:
 *  1) Render the existing Zoom In/Out, Multi-Select, and PDF navigation buttons exactly as is.
 *  2) Add a single new quiz document icon button, which opens the QuizGeneratorModal.
 *  3) Avoid introducing any other new buttons or altering existing ones.
 */

// CanvasToolBar.tsx

import React, { useState } from 'react';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import { MousePointer, FileQuestion } from 'lucide-react';
import QuizGeneratorModal from './QuizGeneratorModal'; // Adjust path if needed

interface PdfPageInfo {
  current: number;
  total: number;
}

interface CanvasToolbarProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  activeView: 'conceptMap' | 'pdf';
  onPdfPrevPage?: () => void;
  onPdfNextPage?: () => void;
  pdfPageInfo?: PdfPageInfo;
}

export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
  onZoomIn,
  onZoomOut,
  activeView,
  onPdfPrevPage,
  onPdfNextPage,
  pdfPageInfo,
}) => {
  const { multiSelectEnabled, toggleMultiSelectEnabled } = useNodeSelection();

  // Local state to control the Quiz modal
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);

  return (
    <div className="flex items-center space-x-4">
      {/* Zoom In Button */}
      <button
        onClick={onZoomIn}
        className="p-2 rounded-md hover:bg-gray-100 text-gray-600 group relative inline-flex items-center justify-center"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"
          />
        </svg>
        <span className="pointer-events-none absolute bottom-full mb-1 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-50">
          Zoom In
        </span>
      </button>

      {/* Zoom Out Button */}
      <button
        onClick={onZoomOut}
        className="p-2 rounded-md hover:bg-gray-100 text-gray-600 group relative inline-flex items-center justify-center"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM7 10h6"
          />
        </svg>
        <span className="pointer-events-none absolute bottom-full mb-1 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-50">
          Zoom Out
        </span>
      </button>

      {/* Multi-select toggle for concept maps */}
      {activeView === 'conceptMap' && (
        <button
          onClick={toggleMultiSelectEnabled}
          className={`
            relative
            p-2
            rounded-md
            hover:bg-gray-100
            text-gray-600
            group
            inline-flex
            items-center
            justify-center
            ${multiSelectEnabled ? 'bg-blue-100' : ''}
          `}
          title={multiSelectEnabled ? 'Multi-Select Enabled' : 'Single-Select Enabled'}
        >
          <MousePointer className="h-5 w-5" />
          {multiSelectEnabled && (
            <span
              className="
                absolute
                -top-1
                -right-1
                w-4
                h-4
                bg-blue-500
                text-white
                text-xs
                flex
                items-center
                justify-center
                rounded-full
              "
            >
              +
            </span>
          )}
          <span className="pointer-events-none absolute bottom-full mb-1 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-50">
            {multiSelectEnabled ? 'Multi-Select' : 'Single Select'}
          </span>
        </button>
      )}

      {/* PDF-specific controls */}
      {activeView === 'pdf' && (
        <>
          <button
            onClick={onPdfPrevPage}
            className="p-2 rounded-md hover:bg-gray-100 text-gray-600 group relative inline-flex items-center justify-center"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="pointer-events-none absolute bottom-full mb-1 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-50">
              Previous Page
            </span>
          </button>

          <button
            onClick={onPdfNextPage}
            className="p-2 rounded-md hover:bg-gray-100 text-gray-600 group relative inline-flex items-center justify-center"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="pointer-events-none absolute bottom-full mb-1 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-50">
              Next Page
            </span>
          </button>

          {/* Display PDF page information */}
          {pdfPageInfo && pdfPageInfo.total > 0 && (
            <span className="ml-4 text-sm text-gray-700">
              Page {pdfPageInfo.current} of {pdfPageInfo.total}
            </span>
          )}
        </>
      )}

      {/* --- Single New Quiz Icon Button: Only shown for Concept Map view --- */}
      {activeView === 'conceptMap' && (
        <>
          <button
            onClick={() => setIsQuizModalOpen(true)}
            className="p-2 text-gray-600 hover:text-blue-500 bg-gray-100 rounded-md mx-2 group relative inline-flex items-center justify-center"
          >
            <FileQuestion className="h-5 w-5" />
            <span className="pointer-events-none absolute bottom-full mb-1 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-50">
              Open Quiz Generator
            </span>
          </button>

          {/* The Quiz Generator Modal */}
          <QuizGeneratorModal
            isOpen={isQuizModalOpen}
            onClose={() => setIsQuizModalOpen(false)}
            preselectedTopicIds={[]}
          />
        </>
      )}
    </div>
  );
};

export default CanvasToolbar;
