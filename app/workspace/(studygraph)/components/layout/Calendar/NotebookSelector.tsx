/**
 * @file NotebookSelector.tsx
 * @description
 * Enhanced checkbox-based interface for selecting notebooks.
 * UPDATES:
 * - Refactored tile JSX to match "file-tile" design system (Header Row + Footer).
 * - Implemented sidebar accent color via CSS variable injection.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { RefreshCw, Check, BookOpen } from 'lucide-react'; // Ensure BookOpen is imported
import { useCalendar } from '@/app/Library/Context/CalendarContextv2';
import { NotebookSummary } from '@/app/Library/Definitions/CalendarDefinitions';
import './calendar-theme.css';


interface NotebookSelectorProps {
  notebooks: NotebookSummary[];
  loading: boolean;
  onRefresh: () => void;
}

const NotebookSelector: React.FC<NotebookSelectorProps> = ({
  notebooks,
  loading,
  onRefresh,
}) => {
  // Step 1: Access calendar context for selection state management
  const { selectedNotebooks, selectNotebook, deselectNotebook } = useCalendar();

  // Step 2: Initialize local state for search and filtering
  const [searchTerm, setSearchTerm] = useState('');

  const filteredNotebooks = useMemo(() => {
    if (!searchTerm.trim()) {
      return notebooks;
    }
    const filtered = notebooks.filter(notebook =>
      notebook.fileName.toLowerCase().includes(searchTerm.toLowerCase().trim())
    );
    return filtered;
  }, [notebooks, searchTerm]);

  const handleNotebookToggle = useCallback((notebookId: string, isSelected: boolean) => {
    if (isSelected) {
      selectNotebook(notebookId);
    } else {
      deselectNotebook(notebookId);
    }
  }, [selectNotebook, deselectNotebook]);

  const getNotebookColor = useCallback((notebook: NotebookSummary) => {
    return notebook.colorCode || '#C8E6C9'; // Default fallback
  }, []);

  const formatFileTime = useCallback((timestamp?: string): string => {
    if (!timestamp) return 'Unknown date';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString();
  }, []);

  return (
    <div className="calendar-container space-y-4">
      
      {/* Step 4: Enhanced Search and Actions Header */}
      <div className="files-header-top" style={{ marginBottom: '16px' }}>
        <div className="files-search">
          <input
            type="text"
            className="files-search-input"
            placeholder="Search notebooks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={loading}
          />
          <button
            onClick={onRefresh}
            disabled={loading}
            className="calendar-btn-icon"
            title="Refresh notebook list"
            aria-label="Refresh available notebooks"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Step 7: Enhanced Loading State */}
      {loading && (
        <div className="empty-state">
          <div className="calendar-loading-spinner"></div>
          <h3 className="empty-title" style={{ marginTop: '16px' }}>Loading Notebooks</h3>
          <p className="empty-description">Fetching your available notebooks...</p>
        </div>
      )}

      {/* Step 8: Enhanced Empty States */}
      {!loading && notebooks.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📚</div>
          <h3 className="empty-title">No Notebooks Available</h3>
          <p className="empty-description">
            You dont have any notebooks with lesson content available for calendar planning. 
            Create some notebooks with lesson units to get started.
          </p>
          <button
            onClick={onRefresh}
            className="calendar-btn calendar-btn-primary"
            style={{ marginTop: '16px' }}
          >
            Refresh List
          </button>
        </div>
      )}

      {!loading && filteredNotebooks.length === 0 && notebooks.length > 0 && (
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <h3 className="empty-title">No Matching Notebooks</h3>
          <p className="empty-description">
            No notebooks match your search term. Try adjusting your search.
          </p>
          <button
            onClick={() => setSearchTerm('')}
            className="calendar-btn calendar-btn-outline"
            style={{ marginTop: '16px' }}
          >
            Clear Search
          </button>
        </div>
      )}

      {/* Step 9: Enhanced Notebook Grid with HomescreenV3 file-tile design */}
      {!loading && filteredNotebooks.length > 0 && (
        <div className="files-grid">
          {filteredNotebooks.map((notebook) => {
            const isSelected = selectedNotebooks.includes(notebook.fileId);
            const notebookColor = getNotebookColor(notebook);
            
            return (
              <div
                key={notebook.fileId}
                className="file-tile"
                onClick={() => handleNotebookToggle(notebook.fileId, !isSelected)}
                // Inject CSS variable for sidebar accent + Handle Selection Styles
                style={{
                  '--accent-color': notebookColor,
                  border: isSelected ? '2px solid #5B8C5A' : undefined, // Override CSS border if selected
                  backgroundColor: isSelected ? '#F8FBF8' : undefined,  // Override CSS bg if selected
                } as React.CSSProperties}
              >
                
                {/* Header Row with Icon and Title */}
                <div className="file-header-row">
                  <div className="file-icon-small">
                    <BookOpen size={16} strokeWidth={1.5} />
                  </div>
                  <div className="file-title" title={notebook.fileName}>
                    {notebook.fileName}
                  </div>
                </div>

                {/* Selection Checkbox Overlay (Top Right) */}
                <div
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    zIndex: 10,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => handleNotebookToggle(notebook.fileId, e.target.checked)}
                    style={{
                      width: '16px',
                      height: '16px',
                      accentColor: '#5B8C5A',
                      cursor: 'pointer'
                    }}
                  />
                </div>

                {/* Footer Section with Meta data */}
                <div className="file-footer">
                  <div className="file-meta">
                    <span className="file-time">
                      {formatFileTime(notebook.lastUpdated.toISOString())}
                    </span>
                  </div>
                  {/* Unit Count displayed in footer */}
                  <div style={{ fontSize: '11px', color: '#6C757D', fontWeight: 500 }}>
                    {notebook.totalUnits} Unit{notebook.totalUnits !== 1 ? 's' : ''}
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Step 16: Enhanced Footer Information */}
      {!loading && notebooks.length > 0 && (
        <div style={{ 
          textAlign: 'center', 
          color: '#6C757D', 
          paddingTop: '16px', 
          borderTop: '1px solid #E0E0E0',
          fontSize: '14px'
        }}>
          Showing {filteredNotebooks.length} of {notebooks.length} available notebook{notebooks.length !== 1 ? 's' : ''}
          {selectedNotebooks.length > 0 && (
            <span style={{ marginLeft: '8px', color: '#5B8C5A', fontWeight: '500' }}>
              • {selectedNotebooks.length} selected
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default NotebookSelector;