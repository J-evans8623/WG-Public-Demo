// app/workspace/(studygraph)/components/layout/Calendar/CalendarRemovalView.tsx

/**
 * @file CalendarRemovalView.tsx
 * @description
 * A dedicated management view for removing notebooks from an active study plan.
 * It displays a filtered list of currently selected notebooks and provides controls
 * to surgically remove a specific notebook via the CalendarContext.
 *
 * Responsibilities:
 * 1. Render a list of active notebooks (derived from context).
 * 2. Handle removal interactions with confirmation.
 * 3. Provide navigation back to the main calendar view.
 */

import React, { useMemo, useCallback } from 'react';
import { ArrowLeft, Trash2, BookOpen, AlertTriangle } from 'lucide-react';
import { useCalendar } from '@/app/Library/Context/CalendarContextv2';
import './calendar-theme.css';

interface CalendarRemovalViewProps {
  /** Callback to return to the main Calendar view */
  onBack: () => void;
}

const CalendarRemovalView: React.FC<CalendarRemovalViewProps> = ({ onBack }) => {
  const { 
    selectedNotebooks, 
    availableNotebooks, 
    removeNotebook,
    isLoading 
  } = useCalendar();

  // 1. Derive the list of active notebook objects from the IDs
  const activeNotebooks = useMemo(() => {
    return availableNotebooks.filter(nb => selectedNotebooks.includes(nb.fileId));
  }, [availableNotebooks, selectedNotebooks]);

  // 2. Handle Removal
  const handleRemove = useCallback((notebookId: string, notebookName: string) => {
    if (isLoading) return;

    // Safety check
    const confirmed = window.confirm(
      `Are you sure you want to remove "${notebookName}" from your study plan?\n\nThis will remove all future study sessions for this subject.`
    );

    if (confirmed) {
      removeNotebook(notebookId);
      // If this was the last notebook, the context might clear the plan, 
      // but we stay in this view or let the parent handle navigation.
    }
  }, [removeNotebook, isLoading]);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-200">
        <button 
          onClick={onBack}
          className="calendar-btn-icon"
          aria-label="Back to Calendar"
          title="Back to Calendar"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Manage Subjects</h2>
          <p className="text-xs text-gray-500">Remove notebooks from your current schedule</p>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeNotebooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
            <BookOpen size={48} className="mb-4 text-gray-300" />
            <p>No notebooks currently selected.</p>
            <button 
              onClick={onBack}
              className="mt-4 calendar-btn calendar-btn-primary"
            >
              Return to Calendar
            </button>
          </div>
        ) : (
          <div className="space-y-3">
             <div className="flex items-start gap-2 p-3 bg-amber-50 text-amber-800 rounded-md text-sm mb-4 border border-amber-200">
                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                <p>
                  Removing a notebook will remove all future scheduled sessions for that notebook.
                </p>
             </div>

            {activeNotebooks.map((notebook) => (
              <div 
                key={notebook.fileId}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors bg-white group"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div 
                    className="w-2 h-10 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: notebook.colorCode || '#E0E0E0' }} 
                  />
                  <div className="min-w-0">
                    <h3 className="font-medium text-gray-900 truncate" title={notebook.fileName}>
                      {notebook.fileName}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {notebook.totalUnits} Unit{notebook.totalUnits !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleRemove(notebook.fileId, notebook.fileName)}
                  disabled={isLoading}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  title="Remove from Schedule"
                  aria-label={`Remove ${notebook.fileName}`}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CalendarRemovalView;