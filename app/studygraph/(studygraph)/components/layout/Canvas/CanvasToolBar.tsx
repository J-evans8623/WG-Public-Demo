/**
 * @file CanvasToolBar.tsx
 * @description
 *   Renders controls for zooming, multi-select, PDF navigation, quick-jump,
 *   search, quiz generator—and now global undo/redo.
 *
 * Responsibilities:
 *   - Expose Search button that opens the global SearchModal.
 *   - Expose Undo/Redo buttons (disabled when unavailable).
 *   - Maintain existing zoom, multi-select, PDF nav, and quiz-generator logic.
 */

import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import { useSearchContext } from '@/app/Library/Context/SearchContext';
import { useUndoRedo } from '@/app/studygraph/(studygraph)/components/Context/UndoRedoContext';
import { MousePointer, Search, Undo2, Redo2 } from 'lucide-react';
import QuizGeneratorModal from './QuizGeneratorModal';

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
  onPdfGoToPage?: (page: number) => void;
}

const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
  onZoomIn,
  onZoomOut,
  activeView,
  onPdfPrevPage,
  onPdfNextPage,
  pdfPageInfo,
  onPdfGoToPage,
}) => {
  // Search
  const { open } = useSearchContext();

  // Undo/Redo
  const { undo, redo, canUndo, canRedo } = useUndoRedo();

  // Multi-select
  const { multiSelectEnabled, toggleMultiSelectEnabled } = useNodeSelection();

  // Quiz modal
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);

  // Quick-jump input
  const [inputPage, setInputPage] = useState('');

  const commonButtonClasses =
    'p-2 rounded-md text-gray-600 group relative inline-flex items-center justify-center hover:bg-white hover:shadow';

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputPage(e.target.value);
  };

  const triggerJump = () => {
    const n = Number(inputPage);
    if (onPdfGoToPage && pdfPageInfo && n >= 1 && n <= pdfPageInfo.total) {
      onPdfGoToPage(n);
    }
    setInputPage('');
  };

  return (
    <div className="flex items-center space-x-4">
      {/* Search Button */}
      <button
        onClick={open}
        className={commonButtonClasses}
        aria-label="Search"
      >
        <Search className="h-5 w-5" />
      </button>

      {/* Undo Button */}
      <button
        onClick={undo}
        disabled={!canUndo}
        className={`${commonButtonClasses} ${!canUndo ? 'opacity-50 cursor-not-allowed' : ''}`}
        aria-label="Undo"
      >
        <Undo2 className="h-5 w-5" />
      </button>

      {/* Redo Button */}
      <button
        onClick={redo}
        disabled={!canRedo}
        className={`${commonButtonClasses} ${!canRedo ? 'opacity-50 cursor-not-allowed' : ''}`}
        aria-label="Redo"
      >
        <Redo2 className="h-5 w-5" />
      </button>

      {/* Zoom In Button */}
      <button
        onClick={onZoomIn}
        className={commonButtonClasses}
        aria-label="Zoom In"
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
        className={commonButtonClasses}
        aria-label="Zoom Out"
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

      {/* Multi-select Toggle */}
      {activeView === 'conceptMap' && (
        <button
          onClick={toggleMultiSelectEnabled}
          className={`${commonButtonClasses} ${multiSelectEnabled ? 'bg-white shadow' : ''}`}
          aria-label="Toggle Multi-Select"
        >
          <MousePointer className="h-5 w-5" />
          {multiSelectEnabled && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 text-white text-xs flex items-center justify-center rounded-full">
              +
            </span>
          )}
        </button>
      )}

      {/* PDF Navigation + Quick-Jump */}
      {activeView === 'pdf' && pdfPageInfo && (
        <>
          <span className="text-sm text-gray-700">
            Page {pdfPageInfo.current} of {pdfPageInfo.total}
          </span>
          <div className="flex items-center space-x-1">
            <input
              type="number"
              min={1}
              max={pdfPageInfo.total}
              value={inputPage}
              onChange={handleInputChange}
              onKeyDown={(e) => e.key === 'Enter' && triggerJump()}
              className="w-12 text-sm border rounded p-1"
              placeholder="Go to"
            />
            <button
              onClick={triggerJump}
              className={commonButtonClasses}
              disabled={!inputPage || Number(inputPage) < 1 || Number(inputPage) > pdfPageInfo.total}
            >
              Go
            </button>
          </div>
        </>
      )}

      {/* Quiz Generator */}
      {activeView === 'conceptMap' && (
        <>
          <button
            onClick={() => setIsQuizModalOpen(true)}
            className={commonButtonClasses}
            aria-label="Open Quiz Generator"
          >
            Quiz
          </button>
          {isQuizModalOpen &&
            ReactDOM.createPortal(
              <QuizGeneratorModal
                isOpen
                onClose={() => setIsQuizModalOpen(false)}
                preselectedTopicIds={[]}
              />,
              document.body
            )}
        </>
      )}
    </div>
  );
};

export default CanvasToolbar;
