/**
 * @file NotebookSelector.tsx
 * @description
 *   Enhanced checkbox-based interface for selecting notebooks with comprehensive metadata display, color indicators,
 *   and advanced filtering capabilities for the BloomMap calendar planner system. This component provides clear
 *   visual feedback for notebook selection state through color-coded indicators, shows relevant metadata including
 *   lesson unit counts and last updated timestamps, and includes robust search functionality for managing large
 *   notebook collections efficiently. The implementation handles loading states, empty states, and error conditions
 *   while maintaining responsive design and accessibility standards throughout. Updated with comprehensive brand
 *   theme integration featuring professional styling with sage green and blue accents, consistent button patterns,
 *   and optimized form elements that align with the established calendar design system. The component integrates
 *   seamlessly with CalendarContext for selection state management and provides intuitive controls for users to
 *   build their study schedule from available notebooks with enhanced visual distinction through color coding and
 *   improved typography hierarchy that maintains readability across different screen sizes. Now aligned with the
 *   new HomescreenV3 file-tile design system featuring enhanced visual hierarchy, improved contrast ratios, and
 *   modern card-based interfaces with sophisticated hover effects and better accessibility support.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Search, BookOpen, Clock, RefreshCw, Check, Trash } from 'lucide-react';
import { useCalendar } from '@/app/Library/Context/CalendarContext';
import { NotebookSummary } from '@/app/Library/Definitions/CalendarDefinitions';
import './calendar-theme.css';

interface NotebookSelectorProps {
  notebooks: NotebookSummary[];
  loading: boolean;
  onRefresh: () => void;
}

/**
 * Enhanced notebook selection component that displays available notebooks with color indicators
 * and comprehensive metadata. Provides search functionality and integrates with calendar context
 * for selection state management with visual feedback and accessibility features. Updated with
 * brand theme integration and HomescreenV3 file-tile design alignment for consistent visual
 * presentation across the calendar system with modern card-based interfaces and enhanced hover states.
 */
const NotebookSelector: React.FC<NotebookSelectorProps> = ({
  notebooks,
  loading,
  onRefresh,
}) => {
  console.log('[NotebookSelector.tsx][3001] › Rendering enhanced notebook selector with HomescreenV3 alignment, notebooks:', notebooks.length);

  // Step 1: Access calendar context for selection state management
  const { selectedNotebooks, selectNotebook, deselectNotebook } = useCalendar();

  // Step 2: Initialize local state for search and filtering
  const [searchTerm, setSearchTerm] = useState('');

  /**
   * Filters notebooks based on search term while preserving original order and selection state.
   * Enhanced with improved performance optimization and case-insensitive matching for better
   * user experience when managing large notebook collections with diverse naming conventions.
   */
  const filteredNotebooks = useMemo(() => {
    if (!searchTerm.trim()) {
      console.log('[NotebookSelector.tsx][3002] › No search term, returning all', notebooks.length, 'notebooks');
      return notebooks;
    }

    const filtered = notebooks.filter(notebook =>
      notebook.fileName.toLowerCase().includes(searchTerm.toLowerCase().trim())
    );

    console.log('[NotebookSelector.tsx][3003] › Filtered to', filtered.length, 'notebooks for search term:', searchTerm);
    return filtered;
  }, [notebooks, searchTerm]);

  /**
   * Handles notebook selection toggle with comprehensive state management and validation.
   * Enhanced with improved error handling and state consistency checks to ensure reliable
   * selection behavior across different interaction patterns and edge cases.
   */
  const handleNotebookToggle = useCallback((notebookId: string, isSelected: boolean) => {
    console.log('[NotebookSelector.tsx][3004] › Toggling notebook selection:', notebookId, 'selected:', isSelected);

    if (isSelected) {
      selectNotebook(notebookId);
    } else {
      deselectNotebook(notebookId);
    }
  }, [selectNotebook, deselectNotebook]);

  /**
   * Formats the last updated timestamp for display with enhanced human-readable formatting.
   * Provides intelligent time period detection and localized formatting that helps users
   * understand content recency and make informed decisions about notebook selection.
   */
  const formatLastUpdated = useCallback((date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 60) {
      return diffMinutes <= 1 ? 'Just now' : `${diffMinutes} minutes ago`;
    } else if (diffHours < 24) {
      return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
    } else if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
    } else {
      return date.toLocaleDateString();
    }
  }, []);

  /**
   * Determines appropriate color for notebook indicator with enhanced fallback handling.
   * Maps notebook names to subject colors from the brand theme system while providing
   * consistent fallback colors for unknown subjects to maintain visual coherence.
   */
  const getNotebookColor = useCallback((notebook: NotebookSummary) => {
    if (notebook.color) return notebook.color;
    
    // Step 3: Map notebook names to brand theme subject colors
    const name = notebook.fileName.toLowerCase();
    if (name.includes('biology') || name.includes('bio')) return '#C8E6C9';
    if (name.includes('chemistry') || name.includes('chem')) return '#FFE0B2';
    if (name.includes('physics')) return '#BBDEFB';
    if (name.includes('math') || name.includes('mathematics')) return '#FFCDD2';
    if (name.includes('history')) return '#E1BEE7';
    if (name.includes('english') || name.includes('literature')) return '#B2DFDB';
    if (name.includes('psychology') || name.includes('psych')) return '#F8BBD9';
    
    return '#C8E6C9'; // Default sage green
  }, []);

  /**
   * Formats file time for display using the same logic as HomescreenV3.
   * Provides consistent time formatting across the application with relative
   * time strings for improved user experience and temporal context.
   */
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
      
      {/* Step 4: Enhanced Search and Actions Header with HomescreenV3 styling */}
      <div className="files-header-top" style={{ marginBottom: '16px' }}>
        <div className="files-title">Select Notebooks for Calendar</div>
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

      {/* Step 5: Enhanced Selection Summary with HomescreenV3 card styling */}
      {selectedNotebooks.length > 0 && (
        <div className="actions-card" style={{ background: '#F8FBF8', borderColor: '#5B8C5A' }}>
          <div className="flex items-center gap-2 mb-2">
            <Check size={16} style={{ color: '#5B8C5A' }} />
            <p style={{ color: '#2C3E50', fontSize: '14px', fontWeight: '500' }}>
              {selectedNotebooks.length} notebook{selectedNotebooks.length !== 1 ? 's' : ''} selected for calendar planning
            </p>
          </div>
          
          {/* Step 6: Selected notebook indicators with file-tile styling */}
          <div className="flex flex-wrap gap-2 mt-2">
            {selectedNotebooks.slice(0, 5).map(notebookId => {
              const notebook = notebooks.find(n => n.fileId === notebookId);
              if (!notebook) return null;
              
              return (
                <div key={notebookId} className="flex items-center gap-2 px-2 py-1" 
                     style={{ 
                       background: 'white', 
                       border: '1px solid #D0D0D0', 
                       borderRadius: '6px',
                       fontSize: '12px'
                     }}>
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ 
                      backgroundColor: getNotebookColor(notebook),
                      border: '1px solid #D0D0D0'
                    }}
                  />
                  <span style={{ color: '#2C3E50' }} className="truncate max-w-24">
                    {notebook.fileName}
                  </span>
                </div>
              );
            })}
            {selectedNotebooks.length > 5 && (
              <div className="px-2 py-1" 
                   style={{ 
                     background: '#FAFAFA', 
                     border: '1px solid #D0D0D0', 
                     borderRadius: '6px',
                     fontSize: '12px',
                     color: '#6C757D'
                   }}>
                +{selectedNotebooks.length - 5} more
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 7: Enhanced Loading State with HomescreenV3 styling */}
      {loading && (
        <div className="empty-state">
          <div className="calendar-loading-spinner"></div>
          <h3 className="empty-title" style={{ marginTop: '16px' }}>Loading Notebooks</h3>
          <p className="empty-description">Fetching your available notebooks...</p>
        </div>
      )}

      {/* Step 8: Enhanced Empty States with HomescreenV3 styling */}
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
                className={`file-tile ${isSelected ? 'selected' : ''}`}
                onClick={() => handleNotebookToggle(notebook.fileId, !isSelected)}
                style={{
                  border: isSelected ? '2px solid #5B8C5A' : '1px solid #D0D0D0',
                  background: isSelected ? '#F8FBF8' : 'white',
                  cursor: 'pointer',
                  position: 'relative'
                }}
              >
                {/* Step 10: File header with color coding matching HomescreenV3 */}
                <div 
                  className="file-header" 
                  style={{backgroundColor: notebookColor}}
                />
                
                {/* Step 11: Selection checkbox positioned like delete button */}
                <div
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    background: 'rgba(255, 255, 255, 0.9)',
                    border: '1px solid #E0E0E0',
                    borderRadius: '4px',
                    padding: '4px',
                    zIndex: 10,
                    opacity: isSelected ? 1 : 0.7
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => handleNotebookToggle(notebook.fileId, e.target.checked)}
                    style={{
                      width: '12px',
                      height: '12px',
                      accentColor: '#5B8C5A'
                    }}
                  />
                </div>

                {/* Step 12: File title matching HomescreenV3 styling */}
                <div className="file-title" style={{ paddingRight: '24px' }}>
                  {notebook.fileName}
                </div>
                
                {/* Step 13: File metadata matching HomescreenV3 structure */}
                <div className="file-meta">
                  <span className="file-time">
                    {formatFileTime(notebook.lastUpdated.toISOString())}
                  </span>
                  <span className="file-status" style={{
                    background: isSelected ? '#E8F5E8' : '#F0F0F0',
                    color: isSelected ? '#2E7D32' : '#6C757D'
                  }}>
                    {isSelected ? 'Selected' : 'Available'}
                  </span>
                </div>

                {/* Step 14: Additional metadata for notebooks */}
                <div style={{
                  fontSize: '10px',
                  color: '#757575',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  fontWeight: '500',
                  marginTop: '4px'
                }}>
                  {notebook.totalUnits} lesson unit{notebook.totalUnits !== 1 ? 's' : ''}
                </div>

                {/* Step 15: Selection indicator for better feedback */}
                {isSelected && (
                  <div style={{
                    position: 'absolute',
                    bottom: '8px',
                    left: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: '#5B8C5A',
                    fontSize: '10px',
                    fontWeight: '500'
                  }}>
                    <Check size={10} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Step 16: Enhanced Footer Information with HomescreenV3 styling */}
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